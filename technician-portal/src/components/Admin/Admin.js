import styles from '../../styles/styles.module.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import callApi from '../../utils/api/callApi';
import { useAppContext } from '../../contexts/app';
import ConfirmationPopup from '../ConfirmationPopup/ConfirmationPopup';
import parseDataBaseDate from '../../utils/parseDataBaseDate';
import EquipmentConfigRow from './EquipmentConfigRow';
import SensorInvoiceGenerator from './SensorInvoiceGenerator';
import EquipmentRow from './EquipmentRow';
import SetPointRow from './SetPointRow';
import CreateSetPoint from './CreateSetPoint';
import CreateNotification from './CreateNotification';
import EditCertificates from './EditCertificates';
import CreateHumidityVariance from './CreateHumidityVariance';
import HumidityVarianceRow from './HumidityVarianceRow';
import StabilityTimes from './StabilityTimes';
import ManageUsers from './ManageUsers';

const tabs = [
    { key: 'notifications', label: 'Notifications & Invoices' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'variances', label: 'Variances' },
    { key: 'stability', label: 'Stability Times' },
    { key: 'certificates', label: 'Certificates' },
    { key: 'users', label: 'Users' }
];

function Admin() {
    const [reference1, setReference1] = useState({});
    const [reference2, setReference2] = useState({});
    const [reference3, setReference3] = useState({});
    const [reference4, setReference4] = useState({});
    const [superDaq, setSuperDaq] = useState({});
    const [setPoints, setSetPoints] = useState([]);
    const [humidityVariances, setHumidityVariances] = useState([]);
    const [addingVariance, setAddingVariance] = useState(false);
    const [addingHumidityVariance, setAddingHumidityVariance] = useState(false);
    const [confirmationArray, setConfirmationArray] = useState(false);
    const [equipmentListFiltered, setEquipmentListFiltered] = useState(true);
    const [tab, setTab] = useState(new URLSearchParams(window.location.search).get('tab') ?? 'notifications');
    const referenceList = [reference1, reference2, reference3, reference4];
    const refreshed = useRef(false);

    const { setPopupMessage, equipmentList, technicianId } = useAppContext();
    const nonFilteredEquipment = equipmentList;
    const filteredEquipment = equipmentList.filter(e => e.active === true);
    const [equipmentRows, setEquipmentRows] = useState(filteredEquipment);

    let currentSuperDaq = equipmentList.filter(asset => asset.reference_tag === asset.asset_tag)[0];
    if (!currentSuperDaq) {
        currentSuperDaq = {};
    }

    function isValidDate(dateString) { // Check if date is valid
        return !isNaN(new Date(dateString))
    }

    function isReferenceValid(reference) { // Check if all necessary fields have values
        if (typeof reference !== "object") { // Return false if reference is not an Object
            return false;
        }
        const referenceFields = [
            reference.generatorTag,
            reference.referenceTag,
            reference.certificateNumber,
            reference.calibrationDate,
            reference.dueDate
        ]
        for (const field of referenceFields) { // Return false if any fields are missing
            if (!field) {
                return false;
            }
        }
        if (!isValidDate(reference.calibrationDate) || !isValidDate(reference.dueDate)) {
            return false;
        }
        return true;
    }

    function clearForm() {
        const setters = [setReference1, setReference2, setReference3, setReference4, setSuperDaq];

        for (const set of setters) {
            set({})
        }
    }

    function handleActiveSelected() {
        updateEquipment();
        setEquipmentListFiltered(!equipmentListFiltered);
    }

    function handleSubmit(event) {
        let warningMessage = ['Set these references?'];
        if (isReferenceValid(superDaq)) {
            warningMessage.push(
                `The SuperDAQ will be set to ${superDaq.referenceTag}
                 with a certificate number of ${superDaq.certificateNumber},
                  a calibration date of ${parseDataBaseDate(new Date(superDaq.calibrationDate).toISOString())},
                   and a due date of ${parseDataBaseDate(new Date(superDaq.dueDate).toISOString())}`)
        };
        for (const reference of referenceList) {
            if (!isReferenceValid(reference))
                continue;
            warningMessage.push(
                `Generator ${reference.generatorTag} will be set to ${reference.referenceTag}
                    with a certificate number of ${reference.certificateNumber},
                    a calibration date of ${parseDataBaseDate(new Date(reference.calibrationDate).toISOString())},
                    and a due date of ${parseDataBaseDate(new Date(reference.dueDate).toISOString())}`)
        }

        if (warningMessage.length > 1) {
            setConfirmationArray(warningMessage);
        } else {
            setPopupMessage('No references have valid data')
        }
    }

    const updateEquipment = useCallback(() => {
        setEquipmentRows(JSON.stringify(equipmentRows) === JSON.stringify(filteredEquipment) ? nonFilteredEquipment : filteredEquipment);
    }, [filteredEquipment, nonFilteredEquipment, equipmentRows])

    const refreshVariances = useCallback(() => {
        callApi('get-variances')
            .then(response => {
                setSetPoints(response)
            })
            .catch((err) => {
                console.error(err)
                setPopupMessage('Unable to get set points')
            })
        callApi('get-humidity-variances')
            .then(response => {
                setHumidityVariances(response)
            })
            .catch((err) => {
                console.error(err)
                setPopupMessage('Unable to get humidity variances')
            })
    }, [setPopupMessage])

    useEffect(() => {
        if (refreshed.current)
            return
        else
            refreshed.current = true

        updateEquipment();
        refreshVariances()
    }, [setPoints, refreshVariances, updateEquipment])

    async function handleConfirm(event) {
        const promises = [];
        if (isReferenceValid(superDaq)) {
            const currentActiveSuperDaqs = equipmentList.filter(equipment => equipment.reference_tag === equipment.asset_tag);
            for (const activeSuperDaq of currentActiveSuperDaqs) {
                const params = {
                    reference_tag: null,
                    generator_tag: activeSuperDaq.asset_tag,
                    certificate_number: activeSuperDaq.calibration_certificate_number,
                    calibration_date: activeSuperDaq.last_calibration,
                    due_date: activeSuperDaq.next_calibration,
                    technician_id: technicianId
                }
                callApi('set-generator', params)
                    .then(() => { })
                    .catch(() => { });
            }
            const params = {
                reference_tag: superDaq.referenceTag,
                generator_tag: superDaq.referenceTag,
                certificate_number: superDaq.certificateNumber,
                calibration_date: superDaq.calibrationDate,
                due_date: superDaq.dueDate,
                technician_id: technicianId
            }
            promises.push(
                callApi('set-generator', params)
                    .then(() => { })
                    .catch(error => {
                        console.error(error);
                        return setPopupMessage(`Could not set SuperDAQ`);
                    })
            )
        }

        for (const reference of referenceList) {
            if (Object.keys(reference).length === 0)
                continue;
            if (!isReferenceValid(reference))
                continue;
            const params = {
                reference_tag: reference.referenceTag,
                generator_tag: reference.generatorTag,
                certificate_number: reference.certificateNumber,
                calibration_date: reference.calibrationDate,
                due_date: reference.dueDate,
                technician_id: technicianId

            }
            promises.push(
                callApi('set-generator', params)
                    .catch(error => {
                        console.error(error);
                        setPopupMessage(`Could not set reference for generator: ${reference.generatorTag}`);
                    })
            )

            const promise = updateEquipment()

            promises.push(promise);
        }
        clearForm();
        setPopupMessage('Loading...')
        await Promise.all(promises);
        setPopupMessage('Equipment updated')
    }

    return !refreshed.current ? <h1 className={styles.title}>Loading...</h1> : (
        <div className={styles.admin_page}>
            <div className={styles.admin_tabs} role='group' aria-label='Admin sections'>
                {tabs.map(t => <button key={t.key} className={styles.admin_tab} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); window.history.replaceState(null, '', `?tab=${t.key}`) }}>{t.label}</button>)}
            </div>
            {/* hidden instead of unmounting so half-typed forms survive a tab switch */}
            <div hidden={tab !== 'notifications'}>
                <SensorInvoiceGenerator />
            </div>
            <div className={styles.menu} hidden={tab !== 'equipment'}>
                {
                    confirmationArray.length > 0 ?
                        <ConfirmationPopup confirmationArray={confirmationArray} setConfirmationArray={setConfirmationArray} handleConfirm={handleConfirm} /> :
                        <></>
                }
                <h1 className={styles.title}>Equipment configuration</h1>
                <div className={styles.admin_grid}>
                    <div className={styles.equipment_row}>
                        <div className={styles.default_text}>Generator</div>
                        <div className={styles.default_text}>Current Asset Tag</div>
                        <div className={styles.default_text}>Cert. number</div>
                        <div className={styles.default_text}>Calibration Date</div>
                        <div className={styles.default_text}>Due Date</div>
                    </div>
                    <EquipmentConfigRow
                        generatorText="SuperDAQ"
                        generatorHint="Temp"
                        description='Fluke 1586A "SUPER-DAQ"'
                        selectedOption={superDaq}
                        setSelectedOption={setSuperDaq}
                    />
                    <EquipmentConfigRow
                        generatorText="Bath 1"
                        generatorHint="28°C"
                        generatorTag="S000101"
                        description="Fluke 5615 PRT"
                        selectedOption={reference1}
                        setSelectedOption={setReference1}
                    />
                    <EquipmentConfigRow
                        generatorText="Bath 2"
                        generatorHint="-25°C"
                        generatorTag="S000102"
                        description="Fluke 5615 PRT"
                        selectedOption={reference2}
                        setSelectedOption={setReference2}
                    />
                    <EquipmentConfigRow
                        generatorText="Bath 3"
                        generatorHint="90°C"
                        generatorTag="S000103"
                        description="Fluke 5615 PRT"
                        selectedOption={reference3}
                        setSelectedOption={setReference3}
                    />
                    <EquipmentConfigRow
                        generatorText="Chamber"
                        generatorHint="RH"
                        generatorTag="S000138"
                        description="Rotronic HygroClip2 Humidity and Temperature Reference"
                        selectedOption={reference4}
                        setSelectedOption={setReference4}
                    />
                </div>
                <div className={`${styles.row} ${styles.row_end}`}>
                    <button className={styles.default_button} onClick={handleSubmit}>Save</button>
                </div>
            </div>
            <div hidden={tab !== 'notifications'}>
                <CreateNotification />
            </div>
            <div hidden={tab !== 'certificates'}>
                <EditCertificates />
            </div>
            <div hidden={tab !== 'users'}>
                <ManageUsers />
            </div>
            <div className={styles.menu} hidden={tab !== 'stability'}>
                <StabilityTimes />
            </div>
            <div className={styles.menu} hidden={tab !== 'variances'}>
                <div className={styles.toolbar}>
                    <h1 className={styles.title}>Humidity Variances</h1>
                    <button className={styles.plus_button} title='Add humidity variance' onClick={() => setAddingHumidityVariance(!addingHumidityVariance)}></button>
                </div>
                {equipmentList && equipmentList.length > 0 && <CreateHumidityVariance key={humidityVariances.length} addingVariance={addingHumidityVariance} refreshVariances={refreshVariances} /> }
                <table className={styles.equipment_table}>
                    <thead className={styles.equipment_table_head}>
                        <tr>
                            <th className={styles.equipment_table_data}></th>
                            <th className={styles.equipment_table_data}>
                                Asset Tag
                            </th>
                            <th className={styles.equipment_table_data}>
                                Temperature
                            </th>
                            <th className={styles.equipment_table_data}>
                                Humidity
                            </th>
                            <th className={styles.equipment_table_data}>
                                Calibration
                            </th>
                            <th className={styles.equipment_table_data}>
                                Interpolation
                            </th>
                            <th className={styles.equipment_table_data}>
                                Drift
                            </th>
                            <th className={styles.equipment_table_data}>
                                Hysteresis
                            </th>
                            <th className={styles.equipment_table_data}>
                                Gas Temperature Dependance
                            </th>
                        </tr>
                    </thead>
                    <tbody className={styles.equipment_table_body}>
                        {humidityVariances.filter(variance => variance.active === true).map((variance, index) => <HumidityVarianceRow key={index} variance={variance} refreshVariances={refreshVariances} />)}
                    </tbody>
                </table>
            </div>
            <div className={styles.menu} hidden={tab !== 'variances'}>
                <div className={styles.toolbar}>
                    <h1 className={styles.title}>Set Points</h1>
                    <button className={styles.plus_button} title='Add set point' onClick={() => setAddingVariance(!addingVariance)}></button>
                </div>
                {equipmentList && equipmentList.length > 0 && <CreateSetPoint key={setPoints.length} addingVariance={addingVariance} refreshVariances={refreshVariances} />}
                <table className={styles.equipment_table}>
                    <thead className={styles.equipment_table_head}>
                        <tr>
                            <th className={styles.equipment_table_data}></th>
                            <th className={styles.equipment_table_data}>
                                Set Point
                            </th>
                            <th className={styles.equipment_table_data}>
                                Reference Asset Tag
                            </th>
                            <th className={styles.equipment_table_data}>
                                Generator Asset Tag
                            </th>
                            <th className={styles.equipment_table_data}>
                                Reference Uncertainty
                            </th>
                            <th className={styles.equipment_table_data}>
                                Bridge Variance
                            </th>
                            <th className={styles.equipment_table_data}>
                                Generator Stability
                            </th>
                            <th className={styles.equipment_table_data}>
                                Add to CP
                            </th>
                        </tr>
                    </thead>
                    <tbody className={styles.equipment_table_body}>
                        {setPoints.filter(setPoint => setPoint.active === true).map((setPoint, index) => <SetPointRow key={index} setPoint={setPoint} refreshVariances={refreshVariances} />)}
                    </tbody>
                </table>
            </div>
            <div className={styles.menu} hidden={tab !== 'equipment'}>
                <div className={styles.toolbar}>
                    <h1 className={styles.title}>Lab Equipment</h1>
                    <label className={styles.check_box_container}>
                        <input className={styles.grid_check_box} type="checkbox" onChange={handleActiveSelected} checked={equipmentListFiltered} />
                        <span className={styles.expedite_text}>Show Inactive</span>
                    </label>
                </div>
                <table className={styles.equipment_table}>
                    <thead className={styles.equipment_table_head}>
                        <tr>
                            <th className={styles.equipment_table_data}>
                                Asset Tag
                            </th>
                            <th className={styles.equipment_table_data}>
                                Description
                            </th>
                            <th className={styles.equipment_table_data}>
                                Serial Number
                            </th>
                            <th className={styles.equipment_table_data}>
                                Certificate Number
                            </th>
                            <th className={styles.equipment_table_data}>
                                Calibration Date
                            </th>
                            <th className={styles.equipment_table_data}>
                                Calibration Due Date
                            </th>
                        </tr>
                    </thead>
                    <tbody className={styles.equipment_table_body}>
                        {equipmentRows && equipmentRows.map(equipment => <EquipmentRow key={equipment.asset_tag} equipment={equipment} />)}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default Admin;