/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import SearchResults from './SearchResults';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';

const mockedUseNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
}))

jest.mock('axios')

// jsdom has no scrollIntoView; results scroll to the highlighted batch
window.HTMLElement.prototype.scrollIntoView = jest.fn()

// an order whose only batch has no sensors yet
const emptyBatchRows = [{
    order_id: 1861, customer_order_number: 'TEST-1', received_timestamp: '2026-10-26T20:11:22.132Z',
    batch_id: 3137, calibration_procedure_id: 4, current_location: 'R-1', sensor_id: null
}]

let batchById;

beforeEach(() => {
    jest.clearAllMocks()
    batchById = { batch_id: 3137, customer_order_number: 'TEST-1', calibration_procedure_id: 4 }

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-search-results/`:
                return Promise.resolve({ data: emptyBatchRows })
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: batchById })
            case `http://${ip}/api/get-batches-by-order-id/`:
                return Promise.resolve({ data: [{ batch_id: 3137 }, { batch_id: 3138 }] })
            case `http://${ip}/api/get-sensors/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/log-batch-interaction/`:
            case `http://${ip}/api/update-batch-technician/`:
                return Promise.resolve({ data: {} })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
})

function renderResults(sharedState = {}) {
    const state = {
        searchSelection: { key: 'batch_id', value: 3137 }, setPopupMessage: jest.fn(), setBatchNumber: jest.fn(),
        technicianId: 1, setProcedureId: jest.fn(), setSensorList: jest.fn(),
        setOrderNumber: jest.fn(), setBatches: jest.fn(), setCustomerOrderNumber: jest.fn(),
        ...sharedState
    }
    render(
        <AppWrapper sharedState={state}>
            <SearchResults />
        </AppWrapper>
    )
    return state
}

test('batch with no sensors still shows in results', async () => {
    await act(async () => {
        renderResults()
    })
    expect(screen.getByText('Batch 3137')).toBeInTheDocument()
    expect(screen.queryByText(/sensor null/i)).not.toBeInTheDocument()
})

test('batch without a location on an unshipped order is not labeled shipped', async () => {
    emptyBatchRows[0].current_location = null
    await act(async () => {
        renderResults()
    })
    emptyBatchRows[0].current_location = 'R-1'
    expect(screen.getByText('No location set')).toBeInTheDocument()
    expect(screen.queryByText('SHIPPED')).not.toBeInTheDocument()
})

test('opening a batch sets the order number and goes to ManageBatch', async () => {
    let state;
    await act(async () => {
        state = renderResults()
    })
    await act(async () => {
        fireEvent.click(screen.getByText('Batch 3137'))
    })
    expect(state.setCustomerOrderNumber).toBeCalledWith('TEST-1')
    expect(state.setProcedureId).toBeCalledWith(4)
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/update-batch-technician/`, expect.objectContaining({
        params: { department: 'testing', technician_id: 1, batch_id: 3137 }
    }))
    expect(mockedUseNavigate).toBeCalledWith('/manageBatch')
})

test('opening a batch that no longer exists shows a popup', async () => {
    batchById = null
    let state;
    await act(async () => {
        state = renderResults()
    })
    await act(async () => {
        fireEvent.click(screen.getByText('Batch 3137'))
    })
    expect(state.setPopupMessage).toBeCalledWith('Batch 3137 not found')
    expect(mockedUseNavigate).not.toBeCalledWith('/manageBatch')
})

test('opening an order logs shipping start for each batch and goes to Shipping', async () => {
    await act(async () => {
        renderResults()
    })
    await act(async () => {
        fireEvent.click(screen.getByText('Order 1861'))
    })
    for (const batchId of [3137, 3138]) {
        expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/log-batch-interaction/`, expect.objectContaining({
            params: { department: 'shipping', start: true, technician_id: 1, batch_id: batchId }
        }))
    }
    expect(mockedUseNavigate).toBeCalledWith('/shipping')
})
