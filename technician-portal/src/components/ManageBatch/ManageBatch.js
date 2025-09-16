import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";
import callApiAdvanced from "../../utils/api/callApiAdvanced";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";
import TestingMenu from "../TestingMenu/TestingMenu";

import styles from "../../styles/styles.module.css";
import parseSensorString from "../../utils/parseSensorString";
import setBatchLocation from "../../utils/setBatchLocation";

function ManageBatch() {
    const navigate = useNavigate();
    const {
        batchNumber, sensorList, setSensorList,
        procedureId, setPopupMessage, technicianId,
    } = useAppContext()

    const [heartbeat, setHeartBeat] = useState('');
    const [location, setLocation] = useState('');
    const [currentLocation, setCurrentLocation] = useState('');
    const [confirmationArray, setConfirmationArray] = useState(false);
    const [sensor, setSensor] = useState('');
    const readings = useRef(null);
    const setPoint = useRef(null);
    const isMounted = useRef(false);
    const [referencesToVerify, setReferencesToVerify] = useState([]);
    const referenceStrings = useRef(['The following references have been recently changed'])
    const [calibrationProcedureDescription, setCalibrationProcedureDescription] = useState('');

    useEffect(() => {
        if (!isMounted.current) {
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
                    if (contentType !== 'application/json; charset=utf-8') {
                        console.error(`Expecting work order 'application/json; charset=utf-8' but instead got '${contentType}': ${response}`);
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

    const handleHeartBeatChange = (event) => {
        setHeartBeat(event.target.value);
    }

    const handleHeartBeatSubmit = async (event) => {
        if (!heartbeat) {
            return;
        }
        event.preventDefault();
        callApi('change-batch-heartbeats', { batch_id: batchNumber, heartbeat: heartbeat })
            .then((response) => {
                if (response.Result === 'Success') {
                    setPopupMessage(`Heartbeat changed to ${heartbeat} minutes`);
                    setHeartBeat('');
                }
            })
            .catch((err) => {
                setPopupMessage('Heartbeats not changed successfully');
                console.error(err)
            });
    }

    const handleLocationChange = (event) => {
        setLocation(event.target.value.toUpperCase());
    }

    const handleLocationSubmit = (event) => {
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
            .catch((err) => {
                setPopupMessage('The batch was not moved successfully');
                console.error(err)
            })
    }

    const handleSensorChange = (event) => {
        setSensor(event.target.value)
    }

    const handleSensorSubmit = (event) => {
        event.preventDefault();
        const sensorId = parseInt(parseSensorString(sensor)[0]);

        if (sensorList.filter(sensorObject => sensorObject.sensor_id === sensorId).length > 0) {
            setConfirmationArray([`Would you like to REMOVE sensor ${sensorId} from batch ${batchNumber}?`])
        } else {
            setConfirmationArray([`Would you like to ADD sensor ${sensorId} to batch ${batchNumber}?`])
        }
    }

    const handleSensorConfirm = () => {
        const [sensorId, checkDigit] = parseSensorString(sensor);
        if (sensorList.filter(sensorObject => sensorObject.sensor_id === sensorId).length > 0) {
            callApi('remove-sensor', { sensor_id: sensorId, check_digit: checkDigit });
            callApi('remove-sensor-from-batch', { sensor_id: sensorId })
                .then(response => {
                    setPopupMessage(response.Result);
                    setSensorList(sensorList.filter(sensorObject => sensorObject.sensor_id !== sensorId));
                })
        } else {
            callApi('create-sensor', { sensor_id: sensorId, check_digit: checkDigit, batch_id: batchNumber })
                .then(response => {
                    if (response.sensor_id !== sensorId) {
                        setPopupMessage(response.Result);
                        return;
                    }
                    return callApi('get-sensors', { 'batch_id': batchNumber })
                })
                .then(data => {
                    setSensorList(data);
                    setPopupMessage(`Sensor ${sensorId} added to batch ${batchNumber}`);
                })
        }
        setSensor('')
    }

    const printWorkOrder = () => {
        callApi('generate-work-order', { batch_id: batchNumber, print: true })
            .then(setPopupMessage(`Batch ${batchNumber} work order printed`))
    }

    return (
        <>
            <div className={styles.menu}>
                {referencesToVerify.length === 0 ? <></> : <ConfirmationPopup confirmationArray={referenceStrings.current} setConfirmationArray={setReferencesToVerify} handleConfirm={verifyReferences} />}
                {confirmationArray.length > 0 ? <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={handleSensorConfirm} /> : <></>}
                <div className={styles.grid_menu}>
                    <h1 className={styles.title}>{'Batch: ' + batchNumber + (currentLocation ? ` | Current location: ${currentLocation}` : ` | No location set`)}</h1>
                    <button className={styles.default_button} onClick={() => navigate('/batchEntry')}>Change batch</button>
                    <form onSubmit={handleLocationSubmit} data-testid={'locationForm'}>
                        <input type='text' value={location} onChange={handleLocationChange} className={styles.default_text_box} placeholder={'Location'} />
                    </form>
                    <button className={styles.default_button} onClick={downloadWorkOrder}>Download work order</button>
                    <form onSubmit={handleHeartBeatSubmit} data-testid={'heartbeatForm'}>
                        <input type='text' value={heartbeat} onChange={handleHeartBeatChange} className={styles.default_text_box} placeholder={'Heartbeat (minutes)'} />
                    </form>
                    <button className={styles.default_button} onClick={printWorkOrder}>Print work order</button>
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
