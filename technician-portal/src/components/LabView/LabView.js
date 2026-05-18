import { useEffect, useRef, useState } from "react";
import callApi from "../../utils/api/callApi";
import styles from "../../styles/styles.module.css";
import Equipment from "../Equipment/Equipment";
import { useAppContext } from "../../contexts/app";
import getEquipment from "../../utils/getEquipment";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";
import Switch from "../Switch/Switch";


function LabView() {
    const [aggregatorStatusDotStyle, setAggregatorStatusDotStyle] = useState(styles.status_dot_red);
    const [referenceList, setReferenceList] = useState([]);
    const openedEquipment = useRef('');
    const isMounted = useRef(false);
    const [equipmentOutOfCalibration, setEquipmentOutOfCalibration] = useState([]);
    const [labReadingString, setLabReadingString] = useState();
    const [bath2On, setBath2On] = useState(false);
    const [bath3On, setBath3On] = useState(false);
    const [bath2SetPoint, setBath2SetPoint] = useState('');
    const [bath3SetPoint, setBath3SetPoint] = useState('');
    const [bath2CurrentSetPoint, setBath2CurrentSetPoint] = useState(-25);
    const [bath3CurrentSetPoint, setBath3CurrentSetPoint] = useState(90);
    const [toggleTime, setToggleTime] = useState(null)

    const {
        equipment, technicianId, setTechnicianId, setLabReadings,
        generatorStatuses, setGeneratorStatuses, setTechnician,
        setPopupMessage
    } = useAppContext()

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

    const updateGeneratorStatus = (updatePower = false) => {
        if (toggleTime && new Date() - toggleTime < 10000)
            return
        else
            setToggleTime(null)

        callApi('get-generator-statuses')
            .then(response => {
                if (updatePower) {
                    setBath2On(response.filter(g => g.asset_tag === 'S000102')[0].power_on)
                    setBath3On(response.filter(g => g.asset_tag === 'S000103')[0].power_on)
                    setBath2CurrentSetPoint(parseFloat(response.filter(g => g.asset_tag === 'S000102')[0].set_point).toFixed(2))
                    setBath3CurrentSetPoint(parseFloat(response.filter(g => g.asset_tag === 'S000103')[0].set_point).toFixed(2))
                }
                setGeneratorStatuses(response)
            })
    }

    const updateData = () => {
        if (!technicianId) {
            return;
        }

        updateGeneratorStatus(true);

        callApi('get-last-sensor-readings', { sensor_ids: [process.env.REACT_APP_LAB_SENSOR_ID] })
            .then(response => {
                const bothReadings = response.filter(r => r.sensor_id === parseInt(process.env.REACT_APP_LAB_SENSOR_ID))
                if (bothReadings.length > 0) {
                    const labHumidity = bothReadings.filter(r => r.type === 'humidity')[0].value
                    const labTemperature = bothReadings.filter(r => r.type === 'temperature')[0].value
                    setLabReadingString(`${labHumidity}%RH @ ${labTemperature}°C`)
                    setLabReadings({ humidity: labHumidity, temperature: labTemperature })
                } else {
                    setLabReadingString('No lab readings found')
                }
            })
            .catch((err) => {
                if (err?.status === 401) {
                    setTechnician({});
                    setTechnicianId(0);
                    localStorage.clear('user')
                    localStorage.clear('jwt')
                    localStorage.clear('refresh')
                }
                else {
                    console.error(`Unable to set recent data: ${err}`)
                }
            })

        callApi('get-last-reference-readings')
            .then(response => {
                if (response.length === 0)
                    throw Error('Unable to get aggregator readings');
                setAggregatorStyle(response[0].timestamp);

                const referenceArray = [
                    equipment.current.reference1,
                    equipment.current.reference2,
                    equipment.current.reference3,
                    equipment.current.rotronic
                ];

                if (equipment.current.rotronic_backup)
                    referenceArray.push(equipment.current.rotronic_backup)

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
                if (err?.status === 401) {
                    setTechnician({});
                    setTechnicianId(0);
                    localStorage.clear('user')
                    localStorage.clear('jwt')
                    localStorage.clear('refresh')
                }
                else {
                    console.error(`Unable to set recent data: ${err}`)
                }
            })
    }


    const loadData = () => {
        if (!technicianId) {
            setTimeout(loadData, 1000)
            return;
        }

        updateGeneratorStatus(true);

        return getEquipment()
            .then(equipmentObject => {
                equipment.current = equipmentObject;
                const now = new Date()
                const keys = Object.keys(equipmentObject)
                const badEquipment = []
                for (const key of keys) {
                    if (key === 'rotronic_backup')
                        return;
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

    const handleToggleBath = (bathOn, setBathOn, assetTag) => {
        setToggleTime(new Date())
        callApi('create-generator-command', { command_type: 'set_power', asset_tag: assetTag, value: bathOn ? 0 : 1 })
            .catch(err => {
                setPopupMessage(`Unable to turn bath ${assetTag} ${bathOn ? 'off' : 'on'}`);
                console.error(err);
            })
        setBathOn(!bathOn)
    }

    const handleSubmitSetPoint = (event, assetTag, value, setText) => {
        event.preventDefault();

        callApi('create-generator-command', { command_type: 'adjust_set_point', asset_tag: assetTag, value: parseFloat(value) })
            .then(() => {
                setPopupMessage(`Bath ${assetTag} set to ${value}`);
                setText('');
            })
            .catch(err => {
                setPopupMessage(`Unable to change bath ${assetTag} to set point ${value}`);
                console.error(err);
            })

    }

    const cleanSetPointText = (setPointText) => {
        let cleanedText = ''
        for (let i = 0; i < setPointText.length; i++) {
            const char = setPointText[i];
            if (char === '.' || char === '-' || !isNaN(parseFloat(char)))
                cleanedText = cleanedText + char
        }
        return cleanedText;
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
            <ConfirmationPopup confirmationArray={equipmentOutOfCalibration} setConfirmationArray={setEquipmentOutOfCalibration} handleConfirm={() => equipmentOutOfCalibration.current = []} />
            <div className={styles.equipment_bar}>
                <div className={styles.equipment_container}>
                    <h1 className={styles.lab_readings}>
                        Aggregator status: <span className={`${aggregatorStatusDotStyle} ${styles.status_dot}`} data-testid={'statusDot'} ></span>
                        <br />
                        {labReadingString}
                    </h1>
                    {(isMounted.current) ? referenceList : <h1 className={styles.title}>Loading...</h1>}

                    <div className={styles.equipment_control_menu}>
                        <div className={styles.generator_control}>
                            <div className={styles.title}>
                                <span className={`${generatorStatuses} ${styles.status_dot}`} />
                                Bath 2
                            </div>
                            <form onSubmit={event => handleSubmitSetPoint(event, 'S000102', bath2SetPoint, setBath2SetPoint)}>
                                <input className={styles.default_text_box} value={bath2SetPoint} onChange={event => setBath2SetPoint(cleanSetPointText(event.target.value))} placeholder={`Set Point (${bath2CurrentSetPoint})`} />
                            </form>
                            <div className={styles.grid_menu}>
                                <Switch isOn={bath2On} id={'bath2'} handleToggle={() => handleToggleBath(bath2On, setBath2On, 'S000102')} />
                                <div className={styles.default_text}>
                                    {bath2On ? 'On' : 'Off'}
                                </div>
                            </div>
                        </div>
                        <div className={styles.generator_control}>
                            <div className={styles.title}>
                                Bath 3
                            </div>
                            <form onSubmit={event => handleSubmitSetPoint(event, 'S000103', bath3SetPoint, setBath3SetPoint)}>
                                <input className={styles.default_text_box} value={bath3SetPoint} onChange={event => setBath3SetPoint(cleanSetPointText(event.target.value))} placeholder={`Set Point (${bath3CurrentSetPoint})`} />
                            </form>
                            <div className={styles.grid_menu}>
                                <Switch isOn={bath3On} id={'bath3'} handleToggle={() => handleToggleBath(bath3On, setBath3On, 'S000103')} />
                                <div className={styles.default_text}>
                                    {bath3On ? 'On' : 'Off'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default LabView;