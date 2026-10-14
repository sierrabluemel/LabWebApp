import { useState } from 'react';
import styles from '../../styles/styles.module.css';
import { useAppContext } from '../../contexts/app';
import Button from '../Button/Button';
import callApi from '../../utils/api/callApi';

export default function CreateHumidityVariance({ addingVariance, refreshVariances }) {
    const { setPopupMessage, equipmentList } = useAppContext();
    const references = equipmentList.filter(equipment => equipment.type === 'rotronic')

    const [referenceAssetTag, setReferenceAssetTag] = useState(references[0].asset_tag);
    const [temperature, setTemperature] = useState('');
    const [humidity, setHumidity] = useState('');
    const [calibrationUncertainty, setCalibrationUncertainty] = useState('');
    const [readingResolutionUncertainty, setReadingResolutionUncertainty] = useState('');
    const [interpolationUncertainty, setInterpolationUncertainty] = useState('');
    const [driftUncertainty, setDriftUncertainty] = useState('');
    const [hysteresisUncertainty, setHysteresisUncertainty] = useState('');
    const [gasTemperatureDependanceUncertainty, setGasTemperatureDependanceUncertainty] = useState('');
    const [heatDissipationUncertainty, setHeatDissipationUncertainty] = useState('');
    const [selfHeatingUncertainty, setSelfHeatingUncertainty] = useState('');

    const equipmentShown = !addingVariance ? `${styles.add_set_point_container} ${styles.collapsed}` : styles.add_set_point_container;

    function handleSubmit() {
        const parameters = {
            asset_tag: referenceAssetTag,
            temperature: temperature,
            humidity: humidity,
            calibration_uncertainty: calibrationUncertainty,
            reading_resolution_uncertainty: readingResolutionUncertainty,
            interpolation_uncertainty: interpolationUncertainty,
            drift_uncertainty: driftUncertainty,
            hysteresis_uncertainty: hysteresisUncertainty,
            gas_temperature_dependance_uncertainty: gasTemperatureDependanceUncertainty,
            heat_dissipation_uncertainty: heatDissipationUncertainty,
            self_heating_uncertainty: selfHeatingUncertainty,
        }

        for (const parameter in parameters) {
            if (parameters[parameter] === '') {
                setPopupMessage('Please fill all fields before saving')
                throw Error('All fields must be filled')
            }
        }

        callApi('create-humidity-variance', parameters)
            .then(() => {
                setPopupMessage('Variance created!');
                refreshVariances();
            })
            .catch((err) => {
                setPopupMessage('Unable to create new variance, please try again later')
                console.error(err)
            })
    }

    return (
        <>
            <form className={equipmentShown} onSubmit={handleSubmit}>
                <select className={styles.dropdown} value={referenceAssetTag} onChange={event => setReferenceAssetTag(event.target.value)}>
                    {references.map((reference, index) => <option key={index} value={reference.asset_tag}>{reference.asset_tag} ({reference.short_description})</option>)}
                </select>
                <input type='text' value={temperature} onChange={event => setTemperature(event.target.value)} className={styles.default_text_box} placeholder={'Temperature'} />
                <input type='text' value={humidity} onChange={event => setHumidity(event.target.value)} className={styles.default_text_box} placeholder={'Humidity'} />
                <input type='text' value={calibrationUncertainty} onChange={event => setCalibrationUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Calibration Uncertainty'} />
                <input type='text' value={readingResolutionUncertainty} onChange={event => setReadingResolutionUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Reading Resolution Uncertainty'} />
                <input type='text' value={interpolationUncertainty} onChange={event => setInterpolationUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Interpolation Uncertainty'} />
                <input type='text' value={driftUncertainty} onChange={event => setDriftUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Drift Uncertainty'} />
                <input type='text' value={hysteresisUncertainty} onChange={event => setHysteresisUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Hysteresis Uncertainty'} />
                <input type='text' value={gasTemperatureDependanceUncertainty} onChange={event => setGasTemperatureDependanceUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Gas Temperature Dependance Uncertainty'} />
                <input type='text' value={heatDissipationUncertainty} onChange={event => setHeatDissipationUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Heat Dissipation Uncertainty'} />
                <input type='text' value={selfHeatingUncertainty} onChange={event => setSelfHeatingUncertainty(event.target.value)} className={styles.default_text_box} placeholder={'Self Heating Uncertainty'} />
                <Button onClick={handleSubmit} innerText='Create variance' />
            </form>
        </>
    )
}