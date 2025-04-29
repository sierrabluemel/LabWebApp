import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";
import parseDataBaseDate from "../../utils/parseDataBaseDate";

function OrderEntry() {
    const navigate = useNavigate();
    const {
        orderNumber, setOrderNumber,
        technicianId, setPopupMessage, setBatches
    } = useAppContext()

    const [activeOrders, setActiveOrders] = useState(null)

    const handleClick = (orderId) => {
        setOrderNumber(orderId);
        if (!technicianId) {
            setPopupMessage('Please sign in');
            return;
        }
        callApi('get-batches-by-order-id', { order_id: orderId })
            .then(response => {
                setBatches(response);
                for (const batch of response) {
                    callApi('log-batch-interaction', {
                        department: 'shipping',
                        start: true,
                        technician_id: technicianId,
                        batch_id: batch.batch_id
                    })
                }
            })
        navigate('/shipping')
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
                setActiveOrders(orders.sort((a, b) => a.order_id - b.order_id));
            })
    }, [activeOrders, technicianId, orderNumber])

    return (
        <>
            <div className={styles.menu}>
                <form onSubmit={handleSubmit}>
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
            </div>
            <br />
            <hr />
            <br />
            {!activeOrders &&
                <h1 className={styles.title}>Loading...</h1>
            }

            {activeOrders?.length === 0 &&
                <h1 className={styles.title}>No orders found</h1>
            }

            {activeOrders?.length > 0 &&
                activeOrders.map(order => (
                    <button
                        key={order.order_id}
                        className={styles.batch_button}
                        onClick={() => handleClick(order.order_id)}
                    >
                        Order: {order.order_id} | Customer Order: {order.customer_order_number} | {parseDataBaseDate(order.received_timestamp)}
                    </button>
                ))}
        </>
    )
}

export default OrderEntry;