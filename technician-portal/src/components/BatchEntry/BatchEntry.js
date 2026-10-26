import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import Receiving from "../Receiving/Receiving";
import useOpenBatch from "../../utils/useOpenBatch";
import trashCan from "../../media/trash_can.png";

function BatchEntry() {
    const navigate = useNavigate();
    const navigateToBatch = useOpenBatch();
    const {
        batchNumber, setBatchNumber, sensorGrid, setSensorGrid, setPopupMessage, setOrder
    } = useAppContext()

    const [batches, setBatches] = useState(null);
    const [editingOrder, setEditingOrder] = useState(null);

    async function getBatchSensors(batches) {

        let allSensors = await Promise.all(batches.map((b) => {
            return callApi('get-sensors', { batch_id: b.batch_id })
                .then(sensors => {
                    return { ...b, sensors }
                })
        }))
        return allSensors
    }

    const loadBatches = useCallback(() => {
        return callApi('get-batches-by-active-state', { active: true })
            .then(getBatchSensors)
            .then(setBatches)
            .catch((err) => {
                setBatches([]);
                console.error(err)
            })
    }, [])

    // Adding or editing a batch reuses the sales order page for this existing order.
    // The TO goes in route state, not salesOrder, which is the New Sales Order box's value
    const openOrderPage = (order, batch = null) => {
        setOrder(order.order_id);
        const customerOrderNumber = order.customer_order_number;
        navigate('/createSalesOrder', { state: batch ? { mode: 'edit', batch, customerOrderNumber } : { mode: 'add', customerOrderNumber } });
    }

    const removeBatch = (batch, sensors) => {
        return Promise.all(sensors.map(sensor => callApi('remove-sensor-from-batch', { sensor_id: sensor.sensor_id, batch_id: batch.batch_id })))
            .then(() => callApi('delete-batch', { batch_id: batch.batch_id }))
            .then(() => {
                setPopupMessage(`Batch ${batch.batch_id} removed`);
                loadBatches();
            })
            .catch(err => {
                setPopupMessage(`Could not remove batch ${batch.batch_id}`);
                console.error(err);
                return Promise.reject(err);
            })
    }

    const handleSubmit = (event) => {
        event.preventDefault()
        navigateToBatch(parseInt(batchNumber))
    }

    useEffect(() => {
        if (sensorGrid.length > 0) {
            setSensorGrid([]);
        }
    }, [setSensorGrid, sensorGrid.length]);

    useEffect(() => {
        loadBatches();
    }, [loadBatches]);

    const handleChange = (event) => {
        if ((!isNaN(event.target.value) && !isNaN(parseFloat(event.target.value))) || event.target.value === '')
            setBatchNumber(event.target.value);
    }

    // expedited first, then oldest received
    const orders = [...new Set((batches ?? []).map(batch => batch.order_id))]
        .map(orderId => batches.filter(batch => batch.order_id === orderId).sort((a, b) => a.batch_id - b.batch_id))
        .sort((a, b) => (b[0].expedited ? 1 : 0) - (a[0].expedited ? 1 : 0)
            || new Date(a[0].received_timestamp) - new Date(b[0].received_timestamp)
            || a[0].order_id - b[0].order_id);
    // an order is active once any of its batches is in testing
    const isActive = order => order.some(batch => batch.current_location?.startsWith('T'));

    const renderOrders = (orders) => {
        if (!batches)
            return <h1 className={styles.title}>Loading...</h1>;
        if (orders.length === 0)
            return <h1 className={styles.title}>No batches found</h1>;

        return (
            <div className={styles.order_grid}>
                {orders.map(orderBatches => <OrderCard key={orderBatches[0].order_id} batches={orderBatches} openBatch={navigateToBatch} editOrder={setEditingOrder} />)}
            </div>
        )
    }

    return (
        <div className={styles.menu} >
            {editingOrder ? <EditOrderPopup order={editingOrder} openOrderPage={openOrderPage} removeBatch={removeBatch} close={() => setEditingOrder(null)} /> : <></>}
            <div className={styles.entry_row}>
                <Receiving />
                <section>
                    <h2 className={styles.section_heading}>Open a batch</h2>
                    <form onSubmit={handleSubmit} data-testid={'batchForm'} className={styles.inline_form}>
                        <input type='text' value={batchNumber} onChange={handleChange} className={styles.default_text_box} placeholder={'Batch Number'} />
                        <button type='submit' className={styles.default_button}>Open</button>
                    </form>
                </section>
            </div>
            <h2 className={styles.section_heading}>Active orders</h2>
            {renderOrders(orders.filter(isActive))}
            <h2 className={styles.section_heading}>Queued orders</h2>
            {renderOrders(orders.filter(order => !isActive(order)))}
        </div>
    );
}

