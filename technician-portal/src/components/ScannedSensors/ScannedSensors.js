import { useState } from "react";
import styles from "../../styles/styles.module.css";
import SensorLink from "../SensorLink/SensorLink";
import callApi from "../../utils/api/callApi";
import { useAppContext } from "../../contexts/app";

const SensorItem = ({ sensor }) => {
    const { setPopupMessage } = useAppContext();

    const [cableString, setCableString] = useState('')

    const handleAddCable = (event, sensorId) => {
        event.preventDefault();
        callApi('add-cable-to-sensor', { cable_id: cableString, sensor_id: sensorId })
            .then(() => {
                setCableString('')
            })
            .catch(err => {
                setPopupMessage('Unable to add cable to sensor')
                console.error(`Unable to add cable to sensor: ${err}`)
            })
    }
    return (
        <>
            <div className={`${sensor.online ? styles.green_sensor : styles.offline_sensor}`}>
                <SensorLink sensorId={sensor.sensor.split(':')[0]} text={sensor.cable_id ? `${sensor.sensor} (Cable: ${sensor.cable_id})` : sensor.sensor} />
            </div>
            <form onSubmit={(event) => handleAddCable(event, sensor.sensor.split(':')[0])} data-testid={'addLeadForm'}>
                <input type='text' value={cableString} onChange={event => setCableString(event.target.value)} className={styles.default_text_box} placeholder={'Lead ID'} />
            </form>
        </>
    )
}


const ScannedSensors = ({ sensorList }) => {

    if (sensorList.length > 0) {
        return (
            <div>
                <div className={styles.grid_menu}>
                    {sensorList.map((sensor, index) => <SensorItem key={index} sensor={sensor} />)}
                </div>
            </div>
        );
    } else {
        return (
            <div>
                <div className={styles.grid_menu}>
                    <div className={`${styles.offline_sensor} ${styles.double_span}`}>No sensors scanned</div>
                </div>
            </div>
        );
    }
};

export default ScannedSensors;