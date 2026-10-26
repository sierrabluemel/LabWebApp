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
import setBatchLocation from "../../utils/setBatchLocation";
import Button from "../Button/Button";

function ManageBatch() {
    const navigate = useNavigate();
    const {
        batchNumber, sensorList, setSensorList,
        procedureId, setPopupMessage, technicianId,
        customerOrderNumber
    } = useAppContext()

    const [heartbeat, setHeartBeat] = useState('');
    const [location, setLocation] = useState('');
    const [currentLocation, setCurrentLocation] = useState('');
    const [sensor, setSensor] = useState('');
    const readings = useRef(null);
    const setPoint = useRef(null);
    const isMounted = useRef(false);
    const [referencesToVerify, setReferencesToVerify] = useState([]);
    const referenceStrings = useRef([])
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
        setSensor(event.target.value.toUpperCase());
    }

    const handleSensorSubmit = (event) => {
        event.preventDefault()
        const [sensorId, checkDigit] = parseSensorString(sensor);
        if (sensorList.filter(sensorObject => sensorObject.sensor_id === sensorId).length > 0) {
            callApi('remove-sensor', { sensor_id: sensorId, check_digit: checkDigit })
                .then(() => {
                    callApi('remove-sensor-from-batch', { sensor_id: sensorId })
                        .then(response => {
                            setPopupMessage(response.Result);
                            setSensorList(sensorList.filter(sensorObject => sensorObject.sensor_id !== sensorId));
                        })
                })
                .catch(err => {
                    setPopupMessage(`Could not remove sensor ${sensorId} from iMonnit`)
                    console.error(err)
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
                <ConfirmationPopup confirmationArray={referenceStrings.current} setConfirmationArray={setReferencesToVerify} handleConfirm={verifyReferences} />
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
                    <form onSubmit={handleLocationSubmit} data-testid={'locationForm'}>
                        <input type='text' value={location} onChange={handleLocationChange} className={styles.default_text_box} placeholder={'Location'} />
                    </form>
                    <form onSubmit={handleHeartBeatSubmit} data-testid={'heartbeatForm'}>
                        <input type='text' value={heartbeat} onChange={handleHeartBeatChange} className={styles.default_text_box} placeholder={'Heartbeat (minutes)'} />
                    </form>
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
