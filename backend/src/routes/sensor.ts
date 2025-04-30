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
            .then(async (data) => {
                const certificates = removeDuplicateCertificates(data);
                const certificateInvoiceData = getCertificateInvoiceData(certificates) as any;
                const templatePath = path.join(__dirname, 'templates', 'sensorBillingReport.xlsx')
                const outputPath = path.join(__dirname, 'fileOutputs', 'sensorBillingReport.xlsx')
                let calibrationProcedures = await misc.getCalibrationProcedures();

                const workbook = new ExcelJS.Workbook();
                workbook.xlsx.readFile(templatePath)
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

                        worksheet.getCell('A20').value = 'Report for ' + [...certificateInvoiceData.customerOrderNumbers].join(', ');

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
            'NetworkID': sillyConfig.stagingNetworks[0],
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
    moveSensorsToNetworkGroup: (req: Request, res: Response) => {
        const networkGroup = req.query.network_group;
        const sensors = JSON.parse(req.query.sensors as string ?? "");

        let networkIDs = []
        switch (networkGroup) {
            case 'staging':
                networkIDs.push(...sillyConfig.stagingNetworks);
                break
            case 'testing_all_frequencies':
                networkIDs.push(...sillyConfig.anyFrequencyNetworks);
                break
            case 'testing_all_networks':
                networkIDs.push(...sillyConfig.anyFrequencyNetworks);
                networkIDs.push(...sillyConfig.commonFrequencyOnlyNetworks);
                break
            default:
                res.status(500).json({ Error: 'Invalid network group' });
                return
        }

        monnitFetch('https://www.imonnit.com/json/SensorListFull')
            .then(response => {
                let allSensors = response.Result
                for (let sensor of allSensors) {
                    // Converting minutes per heartbeat to heartbeats per second
                    sensor.heartbeatsPerSecond = 60 / (sensor.ReportInterval * 60) / 60;

                    sensors.includes(sensor.SensorID) ? sensor.moving = true : sensor.moving = false
                }

                let sensorsToMove = allSensors.filter((sensor: any) => sensor.moving === true);

                let networkHeartbeats = networkIDs.map(networkID => {
                    const sensorsOnNetwork = allSensors.filter((sensor: any) => sensor.CSNetID === networkID)
                    let heartbeatsPerSecond = 0
                    sensorsOnNetwork.map((sensor: any) => {
                        heartbeatsPerSecond += sensor.heartbeatsPerSecond
                    })
                    return {
                        networkID,
                        heartbeatsPerSecond,
                    }
                })

                let networksToAddTo = [] as any[];
                for (const sensorToMove of sensorsToMove) {
                    const currentNetwork = networkHeartbeats.filter(network => network.networkID === sensorToMove.CSNetID)[0];
                    if (networksToAddTo.length < 1) {
                        const lowestCapacity = Math.min(...networkHeartbeats.map(network => network.heartbeatsPerSecond))
                        networksToAddTo = networkHeartbeats.filter(network => {
                            return network.heartbeatsPerSecond === lowestCapacity;
                        })
                    }
                    const nextNetwork = networksToAddTo[0];
                    const sensor = allSensors.filter((sensor: any) => sensor.SensorID === sensorToMove.SensorID)[0];
                    const inCurrentNetworkGroup = networkIDs.filter(networkID => networkID === sensor.CSNetID)[0];
                    if (!inCurrentNetworkGroup || currentNetwork?.heartbeatsPerSecond > nextNetwork.heartbeatsPerSecond) {
                        // TODO add new monnit api call to move sensor whitelist
                        monnitFetch(`https://www.imonnit.com/json/AssignSensor?NetworkID=${nextNetwork.networkID}&SensorID=${sensor.SensorID}&CheckDigit=${sensor.CheckDigit}`);
                        if (currentNetwork) {
                            currentNetwork.heartbeatsPerSecond -= sensor.heartbeatsPerSecond;
                        }
                        nextNetwork.heartbeatsPerSecond += sensor.heartbeatsPerSecond
                        networksToAddTo.shift();
                    }
                }

                res.json({ Result: 'Success' })
            })
            .catch(err => {
                res.status(500).json({ Error: 'Could not move sensors' })
                console.error(`Error moving sensors: ${err}`)
            })
    },
};

export default sensorRoutes;