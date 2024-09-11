/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManageBatch from './ManageBatch';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';

jest.mock('../TestingMenu/TestingMenu.js', () => () => <mock-testing-menu />);
jest.mock('axios');

const mockedUseNavigate = jest.fn();
const mockSetPopupMessage = jest.fn();
const calibrationProcedures = JSON.parse(JSON.stringify(require('./calibration_procedures.test.json')));

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
}));
jest.spyOn(global.console, 'error').mockImplementation(() => { });

global.URL.createObjectURL = jest.fn();

afterEach(() => {
    global.URL.createObjectURL.mockReset();
});

beforeEach(() => {
    jest.clearAllMocks();

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: { current_location: 'testLocation' } });
            case `http://${ip}/api/generate-work-order?batch_id=1`:
                return Promise.resolve({
                    data: new Blob(['mock file content', 'testing'], { type: 'application/json; charset=utf-8' }),
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json; charset=utf-8' },
                });
            case `http://${ip}/api/generate-work-order?batch_id=2`:
                return Promise.resolve({
                    status: 400,
                    headers: { 'content-type': 'application/json; charset=utf-8' },
                });
            case `http://${ip}/api/generate-work-order?batch_id=3`:
                return Promise.resolve({
                    status: 200,
                    headers: { 'content-type': 'wrong content type' },
                });
            case `http://${ip}/api/change-sensor-heartbeat/`:
                return Promise.resolve({ data: { Result: 'Success' } });
            case `http://${ip}/api/create-location-log/`:
                return Promise.resolve({ data: { Result: 'Success' } });
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: calibrationProcedures });
            default:
                return Promise.reject();
        }
    });
});

const setupComponent = (sharedState) => {
    return render(
        <AppWrapper sharedState={sharedState}>
            <ManageBatch />
        </AppWrapper>
    );
};

test('ManageBatch renders successfully', async () => {
    await act(async () => {
        setupComponent({
            batchNumber: 1,
            sensorList: [],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: jest.fn(),
            technicianId: 1,
        });
    });

    const calibrationProcedureLabel = screen.getByText(/calibration procedure:/i);
    expect(calibrationProcedureLabel).toBeInTheDocument();
});

test('Manage batch works with each procedureId', async () => {
    for (let i = 1; i <= 5; i++) {
        await act(async () => {
            setupComponent({
                batchNumber: 1,
                sensorList: [],
                setSensorList: jest.fn(),
                procedureId: i,
                setPopupMessage: jest.fn(),
                technicianId: 1,
            });
        });
    }
});

const testGenerateWorkOrder = async (batchNumber, statusCode, expectedMessage) => {
    await act(async () => {
        setupComponent({
            batchNumber,
            sensorList: [],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: string => mockSetPopupMessage(string),
            technicianId: 1,
        });
    });

    const downloadWorkOrderButton = screen.getByText(/download work order/i);
    fireEvent.click(downloadWorkOrderButton);

    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/generate-work-order?batch_id=${batchNumber}`, { "responseType": "blob" });

    await waitFor(() => {
        expect(mockSetPopupMessage).toHaveBeenCalledWith(expectedMessage);
    });
};

test('generating work order with bad status code is handled', async () => {
    await testGenerateWorkOrder(2, 400, 'Failed to generate work order for batch 2: Bad server response');
});

test('generating work order with wrong file type is handled', async () => {
    await testGenerateWorkOrder(3, 200, 'Failed to generate work order for batch 3: Server responded with the wrong file type');
});

test('generating work order with success returns blob', async () => {
    await act(async () => {
        setupComponent({
            batchNumber: 1,
            sensorList: [],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: jest.fn(),
            technicianId: 1,
        });
    });

    const downloadWorkOrderButton = screen.getByText(/download work order/i);
    fireEvent.click(downloadWorkOrderButton);
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/generate-work-order?batch_id=1`, { "responseType": "blob" });
});

const testChangeSensorHeartbeat = async (sensorId, heartbeatValue) => {
    await act(async () => {
        setupComponent({
            batchNumber: 1,
            sensorList: [{ sensor_id: sensorId }],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: jest.fn(),
            technicianId: 1,
        });
    });

    const heartbeatForm = screen.getByTestId('heartbeatForm');
    const heartbeatBox = screen.getByPlaceholderText(/heartbeat/i);

    await act(async () => {
        fireEvent.change(heartbeatBox, { target: { value: heartbeatValue } });
    });

    expect(heartbeatBox).toHaveValue(heartbeatValue);

    await act(async () => {
        fireEvent.submit(heartbeatForm);
    });

    expect(heartbeatBox).toHaveValue('');
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/change-sensor-heartbeat/`, {
        'params': { 'sensor_id': sensorId, 'heartbeat': heartbeatValue }
    });
};

test('changing heartbeat calls api', async () => {
    await testChangeSensorHeartbeat(12345, '1');
});

const testChangeLocation = async (sensorId, locationValue, batchId) => {
    await act(async () => {
        setupComponent({
            batchNumber: 1,
            sensorList: [{ sensor_id: sensorId }],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: jest.fn(),
            technicianId: 1,
        });
    });

    const locationForm = screen.getByTestId('locationForm');
    const locationBox = screen.getByPlaceholderText(/location/i);

    await act(async () => {
        fireEvent.change(locationBox, { target: { value: locationValue } });
    });

    expect(locationBox).toHaveValue(locationValue);

    await act(async () => {
        fireEvent.submit(locationForm);
    });

    expect(locationBox).toHaveValue('');
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/create-location-log/`, {
        'params': { 'location': locationValue, 'batch_id': batchId }
    });
};

test('changing location to testing location calls api', async () => {
    await testChangeLocation(12345, 'T-STD', 1);
});

test('changing location to shipping location calls api', async () => {
    await testChangeLocation(12345, 'S-STD', 1);
});
