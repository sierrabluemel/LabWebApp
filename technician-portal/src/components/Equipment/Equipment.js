import { useEffect, useState } from "react";
import styles from "../../styles/styles.module.css";
import { round } from "../../utils/customMath.js";

function Equipment({ assetId, readings, description, openedEquipment, updateData }) {
    let referenceColor;
    const [shownStyle, setShownStyle] = useState('')
    const temperature = `Temperature: ${round(readings.Temperature)}`;
    const humidity = readings.hasOwnProperty('Humidity') ? `Humidity: ${round(readings.Humidity)}` : ``;

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
    if (!readings.hasOwnProperty('Humidity')) {
        let stableString = 'Temperature not stable';
        if (JSON.stringify(readings.stability_data['stable']) === 'true') {
            stableString = 'Temperature stable';
            referenceColor = styles.stable_green;
        }
        elements = (
            <>
                <hr />
                <h1 className={styles.title}>Temperature: {round(readings.Temperature, 10)}</h1>
                <h1 className={styles.title}>Temperature Average: {readings.stability_data.average}</h1>
                <h1 className={styles.title}>{stableString}</h1>
                <h1 className={styles.title}>Slope: {JSON.stringify(round(readings.stability_data['slope'], 10))}</h1>
                <h1 className={styles.title}>STD DEV: {JSON.stringify(round(readings.stability_data['standard_deviation'], 10))}</h1>
            </>)
    } else {
        let stableString = 'Humidity not stable';
        if (JSON.stringify(readings.stability_data.humidity['stable']) === 'true') {
            stableString = 'Humidity stable';
            referenceColor = styles.stable_green;
        }
        elements = (
            <>
                <hr />
                <h1 className={styles.title}>Humidity: {readings.Humidity}</h1>
                <h1 className={styles.title}>Humidity Average: {readings.stability_data.humidity.average}</h1>
                <h1 className={styles.title}>{stableString}</h1>
                <h1 className={styles.title}>Slope: {JSON.stringify(round(readings.stability_data['humidity']['slope'], 10))}</h1>
                <h1 className={styles.title}>STD DEV: {JSON.stringify(round(readings.stability_data['humidity']['standard_deviation'], 10))}</h1>
                <hr />
                <h1 className={styles.title}>Temperature: {readings.Temperature}</h1>
                <h1 className={styles.title}>Temperature Average: {readings.stability_data.temperature.average}</h1>
                <h1 className={styles.title}>{(JSON.stringify(readings.stability_data.temperature['stable']) === 'true') ? 'Temperature stable' : 'Temperature not stable'}</h1>
                <h1 className={styles.title}>Slope: {JSON.stringify(round(readings.stability_data['temperature']['slope'], 10))}</h1>
                <h1 className={styles.title}>STD DEV: {JSON.stringify(round(readings.stability_data['temperature']['standard_deviation'], 10))}</h1>
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
                    {temperature}<br />{humidity}{humidity ? <br /> : ''}{assetId}
                </button>
            {infoPopup}
        </>
    )
}

export default Equipment;