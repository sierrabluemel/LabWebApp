import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import callApi from "../../utils/api/callApi";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import parseSensorString from "../../utils/parseSensorString";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";

import { useAppContext } from "../../contexts/app";

import styles from "../../styles/styles.module.css";
import getReferences from "../../utils/getReferences";
import Button from "../Button/Button";
import SensorLink from "../SensorLink/SensorLink";

function Shipping() {
    const {
        setConfirmationMessage, technicianId, setPopupMessage,
        orderNumber, batches, setBatches
    } = useAppContext()

    const navigate = useNavigate()

    const certificateList = useRef([]);

    const [references, setReferences] = useState(new Set());
    const [certificateMessage, setCertificateMessage] = useState('Loading...');
    const [sensor, setSensor] = useState('');
    const [sensorList, setSensorList] = useState([]);
    const [scannedSensors, setScannedSensors] = useState([]);
    const [sensorsNotRemoved, setSensorsNotRemoved] = useState([]);
    const [missedSensorsArray, setMissedSensorsArray] = useState([]);
    const [optionsOpen, setOptionsOpen] = useState(false)
    const isMounted = useRef(false);
    const [sensorsRemoved, setSensorsRemoved] = useState(false);
    const [sensorsRemovedMessage, setSensorsRemovedMessage] = useState('Loading...')

    const [confirmationArray, setConfirmationArray] = useState([]);
    const [order, setOrder] = useState(null)
    const [referenceVerificationArray, setReferenceVerificationArray] = useState([]);

    const checkSensorList = (sensors = null) => {
        callApi('get-sensor-list')
            .then(sensorsOnNetwork => {
                const orderSensors = sensors || sensorList;

                let sensorsNotRemoved = 0
                orderSensors.forEach(sensor => {
                    sensorsOnNetwork.includes(sensor.sensor_id) && sensorsNotRemoved++;
                })
                if (sensorsNotRemoved > 0) {
                    setSensorsRemoved(false);
                    setSensorsRemovedMessage(`Sensors not removed: ${sensorsNotRemoved}`)
                } else {
                    setSensorsRemoved(true);
                    setSensorsRemovedMessage('All sensors removed');
                }
            })
    }

    const getCertificates = () => {
        callApi('get-certificates-by-order-id', { order_id: orderNumber })
            .then(certificates => {
                if (!certificates.length || certificates.length === 0) {
                    setCertificateMessage('No certificates found')
                    return
                }
                const fullDate = new Date(certificates[0].timestamp)
                const dateString = `${fullDate.getMonth() + 1}/${fullDate.getDate()}/${fullDate.getFullYear()}`;
                setCertificateMessage(`${certificates.length} certificate${certificates.length > 1 ? 's' : ''} generated on ${dateString}`);
                certificateList.current = certificates.sort((a, b) => a.certificate_id - b.certificate_id);
            })
    }

    async function getProcedureReferences(calibrationProcedureIds) {
        const promises = []
        for (const procedureId of calibrationProcedureIds) {
            promises.push(getReferences(procedureId).then(referenceResponse => {
                for (const reference of referenceResponse) {
                    setReferences(references.add(JSON.stringify(reference))) // reference must become a string to allow Set() to recognize the duplicates
                }
            }))
        }
        await Promise.all(promises)
        return references
    }

    function confirmReferences() {
        for (let reference of references) {
            reference = JSON.parse(reference);
            if (reference.certificate_verified) {
                continue;
            }
            const parameters = {
                asset_tag: reference.asset_tag,
                technician_id: technicianId
            }
            callApi('verify-equipment-in-shipping', parameters)
                .catch((err) => {
                    console.error(err);
                    setPopupMessage('There was an error validating references. Please reload this page')
                })
        }
        setPopupMessage('References verified');
    }

    useEffect(() => {
        if (isMounted.current)
            return

        isMounted.current = true;
        const calibrationProcedures = new Set()
        getCertificates();
        callApi('get-order-by-id', { 'order_id': orderNumber })
            .then(response => {
                setOrder(response);
                setBatches(batches.sort((batchA, batchB) => batchA.batch_id - batchB.batch_id));

                batches.forEach(batch => {
                    calibrationProcedures.add(batch.calibration_procedure_id);
                })

                getProcedureReferences(calibrationProcedures)
                    .then(references => {
                        const referenceVerifiedStrings = ['The following references must be verified for information to go onto the certificate']
                        references.forEach(reference => {
                            reference = JSON.parse(reference);
                            if (!reference.certificate_verified) {
                                referenceVerifiedStrings.push(`Reference ${reference.asset_tag} (${reference.description}) will be added to certificates with a calibration date of ${parseDataBaseDate(reference.last_calibration)} and an expiration date of ${parseDataBaseDate(reference.next_calibration)}`)
                            }
                        })

                        if (referenceVerifiedStrings.length > 1)
                            setReferenceVerificationArray(referenceVerifiedStrings)
                    })

            })

        callApi('get-sensors-by-order-id', { order_id: orderNumber })
            .then(response => {
                setSensorList(response)
                setSensorsNotRemoved(response.map(s => s.sensor_id))
                checkSensorList(response);
            })
            .catch((err) => {
                console.error(err)
            })

    })

    const generateCertificates = async () => {
        const promises = [];
        setCertificateMessage('Generating certificates...');
        for (const batch of batches) {
            promises.push(
                callApi('update-batch-technician', {
                    department: 'shipping',
                    technician_id: technicianId,
                    batch_id: batch.batch_id
                })
                    .then(() => {
                        return callApi('set-batch-active-state', {
                            batch_id: batch.batch_id,
                            active_state: false
                        })
                    })
                    .catch((err) => {
                        console.error(err);
                    })
            );
        }

        await Promise.all(promises);
        createCertificates()
    };

    const removeSensorsFromNetwork = async () => {
        setSensorsRemovedMessage('Loading...')
        callApi('remove-sensors-from-network', { sensor_ids: sensorsNotRemoved })
            .then(response => {
                const missed = response.sensors_missed
                setSensorsNotRemoved(missed)

                if (missed.length > 0)
                    setMissedSensorsArray([`Unable to remove ${missed.length > 1 ? missed.length + ' sensors' : '1 sensor'}. Would you like to retry?`])

                checkSensorList();
            })
    }

    const createCertificates = async () => {
        callApi('create-certificates', { order_id: orderNumber })
            .then((certificates) => {
                certificateList.current = certificates.sort((a, b) => a.certificate_id - b.certificate_id);
            })
            .then(() => getCertificates())
            .catch(error => {
                setCertificateMessage('No certificates found');
                console.error(error);

                if (error.response.data.error === 'Not enough readings to generate certificate')
                    setPopupMessage(`Not enough readings present to generate certificates`);
                else
                    setPopupMessage(`An error occurred while generating certificates`);
            })
    };

    const generateCertificate = async (sensorId) => {
        setCertificateMessage('Generating certificates...');
        callApi('create-certificates', { order_id: orderNumber, sensor_id: sensorId })
            .then((certificates) => {
                certificateList.current = certificates.sort((a, b) => a.certificate_id - b.certificate_id);
            })
            .then(() => getCertificates())
            .catch(error => {
                console.error(error);
                setPopupMessage(`An error occurred while generating certificates`);
            })
    };


    const printCertificateLabels = async () => {
        if (certificateList.current.length === 0) {
            setPopupMessage(`There are no labels to print`)
        }
        for (const certificate of certificateList.current) {
            const parameters = {
                sensor_id: certificate.sensor_id,
                calibration_date: certificate.generate_certificate_json.CS1,
                due_date: certificate.generate_certificate_json.CS2,
                certificate_number: `MNT-${certificate.certificate_id}`
            }

            if (certificate.cable_id)
                parameters.cable_id = certificate.cable_id

            try {
                await callApi('print-certificate-labels', parameters)
            } catch (error) {
                console.error(error)
                setPopupMessage('Unable to print label');
                return;
            }
        }
    };


    const printLabel = event => {
        event.preventDefault()
        if (!sensor) {
            setPopupMessage(`Please enter sensor id`);
            return;
        }
        const sensorId = parseInt(parseSensorString(sensor)[0]);
        const certificate = certificateList.current.filter(cert => cert.sensor_id === sensorId)[0]
        if (!certificate) {
            setPopupMessage(`No certificates found for sensor ${sensor}`)
            return;
        }

        if (!certificate.pass) {
            setPopupMessage(`Sensor ${certificate.sensor_id} failed calibration. Please place a red sticker on the sensor`);
            setScannedSensors([...scannedSensors, sensorId]);
            setSensor('');
            return
        }
        const parameters = {
            sensor_id: certificate.sensor_id,
            calibration_date: certificate.generate_certificate_json.CS1,
            due_date: certificate.generate_certificate_json.CS2,
            certificate_number: `MNT-${certificate.certificate_id}`
        }

        if (certificate.cable_id)
            parameters.cable_id = certificate.cable_id

        callApi('print-certificate-labels', parameters)
            .then(setScannedSensors([...scannedSensors, sensorId]))
            .catch((err) => {
                console.error(err)
                setPopupMessage('Unable to print label');
                return;
            })
            .finally(() => {
                setSensor('');
            })
    }


    const printCertificates = async () => {
        if (certificateList.current.length === 0) {
            setPopupMessage(`There are no certificates to print`)
        }

        callApi('generate-order-certificates', { order_id: orderNumber, print: true })
            .catch((error) => {
                console.error(error)
                setPopupMessage('Unable to print certificates');
                return;
            })
    }

    const printReturnRecord = () => {
        callApi('generate-return-record', { order_id: orderNumber, print: true })
            .then(() => {
                setPopupMessage('Return record printed')
            })
            .catch(err => {
                console.error(err)
                setPopupMessage('Unable to print return record')
            })
    }

    const createReturnRecord = () => {
        callApi('generate-return-record', { order_id: orderNumber }, true)
            .then(response => {
                if (response.status === 200 && response.headers.get('content-type') === 'application/json; charset=utf-8') {
                    const blob = new Blob([response.data], { type: 'application/pdf' });

                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `returnRecord${orderNumber}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    console.error(`Expecting return record to be 'application/pdf; charset=utf-8' but instead got '${response.headers.get('content-type')}': ${response}`);
                    setPopupMessage(`Failed to generate return record for order ${orderNumber}`);
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    const downloadCertificates = async () => {
        const order = await callApi('get-order-by-id', { 'order_id': orderNumber });
        callApi('generate-order-certificates', { order_id: orderNumber }, true)
            .then(response => {
                if (response.status === 200 && response.headers.get('content-type') === 'application/json; charset=utf-8') {
                    const blob = new Blob([response.data], { type: 'application/pdf' });

                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${order.customer_order_number}Certificates.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    console.error(`Expecting certificates to be 'application/pdf; charset=utf-8' but instead got '${response.headers.get('content-type')}': ${response}`);
                    setPopupMessage(`Failed to generate certificates for order ${orderNumber}`);
                }
            })
    }

    const handleCloseOrder = () => {
        let confirmationArray = [`Are you sure you would like to finish this order?`];
        setConfirmationArray(confirmationArray);
    }

    const endShipping = () => {
        callApi('set-order-active-state', { order_id: orderNumber, active_state: false })
            .then(Promise.all(batches.map((batch) => {
                return callApi('remove-batch-location', { batch_id: batch.batch_id })
                    .then(callApi('log-batch-interaction', {
                        department: 'shipping',
                        start: false,
                        technician_id: technicianId,
                        batch_id: batch.batch_id
                    }))
            })))
            .then(() => {
                setConfirmationMessage(`Order: ${orderNumber} closed, please add ${order.customer_order_number} to the slack channel`);
                navigate('/confirmation');
            })
            .catch((err) => {
                console.error(err)
            })
    }

    const extraButtonsClass = `${optionsOpen ? styles.extra_options_shown : styles.extra_options_hidden}`

    return (
        <>
            <div className={styles.menu}>
                <button onClick={() => setOptionsOpen(!optionsOpen)} className={styles.show_options_button}>More options {optionsOpen ? '▲' : '▼'}</button>

                <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={endShipping} />
                <ConfirmationPopup confirmationArray={referenceVerificationArray} setConfirmationArray={setReferenceVerificationArray} handleConfirm={confirmReferences} />
                <ConfirmationPopup confirmationArray={missedSensorsArray} setConfirmationArray={setMissedSensorsArray} handleConfirm={removeSensorsFromNetwork} />

                <h2>Order: {orderNumber} | {order ? order.customer_order_number : 'Loading...'} | Sensors: {sensorList.length > 0 ? sensorList.length : 'Loading...'}</h2>

                <div className={styles.batches_container}>
                    {
                        batches.map(batch =>
                            <div key={batch.batch_id} className={styles.shipping_batches}>
                                {batch.current_location
                                    ? <>{`Batch ${batch.batch_id} | Location: ${batch.current_location} | `}<span className={styles[`calibration_${batch.calibration_procedure_id}`]}>CP: {batch.calibration_procedure_id}</span></>
                                    : `Batch ${batch.batch_id} (Shipped)`}
                            </div>
                        )
                    }
                </div>

                <div className={styles.grid_menu}>
                    <Button onClick={generateCertificates} innerText={'Generate certificates'} />
                    <span className={`${styles.status_message} ${certificateList.current.length > 0 ? styles.status_dot_green : styles.status_dot_red}`}>{certificateMessage}</span>
                    <Button onClick={removeSensorsFromNetwork} innerText={'Remove sensors'} />
                    <span className={`${styles.status_message} ${sensorsRemoved ? styles.status_dot_green : styles.status_dot_red}`}>{sensorsRemovedMessage}</span>
                    <Button onClick={printReturnRecord} innerText={'Print return record'} />
                    <form onSubmit={printLabel}>
                        <input type='text' value={sensor} onChange={event => setSensor(event.target.value)} className={styles.default_text_box} placeholder={'Scan sensor to print label'} />
                    </form>
                    <Button onClick={printCertificates} innerText={'Print certificates'} />
                </div>

                <div className={extraButtonsClass}>

                    <hr />

                    <div className={styles.triple_grid_menu}>
                        <Button onClick={createReturnRecord} innerText={'Download return record'} />
                        <Button onClick={downloadCertificates} innerText={'Download certificates'} />
                        <Button onClick={printCertificateLabels} innerText={'Print all labels'} />
                    </div>
                </div>

                <hr />

                <div className={styles.sensor_container}>
                    {sensorList.map((sensor, index) => (
                        <div key={index} className={`${styles.shipping_sensor} ${scannedSensors.includes(sensor.sensor_id) ? styles.status_dot_green : styles.status_dot_red}`}>
                            <SensorLink sensorId={sensor.sensor_id} text={sensor.cable_id ? `${sensor.sensor_id} C: ${sensor.cable_id}` : `${sensor.sensor_id}`} />
                            {certificateList.current.find(c => c.sensor_id === sensor.sensor_id) && <span> | <a className={styles.sensor_link} href={`https://sensorcalibrations.blob.core.windows.net/public-certificates/MNT-${certificateList.current.find(c => c.sensor_id === sensor.sensor_id).certificate_id}.pdf`} target="_blank" rel="noreferrer">MNT-{certificateList.current.find(c => c.sensor_id === sensor.sensor_id).certificate_id}</a></span>}
                            <Button innerText={'Generate certificate'} onClick={() => generateCertificate(sensor.sensor_id)} />
                        </div>
                    ))}
                </div>

                <br />

                <button className={`${styles.default_button} ${styles.red}`} onClick={handleCloseOrder}>Close Order</button>
            </div>
        </>
    );
}

export default Shipping;