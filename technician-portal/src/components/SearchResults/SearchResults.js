import styles from "../../styles/styles.module.css";
import { useAppContext } from "../../contexts/app";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import callApi from "../../utils/api/callApi";
import SensorLink from "../SensorLink/SensorLink";
import parseDataBaseDate from "../../utils/parseDataBaseDate";

const SEARCH_LABELS = {
    customer_order_number: 'Customer order', order_id: 'Order', batch_id: 'Batch',
    sensor_id: 'Sensor', cable_id: 'Lead', certificate_id: 'Certificate'
};

// One row per certificate (or sensor without one); order searches return one summary row per batch instead
const rowKey = (row) => row.certificate_id
    ? `cert-${row.certificate_id}`
    : row.sensor_id
        ? `sensor-${row.sensor_id}-${row.batch_id}`
        : `batch-${row.batch_id}`;

export default function SearchResults() {
    const {
        searchSelection, setPopupMessage, setBatchNumber,
        technicianId, setProcedureId, setSensorList,
        setOrderNumber, setBatches, setCustomerOrderNumber
    } = useAppContext();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedBatches, setExpandedBatches] = useState({});
    const [batchRows, setBatchRows] = useState({});

    const navigate = useNavigate();

    const goToBatch = (batchId) => {
        setBatchNumber(batchId);
        if (!technicianId) return setPopupMessage('Please sign in');

        // same steps as the Open Batch field in BatchEntry
        return callApi('get-batch-by-id', { batch_id: batchId })
            .then(batch => {
                if (!batch) {
                    setPopupMessage(`Batch ${batchId} not found`);
                    return;
                }
                setCustomerOrderNumber(batch.customer_order_number);
                callApi('update-batch-technician', { department: 'testing', technician_id: technicianId, batch_id: batch.batch_id });
                setProcedureId(batch.calibration_procedure_id);
                return callApi('get-sensors', { batch_id: batch.batch_id })
                    .then(data => {
                        setSensorList(data);
                        navigate('/manageBatch');
                    });
            })
            .catch(() => setPopupMessage(`Unable to get batch ${batchId}`));
    };

    const goToOrder = (orderId) => {
        setOrderNumber(orderId);
        if (!technicianId) return setPopupMessage('Please sign in');

        // same steps as the order buttons in OrderEntry
        return callApi('get-batches-by-order-id', { order_id: orderId })
            .then(response => {
                setBatches(response);
                navigate('/shipping');
                for (const batch of response) {
                    callApi('log-batch-interaction', {
                        department: 'shipping',
                        start: true,
                        technician_id: technicianId,
                        batch_id: batch.batch_id
                    })
                }
            })
            .catch(() => setPopupMessage(`Unable to get order ${orderId}`));
    };

    // The whole batch is fetched once and shown in place of the matching rows while the batch is open
    const toggleBatch = (batchId) => {
        if (batchRows[batchId]) {
            setExpandedBatches(prev => ({ ...prev, [batchId]: !prev[batchId] }));
            return;
        }
        return callApi('get-search-results', { search_type: 'batch_id', search_value: batchId })
            .then(res => {
                setBatchRows(prev => ({ ...prev, [batchId]: res }));
                setExpandedBatches(prev => ({ ...prev, [batchId]: true }));
            })
            .catch(() => setPopupMessage(`Unable to get batch ${batchId}`));
    };

    useEffect(() => {
        if (!searchSelection) return;

        setLoading(true);
        setRows([]);
        setExpandedBatches({});
        setBatchRows({});

        callApi('get-search-results', {
            search_type: searchSelection.key,
            search_value: searchSelection.value
        })
            .then(res => {
                if (!res || res.length === 0) setPopupMessage(`No results found for ${searchSelection.value}`);
                setRows(res || []);
            })
            .catch(err => {
                console.error(err);
                setPopupMessage(`Unable to get data for ${searchSelection.value}`);
            })
            .finally(() => setLoading(false));
    }, [searchSelection, setPopupMessage]);

    if (loading) return <div className={styles.menu}><h2 className={styles.title}>Loading...</h2></div>;
    if (!rows.length) return <div className={styles.menu}><h2 className={styles.title}>No results found.</h2></div>;

    const matchKey = searchSelection.key === 'cable_id' ? 'lead_id' : searchSelection.key;
    const isMatch = (row) => String(row[matchKey]) === String(searchSelection.value);
    const isOrderSearch = ['order_id', 'customer_order_number'].includes(searchSelection.key);

    const sorted = [...rows].sort((a, b) =>
        Number(a.order_id) - Number(b.order_id)
        || Number(b.batch_id) - Number(a.batch_id)
        || Number(a.sensor_id ?? 0) - Number(b.sensor_id ?? 0)
        || Number(b.certificate_id ?? 0) - Number(a.certificate_id ?? 0));

    // An open batch shows every row the backend has for it instead of just the matches
    const display = [];
    const shown = new Set();
    sorted.forEach(row => {
        if (!expandedBatches[row.batch_id]) return display.push(row);
        if (shown.has(row.batch_id)) return;
        shown.add(row.batch_id);
        display.push(...batchRows[row.batch_id]);
    });

    // The summary text itself (or "whole batch" on a matched row) opens and closes the batch
    const expandToggle = (row, label) => {
        const open = !!expandedBatches[row.batch_id];
        return (
            <button className={styles.search_expand} aria-label={`Show batch ${row.batch_id}`} aria-expanded={open} onClick={() => toggleBatch(row.batch_id)}>
                {label && <span>{label}</span>}<span className={styles.search_chevron}>{open ? '▴' : '▾'}</span>
            </button>
        );
    };

    // Order cells print once per order, batch and status cells once per batch
    let lastOrder = null;
    let lastBatch = null;

    return (
        <div className={styles.menu}>
            <h2 className={styles.title}>
                {SEARCH_LABELS[searchSelection.key]} {searchSelection.value}
                <span className={styles.search_count}>{rows.length} result{rows.length === 1 ? '' : 's'}</span>
            </h2>
            <div className={styles.search_table_wrap}>
            <table className={styles.search_table}>
                <colgroup>
                    {[150, 230, 70, 90, 180, 110, 70, 100, 100].map((width, i) => <col key={i} style={{ width }} />)}
                </colgroup>
                <thead>
                    <tr>
                        <th>Order</th>
                        <th>Batch</th>
                        <th>Lead</th>
                        <th>Sensor</th>
                        <th>SKU</th>
                        <th>Certificate</th>
                        <th>Result</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {display.map(row => {
                        const firstOfOrder = row.order_id !== lastOrder;
                        const firstOfBatch = firstOfOrder || row.batch_id !== lastBatch;
                        lastOrder = row.order_id;
                        lastBatch = row.batch_id;
                        const batchExpanded = expandedBatches[row.batch_id];
                        const isSummary = row.sensor_id == null;
                        const status = row.current_location
                            ? row.current_location
                            : row.shipped_timestamp ? <span className={styles.search_badge_red}>SHIPPED</span> : 'No location';

                        return (
                            <tr key={rowKey(row)} className={`${!isOrderSearch && isMatch(row) ? styles.search_match : ''} ${firstOfBatch ? styles.search_batch_start : ''}`}>
                                <td>{firstOfOrder && (
                                    <>
                                        <button className={styles.search_link} onClick={() => goToOrder(row.order_id)}>Order {row.order_id}</button>
                                        <div className={styles.search_sub}>
                                            {row.customer_order_number || 'N/A'} · {row.received_timestamp ? parseDataBaseDate(row.received_timestamp) : 'N/A'}
                                        </div>
                                        {row.expedited ? <div><span className={styles.search_badge_red}>EXPEDITED</span></div> : null}
                                    </>
                                )}</td>
                                <td>{firstOfBatch && row.batch_id != null && (
                                    <div className={styles.search_batch_cell}>
                                        <button className={styles.search_link} onClick={() => goToBatch(row.batch_id)}>Batch {row.batch_id}</button>
                                        <span className={`${styles.search_sub} ${styles[`calibration_${row.calibration_procedure_id}`]}`}>CP {row.calibration_procedure_id ?? 'N/A'}</span>
                                        {!isSummary && expandToggle(row, batchExpanded ? '' : 'whole batch')}
                                    </div>
                                )}</td>
                                {isSummary ? (
                                    <td colSpan={6} className={styles.search_sub}>
                                        {row.batch_id == null ? 'No batches yet' : expandToggle(row, `${row.sensor_count} sensor${Number(row.sensor_count) === 1 ? '' : 's'} · ${row.certificate_count} certificate${Number(row.certificate_count) === 1 ? '' : 's'}`)}
                                    </td>
                                ) : (
                                    <>
                                        <td>{row.lead_id ?? ''}</td>
                                        <td><SensorLink sensorId={row.sensor_id} text={row.sensor_id} /></td>
                                        <td>{(row.lead_id ? row.lead_sku : row.sensor_sku) || 'N/A'}</td>
                                        <td>{row.certificate_id ? (
                                            <a href={`https://sensorcalibrations.blob.core.windows.net/public-certificates/MNT-${row.certificate_id}.pdf`} target="_blank" rel="noopener noreferrer" className={styles.sensor_link}>
                                                MNT-{row.certificate_id}
                                            </a>
                                        ) : ''}</td>
                                        <td>{row.certificate_id ? (
                                            row.certificate_pass
                                                ? <span className={styles.search_badge_green}>PASS</span>
                                                : <span className={styles.search_badge_red}>FAIL</span>
                                        ) : ''}</td>
                                        <td>{row.certificate_timestamp ? parseDataBaseDate(row.certificate_timestamp) : ''}</td>
                                    </>
                                )}
                                <td>{firstOfBatch && row.batch_id != null && status}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    );
}
