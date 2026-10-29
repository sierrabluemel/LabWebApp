import { Request, Response } from "express";
import rollingData from "../models/rollingData";
import sensor from "../models/sensor";
import equipment from "../models/equipment";

const rollingDataRoutes = {
    getOnlineSensors: (req: Request, res: Response) => {
        const orderId = req.query.order_id as any as number;
        return sensor.getSensorByOrderId(orderId)
            .then(sensors => {
                const sensorIds = sensors.map(s => s.sensor_id)

                rollingData.getOnlineSensors(sensorIds)
                    .then((result) => {
                        res.status(200).json({
                            online_sensors: result.map(sensor => parseInt(sensor.sensor_id)),
                            order_sensors: sensors.map(s => {
                                return { sensor_id: s.sensor_id, batch_id: s.batch_id, cable_id: s.cable_id }
                            })
                        })
                    })
                    .catch((err) => {
                        console.error(err);
                        res.status(500).json({ error: `Failed to get online sensors.` });
                    })
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
                        heartbeat = (thisSensorReadings[0].timestamp - thisSensorReadings[1].timestamp) / 1000

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
    getGeneratorStatuses: (req: Request, res: Response) => {
        rollingData.getGeneratorStatuses()
            .then(data => {
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch last reference readings` });
            })
    },
    createGeneratorCommand: (req: Request, res: Response) => {
        const commandType = req.query.command_type as string;
        const assetTag = req.query.asset_tag as string;
        const value = req.query.value as string;

        rollingData.createGeneratorCommand(commandType, assetTag, value)
            .then(() => {
                res.json({ result: 'Success' });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Unable to fetch last reference readings` });
            })
    },
    getLastStableReadings: async (req: Request, res: Response) => {
        const minutes = parseInt(req.query.minutes as string ?? 180);
        const setPoints = JSON.parse(req.query.set_points as string ?? "[]")
        const equipmentList: any = await equipment.getEquipment(true)
        let type: string = "temperature";

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
    getSetPointReadiness: async (req: Request, res: Response) => {
        const setPoints = JSON.parse(req.query.set_points as string ?? "[]");
        const sensorIds = (req.query.sensor_ids as unknown as any[]) ?? [];
        const equipmentList: any = await equipment.getEquipment(true);
        // shortcut: CP3/CP8 only check the humidity type, same as getLastStableReadings; upgrade if techs want temperature checked too
        const type = setPoints[0] && Object.keys(setPoints[0]).includes('humidity') ? "humidity" : "temperature";
        const now = Date.now();
        const start = new Date(now - 180 * 60000);

        Promise.all(setPoints.map(async (setPoint: any) => {
            const minutes = parseFloat(setPoint.stabilityCriteria?.minutes) || 1.5;
            const stability = await rollingData.getStableSince(start, equipmentList[`${setPoint.reference}`].asset_tag, type, setPoint[`${type}`], setPoint.stabilityCriteria);
            // Stable only if at least one reading newer than the last unstable one exists
            const hasStableRun = stability?.last_reading && (!stability.last_unstable || new Date(stability.last_reading) > new Date(stability.last_unstable));
            const stableSince = hasStableRun ? new Date(stability.last_unstable ?? start) : null;
            const stableSeconds = stableSince ? Math.floor((now - stableSince.getTime()) / 1000) : 0;
            const ready = stableSeconds >= minutes * 60;
            let sensors: any[] = [];

            if (stableSince && sensorIds.length > 0) {
                // shortcut: "covered" allows a 30 s gap at the window start, enough for the 3 s testing heartbeat; revisit if slower heartbeats are tested
                const windowStart = new Date(Math.max(stableSince.getTime(), now - minutes * 60000));
                sensors = await rollingData.getSensorsInRange(windowStart, sensorIds, type, stability.reference_average, setPoint.stabilityCriteria[`tolerance_${type}`]);
            }

            return { minutes, stable_seconds: stableSeconds, ready, sensors, reference_average: stability?.reference_average ?? null };
        }))
            .then((result) => res.json({ Result: result }))
            .catch((err) => {
                console.error(err);
                res.status(500).json({ Error: `Unable to fetch set point readiness` });
            });
    },
    getReadingRange: (req: Request, res: Response) => {
        const timestamp = new Date(req.query.timestamp as string).getTime();
        const sensorIds = req.query.sensor_ids as unknown as number[];
        let seconds = parseInt(req.query.seconds as string ?? "");

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