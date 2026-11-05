import { Request, Response } from "express";
import rollingData from "../models/rollingData";


function addSensorData(newSensorData: any[]) {
    const readingList = [] as any[];
    newSensorData.forEach(newData => {
        if (newData.dataType.indexOf('Percentage|TemperatureData|TemperatureData|MoistureWeight|TemperatureData|TemperatureData') !== -1) {
            const splitString = newData.dataValue.split('|')
            readingList.push([
                newData.messageDate,
                newData.sensorID,
                'temperature',
                parseFloat(splitString[1]),
                newData.batteryLevel,
                newData.state !== "0"
            ])
            readingList.push([
                newData.messageDate,
                newData.sensorID,
                'humidity',
                parseFloat(splitString[0]),
                newData.batteryLevel,
                newData.state !== "0"
            ])

        } else {
            readingList.push([
                newData.messageDate,
                newData.sensorID,
                'temperature',
                parseFloat(newData.dataValue),
                newData.batteryLevel,
                newData.state !== "0"
            ])
        }
    })
    rollingData.addSensorReadings(readingList)
}

const bufferRoutes = {
    webhook: (req: Request, res: Response) => {
        const sensorData = req.body.sensorMessages;
        res.status(200).send('Data receieved');
        addSensorData(sensorData);
    },
};

export default bufferRoutes;