/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen, within } from '@testing-library/react';
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
                return Promise.resolve({ data: [{ calibration_procedure_id: 1, calibration_procedure: 'Room temp' }, { calibration_procedure_id: 2, calibration_procedure: 'Low temp' }] })
            case `http://${ip}/api/get-batches-by-order-id/`:
                return Promise.resolve({ data: [{ batch_id: 124, order_id: 7, current_location: 'S1', calibration_procedure_id: 1 }, { batch_id: 123, order_id: 7, current_location: 'R1', calibration_procedure_id: 2, bin: 'B-R01' }, { batch_id: 125, order_id: 7, current_location: 'T1', calibration_procedure_id: 2 }] })
            case `http://${ip}/api/get-sensors-by-order-id/`:
                return Promise.resolve({ data: [{ sensor_id: 11, batch_id: 123 }] })
            case `http://${ip}/api/get-certificates-by-order-id/`:
                return Promise.resolve({ data: [{ certificate_id: 1, batch_id: 125 }] })
            case `http://${ip}/api/set-batch-bin/`:
            case `http://${ip}/api/update-batch-calibration-procedure/`:
            case `http://${ip}/api/set-order-expedited/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/create-batch/`:
                return Promise.resolve({ data: { batch_id: 789 } })
            case `http://${ip}/api/remove-sensor-from-batch/`:
            case `http://${ip}/api/delete-batch/`:
            case `http://${ip}/api/delete-order/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/log-batch-interaction/`:
            case `http://${ip}/api/update-batch-technician/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/get-sensors/`:
                return Promise.resolve({ data: [{ sensor_id: 11 }] })
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: { batch_id: 123, customer_order_number: 'SO1', calibration_procedure_id: 1 } })
            case `http://${ip}/api/reform-gateways/`:
                return Promise.resolve({ data: { Result: 'Success', reformed: 3, failed: [] } })
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
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
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
    const batchButton = screen.getByLabelText('Open batch 123')
    await act(async () => {
        fireEvent.click(batchButton)
    })
    expect(mockedUseNavigate).not.toBeCalledWith(expect.stringContaining('/manageBatch'))
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
    const batchButton = screen.getByLabelText('Open batch 123')
    expect(mockAxios.get).not.toBeCalledWith("http://127.0.0.1:8000/api/update-batch-technician/", expect.objectContaining({ "params": { "batch_id": 123, "department": "testing", "technician_id": 1 } }))
    await act(async () => {
        fireEvent.click(batchButton)
    })
    expect(mockAxios.get).toBeCalledWith("http://127.0.0.1:8000/api/update-batch-technician/", expect.objectContaining({ "params": { "batch_id": 123, "department": "testing", "technician_id": 1 } }))
    expect(mockedUseNavigate).toBeCalledWith(expect.stringContaining('/manageBatch'))
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
    expect(mockedUseNavigate).toBeCalledWith(expect.stringContaining('/manageBatch'))
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
    expect(mockedUseNavigate).not.toBeCalledWith(expect.stringContaining('/manageBatch'))
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
    expect(mockedUseNavigate).not.toBeCalledWith(expect.stringContaining('/manageBatch'))
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
    expect(mockedUseNavigate).not.toBeCalledWith(expect.stringContaining('/manageBatch'))
})
const defaultState = () => ({
    batchNumber: 3000, setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(),
    technicianId: 1, setPopupMessage: jest.fn(), sensorGrid: [], setSensorGrid: jest.fn(), setCustomerOrderNumber: jest.fn(),
    setOrder: jest.fn(), setSalesOrder: jest.fn()
})

