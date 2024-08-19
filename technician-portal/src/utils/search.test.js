import search from "./search";
import mockAxios from 'axios';

jest.mock('axios')

beforeEach(async () => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: sensors }))
})

const sensors = [{ "sensor_id": 12345, "check_digit": "ABCDE", "batch_id": 3000 }]

test('search for valid sensor returns sensors', async () => {
    const response = await search('12345:ABCDE', 'sensor')
    expect(response).toBe(sensors)
})

test('search for invalid sensor returns null', async () => {
    const response = await search('1234/:ABCDE', 'sensor')
    expect(response).toBe(null)
})

test('search for valid batch returns sensors', async () => {
    const response = await search('10', 'batch')
    expect(response).toBe(sensors)
})

test('search for invalid batch returns null', async () => {
    const response = await search('test', 'batch')
    expect(response).toBe(null)
})

test('search for valid order returns sensors', async () => {
    const response = await search('10', 'order')
    expect(response).toBe(sensors)
})

test('search for invalid order returns null', async () => {
    const response = await search('test', 'order')
    expect(response).toBe(null)
})

test('search for valid customerOrder returns sensors', async () => {
    const response = await search('TO1000', 'customerOrder')
    expect(response).toBe(sensors)
})

test('TO added to search string if not included in search', async () => {
    const response = await search('1000', 'customerOrder')
    expect(response).toBe(sensors)
})

test('invalid search type gets rejected', async () => {
    const response = await search('1000', 'wrongType')
    expect(response).toBe(null)
})