import { useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";

function Receiving() {
    const navigate = useNavigate();
    const { salesOrder, setSalesOrder, setOrder, expedited, setExpedited } = useAppContext()

    const handleSubmit = (event) => {
        event.preventDefault();
        callApi('create-order', {
            customer_id: 1,
            customer_order_number: salesOrder,
            expedited: expedited
        })
            .then(response => {
                setOrder(response[0].order_id);
                navigate('/createSalesOrder');
            })
    }

    const handleChange = (event) => {
        setSalesOrder(event.target.value.toUpperCase());
    }

    return (
        <div className={styles.menu}>
            <form onSubmit={handleSubmit}>
                <div className={styles.order_entry}>
                    <label className={`${styles.check_box_container}`}>
                        <input className={styles.grid_check_box} type="checkbox" onChange={() => setExpedited(!expedited)} checked={expedited} />
                        <span className={styles.expedite_text}>Expedited</span>
                    </label>
                    <input type='text' value={salesOrder} onChange={handleChange} className={styles.default_text_box} placeholder={'Sales Order'} />
                    <button type='submit' className={styles.default_button}>Submit</button>
                </div>
            </form>
        </div>
    );
}

export default Receiving;