import { useState, useRef, useEffect } from "react";
import styles from "../../styles/styles.module.css";
import callApi from "../../utils/api/callApi";
import { round, average, standardDeviation, getUncertainty } from "../../utils/customMath.js";
import StableTimeDisplay from "../StableTimeDisplay/StableTimeDisplay";
import { useAppContext } from "../../contexts/app";
import Button from "../Button/Button.js";
import getReferences from "../../utils/getReferences.js";
import SensorLink from "../SensorLink/SensorLink.js";
import Dialog from "../Dialog/Dialog";

function TestingMenu({ setPoints, referenceStrings, referencesToVerify, setReferencesToVerify }) {
    const {
        procedureId, sensorGrid,
        sensorList, setSensorList, setSensorGrid, setPopupMessage, equipment,
        variances, labReadings
    } = useAppContext()

    // Spares are tested with the batch but stay out of the grid until added through the popup
    const spares = sensorList.filter(s => s.spare);
    const [showSpares, setShowSpares] = useState(false);

    const addSpare = (sensor) => {
        setShowSpares(false);
        return callApi('set-sensor-spare', { sensor_id: sensor.sensor_id, batch_id: sensor.batch_id, spare: false })
            .then(() => callApi('get-sensors', { batch_id: sensor.batch_id }))
            .then(setSensorList)
            .then(() => setPopupMessage(`Spare ${sensor.sensor_id} added to the batch`))
            .catch(err => {
                setPopupMessage(`Unable to add spare ${sensor.sensor_id}`)
                console.error(err)
            })
    }

    const [stableTimeStrings, setStableTimeStrings] = useState(setPoints.map(() => 'Loading...'));
    const [stableTimes, setStableTimes] = useState([]);
    const [referenceReadings, setReferenceReadings] = useState([]);

    const [loadingMessage, setLoadingMessage] = useState('Loading...');
    const refreshed = useRef(false);
    const selectedSensors = useRef([]);
    const refreshing = useRef(false);
    const readiness = useRef([]); // one entry per set point from get-set-point-readiness
    const reachedReady = useRef(new Set()); // `${setPointIndex}-${sensorId}` cells that completed a window, kept if the bath drifts afterwards
    const [readyColumns, setReadyColumns] = useState([]);

    const readinessType = setPoints?.[0] && 'humidity' in setPoints[0] ? 'humidity' : 'temperature'; // same rule as the backend

    // The sensor is "in" a column's bath when its window average is nearer that set point than any other in the procedure,
    // so a stable second bath can't trigger a reading before the sensors move
    const sensorAtSetPoint = (setPointIndex, sensorId) => {
        const sensor = readiness.current[setPointIndex]?.sensors.find(s => Number(s.sensor_id) === Number(sensorId));
        if (!sensor)
            return null;
        const distance = sp => Math.abs(sensor.average - sp[readinessType]);
        return setPoints.every(sp => distance(setPoints[setPointIndex]) <= distance(sp)) ? sensor : null;
    }

    // Same matching as updateSensors uses for the grid
    const findSavedReading = (savedReadings, setPoint, sensorId) => savedReadings.find(r => r.sensor_id === sensorId
        && ([3, 8].includes(procedureId)
            ? r.set_point === setPoint[r.type]
            : r.type === 'temperature' && r.set_point === setPoint.temperature && r.as_found === setPoint.calibrate));

    // The as-left column at the As Found temperature waits a full window after the sensor's As Found reading,
    // so a green cell there is post-calibration data and not the same readings as the as-found
    const waitingOnAsFound = (setPointIndex, sensorId, savedReadings) => {
        const setPoint = setPoints[setPointIndex];
        const asFoundSetPoint = setPoints.find((sp, i) => i < setPointIndex && sp.calibrate && sp.temperature === setPoint.temperature);
        if (setPoint.calibrate || !asFoundSetPoint)
            return false;
        const asFound = findSavedReading(savedReadings, asFoundSetPoint, sensorId);
        return !asFound || Date.now() - new Date(asFound.timestamp).getTime() < readiness.current[setPointIndex].minutes * 60000;
    }

    // Fixture soaked long enough and this sensor reported, settled, through the whole window
    // A completed window stays Ready; the reading uses the last stable 90 s, which get-last-stable-readings still returns
    const isReadyForTest = (setPointIndex, sensorId, savedReadings) => {
        const key = `${setPointIndex}-${sensorId}`;
        if (reachedReady.current.has(key))
            return true;
        if (!readiness.current[setPointIndex]?.ready || waitingOnAsFound(setPointIndex, sensorId, savedReadings))
            return false;
        const sensor = sensorAtSetPoint(setPointIndex, sensorId);
        const ready = Boolean(sensor?.settled && sensor.covered);
        if (ready)
            reachedReady.current.add(key);
        return ready;
    }

    // Cell for a sensor with no saved reading yet
    const readinessCell = (setPointIndex, sensorId, savedReadings) => {
        if (isReadyForTest(setPointIndex, sensorId, savedReadings))
            return { style: styles.grid_entry_green, text: 'Ready' };
        if (!readiness.current[setPointIndex]?.stable_seconds || !sensorAtSetPoint(setPointIndex, sensorId))
            return { style: styles.grid_entry, text: '' };
        if (waitingOnAsFound(setPointIndex, sensorId, savedReadings))
            return { style: styles.grid_entry_yellow, text: 'Testing - after As Found' };
        const { minutes, stable_seconds } = readiness.current[setPointIndex];
        const remaining = Math.max(0, Math.round(minutes * 60 - stable_seconds));
        let text = 'Testing - settling'; // fixture has soaked, this sensor's own readings haven't
        if (remaining > 90)
            text = `Testing - ${Math.round(remaining / 60)} minutes remaining`;
        else if (remaining > 0)
            text = `Testing - ${remaining} sec remaining`;
        return { style: styles.grid_entry_yellow, text };
    }

    // A column's header turns green when every unread sensor sitting in that bath shows Ready;
    // a spare catching up in another bath doesn't hold the column back
    const getReadyColumns = (savedReadings) => setPoints.map((setPoint, index) => {
        const pending = sensorList.filter(s => !findSavedReading(savedReadings, setPoint, s.sensor_id) && sensorAtSetPoint(index, s.sensor_id));
        return pending.length > 0 && pending.every(s => isReadyForTest(index, s.sensor_id, savedReadings));
    });

    // clicking a selected sensor again deselects it, others add to the selection
    const selectSensor = async (sensorId) => {
        const selected = selectedSensors.current;
        selectedSensors.current = selected.includes(sensorId) ? selected.filter(id => id !== sensorId) : [...selected, sensorId];
        await refresh()
    }

    const updateSensors = (recentReadings, selectedSensors, savedReadings) => {
                let tempReferenceReadings = {};

                if (!setPoints) {
                    return;
                }

                const newSensorGrid = [];
                let currentReadingString = '';
                let elementClass = styles.grid_row;

                sensorList.filter(s => !s.spare).forEach((sensor, index) => {
                    const currentReadings = recentReadings.filter(r => r.sensor_id === sensor.sensor_id)
                    const humidity = currentReadings.length !== 0 ? currentReadings.filter(r => r.type === 'humidity')[0] : null;
                    const temperature = currentReadings.length !== 0 ? currentReadings.filter(r => r.type === 'temperature')[0] : null;
                    let batteryLevel = 100;
                    let currentReadingClass = styles.offline_sensor;

                    if (currentReadings.length === 0) {
                        currentReadingString = 'No data';
                    } else {
                        const timeSinceHeartbeat = parseInt((new Date() - new Date(currentReadings[0].timestamp)) / 1000)
                        batteryLevel = currentReadings[0].battery_level

                        if (timeSinceHeartbeat < 60)
                            currentReadingClass = styles.grid_entry_green;

                        else if (timeSinceHeartbeat < 120)
                            currentReadingClass = styles.grid_entry_yellow;

                        else
                            currentReadingClass = styles.grid_entry_red;

                        currentReadingString = humidity ? `${humidity.value.toFixed(2)}%RH\n${temperature.value.toFixed(2)}°C` : `${currentReadings[0].value.toFixed(2)}°C`;
                    }

                    const sensorStyles = [];
                    const sensorReadingStrings = [];
                    let style = '';

                    if (selectedSensors.includes(sensor.sensor_id))
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
                                    sensorReadingString += pass ? ' / Pass' : ' / Fail';
                                    sensorStyles.push((pass) ? styles.grid_entry_green : styles.grid_entry_red);
                                    sensorReadingStrings.push(sensorReadingString)
                                } else {
                                    const cell = readinessCell(index, sensor.sensor_id, savedReadings);
                                    sensorStyles.push(cell.style);
                                    sensorReadingStrings.push(cell.text)
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

                                if (currentStyle === styles.grid_entry) {
                                    const cell = readinessCell(index, sensor.sensor_id, savedReadings);
                                    currentStyle = cell.style;
                                    sensorReadingString = cell.text;
                                } else {
                                    sensorReadingString += pass ? ' / Pass' : ' / Fail';
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
                                {batteryLevel <= 30 ? <div className={styles.low_battery}></div> : <></>} {sensor.cable_id ? `${sensor.sensor_id} (${sensor.cable_id})` : sensor.sensor_id}{currentReadings[0]?.heartbeat ? ` (${currentReadings[0].heartbeat}s)` : ''}
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
                // Live reference average until a reading is saved for the set point
                const liveReference = (index) => {
                    const value = readiness.current[index]?.reference_average;
                    return value == null ? '' : `${Number(value).toFixed(2)}${readinessType === 'humidity' ? '%RH' : '°C'}`;
                }
                setReferenceReadings(setPoints.map((setPoint, index) => tempReferenceReadings[`setPoint${index}`] || liveReference(index)));
                setSensorGrid(newSensorGrid);
    };

    const updateStableTimes = async () => {
        if (!setPoints) {
            return;
        }

        const now = new Date();
        const stableTimes = await getStableTimes().catch(() => []) || [];

        const result = await callApi('get-set-point-readiness', {
            set_points: JSON.stringify(setPoints),
            sensor_ids: sensorList.map(s => s.sensor_id)
        })
            .then(response => response?.Result ?? [])
            .catch(() => []);
        readiness.current = result;

        setStableTimeStrings(setPoints.map((setPoint, index) => {
            // Same source as the countdown, so "Stable" shows the moment it starts (get-last-stable-readings lags 90 s)
            if (result[index]?.stable_seconds > 0)
                return 'Stable';
            const stableTime = stableTimes[index];
            if (!stableTime)
                return 'None found';
            const totalSeconds = parseInt((now.getTime() - new Date(stableTime).getTime()) / 1000);
            const minutesAgo = parseInt(totalSeconds / 60)

            if (minutesAgo > 2)
                return `Stable ${minutesAgo} minutes ago`;
            else
                return 'Stable';
        }))
    }

    const refresh = async () => {
        const sensorIds = sensorList.map(sensor => sensor.sensor_id);
        if (refreshing.current)
            return;

        refreshing.current = true;

        callApi('get-last-sensor-readings', { sensor_ids: sensorIds })
            .then(recentReadings => {
                if (sensorIds.length > 0)
                    callApi("get-recent-readings", { sensors: sensorIds })
                        .then(savedReadings => {
                            return updateStableTimes()
                                .then(() => {
                                    setReadyColumns(getReadyColumns(savedReadings));
                                    if (recentReadings) {
                                        updateSensors(recentReadings, selectedSensors.current, savedReadings)
                                    }
                                })
                        })
            })
            .catch(err => console.error(err))
            .finally(() => refreshing.current = false)
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
                        const sensorStandardDeviation = round(standardDeviation(referenceAndSensorDifference, 8), 4);

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
        const sensorIds = selectedSensors.current.length ? selectedSensors.current : sensorList.filter(s => !s.spare).map(s => s.sensor_id);

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

                        if (!readings || isNaN(sensorAverage))
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
        // Green "Take reading" once every pending sensor in the column shows Ready.
        // Button keeps its label in state, so the key changes with readiness to remount it with the new text.
        const headerButton = (index, setPointText, readingTypes) => readyColumns[index]
            ? <Button key={`${index}-ready`} onClick={() => handleReadingButtonPress(index, readingTypes)} innerText={'Take reading'} className={`${styles.default_button} ${styles.green}`} />
            : <Button key={index} onClick={() => handleReadingButtonPress(index, readingTypes)} innerText={setPointText} />;
        let setPointButtons = setPoints.map((setPoint, index) => {
            let buttonText = `${setPoints[index].temperature}°C`;
            if (setPoint.calibrate)
                buttonText = `As Found (${setPoints[index].temperature}°C)`
            return headerButton(index, buttonText, ['temperature']);
        })

        switch (procedureId) {
            default:
                break;
            case 3:
                gridRowStyle = `${styles.humidity_grid} ${styles.grid_row}`;
                setPointButtons = setPoints.map((setPoint, index) => headerButton(index, <>{setPoint.temperature}°C<br />{setPoint.humidity}%RH</>, ['humidity', 'temperature']));
                break;
            case 8:
                setPointButtons = setPoints.map((setPoint, index) => headerButton(index, <>{setPoint.temperature}°C<br />{setPoint.humidity}%RH</>, ['humidity', 'temperature']));
                break;
            case 6:
                gridRowStyle = styles.grid_row_6;
                break;
            case 7:
                gridRowStyle = styles.grid_row_10;
                break;
        };

        menu = (
            <>
                <div className={styles.testing_summary}>
                    <div className={gridRowStyle}>
                        <div className={`${styles.grid_entry} ${styles.double_span}`}>Stable times</div>
                        {stableTimeStrings.map((stableTime, index) => {
                            return <StableTimeDisplay stableTime={stableTime} key={index} />;
                        })}
                    </div>
                    <div className={gridRowStyle}>
                        <div className={`${styles.grid_entry} ${styles.double_span}`}>Reference</div>
                        {setPoints.map((setPoint, index) => {
                            return <div className={styles.grid_entry} key={index}>{referenceReadings[index] || 'None found'}</div>
                        })}
                    </div>
                </div>
                <div className={styles.testing_grid}>
                    <div className={gridRowStyle}>
                        <div className={styles.grid_entry}>Sensor ID</div>
                        <div className={styles.grid_entry}>Current reading</div>
                        {setPointButtons}
                    </div>
                    {sensorGrid}
                </div>
                {spares.length > 0 ?
                    <div className={`${styles.row} ${styles.row_end}`}>
                        <Button onClick={() => setShowSpares(true)} innerText={`Add spare (${spares.length} available)`} />
                    </div> : <></>}
                {showSpares ?
                    <Dialog title='Add a spare to this batch' label='Add spare' onClose={() => setShowSpares(false)}
                        footer={<button className={styles.default_button} onClick={() => setShowSpares(false)}>Close</button>}>
                            <div className={styles.modal_body}>
                                {spares.map(spare =>
                                    <div key={spare.sensor_id} className={`${styles.modal_row} ${styles.row}`}>
                                        <SensorLink sensorId={spare.sensor_id} text={spare.cable_id ? `${spare.sensor_id} (${spare.cable_id})` : `${spare.sensor_id}`} />
                                        <Button className={`${styles.default_button} ${styles.green}`} onClick={() => addSpare(spare)} innerText={'Add'} />
                                    </div>)}
                            </div>
                    </Dialog> : <></>}
            </>
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