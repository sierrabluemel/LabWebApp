/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import SalesOrderForm from './SalesOrderForm';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';

jest.mock('../DropDown/DropDown.js', () => ({ setBatches }) => {
    return <button onClick={() => setBatches([{ batch_id: 6, calibration_procedure_id: 2 }])}>mock-add-batch</button>
})

jest.mock('axios')

const mockedUseNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
    useLocation: () => mockLocation,
}))

let mockLocation = { state: null }

beforeEach(() => {
    jest.clearAllMocks()
    mockLocation = { state: null }

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/create-order/`:
                return Promise.resolve({ data: [{ order_id: 1, customer_order_number: 'test' }] })
            case `http://${ip}/api/get-active-sensors/`:
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/log-batch-interaction/`:
            case `http://${ip}/api/update-batch-technician/`:
            case `http://${ip}/api/delete-batch/`:
            case `http://${ip}/api/delete-order/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/get-batches-by-order-id/`:
                return Promise.resolve({ data: [{ batch_id: 6 }] })
            case `http://${ip}/api/get-sensors/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: { batch_id: 5, customer_order_number: 'SO1', calibration_procedure_id: 2, current_location: 'R1' } })
            default:
                return Promise.reject({ response: { status: 500 } });
        }
    });
})

test('Receiving renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                salesOrder: 1, technicianId: 1, setSalesOrder: jest.fn(), setOrder: jest.fn(),
                setPopupMessage: jest.fn(), order: 1
            }}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    const submitButton = screen.getByText(/save sales order/i)
    expect(submitButton).toBeInTheDocument()
})

test('Receiving renders loading when no order is present', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                salesOrder: 1, technicianId: 1, setSalesOrder: jest.fn(), setOrder: jest.fn(),
                setPopupMessage: jest.fn(), order: null
            }}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    const loading = screen.getByText(/loading.../i)
    expect(loading).toBeInTheDocument()
})

const completeOrder = async () => {
    const sharedState = {
        salesOrder: 'SO1', setSalesOrder: jest.fn(), technicianId: 1,
        setPopupMessage: jest.fn(), order: 1, setOrder: jest.fn()
    }
    await act(async () => {
        render(
            <AppWrapper sharedState={sharedState}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    await act(async () => {
        fireEvent.click(screen.getByText('mock-add-batch'))
    })
    await act(async () => {
        fireEvent.click(screen.getByText(/save sales order/i))
    })
    return sharedState
}

test('completing order shows popup instead of navigating', async () => {
    await completeOrder()
    expect(screen.getByText(/order 1 \(SO1\) created/i)).toBeInTheDocument()
    expect(mockedUseNavigate).not.toBeCalled()
})

test('a new order needs a batch before completing', async () => {
    const sharedState = { salesOrder: 'SO1', setSalesOrder: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(), order: 1, setOrder: jest.fn() }
    await act(async () => {
        render(<AppWrapper sharedState={sharedState}><SalesOrderForm /></AppWrapper>)
    })
    await act(async () => {
        fireEvent.click(screen.getByText(/save sales order/i))
    })
    expect(sharedState.setPopupMessage).toBeCalledWith('Add a calibration procedure first')
    expect(screen.queryByText(/created/i)).not.toBeInTheDocument()
})

test('leaving a new order with no batches deletes it', async () => {
    jest.useFakeTimers()
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation(url => url === `http://${ip}/api/get-batches-by-order-id/` ? Promise.resolve({ data: [] }) : defaultGet(url))
    const sharedState = { salesOrder: 'SO1', setSalesOrder: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(), order: 1, setOrder: jest.fn() }
    let unmount
    await act(async () => {
        ({ unmount } = render(<AppWrapper sharedState={sharedState}><SalesOrderForm /></AppWrapper>))
    })
    await act(async () => {
        unmount()
        jest.runAllTimers()
    })
    jest.useRealTimers()
    await act(async () => {})
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-order/`, expect.objectContaining({ params: { order_id: 1 } }))
})

test('leaving a new order that has a batch keeps it', async () => {
    jest.useFakeTimers()
    const sharedState = { salesOrder: 'SO1', setSalesOrder: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(), order: 1, setOrder: jest.fn() }
    let unmount
    await act(async () => {
        ({ unmount } = render(<AppWrapper sharedState={sharedState}><SalesOrderForm /></AppWrapper>))
    })
    await act(async () => {
        unmount()
        jest.runAllTimers()
    })
    jest.useRealTimers()
    await act(async () => {})
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/get-batches-by-order-id/`, expect.objectContaining({ params: { order_id: 1 } }))
    expect(mockAxios.get).not.toBeCalledWith(`http://${ip}/api/delete-order/`, expect.anything())
})

