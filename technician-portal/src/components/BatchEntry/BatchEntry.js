import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import Receiving from "../Receiving/Receiving";
import useOpenBatch from "../../utils/useOpenBatch";
import binClass from "../../utils/binClass";
import removeOrderIfEmpty from "../../utils/removeOrderIfEmpty";
import trashCan from "../../media/trash_can.png";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";
import Dialog from "../Dialog/Dialog";

function BatchEntry() {
    const navigate = useNavigate();
    const navigateToBatch = useOpenBatch();
    const {
        batchNumber, setBatchNumber, sensorGrid, setSensorGrid, setPopupMessage, setOrder
    } = useAppContext()

    const [batches, setBatches] = useState(null);
    const [editingOrder, setEditingOrder] = useState(null);
    const [reforming, setReforming] = useState(false);

    function reformGateways() {
        setReforming(true);
        setPopupMessage('Reforming gateways...');
        callApi('reform-gateways')
            .then(({ reformed, failed }) => {
                setPopupMessage(`Reformed ${reformed} gateways${failed.length ? `, ${failed.length} failed` : ''}`);
            })
            .catch(() => setPopupMessage('Could not reform gateways'))
            .finally(() => setReforming(false));
    }

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

    // A 409 means readings, certificates or logs still point at the batch; the popup offers to delete those too
    const removeBatch = (batch, sensors, force = false) => {
        return Promise.all(sensors.map(sensor => callApi('remove-sensor-from-batch', { sensor_id: sensor.sensor_id, batch_id: batch.batch_id })))
            .then(() => callApi('delete-batch', { batch_id: batch.batch_id, force }))
            .then(() => removeOrderIfEmpty(batch.order_id))
            .then(orderRemoved => {
                setPopupMessage(orderRemoved ? { message: `Batch ${batch.batch_id} removed`, details: `Order ${batch.order_id} was removed with it as it had no batches left` } : `Batch ${batch.batch_id} removed`);
                setEditingOrder(null);
                loadBatches();
            })
            .catch(err => {
                const message = err.response?.data?.error ?? `Could not remove batch ${batch.batch_id}`;
                if (err.response?.status === 409 && !force)
                    setPopupMessage({ message, action: { label: 'Delete anyway', onClick: () => removeBatch(batch, sensors, true).catch(() => { }) } });
                else
                    setPopupMessage(message);
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
            {editingOrder ? <EditOrderPopup order={editingOrder} openOrderPage={openOrderPage} removeBatch={removeBatch} reload={loadBatches} close={() => setEditingOrder(null)} /> : <></>}
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
            <div className={`${styles.row} ${styles.row_end}`}>
                <button className={styles.default_button} onClick={reformGateways} disabled={reforming} title='Make every lab gateway rebuild its sensor list'>Reform gateways</button>
            </div>
        </div>
    );
}

function OrderCard({ batches, openBatch, editOrder }) {
    const first = batches[0];
    const receivedDate = parseDataBaseDate(first.received_timestamp);

    return (
        <div className={styles.order_card}>
            <div className={styles.order_card_header}>
                <h3 className={styles.order_group_title}>{first.customer_order_number} <span className={styles.order_subtitle}>{receivedDate}</span>{first.expedited ? <> <span className={styles.red_character}>Expedited</span></> : <></>}</h3>
                <button className={styles.icon_button} onClick={() => editOrder(first)} aria-label={`Edit order ${first.order_id}`} title='Add or remove batches'>✎</button>
            </div>
            <div className={styles.batch_rows}>
                {batches.map(batch => {
                    const sensorCount = batch.sensors ? batch.sensors.length : 0;
                    return (
                        <button key={batch.batch_id} className={styles.batch_row} onClick={() => openBatch(batch.batch_id)} aria-label={`Open batch ${batch.batch_id}`}>
                            <span className={styles.batch_row_id}>{batch.batch_id}</span>
                            <span>{batch.bin ? <span className={`${styles.stage_badge} ${binClass(batch.bin)}`} title='Bin'>{batch.bin}</span> : <></>}</span>
                            <span>{batch.current_location ? <span className={styles.stage_badge}>{batch.current_location}</span> : <></>}</span>
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
function EditOrderPopup({ order, openOrderPage, removeBatch, reload, close }) {
    const { setPopupMessage } = useAppContext();
    const [batches, setBatches] = useState(null);
    const [sensors, setSensors] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [procedures, setProcedures] = useState([]);
    const [expedited, setExpedited] = useState(Boolean(order.expedited));
    // { batch, batchSensors } and { batch, procedureId } waiting on a confirmation popup
    const [pendingRemoval, setPendingRemoval] = useState(null);
    const [pendingCpChange, setPendingCpChange] = useState(null);

    const load = useCallback(() => {
        Promise.all([
            callApi('get-batches-by-order-id', { order_id: order.order_id }),
            callApi('get-sensors-by-order-id', { order_id: order.order_id }),
            callApi('get-certificates-by-order-id', { order_id: order.order_id }),
            callApi('get-calibration-procedures')
        ])
            .then(([batches, sensors, certificates, procedures]) => {
                setBatches(batches.sort((a, b) => a.batch_id - b.batch_id));
                setSensors(sensors);
                setCertificates(certificates);
                setProcedures(procedures);
            })
            .catch(err => {
                setBatches([]);
                console.error(err);
            })
    }, [order.order_id])

    useEffect(load, [load]);

    const confirmRemoval = ({ batch, batchSensors }) => {
        removeBatch(batch, batchSensors)
            .then(close)
            .catch(() => { })
    }

    const toggleExpedited = (value) => {
        callApi('set-order-expedited', { order_id: order.order_id, expedited: value })
            .then(() => {
                setExpedited(value);
                reload();
            })
            .catch(err => {
                setPopupMessage(err.response?.data?.error ?? `Could not change expedite for order ${order.order_id}`);
                console.error(err);
            })
    }

    const changeProcedure = ({ batch, procedureId }) => {
        callApi('update-batch-calibration-procedure', { batch_id: batch.batch_id, calibration_procedure_id: procedureId })
            .then(() => {
                setPopupMessage(`Batch ${batch.batch_id} changed to CP ${procedureId}`);
                load();
                reload();
            })
            .catch(err => {
                setPopupMessage(err.response?.data?.error ?? `Could not change CP for batch ${batch.batch_id}`);
                console.error(err);
            })
    }

    // Scanner types the bin label and presses Enter
    const setBin = (batch, event) => {
        event.preventDefault();
        const bin = event.target.elements.bin.value.trim().toUpperCase();
        callApi('set-batch-bin', { batch_id: batch.batch_id, bin })
            .then(() => {
                load();
                reload();
            })
            .catch(err => {
                setPopupMessage(err.response?.data?.error ?? `Could not set bin for batch ${batch.batch_id}`);
                console.error(err);
            })
    }

    // A CP change is rare and easy to misclick, so it always asks; the question warns if certificates exist
    const cpChangeQuestion = ({ batch, procedureId }) =>
        certificates.some(certificate => certificate.batch_id === batch.batch_id)
            ? [`Change batch ${batch.batch_id} to CP ${procedureId}?`, `Batch ${batch.batch_id} has certificates generated with CP ${batch.calibration_procedure_id}. They will not match CP ${procedureId}.`]
            : [`Change batch ${batch.batch_id} from CP ${batch.calibration_procedure_id} to CP ${procedureId}?`];

    const removalQuestion = ({ batch, batchSensors }) =>
        [`Remove batch ${batch.batch_id}?`, ...(batchSensors.length ? [`${batchSensors.length} sensor(s) will be unassigned.`] : [])];

    return (
        <>
            <Dialog title={`TO: ${order.customer_order_number}`} label={`Edit order ${order.order_id}`} onClose={close} footer={<>
                <button className={styles.default_button} onClick={close}>Close</button>
                <button className={`${styles.default_button} ${styles.green}`} onClick={() => openOrderPage(order)}>Add batch</button>
            </>}>
                <label className={styles.modal_row}>
                    <input type='checkbox' checked={expedited} onChange={event => toggleExpedited(event.target.checked)} />
                    Expedited
                </label>
                <div className={styles.modal_body}>
                    {!batches ? <p>Loading...</p> : batches.map(batch => {
                        const batchSensors = sensors.filter(sensor => sensor.batch_id === batch.batch_id);
                        const shipped = batch.current_location?.startsWith('S');

                        return (
                            <div className={styles.modal_row} key={batch.batch_id}>
                                <span className={styles.grow}>
                                    <div>{`Batch ${batch.batch_id} | ${batchSensors.length} sensor(s) | ${batch.current_location ?? 'No location'}`}</div>
                                    <div className={styles.row}>
                                        <select className={`${styles.dropdown} ${styles.grow} ${styles[`calibration_${batch.calibration_procedure_id}`]}`} value={batch.calibration_procedure_id} disabled={shipped}
                                            aria-label={`Calibration procedure for batch ${batch.batch_id}`} title={shipped ? 'Shipped batches cannot be changed' : 'Change calibration procedure'}
                                            onChange={event => setPendingCpChange({ batch, procedureId: parseInt(event.target.value) })}>
                                            {procedures.map(procedure => <option key={procedure.calibration_procedure_id} value={procedure.calibration_procedure_id}>{`CP ${procedure.calibration_procedure_id}: ${procedure.calibration_procedure}`}</option>)}
                                        </select>
                                        <form onSubmit={event => setBin(batch, event)}>
                                            <input type='text' name='bin' key={batch.bin} defaultValue={batch.bin ?? ''} disabled={shipped} className={`${styles.default_text_box} ${binClass(batch.bin)}`} placeholder={'Scan bin'} style={{ width: '7rem' }}
                                                aria-label={`Bin for batch ${batch.batch_id}`} title={shipped ? 'Shipped batches cannot be changed' : 'Scan a bin, then press Enter'} />
                                        </form>
                                    </div>
                                </span>
                                <button className={styles.icon_button} onClick={() => openOrderPage(order, batch)} aria-label={`Edit batch ${batch.batch_id}`} title='Edit batch'>✎</button>
                                <button className={styles.icon_button} onClick={() => setPendingRemoval({ batch, batchSensors })} disabled={shipped} aria-label={`Remove batch ${batch.batch_id}`} title={shipped ? 'Shipped batches cannot be removed' : 'Remove batch'}>
                                    <img src={trashCan} alt='' className={styles.edit_order_trash} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </Dialog>
            {/* A CP change is rare and easy to misclick, so it always asks; the question warns if certificates exist */}
            <ConfirmationPopup confirmationArray={pendingCpChange ? cpChangeQuestion(pendingCpChange) : []} setConfirmationArray={() => setPendingCpChange(null)}
                handleConfirm={() => changeProcedure(pendingCpChange)} confirmText={'Change'} />
            <ConfirmationPopup confirmationArray={pendingRemoval ? removalQuestion(pendingRemoval) : []} setConfirmationArray={() => setPendingRemoval(null)}
                handleConfirm={() => confirmRemoval(pendingRemoval)} confirmText={'Remove'} />
        </>
    )
}

export default BatchEntry;
