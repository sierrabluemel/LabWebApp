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
                return Promise.resolve({ data: [] })
            default:
                return Promise.reject();
        }
    });
})

test('Receiving renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                salesOrder: 1, technicianId: 1, setConfirmationMessage: jest.fn(),
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
                salesOrder: 1, technicianId: 1, setConfirmationMessage: jest.fn(),
                setPopupMessage: jest.fn(), order: null
            }}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    const loading = screen.getByText(/loading.../i)
    expect(loading).toBeInTheDocument()
})

test('submitting order creates log', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                salesOrder: 1, technicianId: 1, setConfirmationMessage: jest.fn(),
                setPopupMessage: jest.fn(), order: 1
            }}>
                <SalesOrderForm />
            </AppWrapper>
        )
    })
    const submitButton = screen.getByText(/complete sales order/i)
    await act(async () => {
        fireEvent.click(submitButton)
    })
    expect(mockedUseNavigate).toBeCalledWith('/confirmation')
})