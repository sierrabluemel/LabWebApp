import addSensor from "./addSensor";
import mockAxios from 'axios';

jest.mock('axios')

beforeEach(async () => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {});
})

test('addSensor returns true with good response', async () => {
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: [{ "sensor_id": 12345, "check_digit": "ABCDE", "batch_id": 3000 }] }))
    const sensorValid = await addSensor('12345:ABCDE', 3000)
    expect(sensorValid).toBe(true)
})

test('addSensor returns false with no sensor_id', async () => {
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: [{ "check_digit": "ABCDE", "batch_id": 3000 }] }))
    const sensorValid = await addSensor('12345:ABCDE', 3000)
    expect(sensorValid).toBe(false)
})

test('addSensor returns false when an error is thrown', async () => {
    mockAxios.get.mockImplementation(() => Promise.reject({ data: [{ 'Result': 'Failed: could not add to iMonnit' }]}))
    const sensorValid = await addSensor('12345:ABCDE', 3000)
    expect(sensorValid).toBe(false)
})

test('addSensor returns false with error from parseSensorString', async () => {
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: [{ "check_digit": "ABCDE", "batch_id": 3000 }] }))
    const sensorValid = await addSensor(':ABCDE', 3000)
    expect(sensorValid).toBe(false)
})