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
                    data: new Blob(['mock file content', 'testing'], { type: 'application/pdf' }),
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/pdf' },
                });
            case `http://${ip}/api/generate-work-order?batch_id=2`:
                return Promise.resolve({
                    status: 400,
                    headers: { 'content-type': 'application/pdf' },
                });
            case `http://${ip}/api/generate-work-order?batch_id=3`:
                return Promise.resolve({
                    status: 200,
                    headers: { 'content-type': 'wrong content type' },
                });
            case `http://${ip}/api/change-sensor-heartbeat/`:
                return Promise.resolve({ data: { Result: 'Success' } });
            case `http://${ip}/api/create-location-log/`:
            case `http://${ip}/api/log-batch-interaction/`:
            case `http://${ip}/api/set-batch-active-state/`:
            case `http://${ip}/api/move-batch-to-network-group/`:
            case `http://${ip}/api/change-batch-heartbeats/`:
                return Promise.resolve({ data: { Result: 'Success' } });
            case `http://${ip}/api/get-locations/`:
                return Promise.resolve({ data: ['S-STD', 'T-STD'] });
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

test('picking a heartbeat and pressing Enter changes the batch heartbeat', async () => {
    await act(async () => {
        setupComponent({
            batchNumber: 1,
            sensorList: [{ sensor_id: 12345 }],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: jest.fn(),
            technicianId: 1,
        });
    });

    const heartbeatSelect = screen.getByLabelText('Heartbeat');
    fireEvent.change(heartbeatSelect, { target: { value: '120' } });
    await act(async () => {
        fireEvent.keyDown(heartbeatSelect, { key: 'Enter' });
    });

    expect(heartbeatSelect).toHaveValue('');
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/change-batch-heartbeats/`, expect.objectContaining({
        'params': { 'heartbeat': '120', 'batch_id': 1 }
    }));
});

const testChangeLocation = async (locationValue) => {
    await act(async () => {
        setupComponent({
            batchNumber: 1,
            sensorList: [{ sensor_id: 12345 }],
            setSensorList: jest.fn(),
            procedureId: 1,
            setPopupMessage: jest.fn(),
            technicianId: 1,
        });
    });

    const locationBox = screen.getByLabelText('Location');
    fireEvent.click(locationBox);
    fireEvent.click(screen.getByRole('button', { name: locationValue }));
    await act(async () => {
        fireEvent.keyDown(locationBox, { key: 'Enter' });
    });

    expect(locationBox).toHaveTextContent('Move to location...');
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/create-location-log/`, expect.objectContaining({
        'params': { 'location': locationValue, 'batch_id': 1 }
    }));
};

test('changing location to testing location calls api', async () => {
    await testChangeLocation('T-STD');
});

test('changing location to shipping location calls api', async () => {
    await testChangeLocation('S-STD');
});
