import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";

import callApi from "../../utils/api/callApi";
import AddBatchMenu from "../AddBatchMenu/AddBatchMenu";
import removeOrderIfEmpty from "../../utils/removeOrderIfEmpty";
import DropDown from "../DropDown/DropDown";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";

import styles from "../../styles/styles.module.css";
import addWorkDays from "../../utils/addWorkDays";
import useOpenBatch from "../../utils/useOpenBatch";
import backArrow from "../../media/arrow.png";

function SalesOrderForm() {
    const navigate = useNavigate();
    const openBatch = useOpenBatch();
    // 'add' and 'edit' reuse this page for an order that already exists; no mode is a new order
    const { mode, batch: editingBatch, customerOrderNumber } = useLocation().state ?? {};
    const {
        salesOrder, setSalesOrder, technicianId,
        setPopupMessage, order, setOrder, expedited
    } = useAppContext()

    const [batches, setBatches] = useState(editingBatch ? [editingBatch] : []);
    const [doneMessage, setDoneMessage] = useState([]);
    const [removeConfirmation, setRemoveConfirmation] = useState([]);
    const [calibrationProcedures, setCalibrationProcedures] = useState([])
    const [selectedOption, setSelectedOption] = useState('');
    const [batchDisplay, setBatchDisplay] = useState(null);
    const dueDate = useRef(null);

    useEffect(() => {
        if (!dueDate.current) {
            const dueDateObject = expedited ? addWorkDays(new Date(), 2) : addWorkDays(new Date(), 7);
            dueDate.current = `${dueDateObject.getMonth() + 1}/${dueDateObject.getDate()}/${dueDateObject.getFullYear()}`;
        }
        callApi('get-calibration-procedures')
            .then(response => {
                setCalibrationProcedures(response);
            })
        if (!batches.length || batches.length === 0) {
            setBatchDisplay(null);
            return;
        }
        setBatchDisplay(batches.map(batch => (
            <AddBatchMenu
                key={batch.batch_id}
                calibrationProcedureId={batch.calibration_procedure_id}
                batchNumber={batch.batch_id}
                setBatches={setBatches}
                orderId={order}
                preload={mode === 'edit'}
                hideCancel={mode === 'edit'}
            />
        )))
    }, [salesOrder, order, batches, technicianId, setPopupMessage, expedited]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (mode === 'edit') {
            setOrder(null);
            return batches.length === 1 ? openBatch(batches[0].batch_id) : navigate('/batchEntry');
        }
        if (mode === 'add' && batches.length === 0) {
            setPopupMessage('Add a calibration procedure first');
            return;
        }
        for (const batch of batches) {
            if (!batch.batch_id)
                continue;
            callApi('log-batch-interaction', {
                department: 'receiving',
                start: false,
                technician_id: technicianId,
                batch_id: batch.batch_id
            })
                .catch(error => {
                    console.error(error);
                })
        }
        if (mode === 'add') {
            setOrder(null);
            return batches.length === 1 ? openBatch(batches[0].batch_id) : navigate('/batchEntry');
        }
        setDoneMessage([`Order ${order} (${salesOrder}) created`]);
    }

    // Edit mode removes from the bottom row instead of inside the batch card
    const removeEditingBatch = (force = false) => {
        const batchId = batches[0].batch_id;
        callApi('get-sensors', { batch_id: batchId })
            .then(sensors => Promise.all(sensors.map(sensor => callApi('remove-sensor-from-batch', { sensor_id: sensor.sensor_id }))))
            .then(() => callApi('delete-batch', { batch_id: batchId, force }))
            .then(() => removeOrderIfEmpty(order))
            .then(orderRemoved => {
                setPopupMessage(orderRemoved ? `Batch ${batchId} removed, and order ${order} with it as it had no batches left` : `Batch ${batchId} removed`);
                setOrder(null);
                navigate('/batchEntry');
            })
            .catch(err => {
                const message = err.response?.data?.error ?? `Could not remove batch ${batchId}`;
                if (err.response?.status === 409 && !force)
                    setPopupMessage({ message, action: { label: 'Delete anyway', onClick: () => removeEditingBatch(true) } });
                else
                    setPopupMessage(message);
                console.error(err);
            })
    }

    const finish = (focusNewOrder) => {
        setOrder(null);
        setSalesOrder('');
        navigate('/batchEntry', { state: { focusNewOrder } });
    }

    if (!order) {
        return (
            <div className={`${styles.menu} ${styles.narrow_menu}`}>
                <h1 className={styles.title}>Loading...</h1>
            </div>
        )
    }

    return (
        <div className={`${styles.menu} ${styles.narrow_menu}`}>
            <ConfirmationPopup
                confirmationArray={doneMessage}
                setConfirmationArray={setDoneMessage}
                handleConfirm={() => finish(false)}
                handleDismiss={() => finish(true)}
                confirmText={'Go to testing'}
                dismissText={'Add another order'}
            />
            <ConfirmationPopup
                confirmationArray={removeConfirmation}
                setConfirmationArray={setRemoveConfirmation}
                handleConfirm={() => removeEditingBatch()}
                confirmText={'Remove'}
            />
            {mode ?
                <div className={styles.toolbar}>
                    <img className={styles.back_arrow_image} onClick={() => { setOrder(null); navigate('/batchEntry') }} src={backArrow} alt="Back button" />
                    <h1 className={styles.title}>{customerOrderNumber}</h1>
                </div> :
                <h1 className={styles.title}>{`${salesOrder} | Order due: ${dueDate.current ? dueDate.current : 'Loading...'}`}</h1>}
            {mode === 'edit' ? <></> : <DropDown
                options={calibrationProcedures}
                selectedOption={selectedOption}
                setSelectedOption={setSelectedOption}
                batches={batches}
                setBatches={setBatches}
            />}
            <div className={styles.stack}>
                {batchDisplay}
                {mode === 'edit' && batches.length > 0 ?
                    <div className={styles.row}>
                        <button onClick={handleSubmit} className={`${styles.default_button} ${styles.grow}`}>Edit Batch</button>
                        <button type="button" className={`${styles.default_button} ${styles.red}`} onClick={() => setRemoveConfirmation([`Remove batch ${batches[0].batch_id}?`, 'Its sensors will be unassigned'])}>Remove batch</button>
                    </div> :
                    <button onClick={handleSubmit} className={styles.default_button}>{{ add: 'Add Batch', edit: 'Edit Batch' }[mode] ?? 'Complete Sales Order'}</button>}
            </div>
        </div>
    );
}

export default SalesOrderForm;