import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import callApi from "../../utils/api/callApi";
import ip from "../../utils/ip/ip";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import parseSensorString from "../../utils/parseSensorString";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";

import { useAppContext } from "../../contexts/app";

import styles from "../../styles/styles.module.css";
import getReferences from "../../utils/getReferences";

function Shipping() {
    const {
        setConfirmationMessage, technicianId, setPopupMessage,
        orderNumber, batches, setBatches
    } = useAppContext()

    const navigate = useNavigate()

    const certificateList = useRef([]);

    const [references, setReferences] = useState(new Set());
    const [certificateMessage, setCertificateMessage] = useState('');
    const [sensor, setSensor] = useState('');
    const [sensorList, setSensorList] = useState([]);
    const [scannedSensors, setScannedSensors] = useState([]);
    const isMounted = useRef(false);

    const [confirmationArray, setConfirmationArray] = useState(false);
    const [order, setOrder] = useState(null)
    const [referenceVerificationArray, setReferenceVerificationArray] = useState([]);


    const getCertificates = () => {
        callApi('get-certificates-by-order-id', { order_id: orderNumber })
            .then(certificates => {
                if (!certificates.length || certificates.length === 0) {
                    setCertificateMessage('No certificates found')
                }
                const fullDate = new Date(certificates[0].timestamp)
                const dateString = `${fullDate.getMonth() + 1}/${fullDate.getDate()}/${fullDate.getFullYear()}`;
                setCertificateMessage(`Certificates generated on ${dateString}`);
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
        if (order)
            return;
        const calibrationProcedures = new Set()
        getCertificates();
        callApi('get-order-by-id', { 'order_id': orderNumber })
            .then(response => {
                setOrder(response);
                setBatches(batches.sort((batchA, batchB) => batchA.batch_id - batchB.batch_id));

                if (!isMounted.current) {
                    isMounted.current = true;
                    for (const batch of batches) {
                        calibrationProcedures.add(batch.calibration_procedure_id);
                    };
                    getProcedureReferences(calibrationProcedures).then(references => {
                        const referenceVerifiedStrings = ['The following references must be verified for information to go onto the certificate']
                        for (let reference of references) {
                            reference = JSON.parse(reference);
                            if (!reference.certificate_verified) {
                                referenceVerifiedStrings.push(`Reference ${reference.asset_tag} (${reference.description}) will be added to certificates with a calibration date of ${parseDataBaseDate(reference.last_calibration)} and an expiration date of ${parseDataBaseDate(reference.next_calibration)}`)
                            }
                        }
                        if (referenceVerifiedStrings.length > 1) {
                            setReferenceVerificationArray(referenceVerifiedStrings)
                        }
                    })
                }
            })
            .catch((err) => {
                console.error(err)
            })
        callApi('get-sensors-by-order-id', { order_id: orderNumber })
            .then(response => {
                setSensorList(response)
            })
            .catch((err) => {
                console.error(err)
            })
    })

    const generateCertificates = async () => {
        const promises = [];
        setCertificateMessage('Loading...');
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

        await createCertificates();
        getCertificates();
    };

    const createCertificates = async () => {
        callApi('create-certificate', { 'order_id': orderNumber })
            .then((certificates) => {
                certificateList.current = certificates.sort((a, b) => a.certificate_id - b.certificate_id);
            })
            .catch((error) => {
                console.error(error);
                setPopupMessage(`An error occurred`);
            })
    };


    const printCertificateLabels = async () => {
        if (certificateList.current.length === 0) {
            setPopupMessage(`There are no labels to print`)
        }
        for (const certificate of certificateList.current) {
            try {
                await callApi('print-certificate-labels', { sensor_id: certificate.sensor_id, calibration_date: certificate.generate_certificate_json.CS1, due_date: certificate.generate_certificate_json.CS2, certificate_number: `MNT-${certificate.certificate_id}` })
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
        callApi('print-certificate-labels', { sensor_id: certificate.sensor_id, calibration_date: certificate.generate_certificate_json.CS1, due_date: certificate.generate_certificate_json.CS2, certificate_number: `MNT-${certificate.certificate_id}` })
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
            .then(() => {
                return Promise.all(certificateList.current.map((certificate) => {
                    return callApi('generate-certificate', {
                        certificate_id: certificate.certificate_id,
                        upload: true,
                    })
                }))
            }).catch((error) => {
                console.error(error)
                setPopupMessage('Unable to print certificates');
                return;
            })
    }

    const printReturnRecord = () => {
        callApi('generate-return-record', { order_id: orderNumber, print: true })
    }

    const createReturnRecord = () => {
        fetch(`https://${ip}/api/generate-return-record/?order_id=${orderNumber}`)
            .then(response => {
                if (response.ok) {
                    if (response.headers.get('content-type') === 'application/json; charset=utf-8') {
                        return response.blob();
                    } else {
                        console.error(`Expecting return record to be 'application/pdf; charset=utf-8' but instead got '${response.headers.get("content-type")}': ${response}`);
                        setPopupMessage(`Failed to generate return record for order ${orderNumber}`);
                    }
                } else {
                    console.error(`Could not complete generation, response.ok: ${response.ok}`);
                    setPopupMessage(`Failed to generate return record for order ${orderNumber}`);
                }
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `returnRecord${orderNumber}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    const downloadCertificates = async () => {
        const order = await callApi('get-order-by-id', { 'order_id': orderNumber });
        fetch(`https://${ip}/api/generate-order-certificates?order_id=${orderNumber}`)
            .then(response => {
                if (response.ok && response.headers.get('content-type') === 'application/json; charset=utf-8') {
                    return response.blob();
                } else {
                    throw new Error(`Failed to generate certificates for order ${orderNumber}`);
                }
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${order.customer_order_number}Certificates.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('Error:', error);
                return;
            });
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

    return (
        <>
            <div className={styles.menu}>
                {confirmationArray.length && <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={endShipping} />}
                {referenceVerificationArray.length === 0 ? <></> : <ConfirmationPopup confirmationArray={referenceVerificationArray} setConfirmationArray={setReferenceVerificationArray} handleConfirm={confirmReferences} />}

                <h2>Order: {orderNumber} | {order ? order.customer_order_number : 'Loading...'}</h2>

                <div className={styles.batches_container}>
                    {batches.length > 0 && batches.map(batch =>
                        <div key={batch.batch_id} className={styles.shipping_batches}>
                            {batch.current_location
                                ? <>{`Batch ${batch.batch_id} | Location: ${batch.current_location} | `}<span className={styles[`calibration_${batch.calibration_procedure_id}`]}>CP: {batch.calibration_procedure_id}</span></>
                                : `Batch ${batch.batch_id} (Shipped)`}
                        </div>
                    )}
                </div>

                <div className={styles.grid_menu}>
                    <button className={styles.default_button} onClick={generateCertificates}>Create certificates</button>
                    {
                        certificateList.current.length > 0
                            ? <span className={`${styles.status_message} ${styles.status_dot_green}`}>{certificateMessage}</span>
                            : <span className={`${styles.status_message} ${styles.status_dot_red}`}>{certificateMessage}</span>
                    }
                    <button className={styles.default_button} onClick={printReturnRecord}>Print return record</button>
                    <button className={styles.default_button} onClick={printCertificates}>Print certificates</button>
                    <button className={styles.default_button} onClick={createReturnRecord}>Download return record</button>
                    <button className={styles.default_button} onClick={downloadCertificates}>Download certificates</button>
                    <button className={styles.default_button} onClick={printCertificateLabels}>Print all labels</button>
                    <form onSubmit={printLabel}>
                        <input type='text' value={sensor} onChange={event => setSensor(event.target.value)} className={styles.default_text_box} placeholder={'Scan sensor to print label'} />
                    </form>
                </div>

                <hr />

                <div className={styles.sensor_container}>
                    {sensorList.map((sensor, index) => (
                        <div key={index} className={`${styles.shipping_sensor} ${scannedSensors.includes(sensor.sensor_id) ? styles.status_dot_green : styles.status_dot_red}`}>{sensor.sensor_id}:{sensor.check_digit}</div>
                    ))}
                </div>

                <br />

                <button className={`${styles.default_button} ${styles.red}`} onClick={handleCloseOrder}>Close Order</button>
            </div>
        </>
    );
}

export default Shipping;