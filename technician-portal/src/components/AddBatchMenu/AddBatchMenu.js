import { useEffect, useState } from "react";

import { useAppContext } from "../../contexts/app";
import addSensor from "../../utils/addSensor";
import callApi from "../../utils/api/callApi";
import ScannedSensors from "../ScannedSensors/ScannedSensors";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";


import styles from "../../styles/styles.module.css";

function AddBatchMenu({ calibrationProcedureId, batchNumber, batches, setBatches }) {
    const { setPopupMessage, technicianId } = useAppContext();

    const [addedSensors, setAddedSensors] = useState([]);
    const [sensors, setSensors] = useState([]);
    const [sensor, setSensor] = useState('');
    const [displayed, setDisplayed] = useState(true);
    const [location, setLocation] = useState('');
    const [currentLocation, setCurrentLocation] = useState('No location set');
    const [confirmationArray, setConfirmationArray] = useState(false);

    const handleAddSensor = (event) => {
        console.log(addedSensors)
        event.preventDefault();
        if (!technicianId) {
            setPopupMessage('Please sign in');
        } else {
            if (sensor) {
                const sensorObject = { sensor: sensor, online: false }
                if (!addedSensors.includes(sensor)) {
                    setAddedSensors([...addedSensors, sensor])
                    addSensor(sensorObject.sensor, batchNumber)
                        .then(sensorValid => {
                            if (!sensorValid) {
                                setPopupMessage(`Sensor "${sensor}" could not be added`);
                                setSensors(sensors.filter(item => item !== sensorObject))
                                setAddedSensors(addedSensors.filter(item => item !== sensor))
                            }
                        })
                    setSensors([...sensors, sensorObject]);
                } else {
                    setPopupMessage(`Sensor "${sensor}" is already in this batch`);
                }
                setSensor('');
            }
        }
    }

    const handleSetLocation = async (event) => {
        if (!location) {
            return;
        }
        event.preventDefault();
        const response = await callApi('create-location-log', { 'location': location, 'batch_id': batchNumber })
        if (!response.error) {
            setPopupMessage(`Batch moved to ${location}`);
            setCurrentLocation(location);
            setLocation('');
            if (location.startsWith('T')) {
                callApi('log-batch-interaction', { department: 'testing', start: true, technician_id: technicianId, batch_id: batchNumber })
            } else if (location.startsWith('R')) {
                callApi('log-batch-interaction', { department: 'receiving', start: false, technician_id: technicianId, batch_id: batchNumber })
            }
        } else {
            setPopupMessage('The batch was not moved successfully');
            console.error(response.error)
        }
    }

    const checkStatus = () => {
        callApi('get-online-sensors')
            .then(response => {
                for (const fullSensor of addedSensors) {
                    if (response.includes(parseInt(fullSensor.split(':')[0]))) {
                        let newSensors = []
                        for (const sensorElement of sensors) {
                            if (sensorElement.sensor === fullSensor) {
                                sensorElement.online = true;
                            }
                            newSensors.push({ sensor: sensorElement.sensor, online: sensorElement.online });
                        }
                        setSensors(newSensors)
                    }
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    useEffect(() => {
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    })

    const removeBatch = () => {
        callApi('delete-batch', { batch_id: batchNumber })
            .catch(error => {
                console.error(error)
            })
        if (batches.length > 1) {
            setBatches(
                batches.filter(batch => {
                    return batch.batch_id !== batchNumber;
                })
            )
        } else {
            setBatches([]);
        }
    }

    if (!displayed) {
        return (
            <button className={`${styles.default_button} ${styles.double_span}`} onClick={() => setDisplayed(true)}>{`Expand (Batch: ${batchNumber} | Calibration procedure: ${calibrationProcedureId}) | Total sensors: ${sensors.length}`}</button>
        )
    }

    return (
        <>
        {confirmationArray.length > 0 ? <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={removeBatch} /> : <></>}
            <button className={`${styles.default_button} ${styles.double_span}`} onClick={() => setDisplayed(false)}>{`Hide (Batch: ${batchNumber} | Calibration procedure: ${calibrationProcedureId}) | Total sensors: ${sensors.length}`}</button>
            <h1 className={styles.title}>{`Current location: ${currentLocation}`}</h1>
                <form onSubmit={handleAddSensor} data-testid={'addSensorForm'}>
                    <input type='text' value={sensor} onChange={event => setSensor(event.target.value)} className={styles.default_text_box} placeholder={'Sensor ID:Check Digit'} />
                </form>
                <form onSubmit={handleSetLocation} data-testid={'setLocationForm'} >
                    <input type='text' value={location} onChange={event => setLocation(event.target.value)} className={styles.default_text_box} placeholder={'Location'} />
                </form>
                <ScannedSensors sensorList={sensors} />
                <button type="button" className={`${styles.remove_batch_button} ${styles.red}`} onClick={() => setConfirmationArray([`Are you sure you would like to remove batch ${batchNumber}?`])}>Remove batch</button>
        </>
    )
}

export default AddBatchMenu;