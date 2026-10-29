import { useEffect } from 'react';
import { useAppContext } from '../../contexts/app';
import Dialog from '../Dialog/Dialog';

import styles from '../../styles/styles.module.css';

const FAILURE_WORDS = /\b(could not|cannot|unable|fail|invalid|error|not (found|moved|changed|removed|deleted|enough)|no (certificates|results|references|stable|lab readings|technician)|must (be|look)|already|missing|enter a|select a|sign in|fill all)\b/i;

// The app-wide info and error popup. A caller passes a string, or { message, details, error, action }: the header is the
// main action, details go in the body under it, error forces the red header, and action offers one extra button, e.g. "Delete anyway"
function ErrorMessage() {
  const { popupMessage, setPopupMessage } = useAppContext()

  useEffect(() => {
    const close = () => setPopupMessage('');
    window.addEventListener('keypress', close);
    return () => window.removeEventListener('keypress', close);
  }, [setPopupMessage])

  if (!popupMessage) return <></>;

  const { message, details, error, action } = typeof popupMessage === 'string' ? { message: popupMessage } : popupMessage;
  // shortcut: with no error flag, failures are recognised by wording; pass error: true/false when a message is misread
  const failed = error ?? FAILURE_WORDS.test(message);
  const close = () => setPopupMessage('');
  const footer = <>
    <button className={styles.default_button} onClick={close}>Close</button>
    {action && <button className={`${styles.default_button} ${styles.red}`} onClick={() => { close(); action.onClick(); }}>{action.label}</button>}
  </>;

  return (
    <Dialog title={message} onClose={close} footer={footer} error={failed} role='alertdialog' className={styles.message_popup}>
      {details && <div className={styles.modal_body}><div className={`${styles.modal_row} ${styles.message_popup_text}`}>{details}</div></div>}
    </Dialog>
  )
}

export default ErrorMessage;
