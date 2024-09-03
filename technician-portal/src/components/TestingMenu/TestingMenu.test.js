/* eslint-disable testing-library/no-unnecessary-act */
import { screen, render, fireEvent } from '@testing-library/react';
import TestingMenu from './TestingMenu';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

const equipment = require('../../utils/equipment.test.json')

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-last-humidity-stable-reading/`:
                return Promise.resolve({ data: [{ "slope": 0.0011111111111101009, "stable": true, "average": 99.54599999999998, "assumed_set_point": 100, "standard_deviation": 0.0049013251785311514 }, "2023-10-26T21:29:28.663Z"] })
            case `http://${ip}/api/get-last-temperature-stable-reading/`:
                return Promise.resolve({ data: [{ "slope": 0.0011111111111101009, "stable": true, "average": 99.54599999999998, "assumed_set_point": 100, "standard_deviation": 0.0049013251785311514 }, "2023-10-26T21:29:28.663Z"] })
            case `http://${ip}/api/get-readings/`:
                return Promise.resolve({ data: [{ "reading_id": 20499, "type": "temperature", "set_point": "28.00", "timestamp": "2023-10-10T16:19:20.821Z", "reference_reading": "27.90", "sensor_reading": "27.50", "lab_rh": "35.24", "lab_temperature": "25.40", "sensor_id": 123456, "generator_id": 1, "reference_id": 14, "uncertainty": "0.28", "tolerance": "1", "pass": true }, { "reading_id": 20498, "type": "temperature", "set_point": "-999.00", "timestamp": "2023-10-10T16:19:15.732Z", "reference_reading": "27.90", "sensor_reading": "27.50", "lab_rh": "35.24", "lab_temperature": "25.40", "sensor_id": 123456, "generator_id": 1, "reference_id": 14, "uncertainty": "0.28", "tolerance": "1", "pass": true }, { "reading_id": 20497, "type": "temperature", "set_point": "90.00", "timestamp": "2023-10-10T16:19:09.914Z", "reference_reading": "27.90", "sensor_reading": "27.50", "lab_rh": "35.24", "lab_temperature": "25.40", "sensor_id": 123456, "generator_id": 1, "reference_id": 14, "uncertainty": "0.28", "tolerance": "1", "pass": true }, { "reading_id": 20496, "type": "temperature", "set_point": "-25.00", "timestamp": "2023-10-10T16:18:42.207Z", "reference_reading": "-24.98", "sensor_reading": "28.28", "lab_rh": "33.55", "lab_temperature": "20.40", "sensor_id": 123456, "generator_id": 2, "reference_id": 15, "uncertainty": "0.028", "tolerance": "1", "pass": false }] })
            case `http://${ip}/api/get-recent-data/`:
                return Promise.resolve({ data: [{ "id": 2118719, "lab_humidity": 27.83, "lab_temperature": 17.2, "rotronic_data": { "S000119": { "Humidity": 99.79, "Temperature": 17.53, "stability_data": { "humidity": { "slope": 0.0005911231339541797, "stable": true, "average": 99.806, "assumed_set_point": 100, "standard_deviation": 0.01493279966205042 }, "temperature": { "slope": -0.00012928380874201937, "stable": false, "average": 17.531, "assumed_set_point": 20, "standard_deviation": 0.009001915504969647 } } } }, "generator_readings": null, "devices_under_test": { "886013": -999999, "1066321": -999999, "123456temp": 27.89, '123456humidity': 15 }, "prt_readings_celsius": { "S000114": 16.31538, "S000116": -25.00937, "S000128": 16.2262 }, "timestamp": "2023-10-27T15:38:15.858Z", "super_daq_data": { "S000114": { "Temperature": 16.31542, "stability_data": { "slope": -0.00009503927003926521, "stable": true, "average": 16.313421, "assumed_set_point": 16, "standard_deviation": 0.0027447003270041946 } }, "S000116": { "Temperature": -25.00882, "stability_data": { "slope": 0.00001165216687380225, "stable": true, "average": -25.009349999999998, "assumed_set_point": -25, "standard_deviation": 0.0007345168871248206 } }, "S000128": { "Temperature": 16.22624, "stability_data": { "slope": 0.000034723606026045725, "stable": true, "average": 16.228323, "assumed_set_point": 16, "standard_deviation": 0.0009370732131996917 } } } }] })
            case `http://${ip}/api/get-temperature-reading-range/`:
                return Promise.resolve({ data: [{ super_daq_data: { S000115: { Temperature: 123 } }, devices_under_test: { '123456temp': 123, '123456humidity': 15 } }] })
            case `http://${ip}/api/calibrate-sensor/`:
                return Promise.resolve({ data: { Result: 'failed' } })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: equipment })
            case `http://${ip}/api/get-humidity-reading-range/`:
                return Promise.resolve({ data: [{ rotronic_data: { S000119: { Humidity: 12345, Temperature: 12345 } }, devices_under_test: { '123456temp': 123, '123456humidity': 15 } }] })
            default:
                return Promise.reject();
        }
    });
})

