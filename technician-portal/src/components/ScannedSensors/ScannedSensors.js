import { useState } from "react";
import styles from "../../styles/styles.module.css";
import SensorLink from "../SensorLink/SensorLink";
import callApi from "../../utils/api/callApi";
import { useAppContext } from "../../contexts/app";
import Button from "../Button/Button";

const SensorItem = ({ sensor }) => {
    const { setPopupMessage } = useAppContext();

    const [cableString, setCableString] = useState('')

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
            </div>
            <Button onClick={() => getCableFromMonnit(sensor.sensor.split(':')[0])} innerText={'Get lead'} />
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
                <div className={styles.triple_grid_menu}>
                    {sensorList.map((sensor, index) => <SensorItem key={index} sensor={sensor} />)}
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