function OrderCard({ batches, openBatch, editOrder }) {
    const first = batches[0];
    const receivedDate = parseDataBaseDate(first.received_timestamp);

    return (
        <div className={`${styles.order_card} ${first.expedited ? styles.order_card_expedited : ''}`}>
            <div>
                <div className={styles.order_card_header}>
                    <h3 className={styles.order_group_title}>{first.customer_order_number}{first.expedited ? <> <span className={styles.red_character}>E</span></> : <></>}</h3>
                    <button className={styles.icon_button} onClick={() => editOrder(first)} aria-label={`Edit order ${first.order_id}`} title='Add or remove batches'>✎</button>
                </div>
                <div className={styles.order_subtitle}>{`Order ${first.order_id} · ${receivedDate}`}</div>
            </div>
            <div>
                {batches.map(batch => {
                    const sensorCount = batch.sensors ? batch.sensors.length : 0;
                    return (
                        <button key={batch.batch_id} className={styles.batch_row} onClick={() => openBatch(batch.batch_id)} aria-label={`Open batch ${batch.batch_id}`}>
                            <span className={styles.batch_row_id}>{batch.batch_id}</span>
                            <span>{batch.current_location ? <span className={`${styles.stage_badge} ${batch.current_location.startsWith('T') ? styles.stage_testing : ''}`}>{batch.current_location}</span> : <></>}</span>
                            <span>{sensorCount ? `${sensorCount} sensor${sensorCount === 1 ? '' : 's'}` : <span className={styles.none_chip}>NONE</span>}</span>
                            <span className={styles[`calibration_${batch.calibration_procedure_id}`]}>{`CP ${batch.calibration_procedure_id}`}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// Lists every batch on the order (not just the active ones on this page) so batches can be added or removed
function EditOrderPopup({ order, openOrderPage, removeBatch, close }) {
    const [batches, setBatches] = useState(null);
    const [sensors, setSensors] = useState([]);
    const [pendingRemoval, setPendingRemoval] = useState(null);

    const load = useCallback(() => {
        Promise.all([
            callApi('get-batches-by-order-id', { order_id: order.order_id }),
            callApi('get-sensors-by-order-id', { order_id: order.order_id })
        ])
            .then(([batches, sensors]) => {
                setBatches(batches.sort((a, b) => a.batch_id - b.batch_id));
                setSensors(sensors);
            })
            .catch(err => {
                setBatches([]);
                console.error(err);
            })
    }, [order.order_id])

    useEffect(load, [load]);

    const confirmRemoval = (batch, batchSensors) => {
        removeBatch(batch, batchSensors)
            .then(close)
            .catch(() => setPendingRemoval(null))
    }

    return (
        <>
            <div className={styles.popup_background} onClick={close}></div>
            <div className={`${styles.notification_popup_container} ${styles.modal}`} role='dialog' aria-label={`Edit order ${order.order_id}`}>
                <h2 className={styles.popup_header}>{`TO: ${order.customer_order_number} | Order: ${order.order_id}`}</h2>
                <div className={styles.modal_body}>
                    {!batches ? <p>Loading...</p> : batches.map(batch => {
                        const batchSensors = sensors.filter(sensor => sensor.batch_id === batch.batch_id);
                        const shipped = batch.current_location?.startsWith('S');

                        if (pendingRemoval === batch.batch_id) {
                            return (
                                <div className={`${styles.modal_row} ${styles.modal_row_warning}`} key={batch.batch_id}>
                                    <span className={styles.grow}>{`Remove batch ${batch.batch_id}?${batchSensors.length ? ` ${batchSensors.length} sensor(s) will be unassigned.` : ''}`}</span>
                                    <button className={styles.default_button} onClick={() => setPendingRemoval(null)}>Cancel</button>
                                    <button className={`${styles.default_button} ${styles.red}`} onClick={() => confirmRemoval(batch, batchSensors)}>Remove</button>
                                </div>
                            )
                        }
                        return (
                            <div className={styles.modal_row} key={batch.batch_id}>
                                <span className={styles.grow}>
                                    {`Batch ${batch.batch_id} | `}
                                    <span className={styles[`calibration_${batch.calibration_procedure_id}`]}>{`CP: ${batch.calibration_procedure_id}`}</span>
                                    {` | ${batchSensors.length} sensor(s) | ${batch.current_location ?? 'No location'}`}
                                </span>
                                <button className={styles.icon_button} onClick={() => openOrderPage(order, batch)} aria-label={`Edit batch ${batch.batch_id}`} title='Edit batch'>✎</button>
                                <button className={styles.icon_button} onClick={() => setPendingRemoval(batch.batch_id)} disabled={shipped} aria-label={`Remove batch ${batch.batch_id}`} title={shipped ? 'Shipped batches cannot be removed' : 'Remove batch'}>
                                    <img src={trashCan} alt='' className={styles.edit_order_trash} />
                                </button>
                            </div>
                        )
                    })}
                </div>
                <div className={styles.modal_footer}>
                    <button className={styles.default_button} onClick={close}>Close</button>
                    <button className={`${styles.default_button} ${styles.green}`} onClick={() => openOrderPage(order)}>Add batch</button>
                </div>
            </div>
        </>
    )
}

export default BatchEntry;