const mockSensorGrid = '[<div className="grid_row"><div className="grid_entry">Reference</div><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /></div>, <div className="grid_row "><button className="default_button" onClick={[Function onClick]}>123456</button><div className="grid_entry_green">27.89°C</div><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /></div>, <div className="grid_row "><button className="default_button" onClick={[Function onClick]}>654321</button><div className="grid_entry">No data found</div><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /><div className="grid_entry" /></div>]'

test('TestingMenu renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                sensorGrid: [], sensorList: [],
                setSensorGrid: jest.fn(), setPopupMessage: jest.fn()
            }}>
                <TestingMenu setPoints={[{ temperature: 20 }, { temperature: 20 }, { temperature: 20 }, { temperature: 20 }]} />
            </AppWrapper>
        )
    })
    const message = screen.getByText(/no sensors found/i)
    expect(message).toBeInTheDocument()
})

test('initial render sets grid once', async () => {
    const mockSetSensorGrid = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                sensorGrid: [], sensorList: [{ sensor_id: 123456 }],
                setSensorGrid: mockSetSensorGrid, setPopupMessage: jest.fn(), procedureId: 1,
            }}>
                <TestingMenu setPoints={[{ temperature: 20 }, { temperature: 20 }, { temperature: 20 }, { temperature: 20 }]} />
            </AppWrapper>
        )
    })
    expect(mockSetSensorGrid).toBeCalledTimes(1)
})

test('pressing set point button creates reading', async () => {
    const mockSetSensorGrid = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                sensorGrid: [], sensorList: [{ sensor_id: 123456 }],
                setSensorGrid: mockSetSensorGrid, setPopupMessage: jest.fn(), procedureId: 1,
            }}>
                <TestingMenu setPoints={[{ temperature: 20 }, { temperature: 30 }, { temperature: 40 }, { temperature: 50 }]} />
            </AppWrapper>
        )
    })
    const setPointButton = screen.getByText(/as found/i)
    await act(async () => {
        fireEvent.click(setPointButton)
    })
    expect(mockSetSensorGrid).toBeCalledTimes(2)
    expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-reading/', expect.anything())
})

test('no stable data throws error', async () => {
    const mockSetSensorGrid = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                sensorGrid: mockSensorGrid, sensorList: [{ sensor_id: 123456 }, { sensor_id: 654321 }],
                setSensorGrid: mockSetSensorGrid, setPopupMessage: jest.fn(), procedureId: 1,
            }}>
                <TestingMenu setPoints={[{ temperature: 20 }, { temperature: 30 }, { temperature: 40 }, { temperature: 50 }]} />
            </AppWrapper>
        )
    })
    const setPointButton = screen.getByText(/as found/i)
    await act(async () => {
        fireEvent.click(setPointButton)
    })
    expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-reading/', expect.anything())
})

