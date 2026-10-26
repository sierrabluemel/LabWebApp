import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAppContext } from "../contexts/app";
import callApi from "./api/callApi";

// Loads a batch into shared state and opens its testing page
export default function useOpenBatch() {
    const navigate = useNavigate();
    const {
        setBatchNumber, setSensorList, setProcedureId,
        technicianId, setCustomerOrderNumber, setPopupMessage
    } = useAppContext()

    return useCallback((batch_id) => {
        if (!technicianId) {
            setPopupMessage('Please sign in');
            return;
        }
        if (isNaN(batch_id)) {
            setPopupMessage('Enter a batch number');
            return;
        }
        callApi('get-batch-by-id', { 'batch_id': batch_id })
            .then(batch => {
                if (!batch) {
                    setPopupMessage(`Batch ${batch_id} not found`);
                    return;
                }
                setBatchNumber(batch.batch_id);
                setCustomerOrderNumber(batch.customer_order_number);

                callApi('update-batch-technician', { 'department': 'testing', 'technician_id': technicianId, 'batch_id': batch.batch_id })

                setProcedureId(batch.calibration_procedure_id);

                callApi('get-sensors', { 'batch_id': batch.batch_id })
                    .then(data => {
                        setSensorList(data);
                        navigate('/manageBatch');
                    })
            })
    }, [navigate, setBatchNumber, setCustomerOrderNumber, setProcedureId, setSensorList, setPopupMessage, technicianId])
}
