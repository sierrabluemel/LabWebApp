import { useState } from "react";
import search from "../../utils/search";
import { useAppContext } from "../../contexts/app";

import styles from "../../styles/styles.module.css";

function SearchMenu() {
    const { setPopupMessage } = useAppContext();
    const [type, setType] = useState('sensor');
    const [searchString, setSearchString] = useState('');
    const [data, setData] = useState([]);
    const [responseMessage, setResponseMessage] = useState('');

    function parseDate(dateString) {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();

        const newDate = `${month}/${day}/${year}`;

        return newDate;
    }

    const handleTypeChange = (event) => {
        setType(event.target.value)
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setResponseMessage('Loading...')

        search(searchString, type)
            .then((results) => {
                if (!results) {
                    setPopupMessage('The type of lookup you tried to perform is not valid');
                    return
                }
                setData(results);
                if (results.length === 0) {
                    setResponseMessage('No data found')
                }
                setSearchString('');
            })
            .catch(() => {

            })
    }

    return (
        <div className={styles.menu}>
            <form onSubmit={handleSubmit} data-testid={'searchForm'}>
                <div className={styles.search_bar}>
                    <input type='text' value={searchString} onChange={event => setSearchString(event.target.value)} className={styles.default_text_box} placeholder={'Search'} />

                    <select className={styles.dropdown} value={type} onChange={handleTypeChange}>
                        <option value="sensor">Sensor</option>
                        <option value="batch">Batch Number</option>
                        <option value="customerOrder">TO</option>
                        <option value="order">Order Number</option>
                    </select>
                    <button type="submit" className={styles.search_submit_button}>Submit</button>
                </div>
            </form>

            {data.length === 0 ? <h1 className={styles.default_message}>{responseMessage}</h1> : <></>}

            <table className={styles.search_results}>
                <thead>
                    {data.length === 0 ? <></> : <tr>
                        <th>TO</th>
                        <th>Order #</th>
                        <th>Batch #</th>
                        <th>Sensor ID</th>
                        <th>CP #</th>
                        <th>Certificate</th>
                        <th>Status</th>
                        <th>Received</th>
                        <th>Shipped</th>
                    </tr>
                    }

                </thead>
                <tbody>
                    {data.length === 0 ? <></> :
                        data.map((row, index) => {
                            return (
                                <tr key={index}>
                                    <td>{row.customer_order_number ? row.customer_order_number : 'N/A'}</td>
                                    <td>{row.order_id ? row.order_id : 'N/A'}</td>
                                    <td>{row.batch_id ? row.batch_id : 'N/A'}</td>
                                    <td>{row.sensor_id ? <div className={styles.hoverable} title={row.sku}>{row.sensor_id}</div> : 'N/A'}</td>
                                    <td title={row.calibration_procedure} className={styles.hoverable}>{row.calibration_procedure_id ? row.calibration_procedure_id : 'N/A'}</td>
                                    <td>{row.certificate_id ? <a className={styles.search_link} href={`https://sensorcalibrations.blob.core.windows.net/public-certificates/MNT-${row.certificate_id}.pdf`} target="_blank" rel="noreferrer">MNT-{row.certificate_id}</a> : 'N/A'}</td>
                                    <td>{row.generate_certificate_json && row.generate_certificate_json.CS5 ? row.generate_certificate_json.CS5 : 'N/A'}</td>
                                    <td>{row.receiving_start ? `${parseDate(row.receiving_start)}` : 'N/A'}</td>
                                    <td>{row.shipping_end ? `${parseDate(row.shipping_end)}` : 'N/A'}</td>
                                </tr>
                            )
                        })}
                </tbody>
            </table>
        </div>
    )
}

export default SearchMenu;