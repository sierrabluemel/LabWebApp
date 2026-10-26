import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";

import callApi from "../../utils/api/callApi";
import AddBatchMenu from "../AddBatchMenu/AddBatchMenu";
import DropDown from "../DropDown/DropDown";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";

import styles from "../../styles/styles.module.css";
import addWorkDays from "../../utils/addWorkDays";

function SalesOrderForm() {
    const navigate = useNavigate();
    const {
        salesOrder, setSalesOrder, technicianId,
        setPopupMessage, order, setOrder, expedited
    } = useAppContext()

    const [batches, setBatches] = useState([]);
    const [doneMessage, setDoneMessage] = useState([]);
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
        setBatchDisplay(batches.map((batch, index) => (
            <AddBatchMenu
                key={index}
                calibrationProcedureId={batch.calibration_procedure_id}
                batchNumber={batch.batch_id}
                batches={batches}
                setBatches={setBatches}
                orderId={order}
            />
        )))
    }, [salesOrder, order, batches, technicianId, setPopupMessage, expedited]);

    const handleSubmit = async (event) => {
        event.preventDefault();
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
        setDoneMessage([`Order ${order} (${salesOrder}) created`]);
    }

    const finish = (focusNewOrder) => {
        setOrder(null);
        setSalesOrder('');
        navigate('/batchEntry', { state: { focusNewOrder } });
    }

    if (!order) {
        return (
            <h1 className={styles.title}>Loading...</h1>
        )
    }

    return (
        <div className={styles.menu}>
                <ConfirmationPopup
                    confirmationArray={doneMessage}
                    setConfirmationArray={setDoneMessage}
                    handleConfirm={() => finish(false)}
                    handleDismiss={() => finish(true)}
                    confirmText={'Go to testing'}
                    dismissText={'Add another order'}
                />
                <h1 className={styles.title}>{salesOrder} | Order due: {dueDate.current ? dueDate.current : 'Loading...'}</h1>
                <DropDown
                    options={calibrationProcedures}
                    selectedOption={selectedOption}
                    setSelectedOption={setSelectedOption}
                    batches={batches}
                    setBatches={setBatches}
                />
            <div className={`${styles.grid_menu} ${styles.add_batch_container}`}>
                {batchDisplay}
                <button onClick={handleSubmit} className={`${styles.default_button} ${styles.double_span}`}>Complete Sales Order</button>
            </div>
        </div>
    );
}

export default SalesOrderForm;