import { useAppContext } from '../../contexts/app';

import styles from '../../styles/styles.module.css';

function ErrorMessage() {
  const { popupMessage, setPopupMessage } = useAppContext()

  if (!popupMessage) return <></>;
  window.scroll({
    top: 0, 
    left: 0, 
    behavior: 'smooth'
  });
  
  return (
    <div className={styles.error_popup}>
      <h1 className={styles.title}>{popupMessage}</h1>
      <button className={styles.default_button} id={styles.popup_confirm} onClick={() => setPopupMessage('')}>Close</button>
    </div>
  )
}

export default ErrorMessage;