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
        procedureId: calibrationProcedureId, sensorGrid,
        sensorList, setSensorGrid, setPopupMessage, equipment,
        variances
    } = useAppContext()

    const [stableTimes, setStableTimes] = useState(setPoints.map(() => 'Loading...'));

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

    const updateSensors = async (setSensorGrid, calibrationProcedureId, readings, selectedSensor, recentReadings) => {
        let tempReferenceReadings = {};
        const now = new Date();

        if (!setPoints) {
            return;
        }

        try {
            const newSensorGrid = [];
            let currentReadingString = '';
            let elementClass = styles.grid_row;
            for (let i = 0; i < sensorList.length; i++) {
                let displayBattery = false;
                let currentReadingClass = styles.offline_sensor;
                let sensorReadings = [];
                const sensorStyles = [];
                const sensor = sensorList[i % sensorList.length];
                let style = '';
                const thisMessage = recentReadings.monnit_sensor_data.filter(sensorReading => sensorReading.sensorID === `${sensor.sensor_id}`)[0]
                if (sensor.sensor_id === selectedSensor) {
                    style = styles.selected_sensor;
                }
                for (let setPointIndex = 0; setPointIndex < setPoints.length; setPointIndex++) {
                    let sensorReadingString = '';
                    let referenceString = '';
                    let pass = true;
                    let readingObject = {}

                    if (recentReadings.devices_under_test[sensor.sensor_id]?.temperature) {
                        const heartbeat = thisMessage.heartbeat;

                        let heartbeatString = '';

                        const heartbeatDate = thisMessage.messageDate;
                        const timezoneOffset = now.getTimezoneOffset() * 60000;
                        const heartBeatTimestamp = new Date(new Date(heartbeatDate) - timezoneOffset);
                        const lastHeartBeatSecondsAgo = (now - heartBeatTimestamp) / 1000;

                        if (heartbeat >= 60) {
                            heartbeatString = `(${parseInt(heartbeat / 60)}m)`
                        } else if (heartbeat < 60 && heartbeat) {
                            heartbeatString = `(${heartbeat}s)`
                        }
                        if (thisMessage.batteryLevel && parseInt(thisMessage.batteryLevel) < 30)
                            displayBattery = true;

                        if (lastHeartBeatSecondsAgo < heartbeat * 1.5 || lastHeartBeatSecondsAgo < 10)
                            currentReadingClass = styles.grid_entry_green;
                        else if (lastHeartBeatSecondsAgo < heartbeat * 3 || lastHeartBeatSecondsAgo < 30)
                            currentReadingClass = styles.grid_entry_yellow;
                        else
                            currentReadingClass = styles.grid_entry_red;

                        currentReadingString = `${recentReadings.devices_under_test[sensor.sensor_id]?.temperature.toFixed(2)}°C ${heartbeatString}`;

                        if (calibrationProcedureId === 3 || calibrationProcedureId === 8) {
                            currentReadingString = `${recentReadings.devices_under_test[sensor.sensor_id].humidity?.toFixed(2)}%RH\n
                                    ${recentReadings.devices_under_test[sensor.sensor_id].temperature?.toFixed(2)}°C ${heartbeatString}`;
                        }
                    } else {
                        currentReadingString = 'No data'
                    }
                    switch (calibrationProcedureId) {
                        default:
                            if (calibrationProcedureId === 6) {
                                elementClass = styles.grid_row_6;
                            } else if (calibrationProcedureId === 7) {
                                elementClass = styles.grid_row_10;
                            }
                            const findReadings = readings.find((reading) => (reading.set_point === setPoints[setPointIndex].temperature && reading.type === 'temperature' && reading.as_found === setPoints[setPointIndex].calibrate && reading.sensor_id === sensor.sensor_id));
                            
                            readingObject = { ...readingObject, ...findReadings };

                            if (findReadings) {
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
                            tempReferenceReadings[`setPoint${setPointIndex}`] = referenceString;
                            break;

                        case 3:
                        case 8:
                            elementClass = calibrationProcedureId === 3 ? `${styles.humidity_grid} ${styles.grid_row}` : styles.grid_row;
                            let currentStyle = styles.grid_entry;
                            for (const type of ['humidity', 'temperature']) {
                                if (readings) {
                                    const findReadings = readings.find((reading) => (reading.set_point === setPoints[setPointIndex][type] && reading.type === type && reading.sensor_id === sensor.sensor_id))
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

                            sensorReadings.push(sensorReadingString);
                            tempReferenceReadings[`setPoint${setPointIndex}`] = referenceString;
                            break;
                    }
                    if (loadingMessage) {
                        setLoadingMessage('');
                    }
                }

                newSensorGrid.push(
                    <div className={`${elementClass} ${style}`} key={sensor.sensor_id}>
                        <button className={styles.default_button} onClick={() => selectSensor(sensor.sensor_id)}>
                            {displayBattery ? <div className={styles.low_battery}></div> : <></>} {sensor.sensor_id}
                            </button>
                        <div className={currentReadingClass}>
                            <SensorLink sensorId={sensor.sensor_id} text={currentReadingString} />
                        </div>
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

        getStableTimes()

        const now = new Date();
        setStableTimes(await Promise.all(setPoints.map(async (setPoint, index) => {
            const readingType = setPoint.humidity ? 'humidity' : 'temperature';

            return getStableTime(index, readingType)
                .then(stableTime => {
                    if (!stableTime)
                        return 'None found';
                    const totalSeconds = parseInt((now.getTime() - new Date(stableTime).getTime()) / 1000);
                    const minutesAgo = parseInt(totalSeconds / 60)

                    if (minutesAgo > 0) {
                        return `Stable ${minutesAgo} minutes ago`;
                    } else {
                        return 'Stable';
                    }
                })
        })));
    }

    const refresh = async (updatedSensor = selectedSensor.current) => {
        const sensorIds = sensorList.map(sensor => sensor.sensor_id);
        if (refreshing.current)
            return;

        refreshing.current = true;

        callApi('get-recent-data')
            .then((resolvedRecentReadings) => {
                if (sensorIds.length > 0)
                    callApi("get-recent-readings", { sensors: sensorIds })
                        .then((resolvedReadings) => {
                            updateStableTimes()
                                .then(refreshing.current = false)
                            if (resolvedReadings) {
                                updateSensors(setSensorGrid, calibrationProcedureId, resolvedReadings, updatedSensor, resolvedRecentReadings)
                            }
                        })
            })
    };

    // const getStableTimes = async () => {
    //     return callApi('get-last-stable-readings', {
    //         set_points: JSON.stringify(setPoints)
    //     })
    //     .then(response => {
    //         // console.log(response)
    //     })
    // }

    const getStableTime = async (setPointIndex, readingType = 'temperature') => {
        const setPointObject = setPoints[setPointIndex]
        const setPointReading = setPointObject[readingType]

        return callApi('get-last-stable-reading', {
            type: readingType,
            set_point: setPointReading,
            reference: equipment.current[setPointObject.reference].asset_tag,
            stability_criteria: JSON.stringify(setPoints[setPointIndex].stabilityCriteria)
        })
            .then(response => {
                if (!response.Result)
                    return false;

                const stableTime = new Date(response.Result);
                return stableTime
            })
    }

    const getReadings = async (stableTime, referenceAssetTag, sensorResolution) => {
        const readingTypes = ['temperature', 'humidity']
        return callApi('get-reading-range',
            {
                'timestamp': stableTime
            })
            .then(readings => {
                let finalReadings = {
                    lab_humidity: readings[0].lab_humidity,
                    lab_temperature: readings[0].lab_temperature
                };
                const referenceData = {};
                sensorList.map((sensor) => finalReadings[`${sensor.sensor_id}`] = {})
                readingTypes.forEach((readingType) => {
                    const filteredReadings = readings.filter(reading => reading.reference_data[referenceAssetTag][readingType]);
                    const referenceReadings = readings.map(reading => reading.reference_data[referenceAssetTag][readingType])
                    const referenceAverage = round(average(referenceReadings), 4);

                    if (isNaN(referenceAverage))
                        return;

                    referenceData[`${readingType}_average`] = referenceAverage;
                    referenceData[`${readingType}_readings`] = referenceReadings;
                    for (const sensor of sensorList) {
                        const referenceAndSensorDifference = [] // Array to contain the difference between the reference reading and sensor reading over the course of the 90 seconds
                        const readingList = filteredReadings.map(reading => { // Get sensor readings from range to perform calculations
                            const referenceReading = reading.reference_data[referenceAssetTag][readingType];
                            const sensorReading = reading.devices_under_test[sensor.sensor_id][readingType];

                            referenceAndSensorDifference.push(round(referenceReading - sensorReading, 4));
                            return sensorReading;
                        })

                        const sensorAverage = round(average(readingList), sensorResolution.toString().split('.')[1].length);
                        const sensorStandardDeviation = round(standardDeviation(referenceAndSensorDifference, 10), 4);

                        const finalReadingsSensor = finalReadings[`${sensor.sensor_id}`]

                        finalReadingsSensor[`${readingType}_average`] = sensorAverage;
                        finalReadingsSensor[`${readingType}_standard_deviation`] = sensorStandardDeviation;
                        finalReadingsSensor[`${readingType}_readings`] = readingList;
                        finalReadingsSensor[`${readingType}_reading_difference_data`] = referenceAndSensorDifference;
                    }
                    finalReadings.reference = referenceData
                })
                return finalReadings;
            })
    }

    async function createReading(setPointIndex, stableTime, readingTypes = ['temperature']) {
        const setPointObject = setPoints[setPointIndex];
        const referenceObject = equipment.current[setPointObject.reference];
        const sensorResolution = setPointObject.reference === 'rotronic' ? 0.01 : 0.1;

        getReadings(stableTime, referenceObject.asset_tag, sensorResolution)
            .then((readings) => {
                const referenceData = readings.reference

                if (!readings.lab_humidity || !readings.lab_temperature)
                    return setPopupMessage('No lab readings available for this reading');

                readingTypes.forEach((readingType) => {
                    const referenceAverage = referenceData[`${readingType}_average`];

                    for (let sensor of sensorList) {
                        const sensorReadings = readings[`${sensor.sensor_id}`];
                        const sensorAverage = sensorReadings[`${readingType}_average`];
                        const sensorStandardDeviation = sensorReadings[`${readingType}_standard_deviation`];
                        const readingRawData = {
                            sensor_readings: sensorReadings[`${readingType}_readings`],
                            reference_readings: referenceData[`${readingType}_readings`],
                            sensor_and_reference_difference: sensorReadings[`${readingType}_reading_difference_data`]
                        };

                        if (selectedSensor.current && sensor.sensor_id !== parseInt(selectedSensor.current))
                            continue;

                        else if (!readings || sensorAverage === undefined)
                            return setPopupMessage(`Could not get stable data`);

                        else {
                            const variance = variances.current.filter(variance => {
                                if (
                                    variance.set_point === parseFloat(setPointObject[readingType]) &&
                                    variance.reading_type === readingType &&
                                    variance.reference_type === setPointObject.reference_type &&
                                    variance.generator_type === setPointObject.generator_type)
                                    return true;
                                return false;
                            })[0]
                            const calculatedUncertainty = getUncertainty([variance.bridge, variance.drift, variance.reference, variance.stability, variance.uniformity, variance.dut_resolution, sensorStandardDeviation**2])

                            const finalUncertainty = Math.max(calculatedUncertainty, setPointObject.stabilityCriteria[`minimum_uncertainty_${readingType}`]);

                            const parameters = {
                                type: readingType,
                                set_point: setPointObject[readingType],
                                reference_reading: round(referenceAverage, 2),
                                sensor_reading: round(sensorAverage, 2),
                                lab_rh: readings.lab_humidity,
                                lab_temperature: readings.lab_temperature,
                                sensor_id: sensor.sensor_id,
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
                                        callApi('calibrate-sensor', { 'sensor_id': sensor.sensor_id, 'target_reading': parameters.reference_reading })
                                            .then(response => {
                                                if (response.Result !== 'Success') {
                                                    setPopupMessage(`Could not calibrate sensor ${sensor.sensor_id}, please try again`)
                                                    console.error(response)
                                                    return;
                                                }
                                            })
                                    }
                                })
                                .catch(err => {
                                    setPopupMessage(`Could not create reading for sensor ${sensor.sensor_id}`)
                                    console.error(err.response.data);
                                })
                        }
                    }
                })
            })
    }

    async function handleReadingButtonPress(setPointIndex, stabilityQualifier = 'temperature', readingTypes = ['temperature']) {
        getStableTime(setPointIndex, stabilityQualifier)
            .then(stableTime => {
                if (!stableTime)
                    return setPopupMessage(`No stable times found for this set point`);

                createReading(setPointIndex, stableTime, readingTypes)
            })
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

        switch (calibrationProcedureId) {
            default:
                break;
            case 3:
                gridRowStyle = `${styles.humidity_grid} ${styles.grid_row}`;
                setPointButtons = setPoints.map((setPoint, index) => {
                    return <Button key={index} onClick={() => handleReadingButtonPress(index, 'humidity', ['humidity', 'temperature'])} innerText={<>{setPoint.humidity}%RH<br />{setPoint.temperature}°C</>} />
                });
                break;
            case 8:
                setPointButtons = setPoints.map((setPoint, index) => {
                    return <Button key={index} onClick={() => handleReadingButtonPress(index, 'humidity', ['humidity', 'temperature'])} innerText={<>{setPoint.humidity}%RH<br />{setPoint.temperature}°C</>} />
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
                    {stableTimes.map((stableTime, index) => {
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

            if (variances.current.length === 0) {
                callApi('get-variances')
                    .then((response) => {
                        variances.current = response;
                    })
            }

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