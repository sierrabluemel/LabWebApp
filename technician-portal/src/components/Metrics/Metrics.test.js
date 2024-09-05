import { render, screen, act } from '@testing-library/react';
import Metrics from './Metrics';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';

import { addWorkDays } from './Metrics';

jest.mock('axios');
jest.mock('react-chartjs-2', () => ({
    Bar: () => null
}));

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-calibrations-by-month/`:
                return Promise.resolve({ data: [{ order_id: 10000 }, { order_id: 10001 }] })
            case `http://${ip}/api/get-active-sensors/`:
                return Promise.resolve({ data: [{ sensor_id: 10000, current_location: 'R-C1', received_timestamp: new Date().toISOString() }, { sensor_id: 10001, current_location: 'S-C1', received_timestamp: new Date().toISOString() }] })
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: [{ "calibration_procedure_id": 1, "calibration_procedure": "Monnit Standard Temperature Calibration, 3-Set Points, Leaded, Submersible" }, { "calibration_procedure_id": 2, "calibration_procedure": "Monnit Low Temperature Calibration, 3-Set Points, Leaded, Submersible" }, { "calibration_procedure_id": 3, "calibration_procedure": "Monnit Humidity and Temperature Calibration" }, { "calibration_procedure_id": 4, "calibration_procedure": "Monnit Temperature Calibration, 3-Set Points, Dry" }, { "calibration_procedure_id": 5, "calibration_procedure": "Monnit Temperature Calibration in Climate Controlled Chamber" }] })
            default:
                return Promise.reject()
        }
    });
})
describe('Metrics', () => {
    test('renders successfully', async () => {
        jest.useFakeTimers();
        render(<Metrics />)
        const loading = screen.getByText(/loading.../i)
        expect(loading).toBeInTheDocument()

        await act(async () => {
            jest.advanceTimersByTime(5000);
        })
        const graphs = screen.getByTestId('graphs')
        expect(graphs).toBeInTheDocument()
    })

    test('catches calibration procedure retrieval error', async () => {
        mockAxios.get.mockImplementation(url => {
            switch (url) {
                case `http://${ip}/api/get-calibrations-by-month/`:
                    return Promise.resolve({ data: [{ order_id: 10000 }, { order_id: 10001 }] })
                case `http://${ip}/api/get-active-sensors/`:
                    return Promise.resolve({ data: [{ sensor_id: 10000, current_location: 'R-C1', received_timestamp: new Date().toISOString() }, { sensor_id: 10001, current_location: 'S-C1', received_timestamp: new Date().toISOString() }] })
                case `http://${ip}/api/get-calibration-procedures/`:
                    return Promise.resolve({ data: 'Could not get calibration procedures' })
                default:
                    return Promise.reject()
            }
        });
        jest.useFakeTimers();
        render(<Metrics />)
        const loading = screen.getByText(/loading.../i)
        expect(loading).toBeInTheDocument()

        await act(async () => {
            jest.advanceTimersByTime(5000);
        })
        const graphs = screen.getByTestId('graphs')
        expect(graphs).toBeInTheDocument()
    })
})

describe('addWorkdays', () => {
    test('skips weekends from Friday', () => {
        const startDate = new Date('Fri Sep 06 2024')
        const endDate = addWorkDays(startDate, 1);

        expect(endDate.toString()).toBe(new Date('Mon Sep 09 2024').toString())
    })

    test('skips weekends from Saturday', () => {
        const startDate = new Date('Sat Sep 07 2024')
        const endDate = addWorkDays(startDate, 1);

        expect(endDate.toString()).toBe(new Date('Mon Sep 09 2024').toString())
    })
})