import { Request, Response } from "express";
import { removeDuplicateCertificates } from "../methods/common";
import monnitFetch from "../utils/monnit";
import pdf from "../utils/pdf";
import PDFMerger from "pdf-merger-js";
import fs from 'fs';
import certificate from "../models/certificate";
import sensor from "../models/sensor";
import misc from "../models/misc";
import order from "../models/order";
import batch from "../models/batch";
import reading from "../models/reading";
import equipment from "../models/equipment";
import { parseDataBaseDate } from "../utils/db";
import calibrationProcedures from "../utils/calibrationprocedures";

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
        let certificateJson = req.query.certificate_json;

        certificate.updateCertificateJson(certificateId, certificateJson)
            .then((certificate) => {
                res.json(certificate);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error updating certficate` });
            });
    },
    generateCertificate: (req: Request, res: Response) => {
        let certificateId = parseInt(req.query.certificate_id as string ?? "");

        certificate.getCertficateById(certificateId)
            .then(async (certificate) => {
                const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };

                const bytes = await (await pdf.fillCertificate(certificate.template, certificateJson)).arrayBuffer();
                res.setHeader("Content-Disposition", `attachment; filename=MNT-${certificateId}.pdf`);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(Buffer.from(bytes));
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "An error occurred while processing the PDF." });
            })

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
                    const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };
                    const bytes = await pdf.fillCertificate(certificate.template, certificateJson, certificate.pass);

                    if (process.env.STATUS === 'production') {
                        pdf.uploadPdfToAzure(await bytes.arrayBuffer(), `MNT-${certificate.certificate_id}.pdf`)
                            .catch((err: any) => {
                                console.error("Error uploading PDF:", err);
                                throw Error("Error uploading PDF: " + err)
                            });
                    }

                    fs.writeFileSync('fileOutputs/certificate.pdf', await bytes.bytes());
                    await merger.add('fileOutputs/certificate.pdf');
                }
                const finalCertificates = await merger.saveAsBuffer();

                try {
                    if (print) {
                        pdf.printPdf(finalCertificates);
                    }
                    res.setHeader("Content-Disposition", `attachment; filename=${certificates[0].customer_order_number}Certificates.pdf`);
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
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
            let sensors;
            if (!sensorId)
                sensors = await sensor.getSensorByOrderId(orderId);
            else
                sensors = await sensor.getSensorById(sensorId);

            let thisOrder = await order.getOrderById(orderId);
            let customer = await misc.getCustomerById(thisOrder.customer_id);
            let batches = await batch.getBatchesByOrderId(orderId)
            let calibrationProcedureObjects = await misc.getCalibrationProcedures()
            const equip = await equipment.getEquipment(true)

            let certificates = await Promise.all(sensors.map((s) => {
                return reading.getReadingsBySensorId(s.sensor_id)
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
                            'TechName': 'Ross Schow',
                            'AuthName': 'Kelly S Lewis',
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


                        let sensorId = s.sensor_id;


                        let { dueDate } = { ...cpJson };
                        const pass = cpJson.CS5 === 'PASS'

                        delete cpJson.dueDate;
                        let cert = await certificate.createCertificate({ ...certificateJson, ...cpJson }, template, sensorId, pass)


                        let url = `https://www.imonnit.com/json/CalibrationCertificateCreate/`;
                        const parameters = {
                            'SensorID': sensorId,
                            'DateCertified': calibrationDate.toISOString(),
                            'CertificationExpirationDate': dueDate.toISOString(),
                            'CalibrationFacilityID': 5,
                            'CalibrationNumber': `MNT-${cert.certificate_id}`,
                            'CableID': s.cable_id
                        } as any;
                        const params = new URLSearchParams();
                        for (const parameter in parameters) {
                            params.append(parameter, parameters[parameter]);
                        };
                        return monnitFetch(`${url}?${params.toString()}`)
                            .then(() => {
                                return cert
                            })
                    })
            }))
            res.status(200).json(certificates);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: `Error creating sensor certificates` })
            return Promise.reject({ error: `Error creating sensor certificates` })
        }
    },
};

export default certificateRoutes;