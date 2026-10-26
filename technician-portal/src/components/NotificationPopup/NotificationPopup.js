import styles from "../../styles/styles.module.css";
import trashCan from "../../media/trash_can.png";

export default function NotificationPopup({ isOpen, setIsOpen, dismissNotification, notification }) {
    window.addEventListener('keypress', event => {
        setIsOpen(false);
    })

    const descriptionArray = notification.description && notification.description.split('\n')
    return (
        isOpen &&
        <>
            <div className={styles.popup_background} onClick={() => setIsOpen(false)}></div>
            <div className={styles.notification_popup_container}>
                {notification.title && <div className={styles.popup_header}><span className={styles.title}>{notification.title}</span></div>}
                <br />
                <div className={styles.notification_popup}>
                    <div className={styles.default_text}>{descriptionArray.map((subString, index) => {
                        return <span key={index}>
                            {subString}
                            <br />
                        </span>
                    })}</div>

                    {notification.repeatable && <div className={`${styles.default_text} ${styles.repeat_text}`}>Repeats every <span style={{ 'textDecoration': 'underline', color: 'var(--primary)' }}>{notification.repeat_interval} {notification.repeat_unit}</span></div>}

                </div>
                <img alt='Delete trash can' src={trashCan} className={styles.popup_trash_can_icon} onClick={() => dismissNotification(notification.id, false)} />
                <div className={styles.close_button} onClick={() => setIsOpen(false)}></div>
            </div>
        </>
    )
}