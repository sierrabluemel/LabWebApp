import { useState, useRef, useEffect } from "react";
import styles from "../../styles/styles.module.css";
import callApi from "../../utils/api/callApi";
import { round, average, standardDeviation, getUncertainty } from "../../utils/customMath.js";
import StableTimeDisplay from "../StableTimeDisplay/StableTimeDisplay";
import { useAppContext } from "../../contexts/app";
import Button from "../Button/Button.js";
import getReferences from "../../utils/getReferences.js";
import SensorLink from "../SensorLink/SensorLink.js";

function TestingMenu({ setPoints, referenceStrings, referencesToVerify, setReferencesToVerify }) {
    const {
        procedureId, sensorGrid,
        sensorList, setSensorGrid, setPopupMessage, equipment,
        variances, labReadings
    } = useAppContext()

    const [stableTimeStrings, setStableTimeStrings] = useState(setPoints.map(() => 'Loading...'));
    const [stableTimes, setStableTimes] = useState([]);

    const [loadingMessage, setLoadingMessage] = useState('Loading...');
    const refreshed = useRef(false);
    const selectedSensor = useRef(null);
    const refreshing = useRef(false);

    const selectSensor = async (sensorId) => {
        if (selectedSensor.current === sensorId) {
            selectedSensor.current = null;
            await refresh(null)
        } else {
            selectedSensor.current = sensorId;
            await refresh(sensorId)
        }
    }

    const updateSensors = async (recentReadings, selectedSensor, savedReadings) => {
        callApi('get-sensor-heartbeats', { sensor_ids: sensorList.map(s => s.sensor_id) })
            .then(heartbeats => {
                let tempReferenceReadings = {};

                if (!setPoints) {
                    return;
                }

                const newSensorGrid = [];
                let currentReadingString = '';
                let elementClass = styles.grid_row;

                sensorList.forEach((sensor, index) => {
                    const currentReadings = recentReadings.filter(r => r.sensor_id === sensor.sensor_id)
                    const humidity = currentReadings.length !== 0 ? currentReadings.filter(r => r.type === 'humidity')[0] : null;
                    const temperature = currentReadings.length !== 0 ? currentReadings.filter(r => r.type === 'temperature')[0] : null;
                    let heartbeatString = '';
                    let batteryLevel = 100;
                    let currentReadingClass = styles.offline_sensor;

                    if (currentReadings.length === 0) {
                        currentReadingString = 'No data';
                    } else {
                        const timeSinceHeartbeat = parseInt((new Date() - new Date(currentReadings[0].timestamp)) / 1000)
                        batteryLevel = currentReadings[0].battery_level
                        const heartbeat = heartbeats.filter(h => h.sensor_id === sensor.sensor_id)[0].heartbeat

                        if (heartbeat >= 60)
                            heartbeatString = `(${parseInt(heartbeat / 60)}m)`

                        else if (heartbeat < 60 && heartbeat)
                            heartbeatString = `(${heartbeat}s)`

                        if (timeSinceHeartbeat < heartbeat * 3 || timeSinceHeartbeat < 30)
                            currentReadingClass = styles.grid_entry_green;

                        else if (timeSinceHeartbeat < heartbeat * 6 || timeSinceHeartbeat < 60)
                            currentReadingClass = styles.grid_entry_yellow;

                        else
                            currentReadingClass = styles.grid_entry_red;

                        currentReadingString = humidity ? `${humidity.value.toFixed(2)}%RH\n${temperature.value.toFixed(2)}°C ${heartbeatString}` : `${currentReadings[0].value.toFixed(2)}°C ${heartbeatString}`;
                    }

                    const sensorStyles = [];
                    const sensorReadingStrings = [];
                    let style = '';

                    if (sensor.sensor_id === selectedSensor)
                        style = styles.selected_sensor;

                    setPoints.forEach((setPoint, index) => {
                        let sensorReadingString = '';
                        let referenceString = '';
                        let pass = true;
                        let readingObject = {}

                        switch (procedureId) {
                            default:
                                if (procedureId === 6)
                                    elementClass = styles.grid_row_6;
                                else if (procedureId === 7)
                                    elementClass = styles.grid_row_10;

                                const findReadings = savedReadings.find((reading) => (
                                    reading.set_point === setPoints[index].temperature
                                    && reading.type === 'temperature'
                                    && reading.as_found === setPoints[index].calibrate
                                    && reading.sensor_id === sensor.sensor_id));

                                readingObject = { ...readingObject, ...findReadings };
                                if (findReadings) {
                                    referenceString += `${readingObject.reference_reading}°C\n`
                                    sensorReadingString += `${readingObject.sensor_reading}°C`;
                                    if (!readingObject.pass) {
                                        pass = false;
                                    }
                                    sensorStyles.push((pass) ? styles.grid_entry_green : styles.grid_entry_red);
                                    sensorReadingStrings.push(sensorReadingString)
                                } else {
                                    sensorStyles.push(styles.grid_entry);
                                    sensorReadingStrings.push(sensorReadingString)
                                    break;
                                }

                                tempReferenceReadings[`setPoint${index}`] = referenceString;
                                break;

                            case 3:
                            case 8:
                                elementClass = procedureId === 3 ? `${styles.humidity_grid} ${styles.grid_row}` : styles.grid_row;
                                let currentStyle = styles.grid_entry;
                                for (const type of ['humidity', 'temperature']) {
                                    if (savedReadings) {
                                        const findReadings = savedReadings.find((reading) => (reading.set_point === setPoints[index][type] && reading.type === type && reading.sensor_id === sensor.sensor_id))
                                        readingObject = { ...readingObject, ...findReadings };

                                        if (!findReadings) {
                                            referenceString += '';
                                            sensorReadingString += '';
                                        } else {
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
                                }

                                sensorStyles.push(currentStyle);
                                sensorReadingStrings.push(sensorReadingString)

                                tempReferenceReadings[`setPoint${index}`] = referenceString;
                                break;
                        }
                        if (loadingMessage) {
                            setLoadingMessage('');
                        }
                    })

                    newSensorGrid.push(
                        <div className={`${elementClass} ${style}`} key={sensor.sensor_id}>
                            <div className={styles.default_button} onClick={() => selectSensor(sensor.sensor_id)}>
                                {batteryLevel <= 30 ? <div className={styles.low_battery}></div> : <></>} {sensor.sensor_id}
                            </div>
                            <div className={currentReadingClass}>
                                <SensorLink sensorId={sensor.sensor_id} text={currentReadingString} />
                            </div>
                            {sensorStyles.map((style, index) => {
                                return <div className={style} key={index}>{sensorReadingStrings[index]}</div>
                            })}
                        </div>
                    );
                })
                newSensorGrid.unshift(
                    <div className={elementClass} key={'50'}>
                        <div className={styles.grid_entry}>Reference</div>
                        <div className={styles.grid_entry}></div>
                        {setPoints.map((setPoint, index) => {
                            return <div className={styles.grid_entry} key={index}>{tempReferenceReadings[`setPoint${index}`]}</div>
                        })}
                    </div>)
                setSensorGrid(newSensorGrid);
            })
    };

    const updateStableTimes = async () => {
        if (!setPoints) {
            return;
        }

        const now = new Date();

        setStableTimeStrings(await getStableTimes()
            .then((stableTimes) => {
                return stableTimes.map((stableTime) => {

                    if (!stableTime)
                        return 'None found';
                    const totalSeconds = parseInt((now.getTime() - new Date(stableTime).getTime()) / 1000);
                    const minutesAgo = parseInt(totalSeconds / 60)

                    if (minutesAgo > 0)
                        return `Stable ${minutesAgo} minutes ago`;
                    else
                        return 'Stable';
                })
            }))
    }

    const refresh = async (updatedSensor = selectedSensor.current) => {
        const sensorIds = sensorList.map(sensor => sensor.sensor_id);
        if (refreshing.current)
            return;

        refreshing.current = true;

        callApi('get-last-sensor-readings', { sensor_ids: sensorIds })
            .then(recentReadings => {
                if (sensorIds.length > 0)
                    callApi("get-recent-readings", { sensors: sensorIds })
                        .then(savedReadings => {
                            updateStableTimes()
                                .then(refreshing.current = false)
                            if (recentReadings) {
                                updateSensors(recentReadings, updatedSensor, savedReadings)
                            }
                        })
            })
    };

    const getStableTimes = async () => {
        return callApi('get-last-stable-readings', {
            set_points: JSON.stringify(setPoints)
        })
            .then(response => {
                if (!response.Result)
                    return false;

                setStableTimes(response.Result)
                return response.Result
            })
    }

    const getReadings = async (stableTime, referenceAssetTag, sensorResolution, readingTypes, sensorIds) => {
        return callApi('get-reading-range',
            {
                timestamp: stableTime,
                sensor_ids: sensorIds
            })
            .then(readings => {
                let finalReadings = {
                    lab_humidity: labReadings.humidity,
                    lab_temperature: labReadings.temperature
                };
                const referenceData = {};
                sensorIds.forEach((sensorId) => finalReadings[`${sensorId}`] = {})
                readingTypes.forEach((readingType) => {
                    const filteredReferenceReadings = readings.reference_readings.filter(r => r.asset_tag === referenceAssetTag && r.type === readingType);
                    const referenceValues = filteredReferenceReadings.map(r => r.value);
                    const allSensorReadings = readings.sensor_readings.filter(r => sensorIds.includes(r.sensor_id) && r.type === readingType)
                    const referenceAverage = round(average(referenceValues), 4);

                    if (isNaN(referenceAverage))
                        return;

                    referenceData[`${readingType}_average`] = referenceAverage;
                    referenceData[`${readingType}_readings`] = referenceValues;
                    sensorIds.forEach(sensorId => {
                        const referenceAndSensorDifference = [] // Array to contain the difference between the reference reading and sensor reading over the course of the 90 seconds
                        const readingList = []
                        filteredReferenceReadings.forEach(reading => { // Get sensor readings from range to perform calculations
                            const sensorReadings = allSensorReadings.filter(r => r.sensor_id === sensorId)
                            if (!allSensorReadings.map(r => r.sensor_id).includes(sensorId))
                                throw Error('Sensor readings missing')

                            sensorReadings.forEach(sensorReading => {
                                const secondsDelta = Math.abs(new Date(reading.timestamp) - new Date(sensorReading.timestamp)) / 1000

                                if (secondsDelta <= 1.5) {
                                    referenceAndSensorDifference.push(round(reading.value - sensorReading.value, 4));
                                    readingList.push(sensorReading.value);
                                }
                            })
                        })

                        const sensorAverage = round(average(readingList), sensorResolution.toString().split('.')[1].length);
                        const sensorStandardDeviation = round(standardDeviation(referenceAndSensorDifference, 10), 4);

                        const finalReadingsSensor = finalReadings[`${sensorId}`]

                        finalReadingsSensor[`${readingType}_average`] = sensorAverage;
                        finalReadingsSensor[`${readingType}_standard_deviation`] = sensorStandardDeviation;
                        finalReadingsSensor[`${readingType}_readings`] = readingList;
                        finalReadingsSensor[`${readingType}_reading_difference_data`] = referenceAndSensorDifference;
                    })
                    finalReadings.reference = referenceData
                })
                return finalReadings;
            })
            .catch((err) => {
                if (err.message === 'Sensor readings missing') {
                    return {}
                }
                setPopupMessage('Unable to create readings')
                console.error(err)
            })
    }

    async function createReading(setPointIndex, stableTime, readingTypes = ['temperature']) {
        const setPointObject = setPoints[setPointIndex];
        const referenceObject = equipment.current[setPointObject.reference];
        const sensorResolution = setPointObject.reference === 'rotronic' ? 0.01 : 0.1;
        const sensorIds = selectedSensor.current ? [selectedSensor.current] : sensorList.map(s => s.sensor_id);

        getReadings(stableTime, referenceObject.asset_tag, sensorResolution, readingTypes, sensorIds)
            .then(readings => {
                const referenceData = readings.reference

                if (!referenceData)
                    return setPopupMessage('Missing sensor readings for this set point')

                if (!readings.lab_humidity || !readings.lab_temperature)
                    return setPopupMessage('No lab readings available for this reading');

                readingTypes.forEach((readingType) => {
                    const referenceAverage = referenceData[`${readingType}_average`];

                    for (let sensorId of sensorIds) {
                        const sensorReadings = readings[`${sensorId}`];
                        const sensorAverage = sensorReadings[`${readingType}_average`];
                        const sensorStandardDeviation = sensorReadings[`${readingType}_standard_deviation`];
                        const readingRawData = {
                            sensor_readings: sensorReadings[`${readingType}_readings`],
                            reference_readings: referenceData[`${readingType}_readings`],
                            sensor_and_reference_difference: sensorReadings[`${readingType}_reading_difference_data`]
                        };

                        if (selectedSensor.current && sensorId !== parseInt(selectedSensor.current))
                            continue;

                        else if (!readings || isNaN(sensorAverage))
                            return setPopupMessage(`Could not get stable data for sensor ${sensorId}`);

                        else {
                            const variance = variances.current.filter(variance => {
                                if (variance.set_point === parseFloat(setPointObject[readingType]) && variance.reading_type === readingType)
                                    return true;
                                return false;
                            })[0]

                            const calculatedUncertainty = getUncertainty([variance.bridge, variance.drift, variance.reference, variance.stability, variance.uniformity, variance.dut_resolution, sensorStandardDeviation ** 2])

                            const finalUncertainty = Math.max(calculatedUncertainty, setPointObject.stabilityCriteria[`minimum_uncertainty_${readingType}`]);

                            const parameters = {
                                type: readingType,
                                set_point: setPointObject[readingType],
                                reference_reading: round(referenceAverage, 2),
                                sensor_reading: round(sensorAverage, 2),
                                lab_rh: readings.lab_humidity,
                                lab_temperature: readings.lab_temperature,
                                sensor_id: sensorId,
                                generator_id: equipment.current[setPointObject.generator].equipment_id,
                                reference_id: referenceObject.equipment_id,
                                tolerance: setPointObject.stabilityCriteria[`tolerance_${readingType}`],
                                uncertainty: finalUncertainty,
                                standard_deviation: sensorStandardDeviation,
                                reading_raw_data: JSON.stringify(readingRawData),
                                as_found: setPointObject.calibrate
                            }

                            callApi('create-reading', parameters)
                                .then(() => {
                                    refresh();
                                    if (setPointObject.calibrate) {
                                        callApi('calibrate-sensor', { 'sensor_id': sensorId, 'target_reading': parameters.reference_reading })
                                            .then(response => {
                                                if (response.Result !== 'Success') {
                                                    setPopupMessage(`Could not calibrate sensor ${sensorId}, please try again`)
                                                    console.error(response)
                                                    return;
                                                }
                                            })
                                    }
                                })
                                .catch(err => {
                                    setPopupMessage(`Could not create reading for sensor ${sensorId}`)
                                    console.error(err.response.data);
                                })
                        }
                    }
                })
            })
    }

    async function handleReadingButtonPress(setPointIndex, readingTypes = ['temperature']) {
        const stableTime = stableTimes[setPointIndex];

        if (!stableTime)
            return setPopupMessage(`No stable times found for this set point`);

        createReading(setPointIndex, stableTime, readingTypes)
    }

    let menu;
    if (!setPoints) {
        menu = <h1 className={styles.title}>Loading...</h1>
    } else if (loadingMessage) {
        setLoadingMessage('');
    } else {
        let gridRowStyle = styles.grid_row;
        let setPointButtons = setPoints.map((setPoint, index) => {
            let buttonText = `${setPoints[index].temperature}°C`;
            if (setPoint.calibrate)
                buttonText = `As Found (${setPoints[index].temperature}°C)`
            return <Button onClick={() => handleReadingButtonPress(index)} innerText={buttonText} key={index} />
        })

        switch (procedureId) {
            default:
                break;
            case 3:
                gridRowStyle = `${styles.humidity_grid} ${styles.grid_row}`;
                setPointButtons = setPoints.map((setPoint, index) => {
                    return <Button key={index} onClick={() => handleReadingButtonPress(index, ['humidity', 'temperature'])} innerText={<>{setPoint.humidity}%RH<br />{setPoint.temperature}°C</>} />
                });
                break;
            case 8:
                setPointButtons = setPoints.map((setPoint, index) => {
                    return <Button key={index} onClick={() => handleReadingButtonPress(index, ['humidity', 'temperature'])} innerText={<>{setPoint.humidity}%RH<br />{setPoint.temperature}°C</>} />
                });
                break;
            case 6:
                gridRowStyle = styles.grid_row_6;
                break;
            case 7:
                gridRowStyle = styles.grid_row_10;
                break;
        };

        menu = (
            <div className={styles.testing_grid}>
                <div className={gridRowStyle}>
                    <Button className={`${styles.default_button} ${styles.red}`} onClick={selectSensor} innerText='Clear selection' />
                    <div className={styles.grid_entry}></div>
                    {setPointButtons}
                    <div className={styles.grid_entry}>Stable times</div>
                    <div className={styles.grid_entry}></div>
                    {stableTimeStrings.map((stableTime, index) => {
                        return <StableTimeDisplay stableTime={stableTime} key={index} />;
                    })}
                </div>
                {sensorGrid}
            </div>
        )
    }

    useEffect(() => {
        if (!refreshed.current) {
            refreshed.current = true;
            refresh();

            callApi('get-variances-by-calibration-procedure', { calibration_procedure: procedureId })
                .then((response) => {
                    variances.current = response;
                })

            getReferences(procedureId).then(references => {
                const unverifiedReferences = []
                if (referencesToVerify.length !== 0)
                    return;
                for (const reference of references) {
                    if (reference.physically_verified)
                        continue

                    if (referenceStrings.current.length === 0)
                        referenceStrings.current = ['The following references have been recently changed']

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