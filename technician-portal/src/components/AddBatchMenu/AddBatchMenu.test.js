/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen, act } from '@testing-library/react';
import AddBatchMenu from './AddBatchMenu';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

const api = (endPoint) => `http://${ip}/api/${endPoint}/`
const calledWithParams = (endPoint, params) =>
    expect(mockAxios.get).toBeCalledWith(api(endPoint), expect.objectContaining({ params }))

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case api('create-sensor'):
                return Promise.resolve({ data: { sensor_id: 12345 } })
            case api('create-location-log'):
                return Promise.resolve({ data: { Result: 'success' } })
            case api('get-online-sensors'):
                return Promise.resolve({ data: { online_sensors: [], order_sensors: [] } })
            case api('delete-batch'):
            case api('log-batch-interaction'):
            case api('set-batch-active-state'):
            case api('move-batch-to-network-group'):
            case api('change-batch-heartbeats'):
                return Promise.resolve({ data: {} })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
})

const renderMenu = (sharedState = {}, props = {}) => {
    const state = { setPopupMessage: jest.fn(), technicianId: 1, ...sharedState }
    render(
        <AppWrapper sharedState={state} >
            <AddBatchMenu batchNumber={3000} orderId={7} batches={[]} setBatches={jest.fn()} {...props} />
        </AppWrapper>
    )
    return state
}

const inputSensor = async (mockSensor = '12345:ABCDE') => {
    const addSensorBox = screen.getByPlaceholderText(/scan sensor/i)
    expect(addSensorBox).toHaveValue('')
    fireEvent.change(addSensorBox, { target: { value: mockSensor } })
    expect(addSensorBox).toHaveValue(mockSensor)
    await act(async () => {
        fireEvent.submit(screen.getByTestId('addSensorForm'))
    })
}

const inputLocation = async (location) => {
    const locationBox = screen.getByPlaceholderText(/location/i)
    expect(locationBox).toHaveValue('')
    fireEvent.change(locationBox, { target: { value: location } })
    expect(locationBox).toHaveValue(location.toUpperCase())
    await act(async () => {
        fireEvent.submit(screen.getByTestId('setLocationForm'))
    })
}

test('AddBatchMenu renders successfully', () => {
    renderMenu()
    expect(screen.getByText(/current location/i)).toBeInTheDocument()
})

it('should toggle menu on button click', () => {
    renderMenu()
    const hideButton = screen.getByText(/calibration procedure:/i)
    let currentLocation = screen.getByText(/current location/i)

    fireEvent.click(hideButton)
    const showButton = screen.getByText(/calibration procedure:/i)
    expect(showButton).toBeInTheDocument()
    expect(currentLocation).not.toBeInTheDocument()

    fireEvent.click(showButton)
    expect(showButton).not.toBeInTheDocument()
    expect(screen.getByText(/current location/i)).toBeInTheDocument()
})

test('invalid scan shows the parse error and does not call api', async () => {
    const state = renderMenu()
    await inputSensor('12345')
    expect(state.setPopupMessage).toBeCalledWith('"12345": No check digit found')
    expect(screen.getByPlaceholderText(/scan sensor/i)).toHaveValue('')
    expect(mockAxios.get).not.toBeCalled()
})

test('adding valid sensor twice adds only 1', async () => {
    const state = renderMenu()
    await inputSensor()
    await inputSensor()
    expect(screen.getByText('12345')).toBeInTheDocument()
    expect(screen.getByText(/total sensors: 1/i)).toBeInTheDocument()
    expect(state.setPopupMessage).toBeCalledWith('Sensor "12345" is already in this batch')
    calledWithParams('create-sensor', { batch_id: 3000, check_digit: 'ABCDE', sensor_id: 12345 })
    expect(mockAxios.get).toBeCalledTimes(1)
})

test('sensor rejected by api is removed from the list', async () => {
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: { sensor_id: null } }))
    const state = renderMenu()
    await inputSensor()
    calledWithParams('create-sensor', { batch_id: 3000, check_digit: 'ABCDE', sensor_id: 12345 })
    expect(state.setPopupMessage).toBeCalledWith('Sensor "12345" could not be added')
    expect(screen.getByText(/no sensors scanned/i)).toBeInTheDocument()
})

test('submitting empty location doesn\'t call api', async () => {
    renderMenu()
    await inputLocation('')
    expect(mockAxios.get).toBeCalledTimes(0)
})

test('submitting location starting with "R" creates location log and ends receiving', async () => {
    renderMenu()
    await inputLocation('R-STD')
    calledWithParams('create-location-log', { batch_id: 3000, location: 'R-STD' })
    calledWithParams('log-batch-interaction', { department: 'receiving', start: false, technician_id: 1, batch_id: 3000 })
})

test('submitting location starting with "T" creates location log and starts testing', async () => {
    renderMenu()
    await inputLocation('T-STD')
    calledWithParams('create-location-log', { batch_id: 3000, location: 'T-STD' })
    calledWithParams('log-batch-interaction', { department: 'testing', start: true, technician_id: 1, batch_id: 3000 })
})

test('invalid location shows popup and does not create log', async () => {
    const state = renderMenu()
    await inputLocation('my test')
    expect(mockAxios.get).not.toBeCalled()
    expect(state.setPopupMessage).toBeCalledWith('The batch was not moved successfully')
})

test('checkStatus polls online sensors for the order', async () => {
    jest.useFakeTimers();
    renderMenu()
    await act(async () => {
        jest.advanceTimersByTime(4000);
    })
    calledWithParams('get-online-sensors', { order_id: 7 })
    jest.useRealTimers();
})

test('get all leads reports sensors without a cable', async () => {
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case api('create-sensor'):
                return Promise.resolve({ data: { sensor_id: 12345 } })
            case api('get-sensor-cable-id'):
                return Promise.reject({ response: { status: 509 } })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
    const state = renderMenu()
    await inputSensor()
    await act(async () => {
        fireEvent.click(screen.getByText(/get all leads/i))
    })
    expect(state.setPopupMessage).toBeCalledWith('Leads added for 0 of 1 sensors. No cable on: 12345')
})

test('removing batch creates popup and removes batch', async () => {
    const setBatches = jest.fn()
    renderMenu({}, { setBatches })
    await act(async () => {
        fireEvent.click(screen.getByText(/remove batch/i))
    })
    await act(async () => {
        fireEvent.click(screen.getByText(/confirm/i))
    })
    calledWithParams('delete-batch', { batch_id: 3000 })
    expect(setBatches).toBeCalledWith([])
})
