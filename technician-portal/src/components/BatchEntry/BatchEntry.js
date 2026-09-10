import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";
import parseDataBaseDate from "../../utils/parseDataBaseDate";

function BatchEntry() {
    const navigate = useNavigate();
    const {
        batchNumber, setBatchNumber, setSensorList, setProcedureId,
        technicianId, sensorGrid, setSensorGrid, setCustomerOrderNumber
    } = useAppContext()

    const [batches, setBatches] = useState([<h1 className={styles.title} key={'fillerKey'}>Loading...</h1>]);

    async function getBatchSensors(batches) {

        let allSensors = await Promise.all(batches.map((b) => {
            return callApi('get-sensors', { batch_id: b.batch_id })
                .then(sensors => {
                    return { ...b, sensors }
                })
        }))
        return allSensors
    }

    const navigateToBatch = useCallback((batch_id) => {
        callApi('get-batch-by-id', { 'batch_id': batch_id })
            .then(batch => {
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
    }, [navigate, setBatchNumber, setCustomerOrderNumber, setProcedureId, setSensorList, technicianId])

    const handleSubmit = (event) => {
        event.preventDefault()
        navigateToBatch(parseInt(batchNumber))
    }

    useEffect(() => {
        let isMounted = true;

        if (sensorGrid.length > 0) {
            setSensorGrid([]);
        }
        if (batches.length === 1 && isMounted) {
            callApi('get-batches-by-active-state', { active: true })
                .then(response => {
                    if (response.length === 0) {
                        setBatches([<h1 className={styles.title} key={'fillerKey'}>No batches found</h1>]);
                        return;
                    }
                    return getBatchSensors(response)
                })
                .then(response => {
                    if (!response) {
                        return;
                    }
                    const batchList = []
                    const orders = response.filter((batch, index, self) => index === self.findIndex(b => b.order_id === batch.order_id)).sort((a, b) => a.order_id - b.order_id)

                    for (const order of orders) {
                        const batches = [...new Set(response.filter(batch => batch.order_id === order.order_id))].sort((a, b) => a.batch_id - b.batch_id);
                        const receivedDate = parseDataBaseDate(batches[0].received_timestamp);
                        batchList.push(
                            <div key={orders.indexOf(order)}>
                                <hr />
                                <h1 className={styles.title}>{`TO: ${batches[0].customer_order_number} | Order: ${order.order_id} | ${receivedDate}`}{order.expedited ? <> | <span className={styles.red_character}>E</span></> : <></>}</h1>
                                {batches.map((batch, index) => {
                                    return <BatchDisplay batch={batch} handleButtonClick={() => navigateToBatch(batch.batch_id)} key={index} />
                                })}
                            </div>
                        )
                    }

                    if (isMounted) {
                        setBatches(batchList);
                    }
                })
                .catch((err) => {
                    console.error(err)
                })
        }

        return () => {
            isMounted = false;
        };
    }, [setSensorGrid, batches.length, navigateToBatch, sensorGrid.length]);

    const handleChange = (event) => {
        if ((!isNaN(event.target.value) && !isNaN(parseFloat(event.target.value))) || event.target.value === '')
            setBatchNumber(event.target.value);
    }

    return (
        <div className={styles.menu} >
            <form onSubmit={handleSubmit} data-testid={'batchForm'} >
                <input type='text' value={batchNumber} onChange={handleChange} className={styles.default_text_box} placeholder={'Batch Number'} />
                <button type='submit' className={styles.default_button}>Submit</button>
            </form>
            {batches}
        </div>
    );
}

function BatchDisplay({ batch, handleButtonClick }) {
    return (
        <>
            <button key={batch.batch_id} className={styles.batch_button} onClick={handleButtonClick}>
                {`Batch: ${batch.batch_id} | Sensors: ${batch.sensors ? batch.sensors.length : 0} | `}
                <span className={styles[`calibration_${batch.calibration_procedure_id}`]}>{`CP: ${batch.calibration_procedure_id}`}</span>
            </button>
        </>
    )
}

export default BatchEntry;
