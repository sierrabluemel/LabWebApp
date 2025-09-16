import styles from "../../styles/styles.module.css";
import SensorLink from "../SensorLink/SensorLink";


const ScannedSensors = ({ sensorList }) => {
    if (sensorList.length > 0) {
        return (
            <div>
                <div className={styles.grid_menu}>
                    {sensorList.map((sensor, index) => (
                        <div key={index} className={`${styles.double_span} ${sensor.online ? styles.green_sensor : styles.offline_sensor}`}>
                            <SensorLink sensorId={sensor.sensor.split(':')[0]} text={sensor.sensor} />
                        </div>
                    ))}
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