/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import Receiving from './Receiving';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

const mockedUseNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
    useLocation: () => ({ state: null }),
}))

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/create-order/`:
                return Promise.resolve({ data: { order_id: 1, customer_order_number: 'test' } })
            default:
                return Promise.reject({ response: { status: 500 } });
        }
    });
})

const renderReceiving = (salesOrder, overrides = {}) => {
    const sharedState = {
        salesOrder, setSalesOrder: jest.fn(), setOrder: jest.fn(),
        expedited: false, setExpedited: jest.fn(), setPopupMessage: jest.fn(),
        ...overrides
    }
    render(
        <AppWrapper sharedState={sharedState}>
            <Receiving />
        </AppWrapper>
    )
    return sharedState
}

const submit = async () => {
    await act(async () => {
        fireEvent.click(screen.getByText(/create order/i))
    })
}

test('Receiving renders successfully', () => {
    renderReceiving('SO1')
    expect(screen.getByText(/create order/i)).toBeInTheDocument()
})

test('submitting a sales order creates the order and navigates', async () => {
    const state = renderReceiving('SO1')
    await submit()
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/create-order/`, expect.objectContaining({ params: { customer_id: 1, customer_order_number: 'SO1', expedited: false } }))
    expect(state.setOrder).toBeCalledWith(1)
    expect(mockedUseNavigate).toBeCalledWith('/createSalesOrder')
})

test('empty sales order shows popup and does not call api', async () => {
    const state = renderReceiving('   ')
    await submit()
    expect(state.setPopupMessage).toBeCalledWith('Enter a sales order')
    expect(mockAxios.get).not.toBeCalled()
    expect(mockedUseNavigate).not.toBeCalled()
})

test('failed order creation shows popup', async () => {
    mockAxios.get.mockImplementation(() => Promise.reject({ response: { status: 500 } }))
    const state = renderReceiving('SO1')
    await submit()
    expect(state.setPopupMessage).toBeCalledWith('Could not create order SO1')
    expect(mockedUseNavigate).not.toBeCalled()
})
