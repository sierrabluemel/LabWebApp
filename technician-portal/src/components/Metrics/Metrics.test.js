import { render, screen, act, fireEvent } from '@testing-library/react';
import Metrics from './Metrics';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { AppWrapper } from '../../contexts/app';

const renderMetrics = () => render(<AppWrapper sharedState={{ setEquipmentList: jest.fn() }}><Metrics /></AppWrapper>)

jest.mock('axios');
jest.mock('react-chartjs-2', () => ({
    Bar: ({ options, data }) => <div data-testid={options.plugins.title.text}>{JSON.stringify(data.datasets.map(d => d.data))}</div>
}));

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-calibrations-by-month/`:
                return Promise.resolve({ data: { calibrations: [{ order_id: 10000, calibration_procedure_id: 1 }, { order_id: 10001, calibration_procedure_id: 2 }], failures: [{ order_id: 10000, calibration_procedure_id: 1, pass: false }] } })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/get-active-sensors/`:
                return Promise.resolve({ data: [{ sensor_id: 10000, current_location: 'R-C1', received_timestamp: new Date().toISOString() }, { sensor_id: 10001, current_location: 'S-C1', received_timestamp: new Date().toISOString() }] })
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: [{ "calibration_procedure_id": 1, "calibration_procedure": "Monnit Standard Temperature Calibration, 3-Set Points, Leaded, Submersible" }, { "calibration_procedure_id": 2, "calibration_procedure": "Monnit Low Temperature Calibration, 3-Set Points, Leaded, Submersible" }, { "calibration_procedure_id": 3, "calibration_procedure": "Monnit Humidity and Temperature Calibration" }, { "calibration_procedure_id": 4, "calibration_procedure": "Monnit Temperature Calibration, 3-Set Points, Dry" }, { "calibration_procedure_id": 5, "calibration_procedure": "Monnit Temperature Calibration in Climate Controlled Chamber" }] })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
})
describe('Metrics', () => {
    test('renders successfully', async () => {
        jest.useFakeTimers();
        renderMetrics()
        const loading = screen.getByText(/loading.../i)
        expect(loading).toBeInTheDocument()

        await act(async () => {
            jest.advanceTimersByTime(5000);
        })
        const graphs = screen.getByTestId('graphs')
        expect(graphs).toBeInTheDocument()
    })

    test('toggles between total and by procedure views', async () => {
        jest.useFakeTimers();
        renderMetrics()
        await act(async () => {
            jest.advanceTimersByTime(5000);
        })
        const total = screen.getByRole('button', { name: 'Total' })
        const byProcedure = screen.getByRole('button', { name: 'By procedure' })
        expect(total).toHaveAttribute('aria-pressed', 'true')
        expect(byProcedure).toHaveAttribute('aria-pressed', 'false')

        fireEvent.click(byProcedure)
        expect(byProcedure).toHaveAttribute('aria-pressed', 'true')
        expect(total).toHaveAttribute('aria-pressed', 'false')
    })

    test('shows failure rate as a percent of calibrations', async () => {
        jest.useFakeTimers();
        renderMetrics()
        await act(async () => {
            jest.advanceTimersByTime(5000);
        })
        // mock returns 2 calibrations (CP 1 and CP 2) and 1 failure (CP 1) for every month; datasets are calibrated, failures, rate
        expect(screen.getByTestId('Calibrations and failures by month')).toHaveTextContent('[[2,2,2,2,2,2],[1,1,1,1,1,1],[50,50,50,50,50,50]]')

        fireEvent.click(screen.getByRole('button', { name: 'By procedure' }))
        expect(screen.getByTestId('Sensors calibrated by procedure')).toHaveTextContent('[[1,1,1,1,1,1],[1,1,1,1,1,1],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]]')
        expect(screen.getByTestId('Failures by procedure')).toHaveTextContent('[[1,1,1,1,1,1],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]]')
    })

    test('catches calibration procedure retrieval error', async () => {
        mockAxios.get.mockImplementation(url => {
            switch (url) {
                case `http://${ip}/api/get-calibrations-by-month/`:
                    return Promise.resolve({ data: { calibrations: [{ order_id: 10000 }, { order_id: 10001 }], failures: [] } })
                case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/get-active-sensors/`:
                    return Promise.resolve({ data: [{ sensor_id: 10000, current_location: 'R-C1', received_timestamp: new Date().toISOString() }, { sensor_id: 10001, current_location: 'S-C1', received_timestamp: new Date().toISOString() }] })
                case `http://${ip}/api/get-calibration-procedures/`:
                    return Promise.resolve({ data: 'Could not get calibration procedures' })
                default:
                    return Promise.reject({ response: { status: 500 } })
            }
        });
        jest.useFakeTimers();
        renderMetrics()
        const loading = screen.getByText(/loading.../i)
        expect(loading).toBeInTheDocument()

        await act(async () => {
            jest.advanceTimersByTime(5000);
        })
        const graphs = screen.getByTestId('graphs')
        expect(graphs).toBeInTheDocument()
    })
})