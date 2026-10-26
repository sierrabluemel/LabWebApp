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
                return Promise.resolve({ data: [
                    { batch_id: 123, order_id: 7, customer_order_number: 'TO7', current_location: 'R1', received_timestamp : "2024-08-27T20:11:22.132Z" },
                    { batch_id: 456, order_id: 8, current_location: 'T2', received_timestamp : "2024-08-27T20:11:22.132Z" }
                ] })
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: [{ calibration_procedure_id: 2, calibration_procedure: 'Low temp' }] })
            case `http://${ip}/api/get-batches-by-order-id/`:
                return Promise.resolve({ data: [{ batch_id: 124, current_location: 'S1', calibration_procedure_id: 1 }, { batch_id: 123, current_location: 'R1', calibration_procedure_id: 2 }] })
            case `http://${ip}/api/get-sensors-by-order-id/`:
                return Promise.resolve({ data: [{ sensor_id: 11, batch_id: 123 }] })
            case `http://${ip}/api/create-batch/`:
                return Promise.resolve({ data: { batch_id: 789 } })
            case `http://${ip}/api/remove-sensor-from-batch/`:
            case `http://${ip}/api/delete-batch/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/log-batch-interaction/`:
            case `http://${ip}/api/update-batch-technician/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/get-sensors/`:
                return Promise.resolve({ data: [{ sensor_id: 11 }] })
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
    expect(screen.getAllByText(/no batches/i)).toHaveLength(2)
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

test('submit batch number that doesn\'t exist shows popup', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation(url => url === `http://${ip}/api/get-batch-by-id/` ? Promise.resolve({ data: null }) : defaultGet(url))
    const mockSetPopupMessage = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                batchNumber: 999, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
                technicianId: 1, setPopupMessage: mockSetPopupMessage, sensorGrid: [], setSensorGrid: jest.fn(),
                salesOrder: "", setSalesOrder: jest.fn(), setOrder: jest.fn(), expedited: false, setExpedited: jest.fn(), setCustomerOrderNumber: jest.fn()
            }}>
                <BatchEntry />
            </AppWrapper>
        )
    })
    await act(async () => {
        fireEvent.submit(screen.getByTestId('batchForm'))
    })
    expect(mockSetPopupMessage).toBeCalledWith('Batch 999 not found')
    expect(mockedUseNavigate).not.toBeCalledWith('/manageBatch')
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
const defaultState = () => ({
    batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
    technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(), setCustomerOrderNumber: jest.fn(),
    setOrder: jest.fn(), setSalesOrder: jest.fn()
})

test('batches are split into testing and queued by location', async () => {
    await act(async () => {
        render(<AppWrapper sharedState={defaultState()}><BatchEntry /></AppWrapper>)
    })
    const testingHeading = screen.getByText('Testing (T)')
    const queuedHeading = screen.getByText('Queued (R)')
    const testingBatch = screen.getByText(/batch: 456/i)
    const queuedBatch = screen.getByText(/batch: 123/i)
    // DOCUMENT_POSITION_FOLLOWING = 4
    expect(testingHeading.compareDocumentPosition(testingBatch) & 4).toBeTruthy()
    expect(testingBatch.compareDocumentPosition(queuedHeading) & 4).toBeTruthy()
    expect(queuedHeading.compareDocumentPosition(queuedBatch) & 4).toBeTruthy()
})

const openEditor = async () => {
    await act(async () => {
        render(<AppWrapper sharedState={defaultState()}><BatchEntry /></AppWrapper>)
    })
    await act(async () => {
        fireEvent.click(screen.getByLabelText('Edit order 7'))
    })
}

test('edit order popup lists every batch on the order', async () => {
    await openEditor()
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/get-batches-by-order-id/`, expect.objectContaining({ params: { order_id: 7 } }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Batch 123')
    expect(screen.getByRole('dialog')).toHaveTextContent('Batch 124')
    expect(screen.getByLabelText('Remove batch 124')).toBeDisabled()
})

test('add batch opens the sales order page for this order', async () => {
    await openEditor()
    await act(async () => {
        fireEvent.click(screen.getByText('Add batch'))
    })
    expect(mockedUseNavigate).toBeCalledWith('/createSalesOrder', { state: { mode: 'add', customerOrderNumber: 'TO7' } })
})

test('edit batch opens the sales order page with that batch', async () => {
    await openEditor()
    await act(async () => {
        fireEvent.click(screen.getByLabelText('Edit batch 123'))
    })
    expect(mockedUseNavigate).toBeCalledWith('/createSalesOrder', { state: { mode: 'edit', batch: expect.objectContaining({ batch_id: 123 }), customerOrderNumber: 'TO7' } })
})

test('removing a batch unassigns its sensors and deletes it after confirming', async () => {
    await openEditor()
    fireEvent.click(screen.getByLabelText('Remove batch 123'))
    expect(screen.getByText(/1 sensor\(s\) will be unassigned/i)).toBeInTheDocument()
    expect(mockAxios.get).not.toBeCalledWith(`http://${ip}/api/delete-batch/`, expect.anything())
    await act(async () => {
        fireEvent.click(screen.getByText('Remove'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/remove-sensor-from-batch/`, expect.objectContaining({ params: { sensor_id: 11, batch_id: 123 } }))
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-batch/`, expect.objectContaining({ params: { batch_id: 123 } }))
})
