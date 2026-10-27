import { Request, Response } from "express";
import { removeDuplicateCertificates } from "../methods/common";
import monnitFetch from "../utils/monnit";
import pdf from "../utils/pdf";
import PDFMerger from "pdf-merger-js";
import certificate from "../models/certificate";
import sensor from "../models/sensor";
import misc from "../models/misc";
import order from "../models/order";
import batch from "../models/batch";
import reading from "../models/reading";
import equipment from "../models/equipment";
import { parseDataBaseDate } from "../utils/db";
import calibrationProcedures from "../utils/calibrationprocedures";
const sillyConfig = require('../../config.json');

function filterReadings(readings: any[], setPoints: any[]) {
    let finalReadings = setPoints.map((setPoint) => {
        const temperatureReading = readings.find((reading) => {
            return (reading.set_point === setPoint[reading.type] && reading.type === 'temperature' && reading.as_found === setPoint.calibrate)
        })
        const humidityReading = readings.find((reading) => {
            return (reading.set_point === setPoint[reading.type] && reading.type === 'humidity' && reading.as_found === setPoint.calibrate)
        })
        if (humidityReading)
            return { temperatureReading, humidityReading }
        return { temperatureReading }
    })
    return finalReadings
}

function renderCertificate(cert: any) {
    const certificateJson = { 'CertNumber': `MNT-${cert.certificate_id}`, ...cert.generate_certificate_json };
    return pdf.fillCertificate(cert.template, certificateJson, cert.pass)
        .then((blob) => blob.arrayBuffer());
}

// Every created or edited certificate goes through here so the public PDF (and its QR code link) stays current
async function publishCertificate(cert: any) {
    const bytes = await renderCertificate(cert);
    // Dev certificate ids overlap prod ones, so uploading from dev would overwrite customer PDFs
    if (process.env.STATUS !== 'production') {
        console.log(`Skipping Azure upload of MNT-${cert.certificate_id}.pdf outside production`);
        return;
    }
    await pdf.uploadPdfToAzure(bytes, `MNT-${cert.certificate_id}.pdf`);
}

function syncImonnit(sensorId: number, cableId: number | null, calibrationDate: Date, dueDate: Date, certificateId: number) {
    const parameters = {
        'SensorID': sensorId,
        'DateCertified': calibrationDate.toISOString(),
        'CertificationExpirationDate': dueDate.toISOString(),
        'CalibrationFacilityID': 5,
        'CalibrationNumber': `MNT-${certificateId}`,
        'CableID': cableId
    } as any;
    const params = new URLSearchParams();
    for (const parameter in parameters) {
        params.append(parameter, parameters[parameter]);
    };
    return monnitFetch(`https://www.imonnit.com/json/CalibrationCertificateCreate/?${params.toString()}`);
}

