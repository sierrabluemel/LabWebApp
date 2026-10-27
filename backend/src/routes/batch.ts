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

// department is interpolated into SQL column names, so it must be one of these
const DEPARTMENTS = ['receiving', 'testing', 'shipping'];

const LAB_NETWORKS: Array<number> = [...sillyConfig.stagingNetworks, ...sillyConfig.anyFrequencyNetworks, ...sillyConfig.commonFrequencyOnlyNetworks];

// Reform makes a gateway rebuild its sensor list, which is what the techs otherwise do by hand after sensors move.
// Failures are logged and reported, not thrown: the sensor moves that led here already happened.
function reformGateways(gateways: any[], networkIds: Iterable<number>) {
    const networks = new Set(networkIds);
    const targets = gateways.filter((gateway: any) => networks.has(gateway.NetworkID) && !gateway.GatewayType.startsWith('Wifi'));
    const failed: number[] = [];

    return Promise.all(targets.map((gateway: any) => {
        return monnitFetch(`https://www.imonnit.com/json/GatewayReform?gatewayID=${gateway.GatewayID}`)
            .catch((error) => ({ Result: String(error) }))
            .then((response) => {
                if (response.Result !== 'Success') {
                    console.error(`Unable to reform gateway ${gateway.GatewayID}: `, response);
                    failed.push(gateway.GatewayID);
                }
            })
    }))
        .then(() => ({ reformed: targets.length - failed.length, failed }));
}

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
        const active = req.query.active === 'true';

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
        const activeState = req.query.active_state === 'true';

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
    updateBatchCalibrationProcedure: (req: Request, res: Response) => {
        const batchId = parseInt(req.query.batch_id as string ?? "");
        const calibrationProcedureId = parseInt(req.query.calibration_procedure_id as string ?? "");

        if (isNaN(batchId) || isNaN(calibrationProcedureId)) {
            res.status(400).json({ error: `Invalid batch id or calibration procedure id` });
            return;
        }

        batch.setCalibrationProcedure(batchId, calibrationProcedureId)
            .then(() => {
                res.json({ 'Result': `Batch ${batchId} calibration procedure set to ${calibrationProcedureId}` });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to change calibration procedure` });
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
    getLocations: (req: Request, res: Response) => {
        batch.getLocations()
            .then((rows) => {
                res.json(rows.map((row: { location: string }) => row.location));
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to get locations` });
            })
    },
    logBatchInteraction: (req: Request, res: Response) => {
        const department = req.query.department as string;
        const start = req.query.start === 'true';
        const technicianId = req.query.technician_id;
        const batchId = parseInt(req.query.batch_id as string ?? "");

        if (!DEPARTMENTS.includes(department)) {
            return res.status(400).json({ error: `Invalid department` });
        }

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
        let department = req.query.department as string;
        let technicianId = req.query.technician_id;
        let batchId = req.query.batch_id;

        if (!DEPARTMENTS.includes(department)) {
            return res.status(400).json({ error: `Invalid department` });
        }

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
        const print = req.query.print === 'true';
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
                res.setHeader("Content-Type", "application/pdf");
                res.end(Buffer.from(finishedPdf));
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error generating work order` });
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
            return res.status(400).json({ Result: 'Heartbeat must be a number' });
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
                                console.error(`Unable to set heartbeat for sensor: ${sensorObject.sensor_id}: ${JSON.stringify(response)}`);
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
        // Heartbeat (minutes) the batch is about to run at, so the balance uses the load the sensors will actually add
        const targetHeartbeat = parseFloat(req.query.heartbeat as string ?? "");

        if (isNaN(batchId)) {
            return res.status(400).json({ error: `Invalid batch id` });
        }

        const stagingNetworks: Array<number> = sillyConfig.stagingNetworks;
        const anyFrequencyNetworks: Array<number> = sillyConfig.anyFrequencyNetworks;
        const commonFrequencyNetworks: Array<number> = [...anyFrequencyNetworks, ...sillyConfig.commonFrequencyOnlyNetworks];
        const allNetworks: Array<number> = LAB_NETWORKS;

        // Network type 9 is the common frequency, which the common-frequency-only networks can also take
        const allowedNetworks = (networkType: number) => {
            if (networkGroup !== 'testing')
                return stagingNetworks;
            return networkType === 9 ? commonFrequencyNetworks : anyFrequencyNetworks;
        }
        const heartbeatsPerSecond = (minutes: number) => 1 / (minutes * 60);

        Promise.all([
            sensor.getSensorsByBatchId(batchId),
            monnitFetch('https://www.imonnit.com/json/GatewayList'),
            monnitFetch('https://www.imonnit.com/json/SensorListFull'),
        ])
            .then(([batchSensors, gatewayResponse, sensorResponse]) => {
                const gateways = gatewayResponse.Result;
                const allSensors = sensorResponse.Result;
                const skuById = new Map(batchSensors.map((s: any) => [s.sensor_id, s.sku]));

                const load = new Map<number, number>(allNetworks.map(networkId => [networkId, 0]));
                for (const s of allSensors) {
                    if (load.has(s.CSNetID))
                        load.set(s.CSNetID, load.get(s.CSNetID)! + heartbeatsPerSecond(s.ReportInterval));
                }

                const moves: Array<{ sensor: any, networkId: number }> = [];
                for (const s of allSensors.filter((s: any) => skuById.has(s.SensorID))) {
                    // Take the sensor off its current network's load, then put it on the least loaded allowed network (staying put on a tie)
                    if (load.has(s.CSNetID))
                        load.set(s.CSNetID, load.get(s.CSNetID)! - heartbeatsPerSecond(s.ReportInterval));

                    const candidates = allowedNetworks(parseInt(String(skuById.get(s.SensorID)).split('-')[1]));
                    let networkId = candidates.includes(s.CSNetID) ? s.CSNetID : candidates[0];
                    for (const candidate of candidates) {
                        if (load.get(candidate)! < load.get(networkId)!)
                            networkId = candidate;
                    }

                    load.set(networkId, load.get(networkId)! + heartbeatsPerSecond(isNaN(targetHeartbeat) ? s.ReportInterval : targetHeartbeat));
                    if (networkId !== s.CSNetID)
                        moves.push({ sensor: s, networkId });
                }

                return Promise.all(moves.map(({ sensor: s, networkId }) => {
                    const oldGateways = gateways.filter((gateway: any) => gateway.NetworkID === s.CSNetID && !gateway.GatewayType.startsWith('Wifi'));

                    return monnitFetch(`https://www.imonnit.com/json/AssignSensor?NetworkID=${networkId}&SensorID=${s.SensorID}&CheckDigit=${s.CheckDigit}`)
                        .then((response) => {
                            if (response.Result !== 'Success')
                                return Promise.reject(`Unable to move sensor ${s.SensorID} to network ${networkId}: ${JSON.stringify(response)}`);

                            // The sensor is already on its new network here, so a failed cleanup is logged rather than failing the move
                            return Promise.all(oldGateways.map((gateway: any) => {
                                return monnitFetch(`https://www.imonnit.com/json/RemoveSensorFromGateway?gatewayID=${gateway.GatewayID}&sensorID=${s.SensorID}`)
                                    .then(response => {
                                        if (response.Result !== 'Success')
                                            console.error(`Unable to remove sensor ${s.SensorID} from gateway ${gateway.GatewayID}: `, response);
                                    })
                            }))
                        })
                }))
                    // Every gateway that gained or lost a sensor gets a reform so the techs don't have to do it by hand
                    .then(() => moves.length === 0 ? undefined : reformGateways(gateways, moves.flatMap(m => [m.sensor.CSNetID, m.networkId])))
                    .then(() => moves.length);
            })
            .then((moved) => {
                res.json({ Result: 'Success', moved });
            })
            .catch(error => {
                console.error(`Error moving sensors: ${error}`);
                res.status(500).json({ error: 'Could not move sensors to new networks' });
            })
    },

    reformGateways: (req: Request, res: Response) => {
        monnitFetch('https://www.imonnit.com/json/GatewayList')
            .then((response) => reformGateways(response.Result, LAB_NETWORKS))
            .then(({ reformed, failed }) => {
                res.json({ Result: 'Success', reformed, failed });
            })
            .catch((error) => {
                console.error(`Error reforming gateways: ${error}`);
                res.status(500).json({ error: 'Could not reform gateways' });
            })
    },

}

export default batchRoutes;