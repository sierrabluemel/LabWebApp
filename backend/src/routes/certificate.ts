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
import { addMonths } from "date-fns";
import { EXPIRE_AFTER_25_MONTHS } from "../constants";
import calibrationProcedures from "../utils/calibrationprocedures";

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
        if (process.env.STATUS === 'development') {
            res.json({ 'Result': `Failed: print disabled in test environment` });
            return;
        }
        let url = `http://localhost:4000/print-label/`;

        fetch(`${url}?calibration_date=${calibrationDate}&due_date=${dueDate}&certificate_number=${certificateNumber}&sensor_id=${sensorId}`)
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
        const upload = req.query.upload;
        const print = req.query.print;

        certificate.getCertficateById(certificateId)
            .then(async (certificate) => {
                const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };

                const bytes = await pdf.fillCertificate(certificate.template, certificateJson);
                if (upload && process.env.STATUS === 'production') {
                    pdf.uploadPdfToAzure(bytes, `MNT-${certificate.certificate_id}.pdf`)
                        .catch((err: any) => {
                            console.error("Error uploading PDF:", err);
                            res.status(500).json({ error: "Error uploading PDF" })
                        });
                }
                if (print) {
                    pdf.printPdf(bytes);
                }
                res.setHeader("Content-Disposition", `attachment; filename=MNT-${certificateId}.pdf`);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(Buffer.from(await bytes.bytes()));
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
                    return res.status(404).json({ error: `No certificates found under order id ${orderId}` });
                }

                let merger = new PDFMerger()
                for (const certificate of certificates) {
                    const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };
                    const bytes = await pdf.fillCertificate(certificate.template, certificateJson);
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
    createCertificate: async (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");

        try {
            let sensors = await sensor.getSensorByOrderId(orderId);
            let thisOrder = await order.getOrderById(orderId);
            let customer = await misc.getCustomerById(thisOrder.customer_id);
            let batches = await batch.getBatchesByOrderId(orderId)
            let equip = await equipment.getEquipment();
            let certificates = await Promise.all(sensors.map((s) => {
                return reading.getReadingsBySensorId(s.sensor_id)
                    .then((readings) => {
                        if (readings.length === 0) {
                            throw new Error(`Could not find readings for sensor ${s.sensor_id}`)
                        }
                        let batch = batches.find((b) => b.batch_id == s.batch_id)
                        const today = new Date();
                        const date = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
                        const calibrationDate = readings[0].timestamp;

                        let certificateJson = {
                            'C1': customer.name,
                            'C2': `${customer.address_line_1}, ${customer.address_line_2}`,
                            'C3': `${customer.city}, ${customer.state} ${customer.zip_code}`,
                            'D1': 'Manufacturer: Monnit Corp',
                            'D2': `Model: ${s.sku}`,
                            'D3': `Identifier/Serial: ${s.sensor_id}`,
                            'D4': 'Condition: Functional',
                            'CS1': parseDataBaseDate(calibrationDate),
                            'CS3': JSON.stringify(batch.calibration_procedure_id),
                            'CS4': `${readings[0].lab_rh}% RH @ ${readings[0].lab_temperature}°C`,
                            'TechName': 'Colton Robinson',
                            'AuthName': 'Kelly S Lewis',
                            'Date': date,
                        }

                        // @TODO load db set points
                        let template = 'temperatureCertificate.pdf';
                        let cpJson: any;

                        switch (batch.calibration_procedure_id) {
                            case 1:
                                cpJson = calibrationProcedures.cp1(readings, equip)
                                break;
                            case 2:
                                cpJson = calibrationProcedures.cp2(readings, equip)
                                break;
                            case 3:
                                cpJson = calibrationProcedures.cp3(readings, equip)
                                break;
                            case 4:
                                cpJson = calibrationProcedures.cp4(readings, equip)
                                break;
                            case 5:
                                cpJson = calibrationProcedures.cp5(readings, equip)
                                break;
                            case 6:
                                cpJson = calibrationProcedures.cp6(readings, equip)
                                break;
                            case 7:
                                template = 'temperature8SetPoints1Reference.pdf'
                                cpJson = calibrationProcedures.cp7(readings, equip)
                                break;
                            case 8:
                                template = 'temperature8SetPoints1Reference.pdf'
                                cpJson = calibrationProcedures.cp8(readings, equip)
                                break;
                            default:
                                throw new Error("Invalid calibration procedure")
                        }
                        return { template, ...certificateJson, ...cpJson };
                    })
                    .then(async (certificateJson) => {
                        let sensorId = s.sensor_id;
                        let { template, calibrationDate, dueDate } = certificateJson;

                        delete certificateJson.template;
                        delete certificateJson.calibrationDate;
                        delete certificateJson.dueDate;

                        let cert = await certificate.createCertificate(certificateJson, template, sensorId)
                        let url = `https://www.imonnit.com/json/CalibrationCertificateCreate/`;
                        const parameters = {
                            'SensorID': sensorId,
                            'DateCertified': calibrationDate,
                            'CertificationExpirationDate': dueDate,
                            'CalibrationFacilityID': 5,
                            'CalibrationNumber': `MNT-${cert.certificate_id}`,
                        } as any;
                        const params = new URLSearchParams();
                        for (const parameter in parameters) {
                            params.append(parameter, parameters[parameter]);
                        };
                        await monnitFetch(`${url}?${params.toString()}`)
                        return cert
                    })
            }))
            await Promise.all(sensors.map((s) => {
                const sensorId = s.sensor_id;
                const checkDigit = s.check_digit

                let url = 'https://www.imonnit.com/json/SensorSetHeartbeat/'
                const parameters = {
                    'SensorID': sensorId,
                    'CheckDigit': checkDigit,
                    'reportInterval': 120,
                    'activeStateInterval': 120,
                } as any;

                const params = new URLSearchParams();
                for (const parameter in parameters) {
                    params.append(parameter, parameters[parameter]);
                };
                return monnitFetch(`${url}?${params.toString()}`)
                    .then(() => {
                        url = `https://www.imonnit.com/json/RemoveSensor/`;
                        return monnitFetch(`${url}?${params.toString()}`)
                    })
                    .then((response) => {
                        res.json(response)
                    })
                    .catch((err) => {
                        console.error(err);
                        res.status(500).json({ error: "Error removing sensor." })
                    })
            }));
            res.json(certificates);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: `Error creating certificate` });
        }
    },
};

export default certificateRoutes;