import styles from "../../styles/styles.module.css";
import { useAppContext } from "../../contexts/app";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import callApi from "../../utils/api/callApi";
import Button from "../Button/Button";
import SensorLink from "../SensorLink/SensorLink";
import parseDataBaseDate from "../../utils/parseDataBaseDate";

export default function SearchResults() {
    const {
        searchSelection, setPopupMessage, setBatchNumber,
        technicianId, setProcedureId, setSensorList,
        setOrderNumber, setBatches
    } = useAppContext();

    const [resultData, setResultData] = useState([]);
    const [openOrders, setOpenOrders] = useState({});
    const [openBatches, setOpenBatches] = useState({});
    const [openCertificates, setOpenCertificates] = useState({});
    const [loading, setLoading] = useState(false);
    const [highlightedSensorId, setHighlightedSensorId] = useState(null);
    const [highlightedBatchId, setHighlightedBatchId] = useState(null);

    const navigate = useNavigate();

    const toggleOrder = (orderId) => {
        setOpenOrders(prev => ({ ...prev, [orderId]: !(prev[orderId] ?? false) }));
    };

    const toggleBatch = (orderId, batchId) => {
        setOpenBatches(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                [batchId]: !prev[orderId]?.[batchId]
            }
        }));
    };

    const toggleCertificates = (sensorId) => {
        setOpenCertificates(prev => ({ ...prev, [sensorId]: !prev[sensorId] }));
    };

    const goToBatch = (batchId) => {
        setBatchNumber(batchId);
        if (!technicianId) return setPopupMessage('Please sign in');

        callApi('get-batch-by-id', { batch_id: batchId })
            .then(batch => {
                callApi('update-batch-technician', { department: 'testing', technician_id: technicianId, batch_id: batch.batch_id });
                setProcedureId(batch.calibration_procedure_id);
                return callApi('get-sensors', { batch_id: batch.batch_id });
            })
            .then(data => {
                setSensorList(data);
                navigate('/manageBatch');
            })
            .catch(() => setPopupMessage(`Unable to get batch ${batchId}`));
    };

    const goToOrder = (orderId) => {
        setOrderNumber(orderId);
        if (!technicianId) return setPopupMessage('Please sign in');

        callApi('get-batches-by-order-id', { order_id: orderId })
            .then(response => {
                setBatches(response);
                navigate('/shipping');
            })
            .catch(() => setPopupMessage(`Unable to get order ${orderId}`));
    };

    useEffect(() => {
        if (!searchSelection) return;

        let timeout;
        setLoading(true);
        setResultData([]);

        callApi('get-search-results', {
            search_type: searchSelection.key,
            search_value: searchSelection.value
        })
            .then(res => {
                if (!res || res.length === 0) {
                    setPopupMessage(`No results found for ${searchSelection.value}`);
                    return setResultData([]);
                }

                setResultData(res);

                if (searchSelection.key === 'sensor_id') {
                    const sensorId = String(searchSelection.value);
                    const sensorRow = res.find(r => String(r.sensor_id) === sensorId);

                    if (sensorRow) {
                        const orderKey = String(sensorRow.order_id);
                        const batchKey = String(sensorRow.batch_id);

                        setOpenOrders(prev => ({ ...prev, [orderKey]: true }));
                        setOpenBatches(prev => ({
                            ...prev,
                            [orderKey]: { ...prev[orderKey], [batchKey]: true }
                        }));

                        setHighlightedSensorId(sensorId);

                        timeout = setTimeout(() => setHighlightedSensorId(null), 3000);
                    }
                } else if (searchSelection.key === 'batch_id') {
                    const batchId = String(searchSelection.value);
                    const batchRow = res.find(r => String(r.batch_id) === batchId)

                    if (batchRow) {
                        const orderKey = String(batchRow.order_id);

                        setOpenOrders(prev => ({ ...prev, [orderKey]: true }))
                        setHighlightedBatchId(batchId)

                        timeout = setTimeout(() => setHighlightedBatchId(null), 3000);
                    }
                }
            })
            .catch(err => {
                console.error(err);
                setPopupMessage(`Unable to get data for ${searchSelection.value}`);
            })
            .finally(() => setLoading(false));

        return () => clearTimeout(timeout);
    }, [searchSelection, setPopupMessage]);

    const groupResults = (rows) => {
        const byOrder = {};

        rows.forEach(row => {
            const orderId = String(row.order_id);
            const batchId = String(row.batch_id);
            const sensorId = String(row.sensor_id);

            if (!orderId || !batchId || !sensorId) return;

            if (!byOrder[orderId]) {
                byOrder[orderId] = {
                    order_id: orderId,
                    customer_order_number: row.customer_order_number || "N/A",
                    received_timestamp: row.received_timestamp || "N/A",
                    shipped_timestamp: row.shipped_timestamp,
                    expedited: row.expedited,
                    batches: {}
                };
            }

            if (!byOrder[orderId].batches[batchId]) {
                byOrder[orderId].batches[batchId] = {
                    batch_id: batchId,
                    calibration_procedure_id: row.calibration_procedure_id || "N/A",
                    current_location: row.current_location,
                    sensors: {}
                };
            }

            const sensors = byOrder[orderId].batches[batchId].sensors;

            if (!sensors[sensorId]) {
                sensors[sensorId] = {
                    sensor_id: sensorId,
                    sensor_sku: row.sensor_sku || "N/A",
                    certificates: []
                };
            }

            if (row.certificate_id) {
                sensors[sensorId].certificates.push({
                    certificate_id: Number(row.certificate_id),
                    timestamp: row.certificate_timestamp,
                    pass: row.certificate_pass
                });
            }
        });

        return Object.values(byOrder)
            .sort((a, b) => Number(a.order_id) - Number(b.order_id))
            .map(order => ({
                ...order,
                batches: Object.values(order.batches)
                    .sort((a, b) => Number(a.batch_id) - Number(b.batch_id))
                    .map(batch => ({
                        ...batch,
                        sensors: Object.values(batch.sensors)
                            .sort((a, b) => Number(a.sensor_id) - Number(b.sensor_id))
                            .map(sensor => ({
                                ...sensor,
                                certificates: sensor.certificates.sort((a, b) => b - a)
                            }))
                    }))
            }));
    };

    if (loading) return <div className={styles.menu}><h2 className={styles.title}>Loading...</h2></div>;
    if (!resultData.length) return <div className={styles.menu}><h2 className={styles.title}>No results found.</h2></div>;

    const grouped = groupResults(resultData);

    return (
        <div className={styles.menu}>
            <div className={styles.resultsContainer}>
                {Object.entries(grouped).map(([index, order]) => {
                    const isOrderOpen = !!openOrders[order.order_id];
                    return (
                        <div key={`order-${order.order_id}`} className={styles.orderSection}>
                            <div className={styles.resultRow}>
                                <Button onClick={() => goToOrder(order.order_id)} innerText={`Order ${order.order_id}`} />
                                <button className={styles.resultHeader} onClick={() => toggleOrder(order.order_id)}>
                                    {order.customer_order_number}{isOrderOpen ? " ▲" : " ▼"}

                                    <span className={styles.order_details}>
                                        <span className={styles.order_details_item}>
                                            Received: {parseDataBaseDate(order.received_timestamp) + " "}
                                        </span>
                                        {order.expedited ? <span className={`${styles.order_details_item} ${styles.grid_entry_red}`}>
                                            EXPEDITED ORDER
                                        </span> : <></>}
                                    </span>
                                </button>
                            </div>

                            {isOrderOpen && (
                                <div className={styles.batchContainer}>
                                    {Object.entries(order.batches).map(([, batchData]) => {
                                        console.log(batchData)
                                        const isBatchOpen = !!openBatches[order.order_id]?.[batchData.batch_id];
                                        return (
                                            <div key={`batch-${batchData.batch_id}`}
                                                ref={el => {
                                                    if (el && highlightedBatchId === batchData.batch_id) {
                                                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                                                    }
                                                }}
                                                className={`${styles.resultRow} ${highlightedBatchId === batchData.batch_id ? styles.highlightItem : ""}`}
                                            >
                                                <Button onClick={() => goToBatch(batchData.batch_id)} innerText={`Batch ${batchData.batch_id}`} />
                                                <button className={styles.resultHeader} onClick={() => toggleBatch(order.order_id, batchData.batch_id)}>
                                                    <span className={styles[`calibration_${batchData.calibration_procedure_id}`]}>
                                                        CP: {batchData.calibration_procedure_id}{isBatchOpen ? " ▲" : " ▼"}
                                                    </span>
                                                    <span className={styles.order_details_item}>
                                                        {batchData.current_location ? 
                                                        `Current location: ${batchData.current_location}`
                                                        : <span className={styles.grid_entry_red}>SHIPPED</span>}
                                                        </span>
                                                </button>

                                                {isBatchOpen && (
                                                    <ul className={styles.sensorList}>
                                                        {batchData.sensors.map(sensor => {
                                                            const certsOpen = openCertificates[sensor.sensor_id];
                                                            return (
                                                                <li
                                                                    ref={el => {
                                                                        if (el && highlightedSensorId === sensor.sensor_id) {
                                                                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                                                                        }
                                                                    }}
                                                                    key={`sensor-${sensor.sensor_id}`}
                                                                    className={`${styles.sensorItem} ${highlightedSensorId === sensor.sensor_id ? styles.highlightItem : ""}`}
                                                                >
                                                                    <SensorLink sensorId={sensor.sensor_id} text={`Sensor ${sensor.sensor_id}`} />
                                                                    {` - ${sensor.sensor_sku}`}
                                                                    {sensor.certificates.length > 0 && (
                                                                        <>
                                                                            <button className={styles.certificateToggle} onClick={() => toggleCertificates(sensor.sensor_id)}>
                                                                                Certificates {certsOpen ? "▲" : "▼"}
                                                                            </button>
                                                                            {certsOpen && (
                                                                                <ul className={styles.certificateList}>
                                                                                    {sensor.certificates.sort((a, b) => b.certificate_id - a.certificate_id).map(certificate => (
                                                                                        <li key={`cert-${certificate.certificate_id}`}>
                                                                                            <a href={`https://sensorcalibrations.blob.core.windows.net/public-certificates/MNT-${certificate.certificate_id}.pdf`} target="_blank" rel="noopener noreferrer" className={styles.sensor_link}>
                                                                                                MNT-{certificate.certificate_id}
                                                                                            </a>
                                                                                            {certificate.pass ? <span className={`${styles.green} ${styles.order_details_item}`}>PASS</span> : <span className={`${styles.red} ${styles.order_details_item}`}>FAIL</span>}
                                                                                            <span className={styles.order_details_item}>{parseDataBaseDate(certificate.timestamp)}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
