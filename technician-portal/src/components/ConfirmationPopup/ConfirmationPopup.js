import styles from '../../styles/styles.module.css';

// The first string is the title, any others are listed as warnings under it
function ConfirmationPopup({ confirmationArray, setConfirmationArray, handleConfirm, handleDismiss, confirmText = 'Confirm', dismissText = 'Dismiss' }) {
  if (confirmationArray.length === 0)
    return <></>
  const dismiss = () => {
    setConfirmationArray([]);
    if (handleDismiss) handleDismiss();
  }
  const [title, ...details] = confirmationArray;
  return (
    <>
      <div className={styles.popup_background} onClick={dismiss}>
      </div>
      <div className={`${styles.notification_popup_container} ${styles.modal}`} role='dialog' aria-label={title}>
        <h2 className={styles.popup_header}>{title}</h2>
        {details.length > 0 ?
          <div className={styles.modal_body}>
            {details.map(string => <div key={string} className={`${styles.modal_row} ${styles.modal_row_warning}`}>{string}</div>)}
          </div> : <></>}
        <div className={styles.modal_footer}>
          <button className={styles.default_button} onClick={dismiss}>{dismissText}</button>
          <button className={`${styles.default_button} ${styles.green}`} onClick={() => { setConfirmationArray([]); handleConfirm() }}>{confirmText}</button>
        </div>
      </div>
    </>
  )
}

export default ConfirmationPopup;
