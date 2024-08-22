import callApi from "./api/callApi";
import parseSensorString from "./parseSensorString";

const addSensor = async (sensor, batchId) => {
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
  try {
    const response = await callApi('create-sensor', parameters);
    if (!response[0]['sensor_id']) {
      return false;
    }
  } catch (error) {
    return false;
  }
  return true;
};

export default addSensor;