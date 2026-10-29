import styles from '../../styles/styles.module.css';

// The one popup shell: backdrop, box, header and footer. Every popup (info, error, confirm, content dialogs) renders through it.
// children go between the header and the footer; footer is the row of buttons. className is added to the backdrop and the box
// (confirm_popup sizes to the text, message_popup sits above everything else).
function Dialog({ title, label = title, onClose, footer, children, error = false, role = 'dialog', className = '' }) {
    return (
        <>
            <div className={`${styles.popup_background} ${className}`} onClick={onClose}></div>
            <div className={`${styles.notification_popup_container} ${styles.modal} ${className}`} role={role} aria-label={label}>
                <h2 className={`${styles.popup_header} ${styles.message_popup_text} ${error ? styles.popup_header_error : ''}`}>{title}</h2>
                {children}
                <div className={styles.modal_footer}>{footer}</div>
            </div>
        </>
    )
}

export default Dialog;
