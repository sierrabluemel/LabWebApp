import styles from '../../styles/styles.module.css'
import { useState, useEffect, useRef } from 'react'
import callApi from '../../utils/api/callApi';
import { useAppContext } from '../../contexts/app';

function Admin() {
    const [equipmentLoaded, setEquipmentLoaded] = useState(false);
    const [reference1, setReference1] = useState({});
    const [reference2, setReference2] = useState({});
    const [reference3, setReference3] = useState({});
    const [reference4, setReference4] = useState({});
    const [superDaq, setSuperDaq] = useState('');
    const equipment = useRef([]);

    const { setPopupMessage } = useAppContext();

    let currentSuperDaq = equipment.current.filter(asset => asset.reference_tag === 'active')[0];
    if (!currentSuperDaq) {
        currentSuperDaq = {};
    }

    function handleSubmit(event) {
        event.preventDefault();
        const referenceList = [reference1, reference2, reference3, reference4];
        if (superDaq) {
            const currentActiveSuperDaqs = equipment.current.filter(equipment => equipment.reference_tag === 'active');
            for (const activeSuperDaq of currentActiveSuperDaqs) {
                callApi('set-generator', { reference_tag: null, generator_tag: activeSuperDaq.asset_tag })
            }
            callApi('set-generator', { reference_tag: 'active', generator_tag: superDaq })
                .catch(error => {
                    console.error(error);
                    setPopupMessage(`Could not set SuperDAQ`);
                })
        }
        for (let i = 0; i < referenceList.length; i++) {
            if (referenceList[i].referenceTag !== undefined) {
                callApi('set-generator', { reference_tag: referenceList[i].referenceTag, generator_tag: referenceList[i].generatorTag })
                    .catch(error => {
                        console.error(error);
                        setPopupMessage(`Could not set generator for reference: ${referenceList[i]}`);
                    })
            }
        }
        setPopupMessage('References updated!')
    }

    useEffect(() => {
        callApi('get-equipment')
            .then(response => {
                equipment.current = response;
                setEquipmentLoaded(true);
            })
    })

    function EquipmentRow(props) {
        let currentReference = equipment.current.filter(asset => asset.asset_tag === props.generatorTag)[0];
        if (!currentReference) {
            currentReference = {}
        }

        function handleChange(event) {
            props.setSelectedOption({ referenceTag: event.target.value, generatorTag: props.generatorTag });
        }

        return (
            <div className={styles.equipment_row}>
                <div className={styles.text_container}>
                    <div className={styles.text}>{props.generatorText} <span className={styles.temperature_hint}>({props.generatorTemperature})</span></div>
                </div>
                <select data-testid={props.generatorText} className={styles.equipment_dropdown} value={props.selectedOption.referenceTag} onChange={handleChange}>
                    {
                        !equipmentLoaded ? <option key={-1}>Loading...</option> :
                            <option key={-1}>{currentReference.reference_tag}</option>
                    }
                    {
                        equipment.current.filter(asset => asset.asset_tag !== currentReference.reference_tag).map((asset, index) => {
                            if (asset.description === props.description) {
                                return <option key={index}>{asset.asset_tag}</option>
                            } else {
                                return null;
                            }
                        })
                    }
                </select>
            </div>)
    }


    return (
        <>
            <div className={styles.menu}>
                <h1 className={styles.title}>Equipment configuration</h1>
                <div className={styles.admin_grid}>
                    <EquipmentRow generatorText="Bath 1" generatorTemperature="28°C" generatorTag="S000101" description="Fluke 5615 PRT" selectedOption={reference1} setSelectedOption={setReference1} />
                    <EquipmentRow generatorText="Bath 2" generatorTemperature="-25°C" generatorTag="S000102" description="Fluke 5615 PRT" selectedOption={reference2} setSelectedOption={setReference2} />
                    <EquipmentRow generatorText="Bath 3" generatorTemperature="90°C" generatorTag="S000103" description="Fluke 5615 PRT" selectedOption={reference3} setSelectedOption={setReference3} />
                    <div className={styles.equipment_row}>
                        <div className={styles.text_container}>
                            <div className={styles.text}>SuperDAQ  <span className={styles.temperature_hint}>(Temperature)</span></div>
                        </div>
                        <select data-testid={'superDaqDropdown'} className={styles.equipment_dropdown} value={superDaq} onChange={e => setSuperDaq(e.target.value)}>
                            {
                                !equipmentLoaded ? <option key={-1}>Loading...</option> :
                                    <option key={-1}>{currentSuperDaq.asset_tag}</option>
                            }
                            {
                                equipment.current.filter(asset => asset.asset_tag !== currentSuperDaq.asset_tag).map((asset, index) => {
                                    if (asset.description === 'Fluke 1586A "SUPER-DAQ"') {
                                        return <option key={index}>{asset.asset_tag}</option>
                                    } else {
                                        return null;
                                    }
                                })
                            }
                        </select>
                    </div>
                    
                    <EquipmentRow generatorText="Chamber" generatorTemperature="Humidity" generatorTag="S000105" description="Rotronic HygroClip2 Humidity Reference" selectedOption={reference4} setSelectedOption={setReference4} />
                </div>
                <button className={styles.equipment_save_button} onClick={handleSubmit}>Save</button>
            </div>
        </>
    )
}

export default Admin