test('"Go to testing" clears the order and navigates to batch list', async () => {
    const state = await completeOrder()
    await act(async () => {
        fireEvent.click(screen.getByText(/go to testing/i))
    })
    expect(state.setOrder).toBeCalledWith(null)
    expect(state.setSalesOrder).toBeCalledWith('')
    expect(mockedUseNavigate).toBeCalledWith('/batchEntry', { state: { focusNewOrder: false } })
})

test('"Add another order" clears the order and opens a new order page', async () => {
    const state = await completeOrder()
    await act(async () => {
        fireEvent.click(screen.getByText(/add another order/i))
    })
    expect(state.setOrder).toBeCalledWith(null)
    expect(state.setSalesOrder).toBeCalledWith('')
    expect(mockedUseNavigate).toBeCalledWith('/createSalesOrder', { state: { newOrder: true } })
})

test('the new order page shows the new order form until an order exists', async () => {
    mockLocation = { state: { newOrder: true } }
    await act(async () => {
        render(
            <AppWrapper sharedState={{ salesOrder: '', setSalesOrder: jest.fn(), setOrder: jest.fn(), order: null, expedited: false, setExpedited: jest.fn(), setPopupMessage: jest.fn(), technicianId: 1 }}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    expect(screen.getByPlaceholderText(/new sales order/i)).toBeInTheDocument()
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
})
const renderMode = async (state) => {
    mockLocation = { state }
    const sharedState = {
        salesOrder: 'SO1', setSalesOrder: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(), order: 7, setOrder: jest.fn(),
        setBatchNumber: jest.fn(), setSensorList: jest.fn(), setProcedureId: jest.fn(), setCustomerOrderNumber: jest.fn()
    }
    await act(async () => {
        render(
            <AppWrapper sharedState={sharedState}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    return sharedState
}

test('add mode titles the existing order and needs a batch before submitting', async () => {
    const sharedState = await renderMode({ mode: 'add', customerOrderNumber: 'TO5' })
    expect(screen.getByText('TO5')).toBeInTheDocument()
    await act(async () => {
        fireEvent.click(screen.getByText('Save Batch'))
    })
    expect(sharedState.setPopupMessage).toBeCalledWith('Add a calibration procedure first')
    expect(mockedUseNavigate).not.toBeCalled()
})

test('edit mode shows only that batch and opens it on submit', async () => {
    const sharedState = await renderMode({ mode: 'edit', batch: { batch_id: 5, calibration_procedure_id: 2 }, customerOrderNumber: 'TO5' })
    expect(document.querySelector('mock-dropdown')).toBeNull()
    expect(screen.getByText(/batch: 5/i)).toBeInTheDocument()
    await act(async () => {
        fireEvent.click(screen.getByText('Save Batch'))
    })
    expect(sharedState.setOrder).toBeCalledWith(null)
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/get-batch-by-id/`, expect.objectContaining({ params: { batch_id: 5 } }))
    expect(mockedUseNavigate).toBeCalledWith(expect.stringContaining('/manageBatch'))
})

test('add and edit modes have a back button to the testing page', async () => {
    const sharedState = await renderMode({ mode: 'add', customerOrderNumber: 'TO5' })
    fireEvent.click(screen.getByAltText('Back button'))
    expect(sharedState.setOrder).toBeCalledWith(null)
    expect(mockedUseNavigate).toBeCalledWith('/batchEntry')
})

test('a new order has no back button', async () => {
    await renderMode(null)
    expect(screen.queryByAltText('Back button')).toBeNull()
})

test('edit mode puts remove batch beside edit batch and removes after confirming', async () => {
    const sharedState = await renderMode({ mode: 'edit', batch: { batch_id: 5, calibration_procedure_id: 2 }, customerOrderNumber: 'TO5' })
    const removeButtons = screen.getAllByText('Remove batch')
    expect(removeButtons).toHaveLength(1)
    expect(removeButtons[0].parentElement).toContainElement(screen.getByText('Save Batch'))
    fireEvent.click(removeButtons[0])
    await act(async () => {
        fireEvent.click(screen.getByText('Remove'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-batch/`, expect.objectContaining({ params: { batch_id: 5, force: false } }))
    expect(sharedState.setPopupMessage).toBeCalledWith('Batch 5 removed')
    expect(mockedUseNavigate).toBeCalledWith('/batchEntry')
})

test('removing the last batch in edit mode deletes the order too', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation(url => url === `http://${ip}/api/get-batches-by-order-id/` ? Promise.resolve({ data: [] }) : defaultGet(url))
    const sharedState = await renderMode({ mode: 'edit', batch: { batch_id: 5, calibration_procedure_id: 2 }, customerOrderNumber: 'TO5' })
    fireEvent.click(screen.getByText('Remove batch'))
    await act(async () => {
        fireEvent.click(screen.getByText('Remove'))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/delete-order/`, expect.objectContaining({ params: { order_id: sharedState.order } }))
    expect(sharedState.setPopupMessage).toBeCalledWith({ message: 'Batch 5 removed', details: `Order ${sharedState.order} was removed with it as it had no batches left` })
})
