import { useState, useEffect, useRef } from "react";
import styles from "../../styles/styles.module.css";
import notificationBell from "../../media/notification_bell.png";
import notificationBellUnread from "../../media/notification_bell_unread.png";
import trashCan from "../../media/trash_can.png";
import { useAppContext } from "../../contexts/app";
import NotificationPopup from "../NotificationPopup/NotificationPopup";
import callApi from "../../utils/api/callApi";


export default function NotificationCenter() {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationPopupOpen, setNotificationPopupOpen] = useState(false);
    const [focusedNotification, setFocusedNotification] = useState({});
    const notificationWrapperRef = useRef(null);
    const isMounted = useRef(false);

    const { notifications, setNotifications, setPopupMessage, technicianId } = useAppContext()

    const toggleNotificationPopup = (notification) => {
        setNotificationsOpen(false);
        setFocusedNotification(notification);
        setNotificationPopupOpen(!notificationPopupOpen);
    }

    const dismissNotification = (notification_id, notificationsWereOpen = true) => {
        setNotificationPopupOpen(false)
        callApi('dismiss-notification', { notification_id })
            .then(() => updateNotifications())
            .then(() => notifications.length > 0 && setNotificationsOpen(notificationsWereOpen))
            .catch(err => {
                console.error(`Error dismissing notification: ${err}`)
                setPopupMessage('Could not dismiss notification')
            })
    }

    const updateNotifications = () => {
        callApi('get-notifications', { technician_id: technicianId })
            .then(notificationResponse => setNotifications(notificationResponse))
            .catch(err => {
                console.error(`Unable to get notifications: ${err}`)
            })
    }

    function useOutsideAlerter(ref) {
        useEffect(() => {
            const handleOutsideClick = (event) => {
                if (ref.current && !ref.current.contains(event.target))
                    setNotificationsOpen(false)
            }
            document.addEventListener('mousedown', handleOutsideClick);
            return () => document.removeEventListener('mousedown', handleOutsideClick)
        }, [ref])
    }

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            updateNotifications()
        }
        const interval = setInterval(updateNotifications, 3000);
        return () => clearInterval(interval);
    })



    useOutsideAlerter(notificationWrapperRef);
    return (
        <>
            <div className={styles.notification_display_container}>
                <div className={styles.notification_toggle} ref={notificationWrapperRef}>
                    <img src={notifications.length > 0 ? notificationBellUnread : notificationBell} onClick={() => setNotificationsOpen(!notificationsOpen)} alt="Notification bell" className={styles.notification_bell_image} />
                </div>
                <div className={`${styles.notification_display} ${notificationsOpen ? styles.notification_display_shown : ''}`}>
                    {notifications.map((notification, index) => {
                        return <div key={`notification_${index}`}>
                            <img alt='Delete trash can' src={trashCan} className={styles.trash_can_icon} onClick={() => dismissNotification(notification.id)} />
                            <div className={styles.notification_card} onClick={() => toggleNotificationPopup(notification)} title={notification.description}>
                                {notification.title}
                            </div>
                        </div>
                    })}
                </div>
            </div>
            <NotificationPopup
                isOpen={notificationPopupOpen}
                setIsOpen={setNotificationPopupOpen}
                notification={focusedNotification}
                dismissNotification={dismissNotification}
            />
        </>
    )
}