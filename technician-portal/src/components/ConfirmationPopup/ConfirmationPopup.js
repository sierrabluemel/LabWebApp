import styles from '../../styles/styles.module.css';

function ConfirmationPopup({ confirmationArray, setConfirmationArray, handleConfirm, handleDismiss, confirmText = 'Confirm', dismissText = 'Dismiss' }) {
  if (confirmationArray.length === 0)
    return <></>
  const dismiss = () => {
    setConfirmationArray([]);
    if (handleDismiss) handleDismiss();
  }
  return (
    <>
      <div className={styles.popup_background} onClick={dismiss}>
      </div>
      <div className={`${styles.notification_popup_container} ${styles.confirmation_popup}`}>
        {confirmationArray.map((string, index) => (
          index > 0 ? <h1 key={string} className={`${styles.title} ${styles.status_dot_red}`}>{string}</h1> : <h1 key={string} className={styles.title}>{string}</h1>
        ))}
        <button className={`${styles.default_button} ${styles.red}`} id={styles.popup_close} onClick={dismiss}>{dismissText}</button>
        <button className={`${styles.default_button} ${styles.green}`} id={styles.popup_confirm} onClick={() => { setConfirmationArray([]); handleConfirm() }}>{confirmText}</button>
      </div>
    </>
  )
}

export default ConfirmationPopup;
