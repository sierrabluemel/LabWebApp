import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "../../../styles/styles.module.css"
import { useState } from "react";
import Button from "../../Button/Button";
import { useAppContext } from "../../../contexts/app";
import ip from "../../../utils/ip/ip";

function SensorInvoiceGenerator() {
    const [startDate, setStartDate] = useState(new Date())
    const [endDate, setEndDate] = useState(new Date())

    const { setPopupMessage } = useAppContext;

    function generateReport(event) {
        fetch(`http://${ip}/api/get-sensor-invoice-report/?start_date=${startDate}&end_date=${endDate}`)
            .then(response => {
                if (response.ok) {
                    return response.blob();
                } else {
                    console.error(`Could not complete generation, response.ok: ${response.ok}`);
                    setPopupMessage(`Failed to generate the invoice report`);
                }
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `sensor_invoice_report.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

return (
    <div className={styles.menu}>
        <h1 className={styles.title}>Sensor Invoices</h1>
        <div className={styles.invoice_grid}>
            <div>
                <label htmlFor="startDate">Start Date</label>
                <DatePicker id="startDate" showTimeSelect className={styles.date_picker} selected={startDate} onChange={date => setStartDate(date)} />
            </div>
            <div>
                <label htmlFor="endDate">End Date</label>
                <DatePicker id="endDate" showTimeSelect className={styles.date_picker} selected={endDate} onChange={date => setEndDate(date)} />
            </div>
            <Button innerText={'Generate report'} onClick={generateReport} />
        </div>
    </div>
)
}

export default SensorInvoiceGenerator;