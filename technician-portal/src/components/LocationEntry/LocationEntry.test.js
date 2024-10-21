import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LocationEntry from './LocationEntry';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';

jest.mock('axios')
const mockedUseNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
}))

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/create-location-log/`:
                return Promise.resolve()
            case `http://${ip}/api/log-batch-interaction/`:
                return Promise.resolve()
            case `http://${ip}/api/change-sensor-heartbeat/`:
                return Promise.resolve()
            case `http://${ip}/api/get-active-sensors/`:
                return Promise.resolve({ data: [] })
            default:
                return Promise.reject()
        }
    });
})

function submit(locationString) {
    const textBox = screen.getByPlaceholderText('Location')
    const submitButton = screen.getByText(/submit/i)
    fireEvent.change(textBox, { target: { value: locationString } })
    fireEvent.submit(submitButton)
}

test('LocationEntry renders successfully', () => {
    render(
        <AppWrapper sharedState={{ batchNumber: 1, setPopupMessage: jest.fn(), technicianId: 1 }}>
            <LocationEntry />
        </AppWrapper>
    )
    const submitButton = screen.getByText(/submit/i)
    expect(submitButton).toBeInTheDocument()
})

test('submit with shipping location calls batch interaction', () => {
    render(
        <AppWrapper sharedState={{ batchNumber: 1, setPopupMessage: jest.fn(), technicianId: 1 }}>
            <LocationEntry sensorList={[{ sensor_id: 12345 }]} />
        </AppWrapper>
    )
    submit('S-1234')
    expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-location-log/', { "params": { "batch_id": 1, "location": "S-1234" } })
})

test('submit with testing location calls batch interaction', () => {
    render(
        <AppWrapper sharedState={{ batchNumber: 1, setPopupMessage: jest.fn(), technicianId: 1 }}>
            <LocationEntry sensorList={[{ sensor_id: 12345 }]} />
        </AppWrapper>
    )
    submit('T-1234')
    expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-location-log/', { "params": { "batch_id": 1, "location": "T-1234" } })
})

test('submit with incorrect location calls console.error', async () => {
    const mockSetPopupMessage = jest.fn()
    jest.spyOn(global.console, 'error').mockImplementation(() => { });
    mockAxios.get.mockImplementation(() => Promise.resolve({data: {error: 'call failed' }}))
    render(
        <AppWrapper sharedState={{ batchNumber: 1, setPopupMessage: () => mockSetPopupMessage(), technicianId: 1 }}>
            <LocationEntry sensorList={[{ sensor_id: 12345 }]} />
        </AppWrapper>
    )
    submit('abcde')
    await waitFor(() => {
        expect(mockSetPopupMessage).toHaveBeenCalled()
    })
})