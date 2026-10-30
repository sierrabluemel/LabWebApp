import { useEffect } from "react";
import Dialog from "../Dialog/Dialog";
import styles from "../../styles/styles.module.css";

// A notification opened from the bell: the same popup as everything else, with Dismiss to clear it from the bell
export default function NotificationPopup({ isOpen, setIsOpen, dismissNotification, notification }) {
    useEffect(() => {
        const close = () => setIsOpen(false);
        window.addEventListener('keypress', close);
        return () => window.removeEventListener('keypress', close);
    }, [setIsOpen])

    if (!isOpen)
        return <></>;

    const close = () => setIsOpen(false);
    const repeats = notification.repeatable ? `Repeats every ${notification.repeat_interval} ${notification.repeat_unit}` : '';
    const footer = <>
        <button className={styles.default_button} onClick={close}>Close</button>
        <button className={`${styles.default_button} ${styles.red}`} onClick={() => dismissNotification(notification.id, false)}>Dismiss</button>
    </>;
    return (
        <Dialog title={notification.title} onClose={close} footer={footer} className={styles.confirm_popup}>
            {(notification.description || repeats) &&
                <div className={styles.modal_body}>
                    {notification.description && <div className={`${styles.modal_row} ${styles.message_popup_text}`}>{notification.description}</div>}
                    {repeats && <div className={styles.modal_row}>{repeats}</div>}
                </div>}
        </Dialog>
    )
}
