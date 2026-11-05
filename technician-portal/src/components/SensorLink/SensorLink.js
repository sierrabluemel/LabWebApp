import styles from "../../styles/styles.module.css";

export default function SensorLink({sensorId, text}) {
    return <a className={styles.sensor_link} href={`https://www.imonnit.com/Overview/SensorEdit/${sensorId}`} target="_blank" rel="noreferrer">
        {text}
    </a>
}