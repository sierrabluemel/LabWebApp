import { useState } from 'react';
import { useAppContext } from '../../contexts/app';
import styles from '../../styles/styles.module.css';
import callApi from '../../utils/api/callApi';
import Button from '../Button/Button';
import ConfirmationPopup from '../ConfirmationPopup/ConfirmationPopup';
import { round } from '../../utils/customMath';

export default function HumidityVarianceRow({ variance, refreshVariances }) {
    const { setPopupMessage } = useAppContext();
    const [confirmationArray, setConfirmationArray] = useState([])

    function removeVariance() {
        const parameters = {
            variance_id: variance.variance_id,
            active_state: false
        }
        callApi('change-humidity-variance-active-state', parameters)
            .then(() => refreshVariances())
            .catch((err) => {
                console.error(err)
                setPopupMessage('Unable to delete set point. Please try again later')
            })
    }

    function sanitizeNumber(number) {
        const maxLength = 12
        if (JSON.stringify(number).length > maxLength)
            return `~${round(number, maxLength - 2)}`

        return number
    }

    return (
        <>
            <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={removeVariance} />
            <tr key={variance.reference}>
                <td className={styles.equipment_table_data}>
                    <Button onClick={() => setConfirmationArray(['Are you sure you would like to delete this set point?'])} innerText={'Delete'} className={`${styles.default_button} ${styles.red}`} />
                </td>
                <td className={styles.equipment_table_data}>
                    {variance.asset_tag}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.temperature)}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.humidity)}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.calibration_uncertainty)}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.reading_resolution_uncertainty)}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.drift_uncertainty)}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.hysteresis_uncertainty)}
                </td>
                <td className={styles.equipment_table_data}>
                    {sanitizeNumber(variance.gas_temperature_dependance_uncertainty)}
                </td>
            </tr>
        </>
    )
}