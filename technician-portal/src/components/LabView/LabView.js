import { useEffect, useRef, useState } from "react";
import callApi from "../../utils/api/callApi";
import styles from "../../styles/styles.module.css";
import Equipment from "../Equipment/Equipment";

function LabView() {
    const [aggregatorStatusDotStyle, setAggregatorStatusDotStyle] = useState(styles.status_dot_red);
    const [referenceList, setReferenceList] = useState([]);
    const [labReadings, setLabReadings] = useState(null);
    const equipmentList = useRef([]);
    const openedEquipment = useRef('');
    const isMounted = useRef(false);

    const setAggregatorStyle = (data) => {
        let now = new Date()
        const secondsAgo = (now - new Date(data.timestamp)) / 1000;
        if (secondsAgo <= 30) {
            setAggregatorStatusDotStyle(styles.status_dot_green);
        } else if (secondsAgo > 120) {
            setAggregatorStatusDotStyle(styles.status_dot_red);
        } else {
            setAggregatorStatusDotStyle(styles.status_dot_yellow);
        }
    }

    const updateData = () => {
        callApi('get-recent-data')
            .then(data => {
                setAggregatorStyle(data);

                const referenceArray = [];
                const references = {};
                Object.assign(references, data.super_daq_data, data.rotronic_data)
                let description;
                for (const reference in references) {
                    description = equipmentList.current.filter(equipment => equipment.asset_tag === reference)[0].description
                    referenceArray.push(<Equipment key={reference} assetId={reference} readings={references[reference]} description={description} openedEquipment={openedEquipment} updateData={updateData} />)
                }
                setLabReadings(`${data.lab_humidity}%RH @ ${data.lab_temperature}°C`)
                setReferenceList(referenceArray)
            })
            .catch((err) => {
                console.error(`Unable to set recent data: ${err}`)
            })
    }

    const getEquipment = async () => {
        return callApi('get-equipment')
            .then(equipment => {
                equipmentList.current = equipment;
            })
            .catch(err => {
                console.error(`Error getting equipment: ${err}`)
                setTimeout(getEquipment, 1000);
            })
    }

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            getEquipment()
            .then(() => {
                updateData();
            })
        }
        const interval = setInterval(updateData, 3000);
        return () => clearInterval(interval);
    })

    return (
        <div className={styles.equipment_container}>
            <h1 className={styles.lab_readings}>
                Aggregator status: <span className={`${aggregatorStatusDotStyle} ${styles.status_dot}`} data-testid={'statusDot'} ></span>
                <br />
                {labReadings}
            </h1>
            {(referenceList.length > 0) ? referenceList : <h1 className={styles.title}>Loading...</h1>}
        </div>
    )
}

export default LabView;