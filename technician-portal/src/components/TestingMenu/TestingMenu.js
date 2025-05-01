import { useState, useRef, useEffect } from "react";
import styles from "../../styles/styles.module.css";
import callApi from "../../utils/api/callApi";
import { round, average, standardDeviation } from "../../utils/customMath.js";
import StableTimeDisplay from "../StableTimeDisplay/StableTimeDisplay";
import { useAppContext } from "../../contexts/app";
import Button from "../Button/Button.js";
import getReferences from "../../utils/getReferences.js";

function TestingMenu({ setPoints, referenceStrings, referencesToVerify, setReferencesToVerify }) {
    const {
        procedureId: calibrationProcedureId, sensorGrid,
        sensorList, setSensorGrid, setPopupMessage, equipment
    } = useAppContext()

    const [stableTimes, setStableTimes] = useState(setPoints.map(() => 'Loading...'));

    const [loadingMessage, setLoadingMessage] = useState('Loading...');
    const refreshed = useRef(false);
    const selectedSensor = useRef(null);

    const selectSensor = async (sensorId) => {
        if (selectedSensor.current === sensorId) {
            selectedSensor.current = null;
            await refresh(null)
        } else {
            selectedSensor.current = sensorId;
            await refresh(sensorId)
        }
    }

    const updateSensors = async (sensorList, setSensorGrid, calibrationProcedureId, allReadings, selectedSensor, recentReadings) => {
        let tempReferenceReadings = {};

        if (!setPoints) {
            return;
        }

        try {
            const newSensorGrid = [];
            let currentReadingCell = (<div className={styles.grid_entry}></div>);
            let elementClass = styles.grid_row;
            for (let i = 0; i < sensorList.length; i++) {
                let sensorReadings = [];
                const sensorStyles = [];
                const sensor = sensorList[i % sensorList.length];
                const readings = allReadings[i];
                let style = '';
                const thisMessage = recentReadings.monnit_sensor_data.filter(sensorReading => sensorReading.sensorID === `${sensor.sensor_id}`)[0]
                if (sensor.sensor_id === selectedSensor) {
                    style = styles.selected_sensor;
                }
                if (readings) {
                    for (let j = 0; j < setPoints.length; j++) {
                        let sensorReadingString = '';
                        let referenceString = '';
                        let pass = true;
                        let readingObject = {}

                        if (recentReadings.devices_under_test[`${sensor.sensor_id}temp`] !== undefined) {
                            const heartbeat = thisMessage.heartbeat;

                            let heartbeatString = '';
                            if (heartbeat >= 60) {
                                heartbeatString = `(${parseInt(heartbeat / 60)}m)`
                            } else if (heartbeat < 60 && heartbeat !== undefined) {
                                heartbeatString = `(${heartbeat}s)`
                            }

                            currentReadingCell = <div className={styles.grid_entry_green}>{`${recentReadings.devices_under_test[`${sensor.sensor_id}temp`].toFixed(2)}°C ${heartbeatString}`}</div>;

                            if (calibrationProcedureId === 3 || calibrationProcedureId === 8) {
                                currentReadingCell = <div className={styles.grid_entry_green}>
                                    {`${recentReadings.devices_under_test[`${sensor.sensor_id}humidity`].toFixed(2)}%RH\n
                                    ${recentReadings.devices_under_test[`${sensor.sensor_id}temp`].toFixed(2)}°C ${heartbeatString}`}
                                </div>
                            }
                        } else {
                            currentReadingCell = <div className={styles.grid_entry}>No data</div>
                        }

                        switch (calibrationProcedureId) {
                            default:
                                if (calibrationProcedureId === 6) {
                                    elementClass = styles.grid_row_6;
                                } else if (calibrationProcedureId === 7) {
                                    elementClass = styles.grid_row_10;
                                }

                                const findReadings = readings.find((reading) => (reading.set_point === setPoints[j]['temperature'] && reading.type === 'temperature'));
                                if (findReadings) {
                                    readingObject = { ...readingObject, ...findReadings };
                                    referenceString = referenceString + `${readingObject.reference_reading}°C\n`
                                    sensorReadingString = sensorReadingString + `${readingObject.sensor_reading}°C`;
                                    if (!readingObject.pass) {
                                        pass = false;
                                    }
                                    sensorStyles.push((pass) ? styles.grid_entry_green : styles.grid_entry_red);
                                } else {
                                    sensorReadings.push('');
                                    sensorStyles.push(styles.grid_entry);
                                    break;
                                }

                                sensorReadings.push(sensorReadingString);
                                tempReferenceReadings[`setPoint${j}`] = referenceString;
                                break;

                            case 3:
                            case 8:
                                elementClass = calibrationProcedureId === 3 ? `${styles.humidity_grid} ${styles.grid_row}` : styles.grid_row;
                                let currentStyle = styles.grid_entry;
                                for (const type of ['humidity', 'temperature']) {
                                    const findReadings = readings.find((reading) => (reading.set_point === setPoints[j][type] && reading.type === type))
                                    if (findReadings) {
                                        readingObject = { ...readingObject, ...findReadings };
                                        if (type === 'humidity') {
                                            referenceString += `${readingObject.reference_reading}%RH\n`;
                                            sensorReadingString += `${readingObject.sensor_reading}%RH\n`;
                                        } else {
                                            referenceString += `${readingObject.reference_reading}°C\n`
                                            sensorReadingString += `${readingObject.sensor_reading}°C`;
                                        }
                                        if (!readingObject.pass) {
                                            pass = false;
                                        }
                                        currentStyle = pass ? styles.grid_entry_green : styles.grid_entry_red;
                                    }
                                }

                                sensorStyles.push(currentStyle);

                                sensorReadings.push(sensorReadingString);
                                tempReferenceReadings[`setPoint${j}`] = referenceString;
                                break;
                        }
                        if (loadingMessage) {
                            setLoadingMessage('');
                        }
                    }
                }

                newSensorGrid.push(
                    <div className={`${elementClass} ${style}`} key={sensor.sensor_id}>
                        <button className={styles.default_button} onClick={() => selectSensor(sensor.sensor_id)}>{sensor.sensor_id}</button>
                        {currentReadingCell}
                        {sensorStyles.map((style, index) => {
                            return <div className={style} key={index}>{sensorReadings[index]}</div>
                        })}
                    </div>
                );
            }
            newSensorGrid.unshift(
                <div className={elementClass} key={'1'}>
                    <div className={styles.grid_entry}>Reference</div>
                    <div className={styles.grid_entry}></div>
                    {setPoints.map((setPoint, index) => {
                        return <div className={styles.grid_entry} key={index}>{tempReferenceReadings[`setPoint${index}`]}</div>
                    })}
                </div>)
            setSensorGrid(newSensorGrid);
        } catch (error) {
            console.error(error);
        }
    };

    const updateStableTimes = async () => {
        if (!setPoints) {
            return;
        }

        const newStableTimes = [];

        const now = new Date();
        const references = [equipment.current.reference1.asset_tag, equipment.current.reference2.asset_tag, equipment.current.reference3.asset_tag]
        for (let i = 0; i < setPoints.length; i++) {
            if (!setPoints) {
                return;
            }

            const setPoint = setPoints[i];

            let finalSetPoint = setPoint.temperature;
            let reference = references[i - 1];
            if (parseFloat(setPoint.temperature) < -990) {
                finalSetPoint = setPoints[i + 1].temperature;
                reference = references[i];
            }

            let params = {};
            let endpoint = 'get-last-temperature-stable-reading';
            switch (calibrationProcedureId) {
                case 3:
                case 8:
                    endpoint = 'get-last-humidity-stable-reading';
                    params = {
                        'set_point': setPoint.humidity,
                        'reference': equipment.current.rotronic.asset_tag
                    };
                    break;
                case 5:
                    endpoint = 'get-last-humidity-stable-reading';
                    params = {
                        'set_point': finalSetPoint,
                        'type': 'temperature',
                        'reference': equipment.current.rotronic.asset_tag
                    };
                    break;
                case 1:
                    params = {
                        'set_point': finalSetPoint,
                        'reference': reference,
                        'stability_criteria': JSON.stringify(setPoint.stabilityCriteria)
                    };
                    break;
                case 6:
                    const index = i >= 1 ? i + 1 : i; // Bypass second as found

                    let referenceIndex;
                    switch (index) {
                        case 0:
                            referenceIndex = 1;
                            break;
                        case 2:
                            referenceIndex = 0;
                            break;
                        case 3:
                            referenceIndex = 2;
                            break;
                        default:
                            break;
                    }

                    params = {
                        'set_point': setPoints[index + 1].temperature,
                        'reference': references[referenceIndex],
                        'stability_criteria': JSON.stringify(setPoints[index + 1].stabilityCriteria)
                    };
                    break;
                default:
                    params = {
                        'set_point': finalSetPoint,
                        'reference': references[1],
                        'stability_criteria': JSON.stringify(setPoint.stabilityCriteria)
                    };
                    break;
            }

            const stableTime = await callApi(endpoint, params)

            const totalSeconds = parseInt((now.getTime() - new Date(stableTime[1]).getTime()) / 1000);
            const minutesAgo = parseInt(totalSeconds / 60)
            if (isNaN(minutesAgo)) {
                newStableTimes.push('None found');
            } else if (minutesAgo > 0) {
                newStableTimes.push(`Stable ${minutesAgo} minutes ago`);
            } else {
                newStableTimes.push('Stable');
            }
        }
        setStableTimes(newStableTimes);
    }

    const refresh = async (updatedSensor = selectedSensor.current) => {
        const promises = [];

        for (const sensor of sensorList) {
            promises.push(callApi("get-recent-readings", { sensors: sensor.sensor_id }));
        }
        const resolvedRecentReadings = await callApi('get-recent-data');
        const resolvedReadings = await Promise.all(promises);
        updateStableTimes();
        updateSensors(sensorList, setSensorGrid, calibrationProcedureId, resolvedReadings, updatedSensor, resolvedRecentReadings);
    };

    const getStableTemperatureReading = async (sensorList, setPointObject, reference = equipment.current.reference1.asset_tag) => {
        const setPoint = setPointObject.temperature
        let finalSetPoint = setPoint;
        if (finalSetPoint === '-999.00') {
            if (calibrationProcedureId === 2) {
                finalSetPoint = '0.00';
            } else if (calibrationProcedureId === 7) {
                finalSetPoint = '30.00';
            } else {
                finalSetPoint = '28.00';
            }
        } else if (finalSetPoint === '-998.00') {
            finalSetPoint = '-25.00';
        }
        const lastStableReading = await callApi('get-last-temperature-stable-reading', { 'set_point': finalSetPoint, 'reference': reference, 'stability_criteria': JSON.stringify(setPointObject.stabilityCriteria) });
        
        if (!lastStableReading[1]) {
            setPopupMessage('Unable to find stable data');
            return;
        }
        let readings = await callApi('get-temperature-reading-range', { 'timestamp': lastStableReading[1] });

        let referenceTemperature = readings[0].super_daq_data[reference].stability_data.average;

        let finalReadings = { 'referenceTemperature': referenceTemperature };

        for (const sensor of sensorList) {
            const referenceAndSensorDifference = [] // Array to contain the difference between the reference reading and sensor reading over the course of the 90 seconds

            const readingList = readings.map(reading => { // Get sensor readings from range to perform calculations
                const referenceReading = reading.super_daq_data[reference].Temperature;
                const sensorReading = reading.devices_under_test[`${sensor.sensor_id}temp`];

                referenceAndSensorDifference.push(round(referenceReading - sensorReading, 5));
                return sensorReading;
            })

            finalReadings[`${sensor.sensor_id}temp`] = round(average(readingList), 1);
        }

        return finalReadings;
    }

    async function createTemperatureReading(setPointObject, generatorId, reference, calibrate = false) {
        const setPoint = setPointObject.temperature;
        const readings = await getStableTemperatureReading(sensorList, setPointObject, reference.asset_tag);

        callApi('get-recent-data')
            .then((labReadings) => {
                if (!labReadings.lab_humidity || !labReadings.lab_temperature) {
                    setPopupMessage('No lab readings available for this reading');
                    return;
                }
                for (const sensor of sensorList) {
                    if (selectedSensor.current && sensor.sensor_id !== parseInt(selectedSensor.current)) {
                        continue;
                    } else if (!readings) {
                        setPopupMessage(`Could not get stable data`);
                        return;
                    } else if (readings[`${sensor.sensor_id}temp`] === undefined) {
                        setPopupMessage(`No stable data found for sensor: ${sensor.sensor_id}`);
                        return;
                    } else {
                        const parameters = {
                            'type': 'temperature',
                            'set_point': setPoint,
                            'reference_reading': readings.referenceTemperature,
                            'sensor_reading': readings[`${sensor.sensor_id}temp`],
                            'lab_rh': labReadings.lab_humidity,
                            'lab_temperature': labReadings.lab_temperature,
                            'sensor_id': sensor.sensor_id,
                            'generator_id': generatorId,
                            'reference_id': reference.equipment_id,
                            'tolerance': setPointObject.readingCriteria.tolerance,
                            'uncertainty': setPointObject.readingCriteria.uncertainty,
                        }
                        if (calibrate) {
                            callApi('calibrate-sensor', { 'sensor_id': sensor.sensor_id, 'target_reading': parameters.reference_reading })
                                .then(response => {
                                    if (response.Result !== 'Success') {
                                        setPopupMessage(`Could not calibrate sensor ${sensor.sensor_id}, please try again`)
                                        console.error(response)
                                        return;
                                    }
                                })
                        }
                        callApi('create-reading', parameters)
                            .then(() => {
                                refresh();
                            })
                    }
                }
            })
    }

    const createRotronicTemperatureReading = async (setPointObject, referenceAssetID, generatorId, referenceId, tolerance, uncertainty, calibrate = false) => {
        let setPoint;
        if (setPointObject.temperature !== '-999.00') {
            setPoint = setPointObject.temperature;
        } else {
            setPoint = '20.00';
        }
        const data = await callApi('get-last-humidity-stable-reading', { 'set_point': setPoint, 'type': 'temperature', 'reference': referenceAssetID });
        if (!data[1]) {
            setPopupMessage(`Could not get stable data`);
            return;
        }
        let readings = await callApi('get-humidity-reading-range', { 'timestamp': data[1] });
        if (!readings || readings.error) {
            setPopupMessage(`Could not get stable data`);
            return;
        }
        let referenceTemperature = readings.map((item) => item.rotronic_data[referenceAssetID].Temperature).filter((value) => value !== undefined);
        referenceTemperature = round(referenceTemperature.reduce((a, b) => a + b, 0) / referenceTemperature.length);
        readings = readings.map((item) => item.devices_under_test);
        const labReadings = await callApi('get-recent-data');

        for (const sensor of sensorList) {
            if (selectedSensor.current && sensor.sensor_id !== parseInt(selectedSensor.current)) {
                continue;
            }
            const sensorId = sensor.sensor_id
            let temperatureReading = readings.map((item) => item[`${sensorId}temp`]).filter((value) => value !== undefined);
            temperatureReading = round(temperatureReading.reduce((a, b) => a + b, 0) / temperatureReading.length);
            if (temperatureReading === undefined) {
                setPopupMessage(`No stable data found for sensor: ${sensorId}`);
                return;
            } else {
                const parameters = {
                    'type': 'temperature',
                    'set_point': setPointObject.temperature,
                    'reference_reading': referenceTemperature,
                    'sensor_reading': temperatureReading,
                    'lab_rh': labReadings[0].lab_humidity,
                    'lab_temperature': labReadings[0].lab_temperature,
                    'sensor_id': sensorId,
                    'generator_id': generatorId,
                    'reference_id': referenceId,
                    'tolerance': tolerance,
                    'uncertainty': uncertainty,
                }
                if (calibrate) {
                    callApi('calibrate-sensor', { 'sensor_id': sensorId, 'target_reading': parameters.reference_reading })
                }
                callApi('create-reading', parameters)
                    .then(() => refresh())
            }
        }
    }

    const getHumidityAverages = async (sensorList, setPoint, reference = equipment.current.rotronic.asset_tag) => {
        const data = await callApi('get-last-humidity-stable-reading', { 'set_point': setPoint, 'reference': equipment.current.rotronic.asset_tag });
        let readings = await callApi('get-humidity-reading-range', { 'timestamp': data[1] });

        let referenceHumidity = readings.map((item) => item.rotronic_data[reference].Humidity).filter((value) => value !== undefined);
        let referenceTemperature = readings.map((item) => item.rotronic_data[reference].Temperature).filter((value) => value !== undefined);

        referenceHumidity = round(referenceHumidity.reduce((a, b) => a + b, 0) / referenceHumidity.length);
        referenceTemperature = round(referenceTemperature.reduce((a, b) => a + b, 0) / referenceTemperature.length);
        readings = readings.map((item) => item.devices_under_test);

        let finalReadings = { 'referenceHumidity': referenceHumidity, 'referenceTemperature': referenceTemperature };
        for (const sensor of sensorList) {
            const sensorId = sensor.sensor_id
            let humidityReading = readings.map((item) => item[`${sensorId}humidity`]).filter((value) => value !== undefined);
            let temperatureReading = readings.map((item) => item[`${sensorId}temp`]).filter((value) => value !== undefined);
            humidityReading = round(humidityReading.reduce((a, b) => a + b, 0) / humidityReading.length);
            temperatureReading = round(temperatureReading.reduce((a, b) => a + b, 0) / temperatureReading.length);

            finalReadings[`${sensorId}humidity`] = humidityReading;
            finalReadings[`${sensorId}temp`] = temperatureReading;
        }
        return finalReadings;
    }


    const createHumidityReading = async (setPointsSetPoint, humidityUncertainty, temperatureUncertainty) => {
        let promises = [];
        let readings = await callApi('get-recent-data');
        const humidityAverages = await getHumidityAverages(sensorList, setPoints[setPointsSetPoint].humidity);
        for (const type of ['humidity', 'temperature']) {
            if (!humidityAverages.referenceHumidity || !humidityAverages.referenceTemperature) {
                setPopupMessage('No stable data found!');
                continue
            }
            for (const sensor of sensorList) {
                if (selectedSensor.current && sensor.sensor_id !== parseInt(selectedSensor.current)) {
                    continue;
                }
                if (!humidityAverages[`${sensor.sensor_id}humidity`] || !humidityAverages[`${sensor.sensor_id}temp`]) {
                    setPopupMessage(`No stable data found for sensor: ${sensor.sensor_id}`);
                    return;
                }
                let referenceReading;
                let sensorReading;
                let setPoint;
                let tolerance;
                let uncertainty;

                if (type === 'humidity') {
                    referenceReading = humidityAverages.referenceHumidity;
                    sensorReading = humidityAverages[`${sensor.sensor_id}humidity`];
                    setPoint = setPoints[setPointsSetPoint].humidity;
                    tolerance = 5;
                    uncertainty = humidityUncertainty;
                } else {
                    referenceReading = humidityAverages.referenceTemperature;
                    sensorReading = humidityAverages[`${sensor.sensor_id}temp`];
                    setPoint = setPoints[setPointsSetPoint].temperature;
                    tolerance = 1;
                    uncertainty = temperatureUncertainty;
                }
                const parameters = {
                    'type': type,
                    'set_point': setPoint,
                    'reference_reading': referenceReading,
                    'sensor_reading': sensorReading,
                    'lab_rh': readings[0].lab_humidity,
                    'lab_temperature': readings[0].lab_temperature,
                    'sensor_id': sensor.sensor_id,
                    'generator_id': equipment.current.chamber.equipment_id,
                    'reference_id': equipment.current.rotronic.equipment_id,
                    'tolerance': tolerance,
                    'uncertainty': uncertainty,
                }
                promises.push(callApi('create-reading', parameters))
            }
            await Promise.all(promises);
            refresh();
        }
    }

    let menu;
    if (!setPoints) {
        menu = <h1 className={styles.title}>Loading...</h1>
    } else if (loadingMessage) {
        setLoadingMessage('');
    } else {
        switch (calibrationProcedureId) {
            default:
                menu = <h1 className={styles.title}>No calibration menu found</h1>
                break;
            case 1:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            <Button onClick={() => createTemperatureReading(setPoints[0], equipment.current.bath1.equipment_id, equipment.current.reference1, true)} innerText='As Found' />
                            <Button onClick={() => createTemperatureReading(setPoints[1], equipment.current.bath1.equipment_id, equipment.current.reference1)} innerText={`${setPoints[1].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[2], equipment.current.bath2.equipment_id, equipment.current.reference2)} innerText={`${setPoints[2].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[3], equipment.current.bath3.equipment_id, equipment.current.reference3)} innerText={`${setPoints[3].temperature}°C`} />
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}

                        </div>
                        {sensorGrid}
                    </div>
                );
                break;
            case 2:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            <Button onClick={() => createTemperatureReading(setPoints[0], 2, equipment.current.reference2, true)} innerText='As Found' />
                            <Button onClick={() => createTemperatureReading(setPoints[1], 2, equipment.current.reference2)} innerText={`${setPoints[1].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[2], 17, equipment.current.reference2)} innerText={`${setPoints[2].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[3], 18, equipment.current.reference2)} innerText={`${setPoints[3].temperature}°C`} />
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div >
                );
                break;
            case 3:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={`${styles.humidity_grid} ${styles.grid_row}`}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            {setPoints.map((setPoint, index) => {
                                const criteria = setPoint.stabilityCriteria;
                                return <Button onClick={() => createHumidityReading(index, criteria.uncertaintyHumidity, criteria.uncertaintyTemperature)} innerText={<>{setPoint.humidity}%RH<br />{setPoint.temperature}°C</>} />
                            })}
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div >
                );
                break;
            case 4:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            <Button onClick={() => createTemperatureReading(setPoints[0], 17, equipment.current.reference2, true)} innerText='As Found' />
                            <Button onClick={() => createTemperatureReading(setPoints[1], 17, equipment.current.reference2)} innerText={`${setPoints[1].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[2], 17, equipment.current.reference2)} innerText={`${setPoints[2].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[3], 17, equipment.current.reference2)} innerText={`${setPoints[3].temperature}°C`} />
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div >
                );
                break;
            case 5:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            <Button onClick={() => createRotronicTemperatureReading(setPoints[0], equipment.current.rotronic.asset_tag, 5, equipment.current.rotronic.equipment_id, 1, 0.23, true)} innerText='As Found' />
                            <Button onClick={() => createRotronicTemperatureReading(setPoints[1], equipment.current.rotronic.asset_tag, 5, equipment.current.rotronic.equipment_id, 1, 0.23)} innerText={`${setPoints[1].temperature}°C`} />
                            <Button onClick={() => createRotronicTemperatureReading(setPoints[2], equipment.current.rotronic.asset_tag, 5, equipment.current.rotronic.equipment_id, 1, 0.4)} innerText={`${setPoints[2].temperature}°C`} />
                            <Button onClick={() => createRotronicTemperatureReading(setPoints[3], equipment.current.rotronic.asset_tag, 5, equipment.current.rotronic.equipment_id, 1, 0.62)} innerText={`${setPoints[3].temperature}°C`} />
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div >
                );
                break;
            case 6:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row_6}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            <Button onClick={() => createTemperatureReading(setPoints[0], equipment.current.bath2.equipment_id, equipment.current.reference2, true)} innerText={`As Found (${setPoints[1].temperature}°C)`} />
                            <Button onClick={() => createTemperatureReading(setPoints[1], equipment.current.bath2.equipment_id, equipment.current.reference2)} innerText={`${setPoints[1].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[2], equipment.current.bath1.equipment_id, equipment.current.reference1, true)} innerText={`As Found (${setPoints[3].temperature}°C)`} />
                            <Button onClick={() => createTemperatureReading(setPoints[3], equipment.current.bath1.equipment_id, equipment.current.reference1)} innerText={`${setPoints[3].temperature}°C`} />
                            <Button onClick={() => createTemperatureReading(setPoints[4], equipment.current.bath3.equipment_id, equipment.current.reference3)} innerText={`${setPoints[4].temperature}°C`} />
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div>
                );
                break;
            case 7:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row_10}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            {setPoints.map((setPoint, index) => {
                                const buttonText = parseFloat(setPoint.temperature) <= -990 ? `As Found (${setPoints[index + 1].temperature}°C)` : `${setPoint.temperature}°C`
                                return <Button key={index} onClick={() => createTemperatureReading(setPoint, 17, equipment.current.reference2, parseFloat(setPoint.temperature) <= -990)} innerText={buttonText} />
                            })}
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div >
                );
                break;
            case 8:
                menu = (
                    <div className={styles.testing_grid}>
                        <div className={styles.grid_row}>
                            <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                            <div className={styles.grid_entry}></div>
                            {setPoints.map((setPoint, index) => {
                                const criteria = setPoint.stabilityCriteria;
                                return <Button onClick={() => createHumidityReading(index, criteria.uncertaintyHumidity, criteria.uncertaintyTemperature)} innerText={<>{setPoint.humidity}%RH<br />{setPoint.temperature}°C</>} />
                            })}
                            <div className={styles.grid_entry}>Stable times</div>
                            <div className={styles.grid_entry}></div>
                            {stableTimes.map((stableTime, index) => {
                                return <StableTimeDisplay stableTime={stableTime} key={index} />;
                            })}
                        </div>
                        {sensorGrid}
                    </div >
                );
                break;
        };
    }

    useEffect(() => {
        if (!refreshed.current) {
            refreshed.current = true;
            refresh()

            getReferences(calibrationProcedureId).then(references => {
                const unverifiedReferences = []
                if (referencesToVerify.length !== 0)
                    return;
                for (const reference of references) {
                    if (reference.physically_verified)
                        continue
                    const verificationString = `Please verify that equipment ${reference.asset_tag} (${reference.description}) is being used for this test`
                    unverifiedReferences.push(reference);
                    referenceStrings.current = [...referenceStrings.current, verificationString];
                }
                setReferencesToVerify(unverifiedReferences);
            })
        }
        const interval = setInterval(() => {
            refresh();
        }, 3000);
        return () => clearInterval(interval);
    })
    if (sensorList.length < 1) {
        menu = <h1 className={styles.title}>No sensors found</h1>
    } else if (loadingMessage) {
        menu = <h1 className={styles.title}>Loading...</h1>
    }

    return menu;
}

export default TestingMenu;