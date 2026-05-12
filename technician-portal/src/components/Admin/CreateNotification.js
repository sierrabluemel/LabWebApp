import { useEffect, useRef, useState } from 'react';
import styles from '../../styles/styles.module.css';
import DatePicker from "react-datepicker";
import Select from 'react-select';
import callApi from '../../utils/api/callApi';
import Button from '../Button/Button';
import { useAppContext } from '../../contexts/app';

export default function CreateNotification() {
    const [notificationTitle, setNotificationTitle] = useState('');
    const [notificationDescription, setNotificationDescription] = useState('');
    const [notifyDate, setNotifyDate] = useState(new Date());
    const [options, setOptions] = useState([]);
    const [selectedTechnicians, setSelectedTechnicians] = useState([]);
    const [repeatable, setRepeatable] = useState(false);
    const [repeatInterval, setRepeatInterval] = useState('');
    const [repeatUnit, setRepeatUnit] = useState('');
    const isMounted = useRef(false);

    const { setPopupMessage } = useAppContext();

    const timeUnitOptions = [
        { 
            value: 'days',
            label: 'Days'
        },
        { 
            value: 'months',
            label: 'Months'
        },
        { 
            value: 'years',
            label: 'Years'
        },
    ]

    const handleSubmit = () => {
        if (!notificationTitle || !notificationDescription || !notifyDate || selectedTechnicians.length < 1) {
            setPopupMessage('All fields must be filled to create a notification')
            return
        }
        selectedTechnicians.forEach(technician => {
            callApi('create-notification', {
                title: notificationTitle,
                notify_date: notifyDate,
                description: notificationDescription,
                technician_id: technician.value,
                repeatable: repeatable,
                repeat_interval: repeatInterval || null,
                repeat_unit: repeatUnit.value || null
            })
                .then(() => {
                    setPopupMessage('Notification created')
                    setNotificationTitle('');
                    setNotificationDescription('');
                    setNotifyDate(new Date());
                    setSelectedTechnicians([]);
                    setRepeatInterval('');
                    setRepeatUnit('');
                })
                .catch(err => {
                    console.error(`Unable to create notification: ${err}`)
                    setPopupMessage('Unable to create notification')
                })
        })
    }

    const handleRepeatIntervalUpdate = (event) => {
        if (!isNaN(parseInt(event.target.value)) || event.target.value === '')
            setRepeatInterval(event.target.value)
    }

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            callApi('get-technicians')
                .then(res => {
                    setOptions(res.map(technician => {
                        return {
                            value: technician.technician_id,
                            label: technician.first_name
                        }
                    }))
                })
        }
    }, [])

    return (
        <div className={styles.menu}>
            <div className={styles.title}>
                Create Notification
            </div>
            <form onSubmit={handleSubmit}>
                <div className={styles.create_notification_grid}>
                    <input className={styles.default_text_box} value={notificationTitle} onChange={event => setNotificationTitle(event.target.value)} placeholder={'Notification Title'} />
                    <div>
                        <Select options={options} key={`unique_key__${selectedTechnicians}`} value={selectedTechnicians || []} onChange={selectedOptions => setSelectedTechnicians(selectedOptions)} isMulti />
                    </div>
                    <div>
                        <label htmlFor="notifyDate">Notify Date: </label>
                        <DatePicker id="notifyDate" className={styles.date_picker} selected={notifyDate} onChange={date => setNotifyDate(date)} />
                    </div>
                        <div>
                            <label className={styles.check_box_container}>
                                <input className={styles.grid_check_box} type="checkbox" onChange={() => setRepeatable(!repeatable)} checked={repeatable} />
                                <span className={styles.expedite_text}>Repeat?</span>
                            </label>
                        </div>
                    {repeatable &&
                    <>
                    <input className={styles.default_text_box} value={repeatInterval} onChange={handleRepeatIntervalUpdate} placeholder={'Interval'} />
                        <div className={styles.unit_select}>
                            <Select options={timeUnitOptions} key={`unique_key__${repeatUnit}`} value={repeatUnit} onChange={selectedUnit => setRepeatUnit(selectedUnit)} />
                        </div>
                    </>
                    }
                    <br />
                </div>
                    <textarea className={styles.notification_text} value={notificationDescription} onChange={event => setNotificationDescription(event.target.value)} placeholder={'Notification Description'} />
                <Button onClick={handleSubmit} innerText={'Create Notification'} />
            </form>
        </div>
    )
}