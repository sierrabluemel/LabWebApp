import { Request, Response } from "express";
import rollingData from "../models/rollingData";

const rollingDataRoutes = {
    getOnlineSensors: (req: Request, res: Response) => {
        rollingData.getOnlineSensors()
            .then((result) => {
                res.status(200).json(result.monnit_sensor_data.map((s: any) => parseInt(s.sensorID)))
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Failed to get online sensors.` });
            })
    },
    getRecentData: (req: Request, res: Response) => {
        rollingData.getRecentData()
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch recent data` });
            })
    },
    getBulkData: (req: Request, res: Response) => {
        let minutes = parseInt(req.query.minutes as string ?? "");

        if (isNaN(minutes)) {
            minutes = 10;
        }

        const start = new Date(Date.now() - minutes * 60000);

        rollingData.getDataSinceTime(start)
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch data` });
            })
    },
    getLastHumidityStableReading: (req: Request, res: Response) => {
        let type = req.query.type as string;
        let reference = req.query.reference as string;
        let minutes = parseInt(req.query.minutes as string ?? "");
        let setPoint = parseInt(req.query.set_point as string ?? "");

        if (!type) {
            type = 'humidity'
        }
        if (isNaN(minutes)) {
            minutes = 180;
        }
        const start = new Date(Date.now() - minutes * 60000);

        rollingData.getDataSinceTime(start)
            .then((result) => {
                let data = [];
                for (const row of result) {
                    if (row.rotronic_data[reference]) {
                        data.push([row.rotronic_data[reference]['stability_data'][type], row['timestamp']])
                    }
                }
                for (const row of data) {
                    if (row[0].stable) {
                        if (!isNaN(setPoint)) {
                            if (row[0].assumed_set_point === setPoint) {
                                res.json(row);
                                return;
                            }
                        } else {
                            res.json(row);
                            return;
                        }
                    }
                }
                res.json({ 'Result': `Unable to find stable data for set point ${setPoint}` });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch data` });
            })
    },
    getLastTemperatureStableReading: (req: Request, res: Response) => {
        let reference = req.query.reference as string;
        let minutes = parseInt(req.query.minutes as string ?? "");
        let setPoint = parseInt(req.query.set_point as string ?? "");
        let stabilityCriteria = JSON.parse(req.query.stability_criteria as string ?? "")
        if (isNaN(minutes)) {
            minutes = 180;
        }
        const start = new Date(Date.now() - minutes * 60000);

        rollingData.getDataSinceTime(start)
            .then((result) => {
                for (const row of result) {
                    const reference_data = row.super_daq_data[reference];
                    if (reference_data && 'stability_data' in reference_data) {
                        const stabilityData = reference_data.stability_data;
                        if (stabilityData.slope < stabilityCriteria.slope && stabilityData.standard_deviation < stabilityCriteria.standardDeviation && Math.abs(stabilityData.assumed_set_point - stabilityData.average) < stabilityCriteria.difference && stabilityData.assumed_set_point === setPoint) {
                            return res.json([stabilityData, row.timestamp]);
                        }
                    }
                }
                res.json({ 'Result': `Unable to find stable data for set point ${setPoint}` });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch data` });
            })
    },
    getHumidityReadingRange: (req: Request, res: Response) => {
        let seconds = parseInt(req.query.seconds as string ?? "");
        let timestamp = new Date(req.query.timestamp as string).getTime();

        if (isNaN(seconds)) {
            seconds = 30;
        }
        const start = new Date(timestamp - (seconds * 1000));
        const end = new Date(start.getTime() - (seconds * 1000));

        rollingData.getHumidityDataInTimeRange(start, end)
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch data` });
            })
    },
    getTemperatureReadingRange: (req: Request, res: Response) => {
        let seconds = parseInt(req.query.seconds as string ?? "");
        let timestamp = new Date(req.query.timestamp as string).getTime();

        if (isNaN(seconds)) {
            seconds = 90;
        }
        const start = new Date(timestamp - (seconds * 1000));
        const end = new Date(timestamp);

        rollingData.getTemperatureDataInTimeRange(start, end)
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch data` });
            })
    },
};

export default rollingDataRoutes;