test('orders with a batch in testing are active, the rest queued, expedited first', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation((url, config) => url === `http://${ip}/api/get-sensors/` && config.params.batch_id === 125
        ? Promise.resolve({ data: [] })
        : url === `http://${ip}/api/get-batches-by-active-state/`
        ? Promise.resolve({ data: [
            { batch_id: 123, order_id: 7, customer_order_number: 'TO7', current_location: 'R1', received_timestamp: "2024-08-27T20:11:22.132Z" },
            { batch_id: 125, order_id: 7, customer_order_number: 'TO7', current_location: 'T1', received_timestamp: "2024-08-27T20:11:22.132Z" },
            { batch_id: 456, order_id: 8, customer_order_number: 'TO8', current_location: 'T2', expedited: true, received_timestamp: "2024-08-28T20:11:22.132Z" },
            { batch_id: 789, order_id: 9, customer_order_number: 'TO9', current_location: 'R2', received_timestamp: "2024-08-26T20:11:22.132Z" }
        ] })
        : defaultGet(url))
    await act(async () => {
        render(<AppWrapper sharedState={defaultState()}><BatchEntry /></AppWrapper>)
    })
    // TO7 is split: batch 125 (testing) is active, batch 123 (receiving) gets its own queued card
    expect(screen.getAllByText('TO7')).toHaveLength(2)
    expect(screen.getByLabelText('Open batch 123')).toHaveTextContent('R1')
    expect(screen.getByLabelText('Open batch 125')).toHaveTextContent('T1')
    expect(screen.getByLabelText('Open batch 125')).toHaveTextContent('NONE')
    // DOCUMENT_POSITION_FOLLOWING = 4
    const follows = (a, b) => expect(a.compareDocumentPosition(b) & 4).toBeTruthy()
    const queued = screen.getByText('Queued orders')
    follows(screen.getByText('TO8'), screen.getByLabelText('Open batch 125'))
    follows(screen.getByLabelText('Open batch 125'), queued)
    follows(queued, screen.getByLabelText('Open batch 123'))
    follows(queued, screen.getByText('TO9'))
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

test('changing the CP of a batch without certificates asks, then applies on Change', async () => {
    await openEditor()
    fireEvent.change(screen.getByLabelText('Calibration procedure for batch 123'), { target: { value: '1' } })
    expect(screen.getByText(/change batch 123 from CP \d+ to CP 1\?/i)).toBeInTheDocument()
    expect(mockAxios.get).not.toBeCalledWith(`http://${ip}/api/update-batch-calibration-procedure/`, expect.anything())
    await act(async () => {
        fireEvent.click(screen.getByText('Change'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/update-batch-calibration-procedure/`, expect.objectContaining({ params: { batch_id: 123, calibration_procedure_id: 1 } }))
    expect(screen.getByLabelText('Calibration procedure for batch 124')).toBeDisabled()
})

test('changing the CP of a batch with certificates asks first', async () => {
    await openEditor()
    fireEvent.change(screen.getByLabelText('Calibration procedure for batch 125'), { target: { value: '1' } })
    expect(screen.getByText(/has certificates generated with CP 2/i)).toBeInTheDocument()
    expect(mockAxios.get).not.toBeCalledWith(`http://${ip}/api/update-batch-calibration-procedure/`, expect.anything())
    await act(async () => {
        fireEvent.click(screen.getByText('Change'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/update-batch-calibration-procedure/`, expect.objectContaining({ params: { batch_id: 125, calibration_procedure_id: 1 } }))
})

test('toggling expedited updates the order', async () => {
    await openEditor()
    await act(async () => {
        fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Expedited'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/set-order-expedited/`, expect.objectContaining({ params: { order_id: 7, expedited: true } }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Expedited')).toBeChecked()
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
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-batch/`, expect.objectContaining({ params: { batch_id: 123, force: false } }))
})

test('a batch that still has readings offers Delete anyway, which retries with force', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation((url, config) => url === `http://${ip}/api/delete-batch/` && !config.params.force
        ? Promise.reject({ response: { status: 409, data: { error: 'Batch 123 still has reading records, so it cannot be removed' } } })
        : defaultGet(url, config))
    const state = defaultState()
    await act(async () => {
        render(<AppWrapper sharedState={state}><BatchEntry /></AppWrapper>)
    })
    await act(async () => { fireEvent.click(screen.getByLabelText('Edit order 7')) })
    fireEvent.click(screen.getByLabelText('Remove batch 123'))
    await act(async () => { fireEvent.click(screen.getByText('Remove')) })
    const popup = state.setPopupMessage.mock.calls.at(-1)[0]
    expect(popup.message).toBe('Batch 123 still has reading records, so it cannot be removed')
    expect(popup.action.label).toBe('Delete anyway')

    await act(async () => { popup.action.onClick() })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-batch/`, expect.objectContaining({ params: { batch_id: 123, force: true } }))
    expect(state.setPopupMessage).toHaveBeenLastCalledWith('Batch 123 removed')
})

test('removing the last batch of an order deletes the order too', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    let deleted = false
    mockAxios.get.mockImplementation((url, config) => {
        if (url === `http://${ip}/api/delete-batch/`) deleted = true
        if (url === `http://${ip}/api/get-batches-by-order-id/` && deleted) return Promise.resolve({ data: [] })
        return defaultGet(url, config)
    })
    const state = defaultState()
    await act(async () => {
        render(<AppWrapper sharedState={state}><BatchEntry /></AppWrapper>)
    })
    await act(async () => { fireEvent.click(screen.getByLabelText('Edit order 7')) })
    fireEvent.click(screen.getByLabelText('Remove batch 123'))
    await act(async () => { fireEvent.click(screen.getByText('Remove')) })
    await act(async () => { })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-order/`, expect.objectContaining({ params: { order_id: 7 } }))
    expect(state.setPopupMessage).toHaveBeenLastCalledWith({ message: 'Batch 123 removed', details: 'Order 7 was removed with it as it had no batches left' })
})

test('reform gateways button reforms every lab gateway and reports the count', async () => {
    const state = defaultState()
    await act(async () => {
        render(<AppWrapper sharedState={state}><BatchEntry /></AppWrapper>)
    })
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Reform gateways' }))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/reform-gateways/`, expect.anything())
    expect(state.setPopupMessage).toBeCalledWith('Reformed 3 gateways')
})

test('scanning a bin in the edit order popup sets it on the batch', async () => {
    await openEditor()
    expect(screen.getByLabelText('Bin for batch 123')).toHaveValue('B-R01')
    expect(screen.getByLabelText('Bin for batch 124')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Bin for batch 125'), { target: { value: 'B-Y21' } })
    await act(async () => {
        fireEvent.submit(screen.getByLabelText('Bin for batch 125').closest('form'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/set-batch-bin/`, expect.objectContaining({ params: { batch_id: 125, bin: 'B-Y21' } }))
})
