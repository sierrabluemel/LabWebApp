import monnitFetch from "../utils/monnit";
import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { Request, Response } from "express";
import { removeDuplicateCertificates, getCertificateInvoiceData, getDateString } from "../methods/common";
import sensor from "../models/sensor";
import certificate from "../models/certificate";
import misc from "../models/misc";
const sillyConfig = require('../../config.json');

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
            query = sensor.getSensorsByBatchId(batchId)
                .then((result) => {
                    res.json(result);
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
            .then(async (data) => {
                const certificates = removeDuplicateCertificates(data);
                let calibrationProcedures = await misc.getCalibrationProcedures();
                const certificateInvoiceData = getCertificateInvoiceData(certificates, calibrationProcedures) as any;
                const directory = path.join(__dirname, '..', '..')
                const templatePath = path.join(directory, 'templates', 'sensorBillingReport.xlsx')
                const outputPath = path.join(directory, 'fileOutputs', 'sensorBillingReport.xlsx')

                fs.mkdirSync(path.dirname(outputPath), { recursive: true }); // gitignored, missing on a fresh clone

                const workbook = new ExcelJS.Workbook();
                return workbook.xlsx.readFile(templatePath)
                    .then(() => {
                        const worksheet = workbook.getWorksheet(1)!
                        worksheet.getCell('F3').value = getDateString(startDate)
                        worksheet.getCell('F4').value = getDateString(endDate)

                        const firstRow = 8
                        let procedure3Copy = JSON.parse(JSON.stringify(calibrationProcedures[2])) // Create copy
                        procedure3Copy.calibration_procedure_id = '3_no_lead'

                        calibrationProcedures.splice(2, 0, procedure3Copy)

                        calibrationProcedures.map((calibrationProcedure, index) => {
                            worksheet.getCell(`C${firstRow + index}`).value = certificateInvoiceData[`calibration_procedure_${calibrationProcedure.calibration_procedure_id}`].passed;
                            worksheet.getCell(`D${firstRow + index}`).value = certificateInvoiceData[`calibration_procedure_${calibrationProcedure.calibration_procedure_id}`].failed;
                            worksheet.getCell(`F${firstRow + index}`).value = certificateInvoiceData[`calibration_procedure_${calibrationProcedure.calibration_procedure_id}`].expedited;
                        })

                        const orderNumbers = certificateInvoiceData?.tos;

                        worksheet.getCell('A20').value = certificateInvoiceData ? 'Report for ' + [...orderNumbers].join(', ') : '';
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
                console.error(err);
                res.status(500).json("Unable to calibrate sensor");
            })
    },
    createSensor: (req: Request, res: Response) => {
        let sensorId = parseInt(req.query.sensor_id as string ?? "");
        let checkDigit = req.query.check_digit as string;
        let batchId = parseInt(req.query.batch_id as string ?? "");
        const spare = req.query.spare === 'true';
        const manufacturer = 'Monnit Corporation';

        const parameters = {
            'NetworkID': sillyConfig.stagingNetworks[0],
            'SensorID': sensorId,
            'CheckDigit': checkDigit,
            'reportInterval': 2,
            'activeStateInterval': 2,
        } as any;
        const params = new URLSearchParams();
        for (const parameter in parameters) {
            params.append(parameter, parameters[parameter]);
        };

        monnitFetch(`https://www.imonnit.com/json/AssignSensor/?${params.toString()}`)
            .then(() => {
                return monnitFetch(`https://www.imonnit.com/json/SensorSetHeartbeat/?${params.toString()}`)
            })
            .then(() => {
                return monnitFetch(`https://www.imonnit.com/json/LookUpSensor/?${params.toString()}`)
            })
            .then(response => {
                return sensor.createSensor(sensorId, checkDigit, manufacturer, response.Result.SKU, batchId, spare)
            })
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Could not add sensor ${sensorId} in iMonnit` });
            });
    },
    changeSensorHeartbeat: (req: Request, res: Response) => {
        let sensorId = req.query.sensor_id;
        let reportInterval = parseFloat(req.query.heartbeat as string ?? "");
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
        monnitFetch(`${url}?${params.toString()}`)
            .then((data) => {
                res.json(data);
            })
            .catch((error) => {
                console.error(error);
                res.json({ 'Result': error });
            })
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
        const batchId = parseInt(req.query.batch_id as string ?? "");

        if (isNaN(sensorId) || isNaN(batchId)) {
            return res.status(400).json({ error: "Sensor id and batch id are required." });
        }

        sensor.removeFromBatch(sensorId, batchId)
            .then(() => {
                res.json({ Result: 'Sensor successfully removed from batch' });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error removing sensor from batch." })
            })
    },
    setSensorSpare: (req: Request, res: Response) => {
        const sensorId = parseInt(req.query.sensor_id as string ?? "");
        const batchId = parseInt(req.query.batch_id as string ?? "");
        const spare = req.query.spare === 'true';

        if (isNaN(sensorId) || isNaN(batchId)) {
            return res.status(400).json({ error: "Sensor id and batch id are required." });
        }

        sensor.setSpare(sensorId, batchId, spare)
            .then(() => {
                res.json({ Result: spare ? `Sensor ${sensorId} marked as spare` : `Sensor ${sensorId} added to batch ${batchId}` });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error updating sensor spare state." })
            })
    },
    removeSensor: (req: Request, res: Response) => {
        const sensorId = req.query.sensor_id;
        const checkDigit = req.query.check_digit

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
    getSensorList: (req: Request, res: Response) => {
        let url = 'https://www.imonnit.com/json/SensorList/'

        monnitFetch(url)
            .then((response) => {
                const sensorIds = response.Result.map((s: any) => s.SensorID)
                res.json(sensorIds)
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error getting sensors" })
            })
    },
    getSensorCableId: (req: Request, res: Response) => {
        const sensorId = parseInt(req.query.sensor_id as any);
        let url = `https://www.imonnit.com/json/SensorGetExtended?sensorID=${sensorId}`

        monnitFetch(url)
            .then(response => {
                const cableId = response.Result.CableID;
                if (cableId < 0)
                    return res.status(500).json({ error: "cableID returned is not valid" })

                if (!cableId)
                    return res.status(509).json({ Result: 'No cableID found from iMonnit' })

                url = `https://www.imonnit.com/json/CableLookup/?CableID=${cableId}`
                monnitFetch(url)
                    .then(result => {
                        const cableSku = result.Result.SKU
                        sensor.addCableToSensor(sensorId, cableId, cableSku)
                            .then(() => res.json({ Result: 'Cable added to sensor' }));
                    })
                    .catch((err) => {
                        console.error(err);
                        res.status(500).json({ error: "Error setting cable" })
                    })

            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error looking up sensor" })
            })
    },
    addCableToSensor: (req: Request, res: Response) => {
        const cableId = parseInt(req.query.cable_id as any);
        const sensorId = parseInt(req.query.sensor_id as any);
        let url = `https://www.imonnit.com/json/CableLookup/?CableID=${cableId}`

        monnitFetch(url)
            .then(result => {
                const cableSku = result.Result.SKU
                sensor.addCableToSensor(sensorId, cableId, cableSku)
                    .then(() => res.json({ Result: 'Cable added to sensor' }));
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error setting cable" })
            })
    },
};

export default sensorRoutes;