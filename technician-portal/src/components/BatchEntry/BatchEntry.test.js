/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import BatchEntry from './BatchEntry';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';

const mockedUseNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
    useLocation: () => ({ state: null }),
}))

jest.mock('axios')

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-batches-by-active-state/`:
                return Promise.resolve({ data: [{ batch_id: 123, received_timestamp : "2024-08-27T20:11:22.132Z" }] })
            case `http://${ip}/api/log-batch-interaction/`:
            case `http://${ip}/api/update-batch-technician/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/get-sensors/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: { batch_id: 123, customer_order_number: 'SO1', calibration_procedure_id: 1 } })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
})

test('BatchEntry renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const submitButton = screen.getByText(/submit/i)
    expect(submitButton).toBeInTheDocument()
})

test('sensorGrid having entries resets to empty list', async () => {
    const mockSetSensorGrid = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: ['testing'], setSensorGrid: mockSetSensorGrid,
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    expect(mockSetSensorGrid).toBeCalledWith([])
})

test('clicking button without technicianId does nothing', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: null, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const batchButton = screen.getByText(/batch: 123/i)
    await act(async () => {
        fireEvent.click(batchButton)
    })
    expect(mockedUseNavigate).not.toBeCalledWith('/manageBatch')
})

test('clicking button navigates to ManageBatch screen', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const batchButton = screen.getByText(/batch: 123/i)
    expect(mockAxios.get).not.toBeCalledWith("http://127.0.0.1:8000/api/update-batch-technician/", expect.objectContaining({ "params": { "batch_id": 123, "department": "testing", "technician_id": 1 } }))
    await act(async () => {
        fireEvent.click(batchButton)
    })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/update-batch-technician/", expect.objectContaining({ "params": { "batch_id": 123, "department": "testing", "technician_id": 1 } }))
    expect(mockedUseNavigate).toBeCalledWith('/manageBatch')
})

test('empty response has message stating no batches', async () => {
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: [] }))
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const message = screen.getByText(/no batches/i)
    expect(message).toBeInTheDocument()
})

test('submit batch number with valid number navigates', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 123, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const batchEntry = screen.getByPlaceholderText(/batch number/i)
    const form = screen.getByTestId('batchForm')
    fireEvent.change(batchEntry, { target: { value: '123' } })
    await act(async() => {
        fireEvent.submit(form)
    })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/get-batches-by-active-state/", expect.objectContaining({"params": {"active": true}}))
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/get-batch-by-id/", expect.objectContaining({"params": {"batch_id": 123}}))
    expect(mockedUseNavigate).toBeCalledWith('/manageBatch')
})

test('submit batch number without technicianId doesn\'t continue', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 123, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: null, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const batchEntry = screen.getByPlaceholderText(/batch number/i)
    const form = screen.getByTestId('batchForm')
    fireEvent.change(batchEntry, { target: { value: '123' } })
    await act(async() => {
        fireEvent.submit(form)
    })
    expect(mockAxios.get).not.toBeCalledWith("http://127.0.0.1:8000/api/get-batch-by-id/", expect.objectContaining({"params": {"batch_id": 123}}))
    expect(mockedUseNavigate).not.toBeCalledWith('/manageBatch')
})

test('submit batch number without proper batch number doesn\'t continue', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 'test', setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    const batchEntry = screen.getByPlaceholderText(/batch number/i)
    const form = screen.getByTestId('batchForm')
    fireEvent.change(batchEntry, { target: { value: 'test' } })
    await act(async() => {
        fireEvent.submit(form)
    })
    expect(mockAxios.get).not.toBeCalledWith("http://127.0.0.1:8000/api/get-batch-by-id/", expect.anything())
    expect(mockedUseNavigate).not.toBeCalledWith('/manageBatch')
})