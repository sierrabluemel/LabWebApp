/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import OrderEntry from './OrderEntry';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';

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
            case `http://${ip}/api/get-orders-to-ship/`:
                return Promise.resolve({ data: [{ order_id: 1, customer_order_number: 'test', received_timestamp : "2024-08-27T20:11:22.132Z" }, { order_id: 2, customer_order_number: 'test', received_timestamp : "2024-08-27T20:11:22.132Z" }] })
            case `http://${ip}/api/get-batches-by-order-id/`:
                return Promise.resolve({ data: ['test', 'test'] })
            case `http://${ip}/api/get-order-by-id/`:
                return Promise.resolve({ data: { order_id: 1 } })
            default:
                return Promise.reject();
        }
    });
})

test('OrderEntry renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                orderNumber: 1, setOrderNumber: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), setBatches: jest.fn()
            }}>
                <OrderEntry />
            </AppWrapper>
        )
    })
    const submitButton = screen.getByText(/submit/i)
    expect(submitButton).toBeInTheDocument()
})

test('clicking order logs batch interaction and navigates', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                orderNumber: 1, setOrderNumber: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), setBatches: jest.fn()
            }}>
                <OrderEntry />
            </AppWrapper>
        )
    })
    const orderButton = screen.getByText(/order: 1/i)
    expect(orderButton).toBeInTheDocument()
    await act(async () => {
        fireEvent.click(orderButton)
    })
    expect(mockedUseNavigate).toBeCalledWith('/shipping')
})

test('clicking order without sign in stops', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                orderNumber: 1, setOrderNumber: jest.fn(),
                technicianId: null, setPopupMessage: jest.fn(), setBatches: jest.fn()
            }}>
                <OrderEntry />
            </AppWrapper>
        )
    })
    const orderButton = screen.getByText(/order: 1/i)
    expect(orderButton).toBeInTheDocument()
    await act(async () => {
        fireEvent.click(orderButton)
    })
    expect(mockedUseNavigate).toBeCalledTimes(0)
})

test('entering order in box navigates', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                orderNumber: 1, setOrderNumber: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), setBatches: jest.fn()
            }}>
                <OrderEntry />
            </AppWrapper>
        )
    })
    const orderBox = screen.getByPlaceholderText(/order number/i)
    const submitButton = screen.getByText(/submit/i)
    expect(orderBox).toBeInTheDocument()
    expect(submitButton).toBeInTheDocument()
    await act(async () => {
        fireEvent.change(orderBox, { target: { value: '1' } })
        fireEvent.click(submitButton)
    })
    expect(orderBox).toHaveValue('1');
    expect(mockedUseNavigate).toBeCalledWith('/shipping');
})

test('entering order in box without technician id stops', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                orderNumber: 1, setOrderNumber: jest.fn(),
                technicianId: null, setPopupMessage: jest.fn(), setBatches: jest.fn()
            }}>
                <OrderEntry />
            </AppWrapper>
        )
    })
    const orderBox = screen.getByPlaceholderText(/order number/i)
    const submitButton = screen.getByText(/submit/i)
    expect(orderBox).toBeInTheDocument()
    expect(submitButton).toBeInTheDocument()
    await act(async () => {
        fireEvent.change(orderBox, { target: { value: '1' } })
        fireEvent.click(submitButton)
    })
    expect(orderBox).toHaveValue('1');
    expect(mockedUseNavigate).toBeCalledTimes(0);
})

test('response without order_id gets detected', async () => {
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-orders-to-ship/`:
                return Promise.resolve({ data: [{ order_id: 1, customer_order_number: 'test', received_timestamp : "2024-08-27T20:11:22.132Z" }, { order_id: 2, customer_order_number: 'test', received_timestamp : "2024-08-27T20:11:22.132Z" }] })
            case `http://${ip}/api/get-order-by-id/`:
                return Promise.resolve({ data: { Result: 'Error' } })
            default:
                return Promise.reject();
        }
    });
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                orderNumber: 1, setOrderNumber: jest.fn(),
                technicianId: 1, setPopupMessage: jest.fn(), setBatches: jest.fn()
            }}>
                <OrderEntry />
            </AppWrapper>
        )
    })
    const orderBox = screen.getByPlaceholderText(/order number/i)
    const submitButton = screen.getByText(/submit/i)
    expect(orderBox).toBeInTheDocument()
    expect(submitButton).toBeInTheDocument()
    await act(async () => {
        fireEvent.change(orderBox, { target: { value: '1' } })
        fireEvent.click(submitButton)
    })
    expect(orderBox).toHaveValue('1');
    expect(mockedUseNavigate).toBeCalledTimes(0);
})