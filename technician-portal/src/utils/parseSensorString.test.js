import parseSensorString from "./parseSensorString";

test('parseSensorString with standard format returns sensorId and checkDigit', () => {
    const [sensorId, checkDigit] = parseSensorString('123456:ABCDEF');
    expect(sensorId).toBe('123456');
    expect(checkDigit).toBe('ABCDEF');
})

test('parseSensorString with url format returns sensorId and checkDigit', () => {
    const [sensorId, checkDigit] = parseSensorString('https://app.onupkeep.com/web/edge/add-device/qr?id=123456&sc=ABCDEF');
    expect(sensorId).toBe('123456');
    expect(checkDigit).toBe('ABCDEF');
})

test('parseSensorString with WiFi format returns sensorId and checkDigit', () => {
    const [sensorId, checkDigit] = parseSensorString('123456ABCDEF');
    expect(sensorId).toBe('123456');
    expect(checkDigit).toBe('ABCDEF');
})

test('parseSensorString with incorrect standard format throws error', () => {
    expect(() => parseSensorString(':ABCDEF')).toThrow('No sensor ID found');
    expect(() => parseSensorString('123456:')).toThrow('No check digit found');
    expect(() => parseSensorString('ABCDEF:ABCDEF')).toThrow('Sensor id should be a number');
    expect(() => parseSensorString('123456:123456')).toThrow('Check digit should only contain letters');
})