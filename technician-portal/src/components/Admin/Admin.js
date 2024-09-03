import styles from '../../styles/styles.module.css'
import { useState, useEffect } from 'react'
import callApi from '../../utils/api/callApi';
import { useAppContext } from '../../contexts/app';
import ConfirmationPopup from '../ConfirmationPopup/ConfirmationPopup';
import parseDataBaseDate from '../../utils/parseDataBaseDate';
import EquipmentRow from './EquipmentRow/EquipmentRow';

function Admin() {
    const [reference1, setReference1] = useState({});
    const [reference2, setReference2] = useState({});
    const [reference3, setReference3] = useState({});
    const [reference4, setReference4] = useState({});
    const [superDaq, setSuperDaq] = useState({});
    const [confirmationArray, setConfirmationArray] = useState(false);
    const referenceList = [reference1, reference2, reference3, reference4];

    const { setPopupMessage, equipment } = useAppContext();

    let currentSuperDaq = equipment.current.filter(asset => asset.reference_tag === asset.asset_tag)[0];
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

    function handleSubmit(event) {
        let warningMessage = ['This will set the following references:'];
        if (isReferenceValid(superDaq)) {
            warningMessage.push(
                `The SuperDAQ will be set to ${superDaq.referenceTag}
                 with a certificate number of ${superDaq.certificateNumber},
                  a calibration date of ${parseDataBaseDate(new Date(superDaq.calibrationDate).toISOString())},
                   and a due date of ${parseDataBaseDate(new Date(superDaq.dueDate).toISOString())}`)
        };
        for (const reference of referenceList) {
            if (isReferenceValid(reference)) {
                warningMessage.push(
                    `Generator ${reference.generatorTag} will be set to ${reference.referenceTag}
                     with a certificate number of ${reference.certificateNumber},
                      a calibration date of ${parseDataBaseDate(new Date(reference.calibrationDate).toISOString())},
                       and a due date of ${parseDataBaseDate(new Date(reference.dueDate).toISOString())}`)
            }
        }

        if (warningMessage.length > 1) {
            setConfirmationArray(warningMessage);
        } else {
            setPopupMessage('No references have valid data')
        }
    }

    async function handleConfirm(event) {
        const promises = [];
        if (isReferenceValid(superDaq)) {
            const currentActiveSuperDaqs = equipment.current.filter(equipment => equipment.reference_tag === equipment.asset_tag);
            for (const activeSuperDaq of currentActiveSuperDaqs) {
                const params = {
                    reference_tag: null,
                    generator_tag: activeSuperDaq.asset_tag,
                    certificate_number: activeSuperDaq.calibration_certificate_number,
                    calibration_date: activeSuperDaq.last_calibration,
                    due_date: activeSuperDaq.next_calibration
                }
                callApi('set-generator', params)
            }
            const params = {
                reference_tag: superDaq.referenceTag,
                generator_tag: superDaq.referenceTag,
                certificate_number: superDaq.certificateNumber,
                calibration_date: superDaq.calibrationDate,
                due_date: superDaq.dueDate
            }
            promises.push(
                callApi('set-generator', params)
                    .catch(error => {
                        console.error(error);
                        return setPopupMessage(`Could not set SuperDAQ`);
                    })
            )
        }

        for (const reference of referenceList) {
            if (Object.keys(reference).length === 0) { // Check if reference is empty Object
                continue;
            }
            if (isReferenceValid(reference)) {
                const params = {
                    reference_tag: reference.referenceTag,
                    generator_tag: reference.generatorTag,
                    certificate_number: reference.certificateNumber,
                    calibration_date: reference.calibrationDate,
                    due_date: reference.dueDate

                }
                promises.push(
                    callApi('set-generator', params)
                        .catch(error => {
                            console.error(error);
                            setPopupMessage(`Could not set reference for generator: ${reference.generatorTag}`);
                        })
                )
            }
        }
        clearForm();
        setPopupMessage('Loading...')
        await Promise.all(promises);
        setPopupMessage('Equipment updated')
    }

    useEffect(() => {
        callApi('get-equipment')
            .then(response => {
                equipment.current = response;
            })
    })

    return (
        <>
            <div className={styles.menu}>
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
                    <EquipmentRow
                        generatorText="SuperDAQ"
                        generatorHint="Temp"
                        description='Fluke 1586A "SUPER-DAQ"'
                        selectedOption={superDaq}
                        setSelectedOption={setSuperDaq}
                    />
                    <EquipmentRow
                        generatorText="Bath 1"
                        generatorHint="28°C"
                        generatorTag="S000101"
                        description="Fluke 5615 PRT"
                        selectedOption={reference1}
                        setSelectedOption={setReference1}
                    />
                    <EquipmentRow
                        generatorText="Bath 2"
                        generatorHint="-25°C"
                        generatorTag="S000102"
                        description="Fluke 5615 PRT"
                        selectedOption={reference2}
                        setSelectedOption={setReference2}
                    />
                    <EquipmentRow
                        generatorText="Bath 3"
                        generatorHint="90°C"
                        generatorTag="S000103"
                        description="Fluke 5615 PRT"
                        selectedOption={reference3}
                        setSelectedOption={setReference3}
                    />
                    <EquipmentRow
                        generatorText="Chamber"
                        generatorHint="RH"
                        generatorTag="S000105"
                        description="Rotronic HygroClip2 Humidity Reference"
                        selectedOption={reference4}
                        setSelectedOption={setReference4}
                    />
                </div>
                <button className={styles.equipment_save_button} onClick={handleSubmit}>Save</button>
            </div>
        </>
    )
}

export default Admin;