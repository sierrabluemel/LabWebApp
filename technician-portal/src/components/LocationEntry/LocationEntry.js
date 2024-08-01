import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";

import styles from "../../styles/styles.module.css";

function LocationEntry({ sensorList }) {
  const navigate = useNavigate();
  const { batchNumber, setPopupMessage, technicianId } = useAppContext()

  const [location, setLocation] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    callApi('create-location-log', {
      'location': location,
      'batch_id': batchNumber
    })
      .then(response => {
        if (!response.error) {
          setPopupMessage(`Batch moved to ${location}`);
          navigate('/manageBatch');
          if (location.startsWith('S')) {
            callApi('log-batch-interaction', {
              department: 'testing',
              start: false,
              technician_id: technicianId,
              batch_id: batchNumber
            })

            for (const sensor of sensorList) {
              callApi('change-sensor-heartbeat', {
                sensor_id: sensor.sensor_id,
                heartbeat: 120
              })
            }
            
          } else if (location.startsWith('T')) {
            callApi('log-batch-interaction', {
              department: 'testing',
              start: true,
              technician_id: technicianId,
              batch_id: batchNumber
            })
          }
        } else {
          setPopupMessage('The batch was not moved successfully');
          console.error(response.error)
        }
      })
  }

  const handleChange = (event) => {
    setLocation(event.target.value.toUpperCase());
  }

  return (
    <div className={styles.menu}>
      <form onSubmit={handleSubmit} >
        <input type='text' value={location} onChange={handleChange} className={styles.default_text_box} placeholder={'Location'} />
        <button type='submit' className={styles.default_button}>Submit</button>
      </form>
    </div>
  );
}

export default LocationEntry;