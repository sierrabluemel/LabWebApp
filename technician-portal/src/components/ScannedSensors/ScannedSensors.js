import { useState } from "react";
import styles from "../../styles/styles.module.css";
import SensorLink from "../SensorLink/SensorLink";
import callApi from "../../utils/api/callApi";
import { useAppContext } from "../../contexts/app";
import Button from "../Button/Button";
import trashCan from "../../media/trash_can.png";

const SensorItem = ({ sensor, batchNumber, onSpareChange, onRemove }) => {
    const { setPopupMessage } = useAppContext();

    const [cableString, setCableString] = useState('')

    const toggleSpare = (sensorId) => {
        const spare = !sensor.spare;
        callApi('set-sensor-spare', { sensor_id: sensorId, batch_id: batchNumber, spare })
            .then(() => onSpareChange(parseInt(sensorId), spare))
            .catch(err => {
                setPopupMessage(`Unable to update spare state for sensor ${sensorId}`)
                console.error(err)
            })
    }

    const handleAddCable = (event, sensorId, cableId = null) => {
        event.preventDefault();
        callApi('add-cable-to-sensor', { cable_id: cableId ? cableId : cableString, sensor_id: sensorId })
            .then(() => {
                setCableString('')
            })
            .catch(err => {
                setPopupMessage('Unable to add cable to sensor')
                console.error(`Unable to add cable to sensor: ${err}`)
            })
    }

    const getCableFromMonnit = (sensorId) => {
        callApi('get-sensor-cable-id', { sensor_id: sensorId })
            .catch(err => {
                if (err.status === 509) {
                    setPopupMessage('Unable to find cable')
                    console.error(`Unable to get cable from Monnit: ${err}`)
                }
                else {
                    setPopupMessage('Unable to automatically add cable to sensor')
                    console.error(`Unable to automatically add cable to sensor: ${err}`)
                }
            })
    }

    return (
        <>
            <div className={`${sensor.online ? styles.green_sensor : styles.offline_sensor}`}>
                <SensorLink sensorId={sensor.sensor.split(':')[0]} text={sensor.cable_id ? `${sensor.sensor.split(':')[0]} (${sensor.cable_id})` : sensor.sensor.split(':')[0]} />
                {sensor.spare ? <span className={styles.shipping_sensor_muted}>spare</span> : <></>}
            </div>
            {/* key resets Button's cached label when the spare state flips; empty div keeps the grid columns when the toggle is hidden */}
            {onSpareChange ? <Button key={sensor.spare ? 'use' : 'spare'} onClick={() => toggleSpare(sensor.sensor.split(':')[0])} className={sensor.spare ? `${styles.default_button} ${styles.green}` : styles.default_button} innerText={sensor.spare ? 'Add to batch' : 'Make spare'} /> : <div></div>}
            <form onSubmit={(event) => handleAddCable(event, sensor.sensor.split(':')[0])} data-testid={'addLeadForm'}>
                <input type='text' value={cableString} onChange={event => setCableString(event.target.value)} className={styles.default_text_box} placeholder={'Lead ID'} />
            </form>
            <Button onClick={() => getCableFromMonnit(sensor.sensor.split(':')[0])} innerText={'Get lead'} />
            {onRemove ? <button type='button' className={styles.icon_button} onClick={() => onRemove(sensor)} aria-label={`Remove sensor ${sensor.sensor.split(':')[0]}`} title='Remove from batch'>
                <img src={trashCan} alt='' className={styles.edit_order_trash} />
            </button> : <div></div>}
        </>
    )
}


const ScannedSensors = ({ sensorList, batchNumber, onSpareChange, onRemove }) => {

    if (sensorList.length > 0) {
        return (
            <div>
                <div className={styles.scanned_sensor_grid}>
                    {/* spares sink to the bottom; sort is stable so scan order is kept within each group */}
                    {[...sensorList].sort((a, b) => (a.spare ? 1 : 0) - (b.spare ? 1 : 0)).map((sensor, index) => <SensorItem key={sensor.sensor} sensor={sensor} batchNumber={batchNumber} onSpareChange={onSpareChange} onRemove={onRemove} />)}
                </div>
            </div>
        );
    } else {
        return (
            <div className={styles.empty_state}>No sensors scanned</div>
        );
    }
};

export default ScannedSensors;