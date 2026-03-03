import { useState } from 'react';
import styles from '../../styles/styles.module.css';
import { useAppContext } from '../../contexts/app';
import Button from '../Button/Button';
import callApi from '../../utils/api/callApi';

export default function CreateSetPoint({ addingVariance, refreshVariances }) {
    const { setPopupMessage, equipmentList } = useAppContext();
    const generatorTypes = ['bath', 'drywell', 'dewar', 'chamber']
    const referenceTypes = ['prt', 'rotronic']
    const references = equipmentList.filter(equipment => referenceTypes.includes(equipment.type))
    const generators = equipmentList.filter(equipment => generatorTypes.includes(equipment.type))

    const [setPoint, setSetPoint] = useState('');
    const [setPointType, setSetPointType] = useState('temperature');
    const [referenceAssetTag, setReferenceAssetTag] = useState(references[0].asset_tag);
    const [generatorAssetTag, setGeneratorAssetTag] = useState(generators[0].asset_tag);
    const [referenceVariance, setReferenceVariance] = useState('');
    const [bridgeVariance, setBridgeVariance] = useState('');
    const [driftVariance, setDriftVariance] = useState('');
    const [stabilityVariance, setStabilityVariance] = useState('');
    const [uniformityVariance, setUniformityVariance] = useState('');
    const [dutResolutionVariance, setDutResolutionVariance] = useState('');

    const equipmentShown = !addingVariance ? `${styles.add_set_point_container} ${styles.collapsed}` : styles.add_set_point_container;

    function handleSubmit() {
        const parameters = {
            set_point: setPoint,
            reading_type: setPointType,
            reference_variance: referenceVariance,
            drift_variance: driftVariance,
            bridge_variance: bridgeVariance,
            uniformity_variance: uniformityVariance,
            stability_variance: stabilityVariance,
            dut_resolution_variance: dutResolutionVariance,
            reference_asset_tag: referenceAssetTag,
            reference_type: references.filter(reference => reference.asset_tag === referenceAssetTag)[0].type,
            generator_asset_tag: generatorAssetTag,
            generator_type: generators.filter(generator => generator.asset_tag === generatorAssetTag)[0].type,
        }

        for (const parameter in parameters) {
            if (parameters[parameter] === '') {
                setPopupMessage('Please fill all fields before saving')
                throw Error('All fields must be filled')
            }
        }

        callApi('create-set-point', parameters)
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
                <input type='text' value={setPoint} onChange={event => setSetPoint(event.target.value)} className={styles.default_text_box} placeholder={'Set point'} />
                <select className={styles.dropdown} value={referenceAssetTag} onChange={event => setReferenceAssetTag(event.target.value)}>
                    {references.map((reference, index) => <option key={index} value={reference.asset_tag}>{reference.asset_tag} ({reference.short_description})</option>)}
                </select>
                <select className={styles.dropdown} value={generatorAssetTag} onChange={event => setGeneratorAssetTag(event.target.value)}>
                    {generators.map((generator, index) => <option key={index} value={generator.asset_tag}>{generator.asset_tag} ({generator.short_description})</option>)}
                </select>
                <div className={styles.set_point_selector}>
                    <label className={styles.admin_check_box_container}>
                        <input className={styles.admin_check_box} type="checkbox" onChange={() => setSetPointType('temperature')} checked={setPointType === 'temperature'} />
                        <span className={styles.expedite_text}>Temperature</span>
                    </label>
                    <label className={styles.admin_check_box_container}>
                        <input className={styles.admin_check_box} type="checkbox" onChange={() => setSetPointType('humidity')} checked={setPointType === 'humidity'} />
                        <span className={styles.expedite_text}>Humidity</span>
                    </label>
                </div>
                <input type='text' value={referenceVariance} onChange={event => setReferenceVariance(event.target.value)} className={styles.default_text_box} placeholder={'Reference Variance'} />
                <input type='text' value={driftVariance} onChange={event => setDriftVariance(event.target.value)} className={styles.default_text_box} placeholder={'Drift Variance'} />
                <input type='text' value={bridgeVariance} onChange={event => setBridgeVariance(event.target.value)} className={styles.default_text_box} placeholder={'Bridge Variance'} />
                <input type='text' value={stabilityVariance} onChange={event => setStabilityVariance(event.target.value)} className={styles.default_text_box} placeholder={'Stability Variance'} />
                <input type='text' value={uniformityVariance} onChange={event => setUniformityVariance(event.target.value)} className={styles.default_text_box} placeholder={'Uniformity Variance'} />
                <input type='text' value={dutResolutionVariance} onChange={event => setDutResolutionVariance(event.target.value)} className={styles.default_text_box} placeholder={'DUT Resolution Variance'} />
                <Button onClick={handleSubmit} innerText='Create set point' />
            </form>
        </>
    )
}