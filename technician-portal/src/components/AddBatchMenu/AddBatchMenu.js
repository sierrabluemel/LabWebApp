import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../contexts/app";
import addSensor from "../../utils/addSensor";
import parseSensorString from "../../utils/parseSensorString";
import callApi from "../../utils/api/callApi";
import ScannedSensors from "../ScannedSensors/ScannedSensors";


import styles from "../../styles/styles.module.css";
import LocationPicker from "../LocationPicker/LocationPicker";
import binClass from "../../utils/binClass";
import Button from "../Button/Button";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";

function AddBatchMenu({ calibrationProcedureId, batchNumber, setBatches, orderId, preload = false, hideCancel = false }) {
    const { setPopupMessage } = useAppContext();

    const [addedSensors, setAddedSensors] = useState([]);
    const [sensors, setSensors] = useState([]);
    const [sensorString, setSensorString] = useState('');
    const [displayed, setDisplayed] = useState(true);
    const [currentLocation, setCurrentLocation] = useState('No location set');
    const [bin, setBin] = useState(null);
    const [binString, setBinString] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [spareMode, setSpareMode] = useState(false);
    const [removeConfirmation, setRemoveConfirmation] = useState([]);
    const sensorToRemove = useRef(null);
    const spareCount = sensors.filter(s => s.spare).length;
    const summary = `Batch: ${batchNumber} | Calibration procedure: ${calibrationProcedureId}) | Total sensors: ${sensors.length - spareCount}${spareCount ? ` | Spares: ${spareCount}` : ''}`;

    // Editing an existing batch: show the sensors and location it already has
    useEffect(() => {
        if (!preload)
            return;
        callApi('get-sensors', { batch_id: batchNumber })
            .then(existing => {
                setSensors(existing.map(s => ({ sensor: `${s.sensor_id}:${s.check_digit}`, online: false, cable_id: s.cable_id, spare: s.spare })));
                setAddedSensors(existing.map(s => s.sensor_id));
            })
            .catch(err => console.error(err))
        callApi('get-batch-by-id', { batch_id: batchNumber })
            .then(batch => {
                setCurrentLocation(batch?.current_location ?? 'No location set');
                setBin(batch?.bin ?? null);
            })
            .catch(err => console.error(err))
    }, [preload, batchNumber]);

    // The bin label is QR scanned: the scanner types it and presses Enter
    const handleSetBin = (event) => {
        event.preventDefault();
        if (!binString)
            return;
        callApi('set-batch-bin', { batch_id: batchNumber, bin: binString })
            .then(() => {
                setBin(binString);
                setBinString('');
            })
            .catch(err => {
                setPopupMessage(err.response?.data?.error ?? `Could not set bin for batch ${batchNumber}`);
                console.error(err);
            })
    }

    const handleAddSensor = (event) => {
        event.preventDefault();
        if (!sensorString)
            return;
        setSensorString('');
        let sensorId, checkDigit;
        try {
            [sensorId, checkDigit] = parseSensorString(sensorString);
        } catch (error) {
            setPopupMessage(`"${sensorString}": ${error.message}`);
            return;
        }
        const sensorObject = { sensor: `${sensorId}:${checkDigit}`, online: false, spare: spareMode }

        if (addedSensors.includes(sensorId)) {
            setPopupMessage(`Sensor "${sensorId}" is already in this batch`);
            return;
        }

        setAddedSensors([...addedSensors, parseInt(sensorId)]);
        addSensor(sensorString, batchNumber, spareMode)
            .then(sensorValid => {
                if (!sensorValid) {
                    setPopupMessage(`Sensor "${sensorId}" could not be added`);
                    setSensors(sensors.filter(item => JSON.stringify(item) !== JSON.stringify(sensorObject)))
                    setAddedSensors(addedSensors.filter(item => parseInt(item) !== parseInt(sensorId)))
                }
            })
        setSensors([...sensors, sensorObject]);
    }

    const getAllLeads = async () => {
        const noCable = [], failed = [];
        let added = 0;
        await Promise.all(sensors.map(sensor => {
            const sensorId = sensor.sensor.split(':')[0];
            return callApi('get-sensor-cable-id', { sensor_id: sensorId })
                .then(() => added++)
                .catch(err => {
                    // backend answers 509 when iMonnit has no cable on the sensor
                    if (err.response?.status === 509)
                        noCable.push(sensorId);
                    else {
                        failed.push(sensorId);
                        console.error(`Unable to automatically add cable to sensor ${sensorId}: ${err}`)
                    }
                })
        }))
        const lines = [`Leads added for ${added} of ${sensors.length} sensors`];
        if (noCable.length) lines.push(`No cable on: ${noCable.join(', ')}`);
        if (failed.length) lines.push(`Lookup failed: ${failed.join(', ')}`);
        setPopupMessage(lines.join('. '))
    }

    const checkStatus = () => {
        callApi('get-online-sensors', { order_id: orderId })
            .then(response => {
                for (const sensor of addedSensors) {
                    if (!response.online_sensors.includes(sensor)) {
                        continue;
                    }
                    let newSensors = []
                    for (const sensorElement of sensors) {
                        if (parseSensorString(sensorElement.sensor)[0] === sensor) {
                            sensorElement.online = true;
                            sensorElement.cable_id = response.order_sensors.filter(s => s.sensor_id === sensor)[0].cable_id
                        }
                        newSensors.push({ ...sensorElement });
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

    const removeBatch = (force = false) => {
        setCancelling(true);
        Promise.all(addedSensors.map(sensorId => callApi('remove-sensor-from-batch', { sensor_id: sensorId, batch_id: batchNumber })))
            .then(() => callApi('delete-batch', { batch_id: batchNumber, force }))
            .then(() => setBatches(current => current.filter(batch => batch.batch_id !== batchNumber)))
            .catch(error => {
                setCancelling(false);
                const message = error.response?.data?.error ?? `Could not remove batch ${batchNumber}`;
                if (error.response?.status === 409 && !force)
                    setPopupMessage({ message, action: { label: 'Delete anyway', onClick: () => removeBatch(true) } });
                else
                    setPopupMessage(message);
                console.error(error)
            })
    }

    const printWorkOrder = () => {
        callApi('generate-work-order', { batch_id: batchNumber, print: true })
            .then(setPopupMessage(`Batch ${batchNumber} work order printed`))
    }

    const requestRemove = (sensorObject) => {
        sensorToRemove.current = sensorObject;
        setRemoveConfirmation([`Remove sensor ${parseSensorString(sensorObject.sensor)[0]} from batch ${batchNumber}?`]);
    }

    // Same two calls as the testing page: reset the iMonnit heartbeat, then drop the batch row
    const removeSensor = () => {
        const [sensorId, checkDigit] = parseSensorString(sensorToRemove.current.sensor);
        callApi('remove-sensor', { sensor_id: sensorId, check_digit: checkDigit })
            .then(() => callApi('remove-sensor-from-batch', { sensor_id: sensorId, batch_id: batchNumber }))
            .then(() => {
                setSensors(current => current.filter(s => parseSensorString(s.sensor)[0] !== sensorId));
                setAddedSensors(current => current.filter(id => parseInt(id) !== sensorId));
                setPopupMessage(`Sensor ${sensorId} removed from batch ${batchNumber}`);
            })
            .catch(err => {
                setPopupMessage(`Could not remove sensor ${sensorId}`);
                console.error(err);
            })
    }

    const onSpareChange = (sensorId, spare) => {
        setSensors(current => current.map(s => parseSensorString(s.sensor)[0] === sensorId ? { ...s, spare } : s));
    }

    if (!displayed) {
        return (
            <button className={styles.default_button} onClick={() => setDisplayed(true)}>{`Expand (${summary}`}</button>
        )
    }

    return (
        <section className={`${styles.subsection} ${styles.stack}`}>
            <ConfirmationPopup confirmationArray={removeConfirmation} setConfirmationArray={setRemoveConfirmation} handleConfirm={removeSensor} confirmText={'Remove'} />
            <button className={styles.default_button} onClick={() => setDisplayed(false)}>{`Hide (${summary}`}</button>

            <div className={styles.current_location_text}>{`Current location: ${currentLocation} | Bin: `}<span className={binClass(bin)}>{bin ?? 'none'}</span></div>

            <div className={styles.grid_menu}>
                <div className={styles.row}>
                    <form onSubmit={handleAddSensor} data-testid={'addSensorForm'} className={styles.row} style={{ flex: 1 }}>
                        <input type='text' value={sensorString} onChange={event => setSensorString(event.target.value)} className={styles.default_text_box} placeholder={spareMode ? 'Scan spare' : 'Scan Sensor'} style={{ flex: 1 }} />
                        <label className={styles.admin_check_box_container}>
                            <input className={styles.admin_check_box} type='checkbox' checked={spareMode} onChange={event => setSpareMode(event.target.checked)} /> Spare
                        </label>
                    </form>
                    <form onSubmit={handleSetBin} data-testid={'binForm'}>
                        <input type='text' value={binString} onChange={event => setBinString(event.target.value.toUpperCase())} className={styles.default_text_box} placeholder={'Scan bin'} style={{ width: '7rem' }} />
                    </form>
                </div>
                <LocationPicker batchNumber={batchNumber} onMoved={setCurrentLocation} />
                <Button onClick={printWorkOrder} innerText={'Print work order'} />
                <Button onClick={getAllLeads} innerText={'Get all leads'} />
            </div>

            <ScannedSensors sensorList={sensors} batchNumber={batchNumber} onSpareChange={onSpareChange} onRemove={requestRemove} />

            {hideCancel ? <></> :
                <div className={styles.card_actions}>
                    <button type="button" className={`${styles.default_button} ${styles.red}`} onClick={() => removeBatch()} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Cancel'}</button>
                </div>}
        </section>
    )
}

export default AddBatchMenu;