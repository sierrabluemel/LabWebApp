import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";
import callApiAdvanced from "../../utils/api/callApiAdvanced";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";
import TestingMenu from "../TestingMenu/TestingMenu";
import backArrow from "../../media/arrow.png";

import styles from "../../styles/styles.module.css";
import parseSensorString from "../../utils/parseSensorString";
import LocationPicker from "../LocationPicker/LocationPicker";
import Button from "../Button/Button";
import useOpenBatch from "../../utils/useOpenBatch";

// Heartbeats the batch can be set to, in minutes
const HEARTBEATS = [
    { label: '3 seconds', minutes: 0.05 },
    { label: '2 minutes', minutes: 2 },
    { label: '2 hours', minutes: 120 },
];

function ManageBatch() {
    const navigate = useNavigate();
    const {
        batchNumber, sensorList, setSensorList,
        procedureId, setPopupMessage, technicianId,
        customerOrderNumber
    } = useAppContext()

    const [heartbeat, setHeartBeat] = useState('');
    const [currentLocation, setCurrentLocation] = useState('');
    const [sensor, setSensor] = useState('');
    const readings = useRef(null);
    const setPoint = useRef(null);
    const isMounted = useRef(false);
    const [referencesToVerify, setReferencesToVerify] = useState([]);
    const referenceStrings = useRef([])
    const [calibrationProcedureDescription, setCalibrationProcedureDescription] = useState('');
    const [removeConfirmation, setRemoveConfirmation] = useState([]);
    const sensorToRemove = useRef(null);
    const openBatch = useOpenBatch();

    // After a page refresh shared state is empty; reload the batch from the URL
    useEffect(() => {
        if (batchNumber) return;
        const batchId = new URLSearchParams(window.location.search).get('batch_id');
        batchId ? openBatch(batchId) : navigate('/batchEntry');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isMounted.current && batchNumber) {
            callApi('get-batch-by-id', { batch_id: batchNumber })
                .then(response => {
                    setCurrentLocation(response.current_location)
                })
            callApi('get-calibration-procedures').then(response => {
                const currentProcedure = response.filter(procedure => procedure.calibration_procedure_id === procedureId)[0];
                setPoint.current = currentProcedure.set_points;
                setCalibrationProcedureDescription(currentProcedure.calibration_procedure);
                isMounted.current = true;
            })
        }
    })

    async function verifyReferences() {
        const promises = []
        for (const reference of referencesToVerify) {
            promises.push(callApi('verify-equipment-in-testing', { asset_tag: reference.asset_tag, technician_id: technicianId }))
        }

        await Promise.all(promises);
        setPopupMessage('Equipment verified')
    }

    const downloadWorkOrder = () => {
        callApiAdvanced(`api/generate-work-order?batch_id=${batchNumber}`, { responseType: 'blob' })
            .then(response => {
                if (response.status === 200) {
                    const contentType = response.headers['content-type']
                    if (!contentType?.startsWith('application/pdf')) {
                        console.error(`Expecting work order 'application/pdf' but instead got '${contentType}': ${response}`);
                        setPopupMessage(`Failed to generate work order for batch ${batchNumber}: Server responded with the wrong file type`);
                    }
                } else {
                    console.error(`Could not complete generation, response.status: ${response.status}`);
                    setPopupMessage(`Failed to generate work order for batch ${batchNumber}: Bad server response`);
                }
                const url = URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = `workOrder${batchNumber}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    const getSensorLeads = async () => {
        await Promise.all(sensorList.map(sensor => {
            return callApi('get-sensor-cable-id', { sensor_id: sensor.sensor_id })
                .catch(err => {
                    if (err.status !== 509) {
                        setPopupMessage('Unable to automatically add cable to sensor')
                        console.error(`Unable to automatically add cable to sensor: ${err}`)
                    }
                })
        }))
        setPopupMessage('Got all leads');
        callApi('get-sensors', { 'batch_id': batchNumber })
            .then(data => {
                setSensorList(data);
            })
    }

    // A select doesn't submit its form on Enter, so apply the picked heartbeat here
    const handleHeartBeatKeyDown = (event) => {
        if (event.key !== 'Enter' || !heartbeat)
            return;
        event.preventDefault();
        const label = HEARTBEATS.find(option => String(option.minutes) === heartbeat).label;
        callApi('change-batch-heartbeats', { batch_id: batchNumber, heartbeat: heartbeat })
            .then((response) => {
                if (response.Result === 'Success') {
                    setPopupMessage(`Heartbeat changed to ${label}`);
                    setHeartBeat('');
                }
            })
            .catch((err) => {
                setPopupMessage('Heartbeats not changed successfully');
                console.error(err)
            });
    }

    const handleSensorChange = (event) => {
        setSensor(event.target.value.toUpperCase());
    }

    const removeSensor = () => {
        const [sensorId, checkDigit] = sensorToRemove.current;
        callApi('remove-sensor', { sensor_id: sensorId, check_digit: checkDigit })
            .then(() => callApi('remove-sensor-from-batch', { sensor_id: sensorId, batch_id: batchNumber }))
            .then(response => {
                setPopupMessage(response.Result);
                setSensorList(sensorList.filter(sensorObject => sensorObject.sensor_id !== sensorId));
            })
            .catch(err => {
                setPopupMessage(`Could not remove sensor ${sensorId} from iMonnit`)
                console.error(err)
            })
    }

    const handleSensorSubmit = (event) => {
        event.preventDefault()
        setSensor('')
        let sensorId, checkDigit;
        try {
            [sensorId, checkDigit] = parseSensorString(sensor);
        } catch (error) {
            setPopupMessage(`"${sensor}": ${error.message}`);
            return;
        }
        if (sensorList.filter(sensorObject => sensorObject.sensor_id === sensorId).length > 0) {
            // Scanning a sensor already in the batch removes it, so confirm in case it was a double scan
            sensorToRemove.current = [sensorId, checkDigit];
            setRemoveConfirmation([`Sensor ${sensorId} is already in this batch. Remove it?`]);
            return;
        }
        callApi('create-sensor', { sensor_id: sensorId, check_digit: checkDigit, batch_id: batchNumber })
            .then(response => {
                if (response.sensor_id !== sensorId)
                    return Promise.reject(new Error(response.error));
                // A sensor added mid-test has to join the testing networks and heartbeat like the rest of the batch
                if (currentLocation?.startsWith('T'))
                    return callApi('move-batch-to-network-group', { batch_id: batchNumber, network_group: 'testing', heartbeat: 0.05 })
                        .then(() => callApi('change-sensor-heartbeat', { sensor_id: sensorId, heartbeat: 0.05 }))
            })
            .then(() => callApi('get-sensors', { 'batch_id': batchNumber }))
            .then(data => {
                setSensorList(data);
                setPopupMessage(`Sensor ${sensorId} added to batch ${batchNumber}`);
            })
            .catch(err => {
                setPopupMessage(err.response?.data?.error ?? err.message ?? `Could not add sensor ${sensorId}`);
                console.error(err)
            })
    }

    const printWorkOrder = () => {
        callApi('generate-work-order', { batch_id: batchNumber, print: true })
            .then(setPopupMessage(`Batch ${batchNumber} work order printed`))
    }

    return (
        <>
            <div className={styles.menu}>
                <ConfirmationPopup confirmationArray={referenceStrings.current} setConfirmationArray={setReferencesToVerify} handleConfirm={verifyReferences} />
                <ConfirmationPopup confirmationArray={removeConfirmation} setConfirmationArray={setRemoveConfirmation} handleConfirm={removeSensor} confirmText={'Remove'} />
                <div className={styles.toolbar}>
                    <img className={styles.back_arrow_image} onClick={() => navigate('/batchEntry')} src={backArrow} alt="Back button" />
                    <h1 className={styles.title}>{`${customerOrderNumber} | Batch: ${batchNumber} | ${currentLocation ? `Current location: ${currentLocation}` : `No location set`}`}</h1>
                    <div className={styles.row}>
                        <Button innerText={'Print work order'} onClick={printWorkOrder} />
                        <Button innerText={'Download work order'} onClick={downloadWorkOrder} />
                        <Button innerText={'Get sensor leads'} onClick={getSensorLeads} />
                    </div>
                </div>
                <div className={styles.triple_grid_menu}>
                    <LocationPicker batchNumber={batchNumber} onMoved={setCurrentLocation} />
                    <select className={styles.dropdown} aria-label={'Heartbeat'} value={heartbeat} onChange={event => setHeartBeat(event.target.value)} onKeyDown={handleHeartBeatKeyDown}>
                        {/* Shown in the closed box only; hidden from the list */}
                        <option value='' disabled hidden>Change heartbeat...</option>
                        {HEARTBEATS.map(option => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}
                    </select>
                    <form onSubmit={handleSensorSubmit}>
                        <input type='text' value={sensor} onChange={handleSensorChange} className={styles.default_text_box} placeholder={'Add/remove sensor'} />
                    </form>
                </div>
                <div className={styles.test_menu}>
                    <h1 className={styles.title}><span className={styles[`calibration_${procedureId}`]}>CP: {procedureId}</span> | {calibrationProcedureDescription}</h1>
                    {setPoint.current ?
                        <TestingMenu readings={readings} setPoints={setPoint.current} referenceStrings={referenceStrings} referencesToVerify={referencesToVerify} setReferencesToVerify={setReferencesToVerify} /> :
                        <></>}
                </div>
            </div>
        </>
    );
}

export default ManageBatch;
