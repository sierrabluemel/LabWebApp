import { useAppContext } from '../../contexts/app';

import styles from '../../styles/styles.module.css';

const FAILURE_WORDS = /\b(could not|cannot|unable|fail|invalid|error|not (found|moved|changed|removed|deleted|enough)|no (certificates|results|references|stable|lab readings|technician)|must (be|look)|already|missing|enter a|select a|sign in|fill all)\b/i;

function ErrorMessage() {
  const { popupMessage, setPopupMessage } = useAppContext()

  window.addEventListener('keypress', event => {
    setPopupMessage('');
  })

  if (!popupMessage) return <></>;

  // A caller can pass { message, action: { label, onClick } } to offer one extra button, e.g. "Delete anyway"
  const { message, action } = typeof popupMessage === 'string' ? { message: popupMessage } : popupMessage;
  // shortcut: failures are recognised by wording rather than a flag from the caller; add a flag if a message is misread
  const failed = FAILURE_WORDS.test(message);
  const close = () => setPopupMessage('');

  return (
    <>
      <div className={`${styles.popup_background} ${styles.message_popup}`} onClick={close}>
      </div>
      <div className={`${styles.notification_popup_container} ${styles.modal} ${styles.message_popup}`} role='alertdialog' aria-label={message}>
        <h2 className={`${styles.popup_header} ${styles.message_popup_text} ${failed ? styles.popup_header_error : ''}`}>{message}</h2>
        <div className={styles.modal_footer}>
          <button className={styles.default_button} onClick={close}>Close</button>
          {action && <button className={`${styles.default_button} ${styles.red}`} onClick={() => { close(); action.onClick(); }}>{action.label}</button>}
        </div>
      </div>
    </>
  )
}

export default ErrorMessage;