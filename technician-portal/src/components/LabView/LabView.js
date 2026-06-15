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
    const [chamberHumidityOn, setChamberHumidityOn] = useState(false);
    const [chamberTemperatureOn, setChamberTemperatureOn] = useState(false);
    const [chamberHumiditySetPoint, setChamberHumiditySetPoint] = useState('');
    const [chamberTemperatureSetPoint, setChamberTemperatureSetPoint] = useState('');
    const [chamberHumidityCurrentSetPoint, setChamberHumidityCurrentSetPoint] = useState(20);
    const [chamberTemperatureCurrentSetPoint, setChamberTemperatureCurrentSetPoint] = useState(40);
    const [toggleTime, setToggleTime] = useState(null)

    const {
        equipment, technicianId, setTechnicianId, setLabReadings,
        setTechnician, setPopupMessage
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
                    setChamberHumidityOn(response.filter(g => g.asset_tag === 'S000138')[0].humidity_on)
                    setChamberTemperatureOn(response.filter(g => g.asset_tag === 'S000138')[0].temperature_on)
                    setBath2On(response.filter(g => g.asset_tag === 'S000102')[0].temperature_on)
                    setBath3On(response.filter(g => g.asset_tag === 'S000103')[0].temperature_on)
                    setChamberHumidityCurrentSetPoint(parseFloat(response.filter(g => g.asset_tag === 'S000138')[0].humidity_set_point).toFixed(2))
                    setChamberTemperatureCurrentSetPoint(parseFloat(response.filter(g => g.asset_tag === 'S000138')[0].temperature_set_point).toFixed(2))
                    setBath2CurrentSetPoint(parseFloat(response.filter(g => g.asset_tag === 'S000102')[0].temperature_set_point).toFixed(2))
                    setBath3CurrentSetPoint(parseFloat(response.filter(g => g.asset_tag === 'S000103')[0].temperature_set_point).toFixed(2))
                }
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

    const handleToggleGenerator = (generatorOn, setGeneratorOn, assetTag, isTemperature = true) => {
        setToggleTime(new Date())
        const commandType = isTemperature ? 'set_temperature_power' : 'set_humidity_power';

        callApi('create-generator-command', {
            command_type: commandType,
            asset_tag: assetTag,
            value: generatorOn ? 0 : 1,
        })
            .catch(err => {
                setPopupMessage(`Unable to turn generator ${assetTag} ${generatorOn ? 'off' : 'on'}`);
                console.error(err);
            })
        setGeneratorOn(!generatorOn)
    }

    const handleSubmitSetPoint = (event, assetTag, value, setText, isTemperature = true) => {
        event.preventDefault();
        const commandType = isTemperature ? 'adjust_temperature' : 'adjust_humidity'

        callApi('create-generator-command', {
            command_type: commandType,
            asset_tag: assetTag,
            value: parseFloat(value),
        })
            .then(() => {
                setPopupMessage(`Generator ${assetTag} set to ${value}`);
                setText('');
            })
            .catch(err => {
                setPopupMessage(`Unable to change generator ${assetTag} to set point ${value}`);
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
                                Chamber
                            </div>
                            ({chamberHumidityCurrentSetPoint}% @ {chamberTemperatureCurrentSetPoint}°C)
                            <div className={styles.generator_grid}>
                                <form onSubmit={event => handleSubmitSetPoint(event, 'S000138', chamberTemperatureSetPoint, setChamberTemperatureSetPoint)}>
                                    <input className={styles.default_text_box} value={chamberTemperatureSetPoint} onChange={event => setChamberTemperatureSetPoint(cleanSetPointText(event.target.value))} placeholder={`Temp (${chamberTemperatureOn ? 'On' : 'Off'})`} />
                                </form>
                                <Switch isOn={chamberTemperatureOn} id={'chamberTemperature'} handleToggle={() => handleToggleGenerator(chamberTemperatureOn, setChamberTemperatureOn, 'S000138')} />
                            </div>
                            <div className={styles.generator_grid}>
                                <form onSubmit={event => handleSubmitSetPoint(event, 'S000138', chamberHumiditySetPoint, setChamberHumiditySetPoint, false)}>
                                    <input className={styles.default_text_box} value={chamberHumiditySetPoint} onChange={event => setChamberHumiditySetPoint(cleanSetPointText(event.target.value))} placeholder={`Humidity (${chamberHumidityOn ? 'On' : 'Off'})`} />
                                </form>
                                <Switch isOn={chamberHumidityOn} id={'chamberHumidity'} handleToggle={() => handleToggleGenerator(chamberHumidityOn, setChamberHumidityOn, 'S000138', false)} />
                            </div>
                        </div>
                        <div className={styles.generator_control}>
                            <div className={styles.title}>
                                Bath 2
                            </div>
                            ({bath2CurrentSetPoint}°C)
                            <div className={styles.generator_grid}>
                                <form onSubmit={event => handleSubmitSetPoint(event, 'S000102', bath2SetPoint, setBath2SetPoint)}>
                                    <input className={styles.default_text_box} value={bath2SetPoint} onChange={event => setBath2SetPoint(cleanSetPointText(event.target.value))} placeholder={`Temp (${bath2On ? 'On' : 'Off'})`} />
                                </form>
                                <Switch isOn={bath2On} id={'bath2'} handleToggle={() => handleToggleGenerator(bath2On, setBath2On, 'S000102')} />
                            </div>
                        </div>
                        <div className={styles.generator_control}>
                            <div className={styles.title}>
                                Bath 3
                            </div>
                            ({bath3CurrentSetPoint}°C)
                            <div className={styles.generator_grid}>
                                <form onSubmit={event => handleSubmitSetPoint(event, 'S000103', bath3SetPoint, setBath3SetPoint)}>
                                    <input className={styles.default_text_box} value={bath3SetPoint} onChange={event => setBath3SetPoint(cleanSetPointText(event.target.value))} placeholder={`Temp (${bath3On ? 'On' : 'Off'})`} />
                                </form>
                                <Switch isOn={bath3On} id={'bath3'} handleToggle={() => handleToggleGenerator(bath3On, setBath3On, 'S000103')} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default LabView;