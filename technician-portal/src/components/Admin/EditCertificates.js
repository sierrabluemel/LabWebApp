import { useState } from 'react';
import styles from '../../styles/styles.module.css';
import callApi from '../../utils/api/callApi';
import Button from '../Button/Button';
import { useAppContext } from '../../contexts/app';

export default function EditCertificates() {
    const [orderId, setOrderId] = useState('');
    const [certificates, setCertificates] = useState([]);
    const [batchId, setBatchId] = useState('');
    const [edits, setEdits] = useState({});

    const { setPopupMessage } = useAppContext();

    const selected = certificates.filter(c => !batchId || c.batch_id === parseInt(batchId));
    const batchIds = [...new Set(certificates.map(c => c.batch_id))];
    // Only fields every selected certificate has can be edited; the backend rejects the rest
    const fields = selected.length === 0 ? [] : Object.keys(selected[0].generate_certificate_json)
        .filter(key => selected.every(c => key in c.generate_certificate_json))
        .map(key => {
            const values = new Set(selected.map(c => c.generate_certificate_json[key]));
            return { key, value: values.size === 1 ? [...values][0] : null };
        });
    // One row per certificate table line: CD11..CD18 -> "CD1", C1..C3 -> "C"; keys without a trailing digit stand alone
    const rows = [];
    for (const field of fields) {
        const name = field.key.match(/^([A-Za-z]+\d?)\d$/)?.[1] ?? field.key;
        const row = rows.find(r => r.name === name);
        row ? row.fields.push(field) : rows.push({ name, fields: [field] });
    }

    const loadCertificates = () => {
        return callApi('get-certificates-by-order-id', { order_id: orderId })
            .then(response => {
                if (response.length === 0)
                    setPopupMessage(`No certificates found for order ${orderId}`);
                setCertificates(response);
                setBatchId('');
                setEdits({});
            })
            .catch(err => {
                console.error(err);
                setPopupMessage(`Unable to load certificates for order ${orderId}`);
            });
    }

    const saveCertificates = (changes) => {
        const params = { order_id: orderId, certificate_json: JSON.stringify(changes) };
        if (batchId)
            params.batch_id = batchId;
        return callApi('update-certificates-json', params)
            .then(updated => {
                setPopupMessage(`Updated ${updated.length} certificate${updated.length === 1 ? '' : 's'}`);
                return loadCertificates();
            })
            .catch(err => {
                console.error(err);
                setPopupMessage(err.response?.data?.error ?? 'Unable to update certificates');
            });
    }

    const handleSave = () => {
        if (Object.keys(edits).length === 0) {
            setPopupMessage('No changes to save');
            return;
        }
        return saveCertificates(edits);
    }

    return (
        <div className={styles.menu}>
            <h1 className={styles.title}>Edit Certificates</h1>
            <form className={`${styles.toolbar} ${styles.center_toolbar}`}onSubmit={event => { event.preventDefault(); loadCertificates(); }}>
                <input className={styles.default_text_box} value={orderId} onChange={event => setOrderId(event.target.value)} placeholder={'Order number'} aria-label='Order number' />
                <Button onClick={loadCertificates} innerText={'Load'} />
                {certificates.length > 0 &&
                    <>
                        <select className={styles.default_text_box} value={batchId} onChange={event => { setBatchId(event.target.value); setEdits({}); }} aria-label='Batch'>
                            <option value=''>All batches</option>
                            {batchIds.map(id => <option key={id} value={id}>Batch {id} (CP {certificates.find(c => c.batch_id === id).calibration_procedure_id})</option>)}
                        </select>
                        <span>{selected.length} certificate{selected.length === 1 ? '' : 's'}</span>
                    </>
                }
            </form>
            {fields.length > 0 &&
                <>
                    <div className={styles.field_rows}>
                        {rows.map(row => (
                            <div key={row.name} className={styles.field_row}>
                                <span className={styles.field_row_label}>{row.name}</span>
                                <div className={styles.field_row_fields}>
                                    {row.fields.map(field => (
                                        <input
                                            key={field.key}
                                            className={field.key in edits ? `${styles.default_text_box} ${styles.cert_field_edited}` : styles.default_text_box}
                                            aria-label={field.key}
                                            title={field.key}
                                            value={edits[field.key] ?? field.value ?? ''}
                                            placeholder={field.value === null ? '(varies)' : ''}
                                            onChange={event => {
                                                const { [field.key]: _, ...rest } = edits;
                                                // Typing back to the original (or clearing a varying field) drops the change
                                                setEdits(event.target.value === (field.value ?? '') ? rest : { ...rest, [field.key]: event.target.value });
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handleSave} innerText={'Save changes'} />
                    <Button onClick={() => saveCertificates({})} innerText={'Republish PDFs'} />
                </>
            }
        </div>
    )
}
