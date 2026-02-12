import { Request, Response } from "express";
import rollingData from "../models/rollingData";

// Sensor data buffer
let currentSensorData = [] as any[];

function addSensorData(newSensorData: any[], currentSensorData: any[], minutes = 10) {
    const now = new Date();
    const dataExpirationTime = 1000 * 60 * minutes // Milliseconds * seconds * minutes = 10 minute expiration
    const readingList = [];
    sensorData:
    for (const newData of newSensorData) {
        const newDataDate = new Date(newData.messageDate + ' UTC');
        const timeDifference = Math.abs(now.getTime() - newDataDate.getTime());
        if (timeDifference > dataExpirationTime) {
            continue;
        }
        for (let i = 0; i < currentSensorData.length; i++) {
            if (newData.sensorID === currentSensorData[i].sensorID) {
                if (newDataDate.getTime() - new Date(currentSensorData[i].messageDate + ' UTC').getTime() < 0) {
                    continue sensorData; // Reject messages that are older than the current message
                }
                currentSensorData.splice(i, 1);
            }
        }
        const finalData = {
            sensorID: newData.sensorID,
            dataType: newData.dataType,
            dataValue: newData.dataValue,
            messageDate: newData.messageDate,
            batteryLevel: newData.batteryLevel,
        }
        currentSensorData.push(finalData);

        const splitString = newData.dataValue

        if (newData.dataType.indexOf('Percentage|TemperatureData|TemperatureData|MoistureWeight|TemperatureData|TemperatureData') !== -1) {
            readingList.push([
                newData.messageDate,
                newData.sensorID,
                'temperature',
                parseFloat(splitString[1]),
                newData.batteryLevel
            ])
            readingList.push([
                newData.messageDate,
                newData.sensorID,
                'humidity',
                parseFloat(splitString[0]),
                newData.batteryLevel
            ])

        } else {
            readingList.push([
                newData.messageDate,
                newData.sensorID,
                'temperature',
                parseFloat(splitString[0]),
                newData.batteryLevel
            ])
        }
    }
    rollingData.addSensorReadings(readingList)
    return currentSensorData;
}

const bufferRoutes = {
    webhook: (req: Request, res: Response) => {
        const sensorData = req.body.sensorMessages;
        res.status(200).send('Data receieved');
        currentSensorData = addSensorData(sensorData, currentSensorData);
    },
    getSensorData: (req: Request, res: Response) => {
        res.json(currentSensorData).status(200);
        currentSensorData = [];
    }
};

export default bufferRoutes;