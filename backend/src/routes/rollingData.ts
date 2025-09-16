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
    getLastStableReading: (req: Request, res: Response) => {
        let type = req.query.type as string ?? 'temperature';
        let reference = req.query.reference as string;
        let minutes = parseInt(req.query.minutes as string ?? 180);
        let setPoint = parseInt(req.query.set_point as string ?? "");
        let stabilityCriteria = JSON.parse(req.query.stability_criteria as string ?? "{}")

        const start = new Date(Date.now() - minutes * 60000);
        rollingData.getStableTime(start, reference, type, setPoint, stabilityCriteria)
            .then((result) => {
                let response = result
                if (result)
                    response = result.timestamp

                return res.json({ Result: response });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ Error: `Unable to fetch data` });
            })
    },
    getReadingRange: (req: Request, res: Response) => {
        let seconds = parseInt(req.query.seconds as string ?? "");
        let timestamp = new Date(req.query.timestamp as string).getTime();

        if (isNaN(seconds)) {
            seconds = 90;
        }
        const start = new Date(timestamp - (seconds * 1000));
        const end = new Date(timestamp);

        rollingData.getDataInTimeRange(start, end)
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