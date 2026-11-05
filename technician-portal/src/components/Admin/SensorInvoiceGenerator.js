import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "../../styles/styles.module.css"
import { useState } from "react";
import Button from "../Button/Button";
import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

function SensorInvoiceGenerator() {
    const [startDate, setStartDate] = useState(new Date())
    const [endDate, setEndDate] = useState(new Date())

    const { setPopupMessage } = useAppContext();

    function generateReport() {
        // callApi refreshes an expired token on 418; raw fetch did not
        return callApi('get-sensor-invoice-report', { start_date: startDate.toString(), end_date: endDate.toString() }, true)
            .then(response => {
                const url = URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                const dateString = `${startDate.getMonth() + 1}_${startDate.getDate()}-${endDate.getMonth() + 1}_${endDate.getDate()}`
                link.download = `sensor_invoice_report_${dateString}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('Error:', error);
                setPopupMessage('Failed to generate the invoice report');
            });
    }

    return (
        <div className={styles.menu}>
            <h1 className={styles.title}>Sensor Invoices</h1>
            <div className={`${styles.toolbar} ${styles.center_toolbar}`}>
                <label htmlFor="startDate">Start</label>
                <DatePicker id="startDate" className={styles.default_text_box} selected={startDate} onChange={date => setStartDate(date)} />
                <label htmlFor="endDate">End</label>
                <DatePicker id="endDate" className={styles.default_text_box} selected={endDate} onChange={date => setEndDate(date)} />
                <Button innerText={'Generate report'} onClick={generateReport} />
            </div>
        </div>
    )
}

export default SensorInvoiceGenerator;