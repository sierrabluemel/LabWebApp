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
import backArrow from "../../media/arrow.png";
import binClass from "../../utils/binClass";

const downloadIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
);

function Shipping() {
    const {
        setConfirmationMessage, technicianId, setPopupMessage,
        orderNumber, setOrderNumber, batches, setBatches
    } = useAppContext()

    const navigate = useNavigate()

    const certificateList = useRef([]);

    const [references, setReferences] = useState(new Set());
    const [certificateMessage, setCertificateMessage] = useState('Loading...');
    const [sensor, setSensor] = useState('');
    const [sensorList, setSensorList] = useState(null); // null until loaded, so Delete Order doesn't flash on full orders
    const [scannedSensors, setScannedSensors] = useState([]);
    const [sensorsNotRemoved, setSensorsNotRemoved] = useState([]);
    const [missedSensorsArray, setMissedSensorsArray] = useState([]);
    const isMounted = useRef(false);
    const [sensorsRemoved, setSensorsRemoved] = useState(false);
    const [sensorsRemovedMessage, setSensorsRemovedMessage] = useState('Loading...')
    const [networkSensorIds, setNetworkSensorIds] = useState(null); // null until the network has been checked

    const [confirmationArray, setConfirmationArray] = useState([]);
    const [deleteArray, setDeleteArray] = useState([]);
    const [order, setOrder] = useState(null)
    const [referenceVerificationArray, setReferenceVerificationArray] = useState([]);

    const checkSensorList = (sensors = null) => {
        callApi('get-sensor-list')
            .then(sensorsOnNetwork => {
                const orderSensors = sensors || sensorList || [];
                setNetworkSensorIds(sensorsOnNetwork);

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
                certificateList.current = certificates.sort((a, b) => a.certificate_id - b.certificate_id);
                const fullDate = new Date(certificates[certificates.length - 1].timestamp)
                const dateString = `${fullDate.getMonth() + 1}/${fullDate.getDate()}/${fullDate.getFullYear()}`;
                setCertificateMessage(`${certificates.length} certificate${certificates.length > 1 ? 's' : ''} generated on ${dateString}`);
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

    // After a page refresh shared state is empty; reload the order from the URL
    useEffect(() => {
        if (orderNumber) return;
        const orderId = new URLSearchParams(window.location.search).get('order_id');
        if (!orderId) return navigate('/orderEntry');
        callApi('get-batches-by-order-id', { order_id: orderId })
            .then(response => {
                setBatches(response);
                setOrderNumber(Number(orderId));
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isMounted.current || !orderNumber)
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
                        const referenceVerifiedStrings = ['Add these references to the certificates?']
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

                if (error.response?.data?.error === 'Not enough readings to generate certificate')
                    setPopupMessage(`Not enough readings present to generate certificates`);
                else
                    setPopupMessage(`An error occurred while generating certificates`);
            })
    };

    const promoteSpare = (sensor) => {
        return callApi('set-sensor-spare', { sensor_id: sensor.sensor_id, batch_id: sensor.batch_id, spare: false })
            .then(() => callApi('get-sensors-by-order-id', { order_id: orderNumber }))
            .then(setSensorList)
            .catch(err => {
                setPopupMessage(`Unable to add spare ${sensor.sensor_id} to the batch`);
                console.error(err);
            })
    }

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


    const printLabel = event => {
        event.preventDefault()
        if (!sensor) {
            setPopupMessage(`Please enter sensor id`);
            return;
        }
        const sensorId = parseInt(parseSensorString(sensor)[0]);
        const certificate = certificateList.current.filter(cert => cert.sensor_id === sensorId)[0]
        if (sensorList?.some(s => s.sensor_id === sensorId && s.spare)) {
            setPopupMessage(`Sensor ${sensorId} is a spare and gets no label`)
            setSensor('');
            return;
        }
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
            return;
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
                if (response.status === 200 && response.headers.get('content-type')?.startsWith('application/pdf')) {
                    const blob = new Blob([response.data], { type: 'application/pdf' });

                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `returnRecord${orderNumber}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    console.error(`Expecting return record to be 'application/pdf' but instead got '${response.headers.get('content-type')}': ${response}`);
                    setPopupMessage(`Failed to generate return record for order ${orderNumber}`);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                setPopupMessage(`Failed to generate return record for order ${orderNumber}`);
            });
    }

    const downloadCertificates = async () => {
        Promise.all([
            callApi('get-order-by-id', { 'order_id': orderNumber }),
            callApi('generate-order-certificates', { order_id: orderNumber }, true)
        ])
            .then(([order, response]) => {
                if (response.status === 200 && response.headers.get('content-type')?.startsWith('application/pdf')) {
                    const blob = new Blob([response.data], { type: 'application/pdf' });

                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${order.customer_order_number}Certificates.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    console.error(`Expecting certificates to be 'application/pdf' but instead got '${response.headers.get('content-type')}': ${response}`);
                    setPopupMessage(`Failed to generate certificates for order ${orderNumber}`);
                }
            })
            .catch(error => {
                console.error(error);
                setPopupMessage(`Failed to download certificates for order ${orderNumber}`);
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
                setConfirmationMessage(`${order.customer_order_number} closed, please add it to the slack channel`);
                navigate('/confirmation');
            })
            .catch((err) => {
                console.error(err)
            })
    }

    const deleteOrder = () => {
        callApi('delete-order', { order_id: orderNumber })
            .then(() => {
                setPopupMessage(`Order ${order?.customer_order_number ?? orderNumber} deleted`);
                navigate('/orderEntry');
            })
            .catch((err) => {
                console.error(err);
                setPopupMessage(err.response?.data?.error || 'Unable to delete order');
            })
    }

    // green only once every non-spare sensor on the order has a certificate
    const regularSensors = sensorList ? sensorList.filter(s => !s.spare) : [];
    const spareCount = sensorList ? sensorList.length - regularSensors.length : 0;
    const certifiedCount = regularSensors.filter(s => certificateList.current.some(c => c.sensor_id === s.sensor_id)).length;

    return (
        <>
            <div className={styles.menu}>
                <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={endShipping} />
                <ConfirmationPopup confirmationArray={deleteArray} setConfirmationArray={setDeleteArray} handleConfirm={deleteOrder} />
                <ConfirmationPopup confirmationArray={referenceVerificationArray} setConfirmationArray={setReferenceVerificationArray} handleConfirm={confirmReferences} />
                <ConfirmationPopup confirmationArray={missedSensorsArray} setConfirmationArray={setMissedSensorsArray} handleConfirm={removeSensorsFromNetwork} />

                <div className={styles.toolbar}>
                    <img className={styles.back_arrow_image} onClick={() => navigate('/orderEntry')} src={backArrow} alt="Back button" />
                    <h2 className={`${styles.title} ${styles.title_facts}`}>
                        <span className={styles.title_fact}><span className={styles.title_fact_label}>Sales order</span>{order ? order.customer_order_number : 'Loading...'}</span>
                        <span className={styles.title_fact}><span className={styles.title_fact_label}>Sensors</span>{sensorList ? regularSensors.length : 'Loading...'}</span>
                        {spareCount ? <span className={styles.title_fact}><span className={styles.title_fact_label}>Spares</span>{spareCount}</span> : <></>}
                    </h2>
                </div>

                <div className={styles.batches_container}>
                    {
                        batches.map(batch =>
                            <div key={batch.batch_id} className={`${styles.shipping_batches} ${styles.title_facts}`}>
                                {batch.current_location
                                    ? <>
                                        <span className={styles.title_fact}><span className={styles.title_fact_label}>Batch</span>{batch.batch_id}</span>
                                        <span className={styles.title_fact}><span className={styles.title_fact_label}>Location</span><span className={styles.stage_badge}>{batch.current_location}</span></span>
                                        <span className={styles.title_fact}><span className={styles.title_fact_label}>Bin</span><span className={binClass(batch.bin)}>{batch.bin ?? 'none'}</span></span>
                                        <span className={styles[`calibration_${batch.calibration_procedure_id}`]}>CP: {batch.calibration_procedure_id}</span>
                                    </>
                                    : <span className={styles.title_fact}><span className={styles.title_fact_label}>Batch</span>{batch.batch_id}<span className={styles.stage_badge}>Shipped</span></span>}
                            </div>
                        )
                    }
                </div>

                <h3 className={styles.section_heading}>Actions</h3>
                <div className={styles.action_cards}>
                    <div className={styles.action_card}>
                        <h4>Certificates</h4>
                        <span className={`${styles.status_pill} ${certifiedCount === 0 ? styles.soft_bad : certifiedCount < regularSensors.length ? styles.soft_warn : styles.soft_good}`}>
                            {certifiedCount > 0 && certifiedCount < regularSensors.length ? `${certifiedCount} of ${regularSensors.length} sensors have certificates` : certificateMessage}
                        </span>
                        <Button onClick={generateCertificates} innerText={'Generate certificates'} />
                        <div className={styles.button_with_icon}>
                            <Button onClick={printCertificates} innerText={'Print certificates'} />
                            <button className={`${styles.default_button} ${styles.download_button}`} onClick={downloadCertificates} title='Download certificates' aria-label='Download certificates'>{downloadIcon}</button>
                        </div>
                    </div>
                    <div className={styles.action_card}>
                        <h4>Network</h4>
                        <span className={`${styles.status_pill} ${sensorsRemoved ? styles.soft_good : styles.soft_bad}`}>{sensorsRemovedMessage}</span>
                        <Button onClick={removeSensorsFromNetwork} innerText={'Remove sensors'} />
                    </div>
                    <div className={styles.action_card}>
                        <h4>Return record and labels</h4>
                        <form onSubmit={printLabel}>
                            <input type='text' value={sensor} onChange={event => setSensor(event.target.value)} className={styles.default_text_box} placeholder={'Scan sensor to print label'} />
                        </form>
                        <div className={styles.button_with_icon}>
                            <Button onClick={printReturnRecord} innerText={'Print return record'} />
                            <button className={`${styles.default_button} ${styles.download_button}`} onClick={createReturnRecord} title='Download return record' aria-label='Download return record'>{downloadIcon}</button>
                        </div>
                    </div>
                </div>

                <h3 className={styles.section_heading}>Sensors</h3>
                <div className={styles.sensor_container}>
                    {sensorList?.map((sensor, index) => {
                        const certificate = sensor.spare ? undefined : certificateList.current.find(c => c.sensor_id === sensor.sensor_id);
                        if (sensor.spare)
                            return (
                                <div key={index} className={`${styles.shipping_sensor} ${styles.sensor_pending}`}>
                                    <div className={styles.shipping_sensor_header}>
                                        <SensorLink sensorId={sensor.sensor_id} text={sensor.cable_id ? `${sensor.sensor_id} C: ${sensor.cable_id}` : `${sensor.sensor_id}`} />
                                        <span className={styles.shipping_sensor_status}>Spare</span>
                                    </div>
                                    <span className={styles.shipping_sensor_muted}>No certificate unless used</span>
                                    <Button onClick={() => promoteSpare(sensor)} innerText={'Use spare'} />
                                </div>
                            );
                        const status = !certificate ? { label: 'No certificate', className: styles.sensor_pending }
                            : !certificate.pass ? { label: 'Failed', className: styles.sensor_failed }
                                : !networkSensorIds || networkSensorIds.includes(sensor.sensor_id) ? { label: 'On network', className: styles.sensor_on_network }
                                : scannedSensors.includes(sensor.sensor_id) ? { label: 'Label printed', className: styles.sensor_done }
                                    : { label: 'Ready', className: styles.sensor_ready };
                        return (
                            <div key={index} className={`${styles.shipping_sensor} ${status.className}`}>
                                <div className={styles.shipping_sensor_header}>
                                    <SensorLink sensorId={sensor.sensor_id} text={sensor.cable_id ? `${sensor.sensor_id} C: ${sensor.cable_id}` : `${sensor.sensor_id}`} />
                                    <span className={styles.shipping_sensor_status}>{status.label}</span>
                                </div>
                                {certificate
                                    ? <a className={styles.sensor_link} href={`https://sensorcalibrations.blob.core.windows.net/public-certificates/MNT-${certificate.certificate_id}.pdf`} target="_blank" rel="noreferrer">MNT-{certificate.certificate_id}</a>
                                    : <span className={styles.shipping_sensor_muted}>Not generated yet</span>}
                                {/* key resets Button's cached label once a certificate exists */}
                                <Button key={certificate ? 'regenerate' : 'generate'} className={certificate ? `${styles.default_button} ${styles.regenerate_button}` : styles.default_button} innerText={certificate ? 'Regenerate certificate' : 'Generate certificate'} onClick={() => generateCertificate(sensor.sensor_id)} />
                            </div>
                        );
                    })}
                </div>

                <div className={`${styles.row} ${styles.row_end}`}>
                    {sensorList?.length === 0 &&
                        <button className={`${styles.default_button} ${styles.danger_outline_button}`} onClick={() => setDeleteArray([`Delete order ${order?.customer_order_number ?? orderNumber}?`, 'This cannot be undone.'])}>Delete Order</button>}
                    <button className={`${styles.default_button} ${styles.red}`} onClick={handleCloseOrder}>Close Order</button>
                </div>
            </div>
        </>
    );
}

export default Shipping;