import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import addWorkDays from "../../utils/addWorkDays";

function OrderEntry() {
    const navigate = useNavigate();
    const {
        orderNumber, setOrderNumber,
        technicianId, setPopupMessage, setBatches
    } = useAppContext()

    const [activeOrders, setActiveOrders] = useState(null)

    const setOrderColors = (orders) => {
        const today = new Date();
        let dueDate;

        orders.forEach(order => {
            if (order.expedited)
                dueDate = addWorkDays(new Date(order.received_timestamp), 2)
            else
                dueDate = addWorkDays(new Date(order.received_timestamp), 7)

            if (order.sensor_count === 0)
                order.elementClass = styles.gray;
            else if (addWorkDays(today, 0) > dueDate)
                order.elementClass = styles.red;
            else if (addWorkDays(today, 3) < dueDate)
                order.elementClass = styles.green;
            else
                order.elementClass = styles.yellow;

            order.dueDate = JSON.stringify(dueDate).replace('"', '')
        })

        return orders.sort((a, b) => a.order_id - b.order_id);
    }

    const handleClick = (orderId) => {
        setOrderNumber(orderId);
        if (!technicianId) {
            setPopupMessage('Please sign in');
            return;
        }
        callApi('get-batches-by-order-id', { order_id: orderId })
            .then(response => {
                setBatches(response);
                navigate('/shipping')
                for (const batch of response) {
                    callApi('log-batch-interaction', {
                        department: 'shipping',
                        start: true,
                        technician_id: technicianId,
                        batch_id: batch.batch_id
                    })
                }
            })
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!technicianId) {
            setPopupMessage('Please sign in');
            return;
        }
        callApi('get-order-by-id', { order_id: orderNumber })
            .then(response => {
                if (!response.order_id) {
                    setPopupMessage(`Could not find order: ${orderNumber}`)
                    return
                }
                return callApi('get-batches-by-order-id', { order_id: orderNumber })
            })
            .then(batches => {
                setBatches(batches);
                for (const batch of batches) {
                    callApi('log-batch-interaction', {
                        department: 'shipping',
                        start: true,
                        technician_id: technicianId,
                        batch_id: batch.batch_id
                    })
                }
                navigate('/shipping')
            })
    }

    useEffect(() => {
        if (activeOrders)
            return;
        callApi('get-orders-to-ship')
            .then(orders => {
                setActiveOrders(setOrderColors(orders));
            })
    }, [activeOrders, technicianId, orderNumber])

    return (
        <>
            <div className={styles.menu}>
                <h2 className={styles.section_heading}>Open an order by order number</h2>
                <form onSubmit={handleSubmit} className={styles.inline_form}>
                    <input
                        type='text'
                        value={orderNumber}
                        onChange={(event) => setOrderNumber(event.target.value)}
                        className={styles.default_text_box}
                        placeholder={'Order Number'}
                    />
                    <button
                        className={styles.default_button}
                        onClick={handleSubmit}
                    >
                        Submit
                    </button>
                </form>
                <h2 className={styles.section_heading}>Orders to ship</h2>
                {!activeOrders &&
                    <h1 className={styles.title}>Loading...</h1>
                }

                {activeOrders?.length === 0 &&
                    <h1 className={styles.title}>No orders found</h1>
                }

                {activeOrders?.length > 0 &&
                    <div className={styles.batches_container}>
                        {activeOrders.map(order => (
                            <button
                                key={order.order_id}
                                className={`${styles.batch_button} ${order.elementClass}`}
                                onClick={() => handleClick(order.order_id)}
                            >
                                Order: {order.order_id} | Customer Order: {order.customer_order_number} | {parseDataBaseDate(order.dueDate)}{order.sensor_count === 0 && ' | Empty'}
                            </button>
                        ))}
                    </div>}
            </div>
        </>
    )
}

export default OrderEntry;