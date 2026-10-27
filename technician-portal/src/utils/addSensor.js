import callApi from "./api/callApi";
import parseSensorString from "./parseSensorString";

const addSensor = async (sensor, batchId, spare = false) => {
  let sensorId;
  let checkDigit;
  try {
    [sensorId, checkDigit] = parseSensorString(sensor);
  } catch (error) {
    return false;
  }

  const parameters = {
    'sensor_id': sensorId,
    'check_digit': checkDigit,
    'batch_id': batchId,
  }
  if (spare)
    parameters.spare = true;

  return callApi('create-sensor', parameters)
    .then((response) => {
      return !isNaN(parseInt(response['sensor_id'] ?? ""));
    })
    .catch((err) => {
      return false
    })
};

export default addSensor;