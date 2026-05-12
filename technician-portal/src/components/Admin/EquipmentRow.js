import styles from '../../styles/styles.module.css';
import parseDataBaseDate from '../../utils/parseDataBaseDate';

function EquipmentRow({ equipment }) {
    return (
        <tr key={equipment.asset_tag}>
            <td className={styles.equipment_table_data}>
                {equipment.asset_tag}
            </td>
            <td className={styles.equipment_table_data}>
                {equipment.description}
            </td>
            <td className={styles.equipment_table_data}>
                {Number.isNaN(parseFloat(equipment.serial_number)) ? '-' : equipment.serial_number}
            </td>
            <td className={styles.equipment_table_data}>
                {!equipment.calibration_certificate_number ? '-' : equipment.calibration_certificate_number}
            </td>
            <td className={styles.equipment_table_data}>
                {!equipment.last_calibration ? '-' : parseDataBaseDate(equipment.last_calibration)}
            </td>
            <td className={styles.equipment_table_data}>
                {!equipment.next_calibration ? '-' : parseDataBaseDate(equipment.next_calibration)}
            </td>
        </tr>
    )
}

export default EquipmentRow