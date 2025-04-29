import { useEffect, useRef, useState } from "react";

import { useAppContext } from "../../contexts/app";
import addSensor from "../../utils/addSensor";
import parseSensorString from "../../utils/parseSensorString";
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
    const awaitingUpdate = useRef(false);

    const handleAddSensor = (event) => {
        event.preventDefault();
        if (!technicianId) {
            setPopupMessage('Please sign in');
            return
        }
        if (!sensor)
            return;
        const [sensorID, checkDigit] = parseSensorString(sensor);
        const sensorObject = { sensor: `${sensorID}:${checkDigit}`, online: false }

        setSensor('');
        if (addSensor.includes(sensor)) {
            setPopupMessage(`Sensor "${sensor}" is already in this batch`);
            return;
        }

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
    }

    const handleSetLocation = async (event) => {
        if (!location) {
            return;
        }
        event.preventDefault();
        callApi('create-location-log', { 'location': location, 'batch_id': batchNumber })
            .then((response) => {
                setPopupMessage(`Batch moved to ${location}`);
                setCurrentLocation(location);
                setLocation('');
                if (location.startsWith('T')) {
                    callApi('log-batch-interaction', { department: 'testing', start: true, technician_id: technicianId, batch_id: batchNumber })
                } else if (location.startsWith('R')) {
                    callApi('log-batch-interaction', { department: 'receiving', start: false, technician_id: technicianId, batch_id: batchNumber })
                }
            })
            .catch((error) => {
                setPopupMessage('The batch was not moved successfully');
                console.error(error)
            })
    }

    const checkStatus = () => {
        if (awaitingUpdate.current) {
            return;
        }
        awaitingUpdate.current = true;
        callApi('get-online-sensors')
            .then(response => {
                for (const fullSensor of addedSensors) {
                    if (!response.includes(parseInt(fullSensor.split(':')[0])))
                        continue;
                    let newSensors = []
                    for (const sensorElement of sensors) {
                        if (sensorElement.sensor === fullSensor)
                            sensorElement.online = true;
                        newSensors.push({ sensor: sensorElement.sensor, online: sensorElement.online });
                    }
                    setSensors(newSensors)
                }
                awaitingUpdate.current = false;
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
            .then(() => { })
            .catch(error => {
                console.error(error)
            })
        setBatches(batches.length > 1 ? batches.filter(batch => batch.batch_id !== batchNumber) : []);
    }

    const printWorkOrder = () => {
        callApi('generate-work-order', { batch_id: batchNumber, print: true })
            .then(setPopupMessage(`Batch ${batchNumber} work order printed`))
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
                <input type='text' value={location} onChange={event => setLocation(event.target.value.toUpperCase())} className={styles.default_text_box} placeholder={'Location'} />
            </form>
            <button type="button" className={`${styles.remove_batch_button} ${styles.red}`} onClick={() => setConfirmationArray([`Are you sure you would like to remove batch ${batchNumber}?`])}>Remove batch</button>
            <ScannedSensors sensorList={sensors} />
            <button className={styles.default_button} onClick={printWorkOrder}>Print work order</button>
        </>
    )
}

export default AddBatchMenu;