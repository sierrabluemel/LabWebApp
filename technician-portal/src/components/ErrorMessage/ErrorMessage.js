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
      <div className={styles.popup_background} onClick={() => setPopupMessage('')}>
      </div>
      <div className={styles.notification_popup_container}>
        <h1 className={styles.title}>{popupMessage}</h1>
        <button className={styles.default_button} id={styles.popup_confirm} onClick={() => setPopupMessage('')}>Close</button>
      </div>
    </>
  )
}

export default ErrorMessage;