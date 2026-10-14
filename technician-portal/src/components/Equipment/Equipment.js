import { useEffect, useState } from "react";
import styles from "../../styles/styles.module.css";
import { round } from "../../utils/customMath.js";

function Equipment({ assetId, readings, description, openedEquipment, updateData }) {
    const temperatureReading = readings.filter(reading => reading.type === 'temperature')[0]
    const humidityReading = readings.filter(reading => reading.type === 'humidity')[0]
    let referenceColor;
    const [shownStyle, setShownStyle] = useState('')

    const toggleChecked = () => {
        if (shownStyle !== styles.equipment_popup_show) {
            openedEquipment.current = assetId
            setShownStyle(styles.equipment_popup_show)
        } else {
            openedEquipment.current = ''
            setShownStyle('')
        }
        updateData()
    }

    useEffect(() => {
        if (openedEquipment.current !== assetId && shownStyle) {
            setShownStyle('')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openedEquipment.current])

    let elements;
    if (!humidityReading) {
        let stableString = 'Temperature not stable';
        if (temperatureReading?.stable) {
            stableString = 'Temperature stable';
            referenceColor = styles.stable_green;
        }
        elements = (
            <>
                <hr />
                <h1 className={styles.title}>Temperature: {round(temperatureReading.value, 10)}</h1>
                <h1 className={styles.title}>Temperature Average: {round(temperatureReading.average, 4)}</h1>
                <h1 className={styles.title}>{stableString}</h1>
                <h1 className={styles.title}>Slope: {round(temperatureReading.slope, 6)}</h1>
                <h1 className={styles.title}>STD DEV: {round(temperatureReading.standard_deviation, 6)}</h1>
            </>)
    } else {
        let stableString = 'Humidity not stable';
        if (humidityReading && humidityReading.stable) {
            stableString = 'Humidity stable';
            referenceColor = styles.stable_green;
        }
        elements = (
            <>
                <hr />
                <h1 className={styles.title}>Humidity: {humidityReading.value}</h1>
                <h1 className={styles.title}>Humidity Average: {round(humidityReading.average, 4)}</h1>
                <h1 className={styles.title}>{stableString}</h1>
                <h1 className={styles.title}>Slope: {round(humidityReading.slope, 6)}</h1>
                <h1 className={styles.title}>STD DEV: {round(humidityReading.standard_deviation, 6)}</h1>
                <hr />
                <h1 className={styles.title}>Temperature: {temperatureReading.value}</h1>
                <h1 className={styles.title}>Temperature Average: {round(temperatureReading.average, 4)}</h1>
                <h1 className={styles.title}>{temperatureReading.stable ? 'Temperature stable' : 'Temperature not stable'}</h1>
                <h1 className={styles.title}>Slope: {round(temperatureReading.slope, 6)}</h1>
                <h1 className={styles.title}>STD DEV: {round(temperatureReading.standard_deviation, 6)}</h1>
            </>
        )
    }
    const infoPopup = (
        <div className={`${styles.equipment_popup} ${shownStyle}`} data-testid={'equipmentPopup'}>
            <h1 className={styles.title}>Reference: {assetId} | {description}</h1>
            {elements}
        </div>
    )

    return (
        <>
                <button className={`${styles.equipment} ${referenceColor}`} onClick={toggleChecked}>
                    Temperature: {round(temperatureReading.value, 2)}<br />{humidityReading ? <>Humidity: {round(humidityReading.value, 2)}<br /></> : ''}{assetId}
                </button>
            {infoPopup}
        </>
    )
}

export default Equipment;