import { useEffect, useState } from 'react';
import styles from '../../../styles/styles.module.css'
import { useAppContext } from '../../../contexts/app';

function EquipmentRow({ generatorText, generatorHint, generatorTag, description, selectedOption, setSelectedOption }) {
    const [referenceTag, setReferenceTag] = useState('');
    const [certificateNumber, setCertificateNumber] = useState('');
    const [calibrationDate, setCalibrationDate] = useState('');
    const [dueDate, setDueDate] = useState('');

    const { equipmentList } = useAppContext();

    let currentGenerator;
    let dropdownOptions;
    if (generatorTag) {
        currentGenerator = equipmentList.current.filter(asset => asset.asset_tag === generatorTag)[0];
        dropdownOptions = equipmentList.current.filter(asset => asset.asset_tag !== currentGenerator.reference_tag);
    } else {
        currentGenerator = equipmentList.current.filter(asset => asset.reference_tag === asset.asset_tag)[0];
        dropdownOptions = equipmentList.current.filter(asset => asset.asset_tag !== asset.reference_tag);
    }

    if (!currentGenerator) {
        currentGenerator = {}
    }

    function handleDropDownChange(event) {
        event.preventDefault();
        let generatorTag = currentGenerator.asset_tag ? currentGenerator.asset_tag : event.target.value;
        let currentOptions = {...selectedOption};
        currentOptions.referenceTag = event.target.value;
        currentOptions.generatorTag = generatorTag;
        setSelectedOption(currentOptions);
        setReferenceTag(event.target.value);
    }

    function handleCertificateNumberChange(event) {
        event.preventDefault();
        let currentOptions = {...selectedOption};
        currentOptions.certificateNumber = event.target.value;
        setSelectedOption(currentOptions);
        setCertificateNumber(event.target.value);
    }

    function handleCalibrationDateChange(event) {
        event.preventDefault();
        let currentOptions = {...selectedOption};
        currentOptions.calibrationDate = event.target.value;
        setSelectedOption(currentOptions);
        setCalibrationDate(event.target.value);
    }

    function handleDueDateChange(event) {
        event.preventDefault();
        let currentOptions = {...selectedOption};
        currentOptions.dueDate = event.target.value;
        setSelectedOption(currentOptions);
        setDueDate(event.target.value);
    }

    useEffect(() => {
        !selectedOption ? setSelectedOption({}) :
        setReferenceTag(selectedOption.referenceTag || '');
        setCertificateNumber(selectedOption.certificateNumber || '');
        setCalibrationDate(selectedOption.calibrationDate || '');
        setDueDate(selectedOption.dueDate || '');
    }, [selectedOption, setSelectedOption]);

    return (
        <div className={styles.equipment_row}>
            <div className={styles.text_container}>
                <div className={styles.text}>{generatorText} <span className={styles.temperature_hint}>({generatorHint})</span></div>
            </div>
            <select data-testid={generatorText} className={styles.equipment_dropdown} value={referenceTag} onChange={handleDropDownChange}>
                {
                    !equipmentList.current.length > 0 ? <option key={-1}>Loading...</option> : // awaiting response
                        currentGenerator.reference_tag === currentGenerator.asset_tag ? // is the current equipment the SuperDAQ?
                            <option key={-1}>{currentGenerator.asset_tag}</option> :
                            <option key={-1}>{currentGenerator.reference_tag}</option>
                }
                {
                    dropdownOptions.map((asset, index) => {
                        if (asset.description === description) {
                            return <option key={index}>{asset.asset_tag}</option>
                        } else {
                            return null;
                        }
                    })
                }
            </select>
            <input data-testid={`${generatorText}certificateNumber`} className={styles.equipment_input} value={certificateNumber} onChange={handleCertificateNumberChange} placeholder={'Certificate number'} />
            <input data-testid={`${generatorText}calibrationDate`} className={styles.equipment_input} value={calibrationDate} onChange={handleCalibrationDateChange} placeholder={'MM/DD/YYYY'} />
            <input data-testid={`${generatorText}dueDate`} className={styles.equipment_input} value={dueDate} onChange={handleDueDateChange} placeholder={'MM/DD/YYYY'} />
        </div>
    )
}

export default EquipmentRow;