test('no readings throws error', async () => {
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-last-humidity-stable-reading/`:
                return Promise.resolve({ data: [{ "slope": 0.0011111111111101009, "stable": true, "average": 99.54599999999998, "assumed_set_point": 100, "standard_deviation": 0.0049013251785311514 }, "2023-10-26T21:29:28.663Z"] })
            case `http://${ip}/api/get-last-temperature-stable-reading/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/get-readings/`:
                return Promise.resolve({ data: [{ "reading_id": 20499, "type": "temperature", "set_point": "28.00", "timestamp": "2023-10-10T16:19:20.821Z", "reference_reading": "27.90", "sensor_reading": "27.50", "lab_rh": "35.24", "lab_temperature": "25.40", "sensor_id": 123456, "generator_id": 1, "reference_id": 14, "uncertainty": "0.28", "tolerance": "1", "pass": true }, { "reading_id": 20498, "type": "temperature", "set_point": "-999.00", "timestamp": "2023-10-10T16:19:15.732Z", "reference_reading": "27.90", "sensor_reading": "27.50", "lab_rh": "35.24", "lab_temperature": "25.40", "sensor_id": 123456, "generator_id": 1, "reference_id": 14, "uncertainty": "0.28", "tolerance": "1", "pass": true }, { "reading_id": 20497, "type": "temperature", "set_point": "90.00", "timestamp": "2023-10-10T16:19:09.914Z", "reference_reading": "27.90", "sensor_reading": "27.50", "lab_rh": "35.24", "lab_temperature": "25.40", "sensor_id": 123456, "generator_id": 1, "reference_id": 14, "uncertainty": "0.28", "tolerance": "1", "pass": true }, { "reading_id": 20496, "type": "temperature", "set_point": "-25.00", "timestamp": "2023-10-10T16:18:42.207Z", "reference_reading": "-24.98", "sensor_reading": "28.28", "lab_rh": "33.55", "lab_temperature": "20.40", "sensor_id": 123456, "generator_id": 2, "reference_id": 15, "uncertainty": "0.028", "tolerance": "1", "pass": false }] })
            case `http://${ip}/api/get-recent-data/`:
                return Promise.resolve({ data: [{ "id": 2118719, "lab_humidity": 27.83, "lab_temperature": 17.2, "rotronic_data": { "S000119": { "Humidity": 99.79, "Temperature": 17.53, "stability_data": { "humidity": { "slope": 0.0005911231339541797, "stable": true, "average": 99.806, "assumed_set_point": 100, "standard_deviation": 0.01493279966205042 }, "temperature": { "slope": -0.00012928380874201937, "stable": false, "average": 17.531, "assumed_set_point": 20, "standard_deviation": 0.009001915504969647 } } } }, "generator_readings": null, "devices_under_test": { "886013": -999999, "1066321": -999999, "123456temp": 27.89 }, "prt_readings_celsius": { "S000114": 16.31538, "S000116": -25.00937, "S000128": 16.2262 }, "timestamp": "2023-10-27T15:38:15.858Z", "super_daq_data": { "S000114": { "Temperature": 16.31542, "stability_data": { "slope": -0.00009503927003926521, "stable": true, "average": 16.313421, "assumed_set_point": 16, "standard_deviation": 0.0027447003270041946 } }, "S000116": { "Temperature": -25.00882, "stability_data": { "slope": 0.00001165216687380225, "stable": true, "average": -25.009349999999998, "assumed_set_point": -25, "standard_deviation": 0.0007345168871248206 } }, "S000128": { "Temperature": 16.22624, "stability_data": { "slope": 0.000034723606026045725, "stable": true, "average": 16.228323, "assumed_set_point": 16, "standard_deviation": 0.0009370732131996917 } } } }] })
            case `http://${ip}/api/get-temperature-reading-range/`:
                return Promise.resolve({ data: [{ super_daq_data: { S000115: { Temperature: 123 } }, devices_under_test: { '123456temp': 123 } }] })
            case `http://${ip}/api/calibrate-sensor/`:
                return Promise.resolve({ data: { Result: 'failed' } })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: equipment })
            default:
                return Promise.reject();
        }
    });
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                sensorGrid: mockSensorGrid, sensorList: [{ sensor_id: 123456 }, { sensor_id: 654321 }],
                setSensorGrid: jest.fn(), setPopupMessage: jest.fn(), procedureId: 1,
            }}>
                <TestingMenu setPoints={[{ temperature: 20 }, { temperature: 30 }, { temperature: 40 }, { temperature: 50 }]} />
            </AppWrapper>
        )
    })
    const setPointButton = screen.getByText(/as found/i)
    expect(setPointButton).toBeInTheDocument();
    await act(async () => {
        fireEvent.click(setPointButton)
    })
    expect(mockAxios.get).not.toBeCalledWith('http://127.0.0.1:8000/api/create-reading/', expect.anything())
})

test('pressing humidity set point button creates reading', async () => {
    const mockSetSensorGrid = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                sensorGrid: [], sensorList: [{ sensor_id: 123456 }],
                setSensorGrid: mockSetSensorGrid, setPopupMessage: jest.fn(), procedureId: 3,
            }}>
                <TestingMenu setPoints={[{ temperature: 40, humidity: 20 }, { temperature: 30, humidity: 50 }, { temperature: 20, humidity: 80 }]} />
            </AppWrapper>
        )
    })
    const setPointButton = screen.getByText(/50%RH/i)
    await act(async () => {
        fireEvent.click(setPointButton)
    })
    expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-reading/', expect.anything())
})