import { useLocation, useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";

function Receiving() {
    const navigate = useNavigate();
    const focusNewOrder = !!useLocation().state?.focusNewOrder;
    const { salesOrder, setSalesOrder, setOrder, expedited, setExpedited, setPopupMessage } = useAppContext()

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!salesOrder.trim()) {
            setPopupMessage('Enter a sales order');
            return;
        }
        callApi('create-order', {
            customer_id: 1,
            customer_order_number: salesOrder,
            expedited: expedited
        })
            .then(response => {
                setOrder(response.order_id);
                navigate('/createSalesOrder');
            })
            .catch(error => {
                console.error(error);
                setPopupMessage(`Could not create order ${salesOrder}`);
            })
    }

    const handleChange = (event) => {
        setSalesOrder(event.target.value.toUpperCase());
    }

    return (
        <section>
            <h2 className={styles.section_heading}>New order</h2>
            <form onSubmit={handleSubmit}>
                <div className={styles.order_entry}>
                    <input type='text' value={salesOrder} onChange={handleChange} className={styles.default_text_box} placeholder={'New Sales Order'} autoFocus={focusNewOrder} />
                    <button type='submit' className={styles.default_button}>Create Order</button>
                    <label className={styles.check_box_container}>
                        <input className={styles.grid_check_box} type="checkbox" onChange={() => setExpedited(!expedited)} checked={expedited} />
                        <span className={styles.expedite_text}>Expedited</span>
                    </label>
                </div>
            </form>
        </section>
    );
}

export default Receiving;
