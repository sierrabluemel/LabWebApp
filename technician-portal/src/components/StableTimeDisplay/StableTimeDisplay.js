import styles from '../../styles/styles.module.css';

function StableTimeDisplay({ stableTime }) {
    let style;
    if (stableTime === 'Stable') {
      style = styles.grid_entry_green;
    } else if (stableTime.indexOf('ago') > 0) {
      style = styles.grid_entry_yellow;
    } else {
      style = styles.grid_entry;
    }
    return (
      <div className={style}>{stableTime}</div>
    )
  }

  export default StableTimeDisplay;
