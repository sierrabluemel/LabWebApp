import { useEffect, useRef, useState } from "react";
import callApi from "../../utils/api/callApi";
import styles from "../../styles/styles.module.css";
import Equipment from "../Equipment/Equipment";
import { useAppContext } from "../../contexts/app";
import getEquipment from "../../utils/getEquipment";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";


function LabView() {
    const [aggregatorStatusDotStyle, setAggregatorStatusDotStyle] = useState(styles.status_dot_red);
    const [referenceList, setReferenceList] = useState([]);
    const openedEquipment = useRef('');
    const isMounted = useRef(false);
    const [equipmentOutOfCalibration, setEquipmentOutOfCalibration] = useState([]);
    const [labReadingString, setLabReadingString] = useState()

    const { equipment, technicianId, labReadings, setLabReadings } = useAppContext()

    const setAggregatorStyle = (timestamp) => {
        let now = new Date()
        const secondsAgo = (now - new Date(timestamp)) / 1000;
        if (secondsAgo <= 30) {
            setAggregatorStatusDotStyle(styles.status_dot_green);
        } else if (secondsAgo > 120) {
            setAggregatorStatusDotStyle(styles.status_dot_red);
        } else {
            setAggregatorStatusDotStyle(styles.status_dot_yellow);
        }
    }

    const updateData = () => {
        if (!technicianId) {
            return;
        }

        callApi('get-last-sensor-readings')
        .then(response => {
            const bothReadings = response.filter(r => r.sensor_id === parseInt(process.env.REACT_APP_LAB_SENSOR_ID))
            if (bothReadings.length > 0) {
                const labHumidity = bothReadings.filter(r => r.type === 'humidity')[0].value
                const labTemperature = bothReadings.filter(r => r.type === 'temperature')[0].value
                setLabReadings({
                    humidity: labHumidity,
                    temperature: labTemperature
                })
                setLabReadingString(`${labHumidity}%RH @ ${labTemperature}°C`)
            } else {
                setLabReadingString('No lab readings found')
            }
        })

        callApi('get-last-reference-readings')
            .then(response => {
                setAggregatorStyle(response[0].timestamp);

                const referenceArray = [
                    equipment.current.reference1,
                    equipment.current.reference2,
                    equipment.current.reference3,
                    equipment.current.rotronic
                ];

                setReferenceList(referenceArray.map(reference => {
                    return <Equipment
                        key={reference.asset_tag}
                        assetId={reference.asset_tag}
                        readings={response.filter(reading => reading.asset_tag === reference.asset_tag)}
                        description={reference.description}
                        openedEquipment={openedEquipment}
                        updateData={updateData}
                    />
                }))
            })
            .catch((err) => {
                if (err.status !== 401) {
                    console.error(`Unable to set recent data: ${err}`)
                }
            })
    }


    const loadData = () => {
        if (!technicianId) {
            setTimeout(getEquipment, 3000)
            return;
        }

        return getEquipment()
            .then(equipmentObject => {
                equipment.current = equipmentObject;
                const now = new Date()
                const keys = Object.keys(equipmentObject)
                const badEquipment = []
                for (const key of keys) {
                    const equipment = equipmentObject[key]
                    if (new Date(equipment.next_calibration) < now) {
                        badEquipment.push(`${equipment.asset_tag} (${equipment.description}) is out of calibration as of ${parseDataBaseDate(equipment.next_calibration)}`)
                    }
                }
                if (badEquipment.length > 0) {
                    setEquipmentOutOfCalibration(['EQUIPMENT OUT OF CALIBRATION', ...badEquipment]);
                }
            })
    }

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            loadData()
                .then(() => {
                    updateData();
                })
        }
        const interval = setInterval(updateData, 3000);
        return () => clearInterval(interval);
    })

    return (
        <>
            {equipmentOutOfCalibration.length === 0 ? <></> : <ConfirmationPopup confirmationArray={equipmentOutOfCalibration} setConfirmationArray={setEquipmentOutOfCalibration} handleConfirm={() => equipmentOutOfCalibration.current = []} />}
            <div className={styles.equipment_container}>
                <h1 className={styles.lab_readings}>
                    Aggregator status: <span className={`${aggregatorStatusDotStyle} ${styles.status_dot}`} data-testid={'statusDot'} ></span>
                    <br />
                    {labReadingString}
                </h1>
                {(isMounted.current) ? referenceList : <h1 className={styles.title}>Loading...</h1>}
            </div>
        </>
    )
}

export default LabView;