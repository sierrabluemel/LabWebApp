import { Request, Response } from "express";
import rollingData from "../models/rollingData";
import equipment from "../models/equipment";

const rollingDataRoutes = {
    getOnlineSensors: (req: Request, res: Response) => {
        const sensorIds = req.query.sensor_ids as unknown as number[];

        rollingData.getOnlineSensors(sensorIds)
            .then((result) => {
                res.status(200).json(result.map(sensor => parseInt(sensor.sensor_id)))
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
    getLastSensorReadings: (req: Request, res: Response) => {
        const sensorIds = req.query.sensor_ids as unknown as number[];

        rollingData.getLastSensorReadings(sensorIds)
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch recent data` });
            })
    },
    getSensorHeartbeats: (req: Request, res: Response) => {
        const sensorIds = req.query.sensor_ids as unknown as number[];

        rollingData.getLastTwoSensorReadings(sensorIds)
            .then(readings => {
                const sensorIds = new Set(readings.map(s => s.sensor_id))
                const heartBeats = [...sensorIds].map(sensorId => {
                    const thisSensorReadings = readings.filter(r => r.sensor_id === sensorId && r.type === 'temperature')
                    let heartbeat = null;
                    if (thisSensorReadings.length === 2)
                        heartbeat = (thisSensorReadings[0].timestamp - thisSensorReadings[1].timestamp)/1000

                    return {
                        sensor_id: parseInt(sensorId), 
                        heartbeat
                    }
                })
                res.json(heartBeats);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch recent data` });
            })
    },
    getLastReferenceReadings: (req: Request, res: Response) => {
        rollingData.getLastReferenceReadings()
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch last reference readings` });
            })
    },
    getLastStableReadings: async (req: Request, res: Response) => {
        let minutes = parseInt(req.query.minutes as string ?? 180);
        let setPoints = JSON.parse(req.query.set_points as string ?? "[]")
        let type: string = "temperature";
        const equipmentList: any = await equipment.getEquipment(true)

        if (Object.keys(setPoints[0]).includes('humidity'))
            type = "humidity"

        const start = new Date(Date.now() - minutes * 60000);
        Promise.all(setPoints.map(async (setPoint: any) => {
            return rollingData.getStableTime(start, equipmentList[`${setPoint.reference}`].asset_tag, setPoint[`${type}`], setPoint.stabilityCriteria)
            .then((result) => result?.timestamp)
        }))
            .then((result) => {
                return res.json({ Result: result });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ Error: `Unable to fetch data` });
            })

    },
    getReadingRange: (req: Request, res: Response) => {
        let seconds = parseInt(req.query.seconds as string ?? "");
        let timestamp = new Date(req.query.timestamp as string).getTime();
        const sensorIds = req.query.sensor_ids as unknown as number[];

        if (isNaN(seconds)) {
            seconds = 90;
        }
        const start = new Date(timestamp - (seconds * 1000));
        const end = new Date(timestamp);

        rollingData.getDataInTimeRange(start, end, sensorIds)
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