const certificateRoutes = {
    getCalibrationsByMonth: (req: Request, res: Response) => {
        const startDate = new Date(req.query.start_date as string ?? "");

        let endDate = new Date(startDate.getTime());
        endDate = new Date(endDate.setMonth(endDate.getMonth() + 1));

        certificate.getCalibrationsByDateRange(startDate, endDate)
            .then((result) => {
                const data = removeDuplicateCertificates(result);
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error getting calibrations` });
            })
    },
    getCertificatesByOrderId: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");

        certificate.getCertificatesByOrderId(orderId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error getting calibrations` });
            })
    },
    printCertificateLabels: (req: Request, res: Response) => {
        const calibrationDate = req.query.calibration_date;
        const dueDate = req.query.due_date;
        const certificateNumber = req.query.certificate_number;
        const sensorId = req.query.sensor_id;
        const cableId = req.query.cable_id;
        const deviceString = cableId ? `cable_id=${cableId}` : `sensor_id=${sensorId}`
        if (process.env.STATUS === 'development') {
            res.json({ 'Result': `Failed: print disabled in test environment` });
            return;
        }
        let url = `http://localhost:4000/print-label/`;

        fetch(`${url}?calibration_date=${calibrationDate}&due_date=${dueDate}&certificate_number=${certificateNumber}&${deviceString}`)
            .then((response: any) => {
                res.json({ 'Result': JSON.stringify(response) })
            })
            .catch((error: any) => {
                console.error(error);
                res.json({ 'Result': `Failed: ${error}` })
            })
    },
    updateCertificateJson: (req: Request, res: Response) => {
        let certificateId = parseInt(req.query.certificate_id as string ?? "");
        let certificateJson: any;
        try {
            certificateJson = JSON.parse(req.query.certificate_json as string ?? "");
        } catch {
            res.status(400).json({ error: `certificate_json is not valid JSON` });
            return;
        }

        certificate.updateCertificateJson(certificateId, certificateJson, certificateJson.CS5 === 'PASS')
            .then(async (updated) => {
                await publishCertificate(updated);
                res.json(updated);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error updating certficate` });
            });
    },
    updateCertificatesJson: async (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const batchId = parseInt(req.query.batch_id as string ?? "");

        let edits: any;
        try {
            edits = JSON.parse(req.query.certificate_json as string ?? "");
        } catch {
            res.status(400).json({ error: `Certificate changes are not valid JSON` });
            return;
        }
        if (!orderId) {
            res.status(400).json({ error: `Order number is required` });
            return;
        }
        if (!edits || typeof edits !== 'object' || Array.isArray(edits) || Object.values(edits).some((v) => typeof v !== 'string')) {
            res.status(400).json({ error: `Certificate changes must be an object of text values` });
            return;
        }
        for (const dateKey of ['CS1', 'CS2']) {
            if (dateKey in edits && isNaN(new Date(edits[dateKey]).getTime())) {
                res.status(400).json({ error: `${dateKey} must be a date like 1/31/2026` });
                return;
            }
        }

        try {
            let targets = await certificate.getCertificatesByOrderId(orderId);
            if (batchId)
                targets = targets.filter((c) => c.batch_id === batchId);
            if (targets.length === 0) {
                res.status(400).json({ error: `No certificates found for order ${orderId}${batchId ? ` batch ${batchId}` : ''}` });
                return;
            }

            // Only existing fields: a key the PDF template lacks makes fillCertificate throw
            const unknownKeys = Object.keys(edits).filter((key) => targets.some((c) => !(key in c.generate_certificate_json)));
            if (unknownKeys.length > 0) {
                res.status(400).json({ error: `Unknown certificate fields: ${unknownKeys.join(', ')}` });
                return;
            }

            const datesChanged = 'CS1' in edits || 'CS2' in edits;
            // shortcut: per-row updates with no transaction, a mid-loop failure leaves earlier certificates edited; add a transaction if orders get large
            const updated = await Promise.all(targets.map(async (target) => {
                const merged = { ...target.generate_certificate_json, ...edits };
                const cert = await certificate.updateCertificateJson(target.certificate_id, merged, merged.CS5 === 'PASS');
                await publishCertificate(cert);
                if (datesChanged)
                    await syncImonnit(target.sensor_id, target.cable_id, new Date(merged.CS1), new Date(merged.CS2), cert.certificate_id);
                return cert;
            }));
            res.json(updated);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: `Error updating certificates` });
        }
    },
    generateOrderCertificates: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const print = req.query.print;

        certificate.getCertificatesByOrderId(orderId)
            .then(async (certificates) => {
                if (certificates.length == 0) {
                    return res.status(500).json({ error: `No certificates found under order id ${orderId}` });
                }

                certificates = certificates.sort((a, b) => a.certificate_id - b.certificate_id)

                let merger = new PDFMerger()
                for (const certificate of certificates) {
                    await merger.add(await renderCertificate(certificate));
                }
                const finalCertificates = await merger.saveAsBuffer();

                try {
                    if (print) {
                        pdf.printPdf(finalCertificates);
                    }
                    res.setHeader("Content-Disposition", `attachment; filename=${certificates[0].customer_order_number}Certificates.pdf`);
                    res.setHeader("Content-Type", "application/pdf");
                    res.end(Buffer.from(finalCertificates));
                } catch (error) {
                    console.error("Error occurred:", error);
                    res.status(500).json({ error: "An error occurred while processing the PDF." });
                }
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "An error occurred while processing the PDF." });
            })
    },
    createCertificates: async (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const sensorId = parseInt(req.query.sensor_id as string ?? "")

        try {
            let sensors = await sensor.getSensorByOrderId(orderId);
            if (sensorId)
                sensors = sensors.filter((s) => s.sensor_id === sensorId);

            let thisOrder = await order.getOrderById(orderId);
            let customer = await misc.getCustomerById(thisOrder.customer_id);
            let batches = await batch.getBatchesByOrderId(orderId)
            let calibrationProcedureObjects = await misc.getCalibrationProcedures()
            const equip = await equipment.getEquipment(true)

            // Pass 1 builds every payload, so a sensor without readings fails before anything is saved or sent to iMonnit
            const payloads = await Promise.all(sensors.map((s) => {
                return reading.getReadingsBySensorId(s.sensor_id, s.batch_id)
                    .then(async (readings) => {
                        if (readings.length === 0) {
                            throw new Error(`Could not find readings for sensor ${s.sensor_id}`)
                        }
                        let batch = batches.find((b) => b.batch_id == s.batch_id)
                        const calibrationProcedure = calibrationProcedureObjects.filter((p) => p.calibration_procedure_id === batch.calibration_procedure_id)[0] as any;

                        readings = filterReadings(readings, calibrationProcedure.set_points)
                        const temperatureReadings = readings.map(r => r.temperatureReading)

                        const today = new Date();
                        const date = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
                        const calibrationDate = temperatureReadings[0].timestamp;
                        let sku = s.sku;
                        let deviceId = s.sensor_id

                        if (s.cable_id) {
                            sku = s.cable_sku;
                            deviceId = s.cable_id;
                        }

                        let certificateJson = {
                            'C1': customer.name,
                            'C2': `${customer.address_line_1}, ${customer.address_line_2}`,
                            'C3': `${customer.city}, ${customer.state} ${customer.zip_code}`,
                            'D1': 'Manufacturer: Monnit Corp',
                            'D2': `Model: ${sku}`,
                            'D3': `Identifier/Serial: ${deviceId}`,
                            'D4': 'Condition: Functional',
                            'CS1': parseDataBaseDate(calibrationDate),
                            'CS3': JSON.stringify(batch.calibration_procedure_id),
                            'CS4': `${temperatureReadings[0].lab_rh}% RH @ ${temperatureReadings[0].lab_temperature}°C`,
                            'TechName': sillyConfig.certificateSignatures.technician.name,
                            'AuthName': sillyConfig.certificateSignatures.authorizer.name,
                            'Date': date,
                        }

                        // @TODO load db set points
                        let template = 'temperatureCertificate.pdf';
                        let cpJson: any;

                        switch (batch.calibration_procedure_id) {
                            case 1:
                                cpJson = calibrationProcedures.cp1(temperatureReadings, equip)
                                break;
                            case 2:
                                cpJson = calibrationProcedures.cp2(temperatureReadings, equip)
                                break;
                            case 3:
                                template = 'humidityCertificate.pdf'
                                cpJson = calibrationProcedures.cp3(readings, equip)
                                break;
                            case 4:
                                cpJson = calibrationProcedures.cp4(temperatureReadings, equip)
                                break;
                            case 5:
                                cpJson = calibrationProcedures.cp5(temperatureReadings, equip)
                                break;
                            case 6:
                                cpJson = calibrationProcedures.cp6(temperatureReadings, equip)
                                break;
                            case 7:
                                template = 'temperature8SetPoints1Reference.pdf'
                                cpJson = calibrationProcedures.cp7(temperatureReadings, equip)
                                break;
                            case 8:
                                template = 'temperature8SetPoints1Reference.pdf'
                                cpJson = calibrationProcedures.cp8(readings, equip)
                                break;
                            default:
                                throw new Error("Invalid calibration procedure")
                        }


                        let { dueDate } = { ...cpJson };
                        const pass = cpJson.CS5 === 'PASS'

                        delete cpJson.dueDate;
                        return { s, certificateJson: { ...certificateJson, ...cpJson }, template, pass, calibrationDate, dueDate }
                    })
            }))

            const certificates = await Promise.all(payloads.map(async (p) => {
                const cert = await certificate.createCertificate(p.certificateJson, p.template, p.s.sensor_id, p.pass, p.s.batch_id, p.s.cable_id ?? null, p.s.cable_sku ?? null)
                await publishCertificate(cert)
                await syncImonnit(p.s.sensor_id, p.s.cable_id, p.calibrationDate, p.dueDate, cert.certificate_id)
                return cert
            }))
            res.status(200).json(certificates);

        } catch (err) {
            console.error(err);

            if (err instanceof TypeError)
                res.status(500).json({ error: `Not enough readings to generate certificate` })
            else
                res.status(500).json({ error: `Error creating sensor certificates` })
        }
    },
};

export default certificateRoutes;