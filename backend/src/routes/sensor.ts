import monnitFetch from "../utils/monnit";
import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { Request, Response } from "express";
import { removeDuplicateCertificates, getCertificateInvoiceData, getDateString } from "../methods/common";
import sensor from "../models/sensor";
import certificate from "../models/certificate";

const sensorRoutes = {
    getSensors: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");
        let query;

        if (!batchId) {
            query = sensor.getSensors()
                .then((result) => {
                    res.json(result);
                })
        } else {
            query = sensor.getSensorById(batchId)
                .then((result) => {
                    res.json([result]);
                })
        }
        query
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to get sensors.` });
            })
    },
    getActiveSensors: (req: Request, res: Response) => {
        sensor.getActiveSensors()
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error getting active sensors` });
            })
    },
    getSensorInvoiceReport: (req: Request, res: Response) => {
        const startDate = new Date(new Date(req.query.start_date as string ?? "").toDateString());
        const endDate = new Date(new Date(req.query.end_date as string ?? "").setHours(23, 59, 59, 999));

        certificate.invoiceReport(startDate, endDate)
            .then((data) => {
                const certificates = removeDuplicateCertificates(data);
                const certificateInvoiceData = getCertificateInvoiceData(certificates) as any;
                const templatePath = path.join(__dirname, 'templates', 'sensorBillingReport.xlsx')
                const outputPath = path.join(__dirname, 'fileOutputs', 'sensorBillingReport.xlsx')

                const workbook = new ExcelJS.Workbook();
                workbook.xlsx.readFile(templatePath)
                    .then(() => {
                        const worksheet = workbook.getWorksheet(1)!
                        worksheet.getCell('F3').value = getDateString(startDate)
                        worksheet.getCell('F4').value = getDateString(endDate)

                        worksheet.getCell('C8').value = certificateInvoiceData.calibration_procedure_1.passed;
                        worksheet.getCell('D8').value = certificateInvoiceData.calibration_procedure_1.failed;
                        worksheet.getCell('F8').value = certificateInvoiceData.calibration_procedure_1.expedited;

                        worksheet.getCell('C9').value = certificateInvoiceData.calibration_procedure_2.passed;
                        worksheet.getCell('D9').value = certificateInvoiceData.calibration_procedure_2.failed;
                        worksheet.getCell('F9').value = certificateInvoiceData.calibration_procedure_2.expedited;

                        worksheet.getCell('C10').value = certificateInvoiceData.calibration_procedure_3.passed;
                        worksheet.getCell('D10').value = certificateInvoiceData.calibration_procedure_3.failed;
                        worksheet.getCell('F10').value = certificateInvoiceData.calibration_procedure_3.expedited;

                        worksheet.getCell('C11').value = certificateInvoiceData.calibration_procedure_3_no_lead.passed;
                        worksheet.getCell('D11').value = certificateInvoiceData.calibration_procedure_3_no_lead.failed;
                        worksheet.getCell('F11').value = certificateInvoiceData.calibration_procedure_3_no_lead.expedited;

                        worksheet.getCell('C12').value = certificateInvoiceData.calibration_procedure_4.passed;
                        worksheet.getCell('D12').value = certificateInvoiceData.calibration_procedure_4.failed;
                        worksheet.getCell('F12').value = certificateInvoiceData.calibration_procedure_4.expedited;

                        worksheet.getCell('C13').value = certificateInvoiceData.calibration_procedure_5.passed;
                        worksheet.getCell('D13').value = certificateInvoiceData.calibration_procedure_5.failed;
                        worksheet.getCell('F13').value = certificateInvoiceData.calibration_procedure_5.expedited;

                        worksheet.getCell('C14').value = certificateInvoiceData.calibration_procedure_6.passed;
                        worksheet.getCell('D14').value = certificateInvoiceData.calibration_procedure_6.failed;
                        worksheet.getCell('F14').value = certificateInvoiceData.calibration_procedure_6.expedited;

                        worksheet.getCell('A18').value = 'Report for ' + [...certificateInvoiceData.tos].join(', ')

                        return workbook.xlsx.writeFile(outputPath);
                    })
                    .then(() => {
                        res.download(outputPath, 'sensorBillingReport.xlsx', error => {
                            if (error) {
                                console.error('Error sending file: ', error)
                            }
                            fs.unlink(outputPath, error => {
                                if (error) {
                                    console.error('Error deleting file: ', error)
                                }
                            })
                        })
                    })
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to get sensor invoice report` });
            })
    },
    calibrateSensor: (req: Request, res: Response) => {
        let sensorId = req.query.sensor_id as string;
        let targetReading = parseFloat(req.query.target_reading as string ?? "");
        let url = `https://www.imonnit.com/json/SensorGetCalibration/`;

        let params = new URLSearchParams();
        params.append("SensorID", sensorId);

        monnitFetch(`${url}?${params.toString()}`)
            .then((result) => {
                url = `https://www.imonnit.com/json/SensorSetCalibration/`;

                let parameters = result.Result;
                parameters.Calibration1 = Math.round(targetReading * 10);
                parameters.PushAutoCalibrateCommand = true;
                parameters.PushProfileConfig1 = false;
                parameters.PushProfileConfig2 = false;

                params = new URLSearchParams();
                for (const parameter in parameters) {
                    params.append(parameter, parameters[parameter]);
                };

                return monnitFetch(`${url}?${params.toString()}`);
            })
            .then((response) => {
                res.json(response);
            })
            .catch((err) => {
                console.log(err);
                res.status(500).json("Unable to calibrate sensor");
            })
    },
    createSensor: (req: Request, res: Response) => {
        let sensorId = parseInt(req.query.sensor_id as string ?? "");
        let checkDigit = req.query.check_digit as string;
        let batchId = parseInt(req.query.batch_id as string ?? "");
        let sku: string;
        const manufacturer = 'Monnit Corporation';
        let url = `https://www.imonnit.com/json/AssignSensor/`;

        const parameters = {
            'NetworkID': 94464,
            'SensorID': sensorId,
            'CheckDigit': checkDigit,
            'reportInterval': 1,
            'activeStateInterval': 1,
        } as any;
        const params = new URLSearchParams();
        for (const parameter in parameters) {
            params.append(parameter, parameters[parameter]);
        };

        monnitFetch(`${url}?${params.toString()}`)
            .then(() => {
                url = 'https://www.imonnit.com/json/SensorSetHeartbeat/'
                return monnitFetch(`${url}?${params.toString()}`)
            })
            .then(() => {
                url = 'https://www.imonnit.com/json/LookUpSensor/'
                return monnitFetch(`${url}?${params.toString()}`)
            })
            .then((response) => {
                sku = response['Result']['SKU'];
                return sensor.createSensor(sensorId, checkDigit, manufacturer, sku, batchId)
            })
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                if (err.message == `duplicate key value violates unique constraint "sensor_pkey"`) {
                    sensor.setBatchId(sensorId, batchId)
                        .then((result) => {
                            res.json([result]);
                        })
                        .catch((err) => {
                            console.error(err);
                            res.status(500).json({ error: `Error creating sensor` });
                        })
                } else {
                    console.error(err);
                    res.json({ error: `Error creating sensor` });
                }
            });
    },
    changeSensorHeartbeat: (req: Request, res: Response) => {
        let sensorId = req.query.sensor_id;
        let reportInterval = parseInt(req.query.heartbeat as string ?? "");
        if (isNaN(reportInterval)) {
            res.json({ Result: 'Heartbeat must be a number' })
            return
        }

        let url = `https://www.imonnit.com/json/SensorSetHeartbeat/`;
        const parameters = {
            'SensorID': sensorId,
            'reportInterval': reportInterval,
            'activeStateInterval': reportInterval,
        } as any;
        const params = new URLSearchParams();
        for (const parameter in parameters) {
            params.append(parameter, parameters[parameter]);
        };
        try {
            const data = monnitFetch(`${url}?${params.toString()}`);
            res.json(data);
        } catch (error) {
            console.error(error);
            res.json({ 'Result': error });
        }
    },
    getSensorsByOrderId: async (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        sensor.getSensorByOrderId(orderId)
            .then((sensors) => {
                res.json(sensors);
            })
    },
    getSensorsByBatchId: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");

        sensor.getSensorsByBatchId(batchId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error getting sensors" })
            });
    },
    removeSensorFromBatch: (req: Request, res: Response) => {
        const sensorId = parseInt(req.query.sensor_id as string ?? "");

        sensor.removeFromBatch(sensorId)
            .then(() => {
                res.json({ Result: 'Sensor successfully removed from batch' });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error removing sensor from batch." })
            })
    },
    removeSensor: (req: Request, res: Response) => {
        const sensorId = req.query.sensor_id;
        const checkDigit = req.query.check_digit

        let url = 'https://www.imonnit.com/json/SensorSetHeartbeat/'
        const parameters = {
            'NetworkID': 94464,
            'SensorID': sensorId,
            'CheckDigit': checkDigit,
            'reportInterval': 120,
            'activeStateInterval': 120,
        } as any;

        const params = new URLSearchParams();
        for (const parameter in parameters) {
            params.append(parameter, parameters[parameter]);
        };

        monnitFetch(`${url}?${params.toString()}`)
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
    },
};

export default sensorRoutes;