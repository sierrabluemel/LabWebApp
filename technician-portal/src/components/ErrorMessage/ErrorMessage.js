import { useAppContext } from '../../contexts/app';

import styles from '../../styles/styles.module.css';

function ErrorMessage() {
  const { popupMessage, setPopupMessage } = useAppContext()

  window.addEventListener('keypress', event => {
    setPopupMessage('');
  })

  if (!popupMessage) return <></>;

  return (
    <>
      <div className={`${styles.popup_background} ${styles.message_popup}`} onClick={() => setPopupMessage('')}>
      </div>
      <div className={`${styles.notification_popup_container} ${styles.modal} ${styles.message_popup}`} role='alertdialog' aria-label={popupMessage}>
        <h2 className={`${styles.popup_header} ${styles.message_popup_text}`}>{popupMessage}</h2>
        <div className={styles.modal_footer}>
          <button className={styles.default_button} onClick={() => setPopupMessage('')}>Close</button>
        </div>
      </div>
    </>
  )
}

export default ErrorMessage;