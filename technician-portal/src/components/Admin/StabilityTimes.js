import { useEffect, useState } from 'react';
import styles from '../../styles/styles.module.css';
import callApi from '../../utils/api/callApi';
import { useAppContext } from '../../contexts/app';

const DEFAULT_MINUTES = 1.5;

function setPointLabel(setPoint) {
    let label = `${setPoint.temperature}°C`;
    if (setPoint.humidity !== undefined)
        label += ` / ${setPoint.humidity}%RH`;
    return setPoint.calibrate ? `As found (${label})` : label;
}

// Required stable minutes per set point, stored in each procedure's set_points JSON
export default function StabilityTimes() {
    const { setPopupMessage } = useAppContext();
    const [procedures, setProcedures] = useState([]);
    const [edits, setEdits] = useState({});

    const load = () => callApi('get-calibration-procedures')
        .then(response => { setProcedures(response); setEdits({}); })
        .catch(() => setPopupMessage('Unable to load calibration procedures'));

    useEffect(() => { load() }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const save = (procedureId, index) => {
        const key = `${procedureId}-${index}`;
        const minutes = parseFloat(edits[key]);
        if (edits[key] === undefined)
            return;
        if (!(minutes > 0))
            return setPopupMessage('Minutes must be a number greater than 0');

        callApi('update-set-point-minutes', { calibration_procedure_id: procedureId, set_point_index: index, minutes })
            .then(load)
            .catch(() => setPopupMessage('Unable to update stability time. Please try again later'));
    }

    return (
        <>
            <div className={styles.toolbar}>
                <h1 className={styles.title}>Stability Times</h1>
            </div>
            <table className={styles.equipment_table}>
                <thead className={styles.equipment_table_head}>
                    <tr>
                        <th className={styles.equipment_table_data}>CP</th>
                        <th className={styles.equipment_table_data}>Set Point</th>
                        <th className={styles.equipment_table_data}>Required Stable Minutes</th>
                    </tr>
                </thead>
                <tbody className={styles.equipment_table_body}>
                    {procedures.flatMap(procedure => (procedure.set_points ?? []).map((setPoint, index) => {
                        const key = `${procedure.calibration_procedure_id}-${index}`;
                        const stored = setPoint.stabilityCriteria?.minutes ?? DEFAULT_MINUTES;
                        const label = setPointLabel(setPoint);
                        return (
                            <tr key={key}>
                                <td className={styles.equipment_table_data}>{procedure.calibration_procedure_id}</td>
                                <td className={styles.equipment_table_data}>{label}</td>
                                <td className={styles.equipment_table_data}>
                                    <form onSubmit={event => { event.preventDefault(); save(procedure.calibration_procedure_id, index) }}>
                                        <input type='number' step='0.25' min='0' className={styles.default_text_box}
                                            aria-label={`CP${procedure.calibration_procedure_id} ${label} minutes`}
                                            value={edits[key] ?? stored}
                                            onChange={event => setEdits({ ...edits, [key]: event.target.value })}
                                            onBlur={() => save(procedure.calibration_procedure_id, index)} />
                                    </form>
                                </td>
                            </tr>
                        )
                    }))}
                </tbody>
            </table>
        </>
    )
}
