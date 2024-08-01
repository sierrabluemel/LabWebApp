/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen, act } from '@testing-library/react';
import AddBatchMenu from './AddBatchMenu';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/create-sensor/`:
                return Promise.resolve({ data: [{ sensor_id: 1 }] })
            case `http://${ip}/api/create-location-log/`:
                return Promise.resolve({ data: { Result: 'success' } })
            case `http://${ip}/api/get-online-sensors/`:
                return Promise.resolve({ data: [12345] })
            case `http://${ip}/api/delete-batch/`:
                return Promise.resolve({ data: [12345] })
            default:
                return Promise.reject()
        }
    });
})

const inputSensor = async () => {
    const mockSensor = '12345:ABCDE'
    const addSensorBox = screen.getByPlaceholderText(/sensor id:check digit/i)
    const addSensorForm = screen.getByTestId('addSensorForm')
    expect(addSensorBox).toBeInTheDocument()
    expect(addSensorForm).toBeInTheDocument()
    expect(addSensorBox).toHaveValue('')
    fireEvent.change(addSensorBox, { target: { value: mockSensor } })
    expect(addSensorBox).toHaveValue(mockSensor)
    const form = screen.getByTestId('addSensorForm')
    await act(async () => {
        fireEvent.submit(form)
    })
}

const inputLocation = async (location) => {
    const locationBox = screen.getByPlaceholderText(/location/i)
    const locationForm = screen.getByTestId('setLocationForm')
    expect(locationBox).toBeInTheDocument()
    expect(locationForm).toBeInTheDocument()
    expect(locationBox).toHaveValue('')
    fireEvent.change(locationBox, { target: { value: location } })
    expect(locationBox).toHaveValue(location.toUpperCase())
    const form = screen.getByTestId('setLocationForm')
    await act(async () => {
        fireEvent.submit(form)
    })
}

test('AddBatchMenu renders successfully', () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: jest.fn(), technicianId: 1 }} >
            <AddBatchMenu />
        </AppWrapper>
    )

    const currentLocation = screen.getByText(/current location/i)
    expect(currentLocation).toBeInTheDocument()
})

it('should toggle menu on button click', () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: jest.fn(), technicianId: 1 }} >
            <AddBatchMenu />
        </AppWrapper>
    )

    const hideButton = screen.getByText(/calibration procedure:/i)
    let currentLocation = screen.getByText(/current location/i)
    expect(hideButton).toBeInTheDocument()

    fireEvent.click(hideButton)
    const showButton = screen.getByText(/calibration procedure:/i)
    expect(showButton).toBeInTheDocument()
    expect(currentLocation).not.toBeInTheDocument()

    fireEvent.click(showButton)
    expect(showButton).not.toBeInTheDocument()
    currentLocation = screen.getByText(/current location/i)
    expect(currentLocation).toBeInTheDocument()
})

test('adding sensor without technicianId causes error', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: null }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputSensor()
})

test('adding valid sensor twice with technicianId adds only 1', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputSensor()
    await inputSensor()
    const sensorListItem = screen.getByText('12345:ABCDE')
    expect(sensorListItem).toBeInTheDocument()
    expect(mockAxios.get).toBeCalledTimes(1)
})

test('adding invalid sensor gets rejected', async () => {
    mockAxios.get.mockImplementation(Promise.resolve({ data: [{ sensor_id: null }] }))
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputSensor()
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/create-sensor/", { "params": { "batch_id": 3000, "check_digit": "ABCDE", "sensor_id": "12345" } })
})

test('submitting location without location doesn\'t call api', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputLocation('')
    expect(mockAxios.get).toBeCalledTimes(0)
})

test('submitting location starting with "R" creates location log and logs receving', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputLocation('R-STD')
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/create-location-log/", { "params": { "batch_id": 3000, "location": "R-STD" } })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/log-batch-interaction/", { "params": { "department": "receiving", "start": false, "technician_id": 1, "batch_id": 3000 } })
})

test('submitting location starting with "T" creates location log and logs testing', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputLocation('T-STD')
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/create-location-log/", { "params": { "batch_id": 3000, "location": "T-STD" } })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/log-batch-interaction/", { "params": { "department": "testing", "start": true, "technician_id": 1, "batch_id": 3000 } })
})

test('invalid location does not create log', async () => {
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: { error: 'test error' } }))
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputLocation('my test')
    expect(mockAxios.get).toBeCalledTimes(1)
})

test('checkStatus called after 4 seconds', async () => {
    jest.useFakeTimers();
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} />
        </AppWrapper>
    )
    await inputSensor()
    await inputSensor()
    await act(async () => {
        jest.advanceTimersByTime(4000);
    })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/get-online-sensors/", { "params": undefined })
})

test('removing batch creates popup and removes batch', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: () => jest.fn(), technicianId: 1 }} >
            <AddBatchMenu batchNumber={3000} batches={[]} setBatches={jest.fn()} />
        </AppWrapper>
    )
    await inputSensor()
    const removeButton = screen.getByText(/remove batch/i)
    await act(async () => {
        fireEvent.click(removeButton)
    })
    const confirmButton = screen.getByText(/confirm/i)
    await act(async () => {
        fireEvent.click(confirmButton)
    })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/delete-batch/", { "params": { "batch_id": 3000 } })
})