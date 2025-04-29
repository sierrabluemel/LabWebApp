import { Request, Response } from "express";
import { pool } from "../utils/db";
import pdf from "../utils/pdf";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import batch from "../models/batch";
import sensor from "../models/sensor";

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
        let receivingTechnicianId = parseInt(req.query.receiving_technician_id as string ?? "");
        let testingTechnicianId = parseInt(req.query.testing_technician_id as string ?? "");
        let shippingTechnicianId = parseInt(req.query.shipping_technician_id as string ?? "");

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

                if (result.rows[0]) {
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

                const finishedPdf = await pdfDoc.save();

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

}

export default batchRoutes;