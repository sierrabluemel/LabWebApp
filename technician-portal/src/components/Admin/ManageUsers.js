import { useCallback, useEffect, useState } from 'react';
import Select from 'react-select';
import styles from '../../styles/styles.module.css';
import callApi from '../../utils/api/callApi';
import apiPost from '../../utils/api/apiPost';
import Button from '../Button/Button';
import { useAppContext } from '../../contexts/app';

const emptyForm = { firstName: '', lastName: '', email: '', password: '', admin: false };

export default function ManageUsers() {
    const [form, setForm] = useState(emptyForm);
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const { setPopupMessage } = useAppContext();

    // .field_rows clips overflow, so draw the menu on body instead of inside the card
    const selectProps = { menuPortalTarget: document.body, styles: { menuPortal: base => ({ ...base, zIndex: 9999 }) } };

    const loadTechnicians = useCallback(() => {
        callApi('get-technicians')
            .then(res => setTechnicians(res.map(t => ({ value: t.user_id, label: `${t.first_name} ${t.last_name}` }))))
            .catch(() => setPopupMessage('Unable to load technicians'))
    }, [setPopupMessage]);

    useEffect(() => { loadTechnicians() }, [loadTechnicians]);

    const setField = (key) => (event) => setForm({ ...form, [key]: event.target.value });
    const showError = (fallback) => (err) => setPopupMessage(err.response?.data?.error || fallback);

    function createTechnician() {
        return apiPost('create-technician', form)
            .then(() => {
                setForm(emptyForm);
                setPopupMessage('Technician created');
                loadTechnicians();
            })
            .catch(showError('Unable to create technician'))
    }

    function setPassword() {
        if (!selectedTechnician) {
            setPopupMessage('Select a technician first');
            return;
        }
        return apiPost('set-password', { user_id: selectedTechnician.value, password: newPassword })
            .then(() => {
                setNewPassword('');
                setPopupMessage('Password updated');
            })
            .catch(showError('Unable to set password'))
    }

    return (
        <>
            <div className={styles.menu}>
                <h1 className={styles.title}>Create Technician</h1>
                <form onSubmit={e => e.preventDefault()}>
                    <div className={styles.field_rows}>
                        <div className={styles.field_row}>
                            <label className={styles.field_row_label} htmlFor='newFirstName'>Name</label>
                            <div className={styles.field_row_fields}>
                                <input id='newFirstName' className={styles.default_text_box} value={form.firstName} onChange={setField('firstName')} placeholder='First name' />
                                <input className={styles.default_text_box} value={form.lastName} onChange={setField('lastName')} placeholder='Last name' aria-label='Last name' />
                            </div>
                        </div>
                        <div className={styles.field_row}>
                            <label className={styles.field_row_label} htmlFor='newEmail'>Email</label>
                            <div className={styles.field_row_fields}>
                                <input id='newEmail' type='email' className={styles.default_text_box} value={form.email} onChange={setField('email')} placeholder='Email' />
                            </div>
                        </div>
                        <div className={styles.field_row}>
                            <label className={styles.field_row_label} htmlFor='newPassword'>Password</label>
                            <div className={styles.field_row_fields}>
                                <input id='newPassword' type='password' className={styles.default_text_box} value={form.password} onChange={setField('password')} placeholder='Password' />
                                <label className={styles.check_box_container}>
                                    <input className={styles.grid_check_box} type='checkbox' checked={form.admin} onChange={() => setForm({ ...form, admin: !form.admin })} />
                                    <span className={styles.expedite_text}>Admin</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <Button onClick={createTechnician} innerText='Create Technician' />
                </form>
            </div>
            <div className={styles.menu}>
                <h1 className={styles.title}>Set Password</h1>
                <form onSubmit={e => e.preventDefault()}>
                    <div className={styles.field_rows}>
                        <div className={styles.field_row}>
                            <span className={styles.field_row_label}>Technician</span>
                            <div className={styles.field_row_fields}>
                                <Select {...selectProps} className={styles.field_select} aria-label='Technician' options={technicians} value={selectedTechnician} onChange={setSelectedTechnician} />
                            </div>
                        </div>
                        <div className={styles.field_row}>
                            <label className={styles.field_row_label} htmlFor='resetPassword'>New password</label>
                            <div className={styles.field_row_fields}>
                                <input id='resetPassword' type='password' className={styles.default_text_box} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder='New password' />
                            </div>
                        </div>
                    </div>
                    <Button onClick={setPassword} innerText='Set Password' />
                </form>
            </div>
        </>
    )
}
