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
            case api('get-sensors'):
                return Promise.resolve({ data: [{ sensor_id: 111, check_digit: 'ABC', cable_id: null }] })
            case api('get-locations'):
                return Promise.resolve({ data: ['R-A1', 'T-B2'] })
            case api('get-batch-by-id'):
                return Promise.resolve({ data: { batch_id: 3000, current_location: 'R1', bin: 'B-R01' } })
            case api('set-batch-bin'):
            case api('remove-sensor-from-batch'):
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
            <AddBatchMenu batchNumber={3000} orderId={7} setBatches={jest.fn()} {...props} />
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
    fireEvent.click(screen.getByLabelText('Location'))
    fireEvent.click(screen.getByText('New location...'))
    const locationBox = screen.getByPlaceholderText(/new location/i)
    fireEvent.change(locationBox, { target: { value: location } })
    expect(locationBox).toHaveValue(location.toUpperCase())
    await act(async () => {
        fireEvent.submit(screen.getByTestId('locationForm'))
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
    expect(mockAxios.get).not.toBeCalledWith(api('create-sensor'), expect.anything())
})

test('adding valid sensor twice adds only 1', async () => {
    const state = renderMenu()
    await inputSensor()
    await inputSensor()
    expect(screen.getByText('12345')).toBeInTheDocument()
    expect(screen.getByText(/total sensors: 1/i)).toBeInTheDocument()
    expect(state.setPopupMessage).toBeCalledWith('Sensor "12345" is already in this batch')
    calledWithParams('create-sensor', { batch_id: 3000, check_digit: 'ABCDE', sensor_id: 12345 })
    expect(mockAxios.get.mock.calls.filter(([url]) => url === api('create-sensor'))).toHaveLength(1)
})

test('sensor rejected by api is removed from the list', async () => {
    mockAxios.get.mockImplementation(url => Promise.resolve({ data: url === api('get-locations') ? [] : { sensor_id: null } }))
    const state = renderMenu()
    await inputSensor()
    calledWithParams('create-sensor', { batch_id: 3000, check_digit: 'ABCDE', sensor_id: 12345 })
    expect(state.setPopupMessage).toBeCalledWith('Sensor "12345" could not be added')
    expect(screen.getByText(/no sensors scanned/i)).toBeInTheDocument()
})

