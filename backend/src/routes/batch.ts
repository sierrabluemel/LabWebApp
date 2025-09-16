import { Request, Response } from "express";
import { pool } from "../utils/db";
import pdf from "../utils/pdf";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import batch from "../models/batch";
import sensor from "../models/sensor";
import { parseIntNullable } from "../utils/common";
import monnitFetch from "../utils/monnit";
const sillyConfig = require('../../config.json');

const batchRoutes = {
    getBatchById: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");

        if (isNaN(batchId)) {
            res.status(400).json({ error: `Invalid batch id` });
        }

        batch.getBatchById(batchId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Unable to find batch` });
            });
    },
    getBatchesByOrderId: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");

        if (isNaN(orderId)) {
            res.status(400).json({ error: `Invalid order id` });
        }

        batch.getBatchesByOrderId(orderId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error fetching batches` });
            })
    },
    getBatches: (req: Request, res: Response) => {
        batch.getBatches()
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
            });
    },
    getBatchesByActiveState: (req: Request, res: Response) => {
        const active = eval(req.query.active as string);

        batch.getBatchesByActiveState(active)
            .then((result) => {
                res.json(result)
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error fetching batches` });
            });
    },
    createBatch: (req: Request, res: Response) => {
        let currentLocation = req.query.current_location as string;
        let orderId = parseInt(req.query.order_id as string ?? "");
        let calibrationProcedureId = parseInt(req.query.calibration_procedure_id as string ?? "");
        let receivingTechnicianId = parseIntNullable(req.query.receiving_technician_id as string ?? "");
        let testingTechnicianId = parseIntNullable(req.query.testing_technician_id as string ?? "");
        let shippingTechnicianId = parseIntNullable(req.query.shipping_technician_id as string ?? "");

        batch.createBatch(currentLocation, orderId, calibrationProcedureId, receivingTechnicianId, testingTechnicianId, shippingTechnicianId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error creating batch" });
            })
    },
    setBatchActiveState: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");
        const activeState = eval(req.query.active_state as string);

        if (isNaN(batchId)) {
            res.status(400).json({ error: `Invalid batch id` });
        }

        batch.setActiveState(batchId, activeState)
            .then(() => {
                res.json({ 'Result': `Batch ${batchId} active state set to ${activeState}` })
            })
            .catch((err) => {
                console.error(err)
                res.status(500).json({ error: "Unable to set batch state" })
            })
    },
    removeBatchLocation: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");

        if (isNaN(batchId)) {
            res.status(400).json({ error: `Invalid batch id` });
        }

        batch.setLocation(batchId, null)
            .then(() => {
                res.json({ 'Result': `Batch ${batchId} location removed` });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error removing batch location` });
            })
    },
    createLocationLog: (req: Request, res: Response) => {
        let location = req.query.location as string;
        let batchId = parseInt(req.query.batch_id as string ?? "");
        let timestamp = req.query.timestamp as string;

        if (isNaN(batchId)) {
            res.status(400).json({ error: `Invalid batch id` });
        }

        if (!timestamp) {
            timestamp = new Date().toISOString()
        }

        batch.setLocation(batchId, location)
            .then(() => {
                return batch.createLocationLog(batchId, location, timestamp);
            })
            .then((log) => {
                res.json(log);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to create location log` });
            })
    },
    logBatchInteraction: (req: Request, res: Response) => {
        const department = req.query.department;
        const start = eval(req.query.start as string);
        const technicianId = req.query.technician_id;
        const batchId = parseInt(req.query.batch_id as string ?? "");

        const timestamp = new Date().toISOString();
        const status = (start === true) ? 'start' : 'end';
        const column1 = `${department}_${status}`;
        const column2 = `${department}_${status}_technician_id`;

        batch.getBatchById(batchId)
            .then((result) => {
                let query;

                if (result) {
                    query = `UPDATE api_interaction_log SET ${column1} = $1, ${column2} = $2 WHERE batch_id = $3 RETURNING *`;
                } else {
                    query = `INSERT INTO api_interaction_log (${column1}, ${column2}, batch_id) values ($1, $2, $3) RETURNING *`;
                }

                pool.query(query, [timestamp, technicianId, batchId], (error, result) => {
                    if (error) {
                        console.error(error);
                        return res.status(500).json({ error: `Error executing query: ${error}` });
                    }
                    res.json(result.rows);
                })
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to create batch interaction log` });
            })
    },
    updateBatchTechnician: (req: Request, res: Response) => {
        let department = req.query.department;
        let technicianId = req.query.technician_id;
        let batchId = req.query.batch_id;

        const query = `UPDATE api_batch SET ${department}_technician_id = $1 WHERE batch_id = $2 RETURNING *`

        pool.query(query, [technicianId, batchId], (error, result) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: `Error executing query: ${error}` });
            }
            const updatedBatch = result.rows;
            res.json(updatedBatch);
        })
    },
    generateWorkOrder: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");
        const print = eval(req.query.print as string);
        const today = new Date()
        const hours = String(today.getHours()).padStart(2, '0');
        const minutes = String(today.getMinutes()).padStart(2, '0');
        const seconds = String(today.getSeconds()).padStart(2, '0');
        const template = 'workOrderTemplate.pdf';

        batch.getCalibrationInfo(batchId)
            .then(async (data) => {
                let sensors = await sensor.getSensorsByBatchId(batchId);

                let sensorsString;

                for (let i = 0; i < sensors.length; i++) {
                    if (i === 0) {
                        sensorsString = `${sensors[i].sensor_id}`
                    } else {
                        sensorsString = sensorsString + `, ${sensors[i].sensor_id}`
                    }
                }
                const fields = {
                    'calibrationProcedure': `${data.calibration_procedure_id}`,
                    'workOrder': `${batchId}`,
                    'date': `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`,
                    'time': `${hours}:${minutes}:${seconds}`,
                    'technician': `${data.first_name}`,
                    'totalSensors': `${sensors.length}`,
                    'sensorIdList': sensorsString,
                } as any
                const bytes = await pdf.fillForm(template, fields);

                const pdfDoc = await PDFDocument.load(bytes);
                const page = pdfDoc.getPage(0);

                // im silly :3
                let qrCode = await pdfDoc.embedPng(await QRCode.toBuffer(`${batchId}`));

                page.drawImage(qrCode, {
                    x: 130,
                    y: 590,
                    width: 110,
                    height: 110,
                })

                const finishedPdf: any = await pdfDoc.save();

                if (print) {
                    pdf.printPdf(new Blob([finishedPdf]));
                }
                res.setHeader("Content-Disposition", `attachment; filename=workOrder${batchId}.pdf`);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(Buffer.from(finishedPdf));
            })
    },
    deleteBatch: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");

        if (isNaN(batchId)) {
            res.status(400).json({ error: `Invalid batch id` });
        }

        batch.deleteLogs(batchId)
            .then(() => {
                return batch.deleteBatch(batchId);
            })
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error deleting batch` });
            })
    },
    changeBatchHeartBeats: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");
        const heartbeat = parseFloat(req.query.heartbeat as string ?? "");

        if (isNaN(heartbeat)) {
            res.status(500).json({ Result: 'Heartbeat must be a number' });
        }

        sensor.getSensorsByBatchId(batchId)
            .then((sensors) => {
                return Promise.all(sensors.map((sensorObject) => {

                    let url = `https://www.imonnit.com/json/SensorSetHeartbeat/`;
                    const parameters = {
                        SensorID: sensorObject.sensor_id,
                        reportInterval: heartbeat,
                        activeStateInterval: heartbeat,
                    } as any;
                    const params = new URLSearchParams();
                    for (const parameter in parameters) {
                        params.append(parameter, parameters[parameter]);
                    };
                    return monnitFetch(`${url}?${params.toString()}`)
                        .then((response) => {
                            if (response.Result !== 'Success') {
                                return Promise.reject(response.Result);
                            } else {
                                return response;
                            }
                        })
                }))
            })
            .then((response) => {
                res.json({ Result: 'Success' })
            })
            .catch((error) => {
                console.error(error);
                res.status(500).json({ Result: 'Unable to change heartbeats' });
            })
    },

    moveBatchToNetworkGroup: (req: Request, res: Response) => {
        const networkGroup = req.query.network_group;
        const batchId = parseInt(req.query.batch_id as string ?? "");

        const stagingNetworks: Array<number> = sillyConfig.stagingNetworks;
        const testingAllFrequencies: Array<number> = sillyConfig.anyFrequencyNetworks;
        const testingAllNetworks: Array<number> = [...sillyConfig.anyFrequencyNetworks, ...sillyConfig.commonFrequencyOnlyNetworks];
        const allNetworks: Array<number> = [...sillyConfig.stagingNetworks, ...sillyConfig.anyFrequencyNetworks, ...sillyConfig.commonFrequencyOnlyNetworks];

        sensor.getSensorsByBatchId(batchId)
            .then((sensorList) => {
                let sensorsInBatch = sensorList.map(sensor => sensor.sensor_id)

                monnitFetch('https://www.imonnit.com/json/GatewayList')
                    .then((response) => {
                        let gateways = response.Result
                        monnitFetch('https://www.imonnit.com/json/SensorListFull')
                            .then((response) => {
                                let promises: any = [];
                                let allSensors = response.Result
                                for (let sensor of allSensors) {
                                    sensor.heartbeatsPerSecond = 60 / (sensor.ReportInterval * 60) / 60; // Converting minutes per heartbeat to heartbeats per second

                                    if (sensorsInBatch.includes(sensor.SensorID)) {
                                        sensor.moving = true;
                                        const sensorSku = sensorList.filter(s => s.sensor_id === sensor.SensorID)[0].sku
                                        sensor.networkType = parseInt(sensorSku.split('-')[1]);
                                    } else {
                                        sensor.moving = false;
                                    }
                                }


                                let networkLoad = allNetworks.map(networkID => {
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

                                let sensorsToMove = allSensors.filter((sensor: any) => sensor.moving === true);

                                let networksToAddTo: Array<any> = [];
                                let networkHeartbeats = networkLoad.filter(network => stagingNetworks.includes(network.networkID));


                                for (const sensorToMove of sensorsToMove) {
                                    if (networkGroup === 'testing' && !isNaN(sensorToMove.networkType)) {
                                        if (sensorToMove.networkType === 9) {
                                            networkHeartbeats = networkLoad.filter(network => testingAllNetworks.includes(network.networkID));
                                        } else {
                                            networkHeartbeats = networkLoad.filter(network => testingAllFrequencies.includes(network.networkID));
                                        }
                                    }

                                    if (networksToAddTo.length === 0) {
                                        const lowestCapacity = Math.min(...networkHeartbeats.map(network => network.heartbeatsPerSecond))
                                        networksToAddTo = networkHeartbeats.filter(network => {
                                            return network.heartbeatsPerSecond === lowestCapacity;
                                        })
                                    }

                                    const nextNetwork = networksToAddTo[0];
                                    const sensor = allSensors.filter((sensor: any) => sensor.SensorID === sensorToMove.SensorID)[0];
                                    const currentNetwork = networkHeartbeats.filter(network => network.networkID === sensorToMove.CSNetID)[0];
                                    const networkGateways = gateways.filter((gateway: any) => gateway.NetworkID === sensorToMove.CSNetID);

                                    if (!currentNetwork || currentNetwork?.heartbeatsPerSecond > nextNetwork.heartbeatsPerSecond) {
                                        promises.push(monnitFetch(`https://www.imonnit.com/json/AssignSensor?NetworkID=${nextNetwork.networkID}&SensorID=${sensor.SensorID}&CheckDigit=${sensor.CheckDigit}`)
                                            .then((response) => {
                                                if (response.Result !== 'Success') {
                                                    Promise.reject(`Unable to move sensor ${sensor.SensorID} to new network`);
                                                    console.error(`Bad iMonnit fetch on "AssignSensor"(Sensor ID: ${sensor.SensorID}): `, response)
                                                }
                                                promises.push(networkGateways.map((gateway: any) => {
                                                    if (!gateway.GatewayType.startsWith('Wifi'))
                                                        monnitFetch(`https://www.imonnit.com/json/RemoveSensorFromGateway?gatewayID=${gateway.GatewayID}&sensorID=${sensor.SensorID}`)
                                                            .then(response => {
                                                                if (response.Result !== 'Success') {
                                                                    Promise.reject(`Unable to remove sensor ${sensor.SensorID} from gateway`);
                                                                    console.error('Bad iMonnit fetch on "RemoveSensorFromGateway": ', response)
                                                                }
                                                            })
                                                }))
                                            }))
                                        if (currentNetwork) {
                                            currentNetwork.heartbeatsPerSecond -= sensor.heartbeatsPerSecond;
                                        }
                                        nextNetwork.heartbeatsPerSecond += sensor.heartbeatsPerSecond
                                        networksToAddTo.shift();
                                    }
                                }
                                Promise.all(promises)
                                    .then(() => {
                                        res.json({ Result: 'Success' })
                                    })
                                    .catch(error => {
                                        console.error(`Error moving sensors: ${error}`);
                                        res.status(500).json({ Error: 'Could not move sensors' });
                                    })
                            })
                    })
            })
    },

}

export default batchRoutes;