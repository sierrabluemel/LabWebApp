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

const order = { order_id: 1861, customer_order_number: 'TEST-1', received_timestamp: '2026-10-26T20:11:22.132Z', calibration_procedure_id: 4, current_location: 'R-1' }

// base fixture 600017 tested leads 30412 and 30415 in batch 3137; 30412 was also tested on another base in an older batch
const leadRows = [
    { ...order, batch_id: 3137, sensor_id: 600017, sensor_sku: 'MNS2-9-W2-TS-ST-BASE', lead_id: 30412, lead_sku: 'DL-ST-03', certificate_id: 9001, certificate_pass: true, certificate_timestamp: '2026-10-26T20:11:22.132Z' },
    { ...order, batch_id: 3137, sensor_id: 600017, sensor_sku: 'MNS2-9-W2-TS-ST-BASE', lead_id: 30415, lead_sku: 'DL-ST-03', certificate_id: 9002, certificate_pass: false, certificate_timestamp: '2026-10-26T20:11:22.132Z' },
    { ...order, order_id: 954, batch_id: 2001, sensor_id: 600003, sensor_sku: 'MNS2-9-W2-TS-ST-BASE', lead_id: 30412, lead_sku: 'DL-ST-03', certificate_id: 6610, certificate_pass: true, certificate_timestamp: '2025-10-01T20:11:22.132Z' },
]

// an order search returns one summary row per batch
const summaryRows = [
    { ...order, batch_id: 3137, sensor_count: 2, certificate_count: 2 },
    { ...order, batch_id: 3138, current_location: null, sensor_count: 0, certificate_count: 0 },
]

let searchRows;
let batchById;

beforeEach(() => {
    jest.clearAllMocks()
    searchRows = summaryRows
    batchById = { batch_id: 3137, customer_order_number: 'TEST-1', calibration_procedure_id: 4 }

    mockAxios.get.mockImplementation((url, config) => {
        switch (url) {
            case `http://${ip}/api/get-search-results/`:
                // expanding a batch re-searches by batch_id
                return Promise.resolve({ data: config.params.search_type === 'batch_id' ? leadRows.filter(r => r.batch_id === config.params.search_value) : searchRows })
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
        searchSelection: { key: 'order_id', value: 1861 }, setPopupMessage: jest.fn(), setBatchNumber: jest.fn(),
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

test('order search lists batch summaries, not every sensor', async () => {
    await act(async () => {
        renderResults()
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/get-search-results/`, expect.objectContaining({
        params: { search_type: 'order_id', search_value: 1861 }
    }))
    expect(screen.getByText('Batch 3137')).toBeInTheDocument()
    expect(screen.getByText('2 sensors · 2 certificates')).toBeInTheDocument()
    expect(screen.getByText('Batch 3138')).toBeInTheDocument()
    expect(screen.getByText('0 sensors · 0 certificates')).toBeInTheDocument()
    expect(screen.queryByText('30412')).not.toBeInTheDocument()
    expect(screen.getByText('No location')).toBeInTheDocument()
    expect(screen.queryByText('SHIPPED')).not.toBeInTheDocument()
})

test('expanding a batch swaps the summary for its leads and certificates, collapsing brings it back', async () => {
    await act(async () => {
        renderResults()
    })
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Show batch 3137' }))
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/get-search-results/`, expect.objectContaining({
        params: { search_type: 'batch_id', search_value: 3137 }
    }))
    expect(screen.queryByText('2 sensors · 2 certificates')).not.toBeInTheDocument()
    expect(screen.getByText('30412')).toBeInTheDocument()
    expect(screen.getByText('30415')).toBeInTheDocument()
    expect(screen.getByText('MNT-9001')).toBeInTheDocument()
    expect(screen.getByText('FAIL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show batch 3137' })).toHaveAttribute('aria-expanded', 'true')
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Show batch 3137' }))
    })
    expect(screen.getByText('2 sensors · 2 certificates')).toBeInTheDocument()
    expect(screen.queryByText('30412')).not.toBeInTheDocument()
    expect(mockAxios.get.mock.calls.filter(c => c[1].params.search_type === 'batch_id')).toHaveLength(1) // fetched once
})

test('lead search shows every certificate for that lead across bases and batches', async () => {
    searchRows = leadRows.filter(r => r.lead_id === 30412)
    await act(async () => {
        renderResults({ searchSelection: { key: 'cable_id', value: 30412 } })
    })
    expect(screen.getByText('Lead 30412')).toBeInTheDocument()
    expect(screen.getByText('MNT-9001')).toBeInTheDocument()
    expect(screen.getByText('MNT-6610')).toBeInTheDocument()
    expect(screen.queryByText('MNT-9002')).not.toBeInTheDocument()
    expect(screen.getByText('600017')).toBeInTheDocument()
    expect(screen.getByText('600003')).toBeInTheDocument()
    expect(screen.getAllByText('DL-ST-03')).toHaveLength(2) // the lead's SKU, not the base fixture's
    expect(screen.queryByText('MNS2-9-W2-TS-ST-BASE')).not.toBeInTheDocument()
})

test('certificate search shows only that certificate', async () => {
    searchRows = leadRows.filter(r => r.certificate_id === 9002)
    await act(async () => {
        renderResults({ searchSelection: { key: 'certificate_id', value: 9002 } })
    })
    expect(screen.getByText('MNT-9002')).toBeInTheDocument()
    expect(screen.queryByText('MNT-9001')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show batch 3137' })).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
})

test('admins get an Edit link that opens the certificate in the admin Certificates tab', async () => {
    searchRows = leadRows.filter(r => r.certificate_id === 9002)
    await act(async () => {
        renderResults({ searchSelection: { key: 'certificate_id', value: 9002 }, technician: { admin: true } })
    })
    fireEvent.click(screen.getByText('Edit'))
    expect(mockedUseNavigate).toHaveBeenCalledWith('/admin?tab=certificates&order_id=1861&certificate_id=9002')
})

test('sensor without a lead shows its own sku and no certificate', async () => {
    searchRows = [{ ...order, batch_id: 3137, sensor_id: 1393811, sensor_sku: 'MNS2-9-W2-TS-LT-L03', lead_id: null, lead_sku: null, certificate_id: null }]
    await act(async () => {
        renderResults({ searchSelection: { key: 'sensor_id', value: 1393811 } })
    })
    expect(screen.getByText('MNS2-9-W2-TS-LT-L03')).toBeInTheDocument()
    expect(screen.queryByText(/MNT-/)).not.toBeInTheDocument()
})

test('no results shows a popup', async () => {
    searchRows = []
    let state;
    await act(async () => {
        state = renderResults({ searchSelection: { key: 'certificate_id', value: 1 } })
    })
    expect(state.setPopupMessage).toBeCalledWith('No results found for 1')
    expect(screen.getByText('No results found.')).toBeInTheDocument()
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
    expect(mockedUseNavigate).toBeCalledWith(expect.stringContaining('/manageBatch'))
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
    expect(mockedUseNavigate).not.toBeCalledWith(expect.stringContaining('/manageBatch'))
})

test('opening an order logs shipping start for each batch and goes to Shipping', async () => {
    await act(async () => {
        renderResults()
    })
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Order 1861' }))
    })
    for (const batchId of [3137, 3138]) {
        expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/log-batch-interaction/`, expect.objectContaining({
            params: { department: 'shipping', start: true, technician_id: 1, batch_id: batchId }
        }))
    }
    expect(mockedUseNavigate).toBeCalledWith(expect.stringContaining('/shipping'))
})
