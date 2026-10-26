/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import SalesOrderForm from './SalesOrderForm';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';

jest.mock('../DropDown/DropDown.js', () => () => {
    return <mock-dropdown />
})

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
            case `http://${ip}/api/create-order/`:
                return Promise.resolve({ data: [{ order_id: 1, customer_order_number: 'test' }] })
            case `http://${ip}/api/get-active-sensors/`:
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: [] })
            case `http://${ip}/api/log-batch-interaction/`:
                return Promise.resolve({ data: {} })
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
    const submitButton = screen.getByText(/complete sales order/i)
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
        fireEvent.click(screen.getByText(/complete sales order/i))
    })
    return sharedState
}

test('completing order shows popup instead of navigating', async () => {
    await completeOrder()
    expect(screen.getByText(/order 1 \(SO1\) created/i)).toBeInTheDocument()
    expect(mockedUseNavigate).not.toBeCalled()
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

test('"Add another order" clears the order and focuses the new order box', async () => {
    const state = await completeOrder()
    await act(async () => {
        fireEvent.click(screen.getByText(/add another order/i))
    })
    expect(state.setOrder).toBeCalledWith(null)
    expect(state.setSalesOrder).toBeCalledWith('')
    expect(mockedUseNavigate).toBeCalledWith('/batchEntry', { state: { focusNewOrder: true } })
})