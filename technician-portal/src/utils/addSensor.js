import callApi from "./api/callApi";

const isValidUrl = urlString => {
  var urlPattern = new RegExp('^(https?:\\/\\/)?' + // validate protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
    '(\\#[-a-z\\d_]*)?$', 'i'); // validate fragment locator
  return !!urlPattern.test(urlString);
}

const parseSensorString = sensorString => {
  let sensorId, checkDigit;

  if (isValidUrl(sensorString)) { // URL sensor format
    const url = new URL(sensorString);
    const params = url.searchParams;

    sensorId = params.get('id');
    checkDigit = params.get('sc');
  } else if (sensorString.indexOf(':') !== -1) { // Standard QR code format
    const sensorArray = sensorString.split(':');
    sensorId = sensorArray[0];
    checkDigit = sensorArray[1];
  } else { // Wifi sensor format
    sensorId = sensorString.replace(/[^0-9]/g, '');
    checkDigit = sensorString.replace(/[^a-z]/gi, '');
  }
  if (!sensorId || !checkDigit) { // Missing sensor id or check digit
    let errorMessage;
    !sensorId ? errorMessage = 'No sensor ID found' : errorMessage = 'No check digit found';
    throw new Error(errorMessage);
  } else if (isNaN(sensorId)) { // Sensor id is not a number
    throw new Error('Sensor id should be a number');
  } else if (!isNaN(checkDigit)) { // Check digit is a number
    throw new Error('Check digit should only contain letters');
  }
  return [sensorId, checkDigit];
}

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