test('submitting empty location doesn\'t call api', async () => {
    renderMenu()
    await inputLocation('')
    expect(mockAxios.get).not.toBeCalledWith(api('create-location-log'), expect.anything())
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
    expect(mockAxios.get).not.toBeCalledWith(api('create-location-log'), expect.anything())
    expect(state.setPopupMessage).toBeCalledWith('Location "MY TEST" is invalid: it must start with R, T, P or S')
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

test('cancel removes the batch right away and drops only its card', async () => {
    const setBatches = jest.fn()
    renderMenu({}, { setBatches })
    await act(async () => {
        fireEvent.click(screen.getByText('Cancel'))
    })
    calledWithParams('delete-batch', { batch_id: 3000, force: false })
    const update = setBatches.mock.calls[0][0]
    expect(update([{ batch_id: 3000 }, { batch_id: 3001 }])).toEqual([{ batch_id: 3001 }])
})

test('preload shows the sensors and location the batch already has', async () => {
    await act(async () => {
        renderMenu({}, { preload: true })
    })
    calledWithParams('get-sensors', { batch_id: 3000 })
    expect(screen.getByText('111')).toBeInTheDocument()
    expect(screen.getByText(/current location/i)).toHaveTextContent('Current location: R1 | Bin: B-R01')
})

test('without preload nothing is fetched up front', async () => {
    await act(async () => {
        renderMenu()
    })
    expect(mockAxios.get).not.toBeCalledWith(api('get-sensors'), expect.anything())
    expect(screen.getByText(/current location/i)).toHaveTextContent('Current location: No location set | Bin: none')
})

test('hideCancel leaves the cancel button out of the card', async () => {
    await act(async () => {
        renderMenu({}, { hideCancel: true })
    })
    expect(screen.queryByText('Cancel')).toBeNull()
})

test('scanning with the Spare box checked sends spare and counts it separately', async () => {
    renderMenu()
    fireEvent.click(screen.getByLabelText('Spare'))
    const scanBox = screen.getByPlaceholderText(/scan spare/i)
    fireEvent.change(scanBox, { target: { value: '12345:ABCDE' } })
    await act(async () => {
        fireEvent.submit(screen.getByTestId('addSensorForm'))
    })
    calledWithParams('create-sensor', { batch_id: 3000, check_digit: 'ABCDE', sensor_id: 12345, spare: true })
    expect(screen.getByText(/spare/i, { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/total sensors: 0 \| spares: 1/i)).toBeInTheDocument()
})

test('"Add to batch" on a preloaded spare calls set-sensor-spare', async () => {
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case api('get-sensors'):
                return Promise.resolve({ data: [{ sensor_id: 111, check_digit: 'ABC', cable_id: null, spare: true }] })
            case api('set-sensor-spare'):
                return Promise.resolve({ data: { Result: 'ok' } })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
    await act(async () => {
        renderMenu({}, { preload: true })
    })
    await act(async () => {
        fireEvent.click(screen.getByText('Add to batch'))
    })
    calledWithParams('set-sensor-spare', { sensor_id: '111', batch_id: 3000, spare: false })
    expect(screen.getByText('Make spare')).toBeInTheDocument()
    expect(screen.getByText(/total sensors: 1/i)).toBeInTheDocument()
})

test('trash button asks to confirm, then removes the sensor from iMonnit and the batch', async () => {
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case api('get-sensors'):
                return Promise.resolve({ data: [{ sensor_id: 111, check_digit: 'ABC', cable_id: null, spare: false }] })
            case api('remove-sensor'):
            case api('remove-sensor-from-batch'):
                return Promise.resolve({ data: { Result: 'ok' } })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
    const state = renderMenu({}, { preload: true })
    await act(async () => { })
    fireEvent.click(screen.getByLabelText('Remove sensor 111'))
    expect(screen.getByText('Remove sensor 111 from batch 3000?')).toBeInTheDocument()
    expect(mockAxios.get).not.toBeCalledWith(api('remove-sensor'), expect.anything())
    await act(async () => {
        fireEvent.click(screen.getByText('Remove'))
    })
    calledWithParams('remove-sensor', { sensor_id: 111, check_digit: 'ABC' })
    calledWithParams('remove-sensor-from-batch', { sensor_id: 111, batch_id: 3000 })
    expect(state.setPopupMessage).toBeCalledWith('Sensor 111 removed from batch 3000')
    expect(screen.getByText(/no sensors scanned/i)).toBeInTheDocument()
    expect(screen.getByText(/total sensors: 0/i)).toBeInTheDocument()
})

test('scanning a bin sets it on the batch and shows it', async () => {
    const state = renderMenu()
    fireEvent.change(screen.getByPlaceholderText(/scan bin/i), { target: { value: 'b-y21' } })
    await act(async () => {
        fireEvent.submit(screen.getByTestId('binForm'))
    })
    calledWithParams('set-batch-bin', { batch_id: 3000, bin: 'B-Y21' })
    expect(screen.getByText(/current location/i)).toHaveTextContent('Current location: No location set | Bin: B-Y21')
    expect(screen.getByPlaceholderText(/scan bin/i)).toHaveValue('')
    expect(state.setPopupMessage).not.toBeCalled()
})

test('a rejected bin shows the api error', async () => {
    const state = renderMenu()
    mockAxios.get.mockImplementation(url => url === api('set-batch-bin') ? Promise.reject({ response: { status: 409, data: { error: 'Bin B-Y21 already holds another batch' } } }) : Promise.resolve({ data: {} }))
    fireEvent.change(screen.getByPlaceholderText(/scan bin/i), { target: { value: 'B-Y21' } })
    await act(async () => {
        fireEvent.submit(screen.getByTestId('binForm'))
    })
    expect(state.setPopupMessage).toBeCalledWith('Bin B-Y21 already holds another batch')
    expect(screen.getByText(/current location/i)).toHaveTextContent('Current location: No location set | Bin: none')
})
