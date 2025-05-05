import { Request, Response } from "express";
import reading from "../models/reading";

const readingRoutes = {
    getRecentReadings: (req: Request, res: Response) => {
        const sensors = req.query.sensors as string;
        const sensorIds = sensors.split(',').map(sensor => parseInt(sensor.trim()));
        const now = new Date();
        const earliestReadingDate = new Date(now.setDate(now.getDate() - 30)).toISOString();

        reading.getRecentReadingsBySensorIds(sensorIds, earliestReadingDate)
            .then((readings) => {
                res.json(readings);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch readings.` })
            });
    },
    getReadingsBySensorId: (req: Request, res: Response) => {
        const sensorId = parseInt(req.query.sensor_id as string ?? "");
        reading.getReadingsBySensorId(sensorId)
            .then((readings) => {
                res.json(readings);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch readings.` })
            });
    },
    createReading: (req: Request, res: Response) => {
        let type = req.query.type as string;
        let setPoint = parseFloat(req.query.set_point as string ?? "");
        let referenceReading = parseFloat(req.query.reference_reading as string ?? "");
        let sensorReading = parseFloat(req.query.sensor_reading as string ?? "");
        let labRh = parseFloat(req.query.lab_rh as string ?? "");
        let labTemperature = parseFloat(req.query.lab_temperature as string ?? "");
        let sensorId = parseInt(req.query.sensor_id as string ?? "");
        let generatorId = parseInt(req.query.generator_id as string ?? "");
        let referenceId = parseInt(req.query.reference_id as string ?? "");
        let uncertainty = parseFloat(req.query.uncertainty as string ?? "");
        let tolerance = parseFloat(req.query.tolerance as string ?? "");
        let standardDeviation = parseFloat(req.query.standard_deviation as string ?? "");
        let pass = false;

        if (Math.abs(referenceReading - sensorReading) < tolerance) {
            pass = true;
        }
        if (isNaN(sensorReading)) {
            sensorReading = null!;
        }
        reading.createReading(type, setPoint, referenceReading, sensorReading, labRh, labTemperature, sensorId, generatorId, referenceId, uncertainty, tolerance, pass, standardDeviation)
            .then((r) => {
                res.json(r);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error creating reading` });
            });
    },
};

export default readingRoutes;