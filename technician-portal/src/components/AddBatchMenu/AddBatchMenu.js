import { useEffect, useState } from "react";

import { useAppContext } from "../../contexts/app";
import addSensor from "../../utils/addSensor";
import parseSensorString from "../../utils/parseSensorString";
import callApi from "../../utils/api/callApi";
import ScannedSensors from "../ScannedSensors/ScannedSensors";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";


import styles from "../../styles/styles.module.css";
import setBatchLocation from "../../utils/setBatchLocation";

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
        event.preventDefault();
        if (!sensor)
            return;
        const [sensorID, checkDigit] = parseSensorString(sensor);
        const sensorObject = { sensor: `${sensorID}:${checkDigit}`, online: false }

        setSensor('');
        if (addedSensors.includes(sensorID)) {
            setPopupMessage(`Sensor "${sensorID}" is already in this batch`);
            return;
        }

        setAddedSensors([...addedSensors, parseInt(sensorID)]);
        addSensor(sensor, batchNumber)
            .then(sensorValid => {
                if (!sensorValid) {
                    setPopupMessage(`Sensor "${sensorID}" could not be added`);
                    setSensors(sensors.filter(item => JSON.stringify(item) !== JSON.stringify(sensorObject)))
                    setAddedSensors(addedSensors.filter(item => item !== sensorID))
                }
            })
        setSensors([...sensors, sensorObject]);
    }

    const handleSetLocation = (event) => {
        event.preventDefault();
        setBatchLocation(location, technicianId, batchNumber)
            .then(error => {
                if (!error) {
                    setPopupMessage(`Batch ${batchNumber} moved to ${location}`);
                    setCurrentLocation(location);
                    setLocation('');
                } else {
                    throw new Error(error)
                }
            })
            .catch(err => {
                setPopupMessage('The batch was not moved successfully');
                console.error(err)
            })
    }

    const checkStatus = () => {
        callApi('get-online-sensors', { sensor_ids: addedSensors })
            .then(response => {
                for (const sensor of addedSensors) {
                    if (!response.includes(sensor)) {
                        continue;
                    }
                    let newSensors = []
                    for (const sensorElement of sensors) {
                        if (parseSensorString(sensorElement.sensor)[0] === sensor)
                            sensorElement.online = true;
                        newSensors.push({ sensor: sensorElement.sensor, online: sensorElement.online });
                    }
                    setSensors(newSensors)
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