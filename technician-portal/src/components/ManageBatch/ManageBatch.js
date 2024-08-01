import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";
import ip from "../../utils/ip/ip";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";
import TestingMenu from "../TestingMenu/TestingMenu";

import styles from "../../styles/styles.module.css";

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

    const getSetPoints = () => {
        switch (procedureId) {
            case 1:
                return [
                    {
                        temperature: '-999.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.005 }
                    },
                    {
                        temperature: '28.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.005 }
                    },
                    {
                        temperature: '-25.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.009 }
                    },
                    {
                        temperature: '90.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.006 }
                    }
                ];
            case 2:
                return [
                    {
                        temperature: '-999.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.0078 }
                    },
                    {
                        temperature: '0.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.0078 }
                    },
                    {
                        temperature: '-80.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.0057 }
                    },
                    {
                        temperature: '-197.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.0020 }
                    }
                ];
            case 3:
                return [
                    {
                        temperature: '40.00',
                        humidity: '20.00',
                        stabilityCriteria: { difference: 2.0, slope: 0.003, standardDeviation: 0.30 }
                    },
                    {
                        temperature: '30.00',
                        humidity: '50.00',
                        stabilityCriteria: { difference: 2.0, slope: 0.003, standardDeviation: 0.60 }
                    },
                    {
                        temperature: '20.00', humidity: '80.00',
                        stabilityCriteria: { difference: 2.0, slope: 0.003, standardDeviation: 0.65 }
                    },
                ];
            case 4:
                return [
                    {
                        temperature: '-999.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.00036 }
                    },
                    {
                        temperature: '28.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.00036 }
                    },
                    {
                        temperature: '-25.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.044 }
                    },
                    {
                        temperature: '90.00',
                        stabilityCriteria: { difference: 0.5, slope: 0.0099, standardDeviation: 0.0032 }
                    }
                ];
            case 5:
                return [
                    {
                        temperature: '-999.00',
                        stabilityCriteria: { difference: 0.25, slope: 0.005, standardDeviation: 0.075 }
                    },
                    {
                        temperature: '20.00',
                        stabilityCriteria: { difference: 0.25, slope: 0.005, standardDeviation: 0.075 }
                    },
                    {
                        temperature: '-20.00',
                        stabilityCriteria: { difference: 0.25, slope: 0.005, standardDeviation: 0.065 }
                    },
                    {
                        temperature: '60.00',
                        stabilityCriteria: { difference: 0.25, slope: 0.005, standardDeviation: 0.01 }
                    }
                ];
            default:
                return null;
        }
    }

    useEffect(() => {
        callApi('get-batch-by-id', { batch_id: batchNumber })
            .then(response => {
                setCurrentLocation(response.current_location)
            })
    })

    const downloadWorkOrder = () => {
        const url = process.env.REACT_APP_STATUS === 'production' ? `https://${ip}/api/generate-work-order?batch_id=${batchNumber}` : `http://${ip}/api/generate-work-order?batch_id=${batchNumber}`
        axios.get(url, { responseType: 'blob' })
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
                return response;
            })
            .then(response => {
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
        const promises = [];
        for (const sensor of sensorList) {
            try {
                promises.push(callApi('change-sensor-heartbeat', { sensor_id: sensor.sensor_id, heartbeat: heartbeat }));
            } catch (error) {
                console.error(error);
                setPopupMessage(`Sensor ${sensor.sensor_id} failed: ${error}`)
            }
        }
        const responses = await Promise.all(promises);
        for (const response of responses) {
            if (response.Result === 'Success') {
                setPopupMessage(`Heartbeat changed to ${heartbeat} minutes`);
            } else {
                setPopupMessage('Heartbeats not changed successfully');
            }
        }
        setHeartBeat('');
    }

    const handleLocationChange = (event) => {
        setLocation(event.target.value.toUpperCase());
    }

    const handleLocationSubmit = async (event) => {
        event.preventDefault();

        if (!location) return;

        const response = await callApi('create-location-log', {
            'location': location,
            'batch_id': batchNumber
        })

        if (!response.error) {
            setPopupMessage(`Batch moved to ${location}`);
            setCurrentLocation(location);
            setLocation('');

            if (location.startsWith('S')) {
                callApi('log-batch-interaction', {
                    department: 'testing',
                    start: false,
                    technician_id: technicianId,
                    batch_id: batchNumber
                })

                callApi('set-batch-active-state', {
                    batch_id: batchNumber,
                    active_state: false
                })

                for (const sensor of sensorList) {
                    callApi('change-sensor-heartbeat', {
                        sensor_id: sensor.sensor_id,
                        heartbeat: 120
                    })
                }
            } else if (location.startsWith('T')) {
                callApi('log-batch-interaction', {
                    department: 'testing',
                    start: true,
                    technician_id: technicianId,
                    batch_id: batchNumber
                })
            }
        } else {
            setPopupMessage('The batch was not moved successfully');
            console.error(response.error)
        }
    }

    const handleSensorChange = (event) => {
        setSensor(event.target.value)
    }

    const handleSensorSubmit = (event) => {
        event.preventDefault();
        const sensorId = parseInt(sensor.split(':')[0])
        if (sensorList.filter(sensorObject => sensorObject.sensor_id === sensorId).length > 0) {
            setConfirmationArray([`Would you like to REMOVE sensor ${sensorId} from batch ${batchNumber}?`])
        } else {
            setConfirmationArray([`Would you like to ADD sensor ${sensorId} to batch ${batchNumber}?`])
        }
    }

    const handleSensorConfirm = () => {
        const sensorId = parseInt(sensor.split(':')[0]);
        const checkDigit = parseInt(sensor.split(':')[1]);
        if (sensorList.filter(sensorObject => sensorObject.sensor_id === sensorId).length > 0) {
            callApi('remove-sensor', { sensor_id: sensorId, check_digit: checkDigit });
            callApi('remove-sensor-from-batch', { sensor_id: sensorId })
                .then(response => {
                    setPopupMessage(response.Result);
                    setSensorList(sensorList.filter(sensorObject => sensorObject.sensor_id !== sensorId));
                })
        } else {
            callApi('create-sensor', { sensor_id: sensorId, check_digit: sensor.split(':')[1], batch_id: batchNumber })
                .then(response => {
                    if (response[0].sensor_id !== sensorId) {
                        setPopupMessage(response.Result);
                        return;
                    }
                    callApi('get-sensors', { 'batch_id': batchNumber })
                        .then(data => {
                            setSensorList(data);
                            setPopupMessage(`Sensor ${sensorId} added to batch ${batchNumber}`);
                        })
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
                {confirmationArray.length > 0 ? <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={handleSensorConfirm} /> : <></>}
                <div className={styles.grid_menu}>
                    <h1 className={styles.title}>{'Batch: ' + batchNumber + (currentLocation ? ` | Current location: ${currentLocation}` : ` | No location set`)}</h1>
                    <button className={styles.default_button} onClick={() => navigate('/batchEntry')}>Change batch</button>
                    <form onSubmit={handleLocationSubmit} data-testid={'locationForm'}>
                        <input type='text' value={location} onChange={handleLocationChange} className={styles.default_text_box} placeholder={'Location'} />
                    </form>
                    <button className={styles.default_button} onClick={downloadWorkOrder}>Download work order</button>
                    <form onSubmit={handleHeartBeatSubmit} data-testid={'heartbeatForm'}>
                        <input type='text' value={heartbeat} onChange={handleHeartBeatChange} className={styles.default_text_box} placeholder={'Heartbeat'} />
                    </form>
                    <button className={styles.default_button} onClick={printWorkOrder}>Print work order</button>
                    <form onSubmit={handleSensorSubmit}>
                        <input type='text' value={sensor} onChange={handleSensorChange} className={styles.default_text_box} placeholder={'Add/remove sensor'} />
                    </form>
                </div>
                <div className={styles.test_menu}>
                    <h1 className={styles.title}>{`Calibration Procedure: ${procedureId}`}</h1>
                    <TestingMenu readings={readings} setPoints={getSetPoints()} />
                </div>
            </div>
        </>
    );
}

export default ManageBatch;