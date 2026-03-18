import { useState } from 'react';
import { useAppContext } from '../../contexts/app';
import styles from '../../styles/styles.module.css';
import callApi from '../../utils/api/callApi';
import Button from '../Button/Button';
import ConfirmationPopup from '../ConfirmationPopup/ConfirmationPopup';

export default function SetPointRow({ setPoint }) {
    const { setPopupMessage } = useAppContext();
    const [confirmationArray, setConfirmationArray] = useState([])
    const [calibrationProcedureId, setCalibrationProcedureId] = useState('')
    let setPointString = setPoint.set_point
    setPointString += setPoint.reading_type === 'temperature' ? '°C' : '%RH'

    function removeSetPoint() {
        const parameters = {
            set_point_id: setPoint.id,
            active_state: false
        }
        callApi('change-set-point-active-state', parameters)
            .catch((err) => {
                console.error(err)
                setPopupMessage('Unable to delete set point. Please try again later')
            })
    }

    function addToCalibrationProcedure(event) {
        event.preventDefault()
        const parameters = {
            calibration_procedure_id: calibrationProcedureId,
            set_point_id: setPoint.id
        }
        callApi('create-set-point-link', parameters)
            .then(() => {
                setPopupMessage(`Link created to Calibration Procedure ${calibrationProcedureId}`);
                setCalibrationProcedureId('');
            })
            .catch((err) => {
                console.error(err)
                setPopupMessage('Unable to create link')
            })
    }

    return (
        <>
            <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={removeSetPoint} />
            <tr key={setPoint.reference}>
                <td className={styles.equipment_table_data}>
                    <Button onClick={() => setConfirmationArray(['Are you sure you would like to delete this set point?'])} innerText={'Delete'} className={`${styles.default_button} ${styles.red}`} />
                </td>
                <td className={styles.equipment_table_data}>
                    {setPointString}
                </td>
                <td className={styles.equipment_table_data}>
                    {setPoint.reference_asset_tag}
                </td>
                <td className={styles.equipment_table_data}>
                    {setPoint.generator_asset_tag}
                </td>
                <td className={styles.equipment_table_data}>
                    {setPoint.reference}
                </td>
                <td className={styles.equipment_table_data}>
                    {setPoint.bridge ? setPoint.bridge : '-'}
                </td>
                <td className={styles.equipment_table_data}>
                    {setPoint.stability}
                </td>
                <td className={styles.equipment_table_data}>
                    <form onSubmit={addToCalibrationProcedure}>
                        <input type='text' value={calibrationProcedureId} onChange={event => setCalibrationProcedureId(event.target.value)} className={styles.default_text_box} placeholder={'Add to CP'} />
                    </form>
                </td>
            </tr>
        </>
    )
}