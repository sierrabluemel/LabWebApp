/* eslint-disable testing-library/no-unnecessary-act */
import { render, screen, act, fireEvent } from '@testing-library/react';
import Shipping from './Shipping';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { AppWrapper } from '../../contexts/app';

const equipment = require('../../utils/equipment.test.json')

const mockedUseNavigate = jest.fn()

jest.mock('axios')
jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
}))

beforeEach(() => {
    jest.clearAllMocks();

    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            headers: {
                get: () => 'application/json; charset=utf-8',
            },
            blob: () => Promise.resolve(new Blob()),
        })
    );

    global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/some-blob-url');

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-certificates-by-order-id/`:
                return Promise.resolve({ data: [{ certificate_id: 1, generate_certificate_json: { CS1: '1/1/1970', CS2: '1/1/1970' } }] })
            case `http://${ip}/api/get-order-by-id/`:
                return Promise.resolve({ data: { order_id: 1, customer_id: 1 } })
            case `http://${ip}/api/get-sensors-by-order-id/`:
                return Promise.resolve({ data: [{ sensor_id: 1 }] })
            case `http://${ip}/api/get-customer-by-id/`:
                return Promise.resolve({ data: { customer_id: 1 } })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: equipment })
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: { batch_id: 1, calibration_procedure_id: 1 } })
            case `http://${ip}/api/get-readings-by-sensor-id/`:
                return Promise.resolve({
                    data: [
                        {
                            reading_id: 1,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '-999.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 2,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '28.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 3,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '-25.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 4,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '90.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 15,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '0.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 5,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '-80.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 6,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '-197.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 7,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '20.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 8,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '60.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 9,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '-20.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 10,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '30.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 11,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '40.00',
                            type: 'temperature',
                            reference_id: 19
                        },
                        {
                            reading_id: 12,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '20.00',
                            type: 'humidity',
                            reference_id: 19
                        },
                        {
                            reading_id: 13,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '50.00',
                            type: 'humidity',
                            reference_id: 19
                        },
                        {
                            reading_id: 14,
                            timestamp: "2023-05-31T06:00:00.000Z",
                            set_point: '80.00',
                            type: 'humidity',
                            reference_id: 19
                        },
                    ]
                })
            default:
                return Promise.reject();
        }
    });
})

test('Shipping renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                setConfirmationMessage: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(),
                orderNumber: 1, batches: [], setBatches: jest.fn()
            }}>
                <Shipping />
            </AppWrapper>
        )
    })
    const orderLabel = screen.getByText(/order: 1 \|/i)
    expect(orderLabel).toBeInTheDocument()
})

test('generating certificates doesn\'t generate errors', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                setConfirmationMessage: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(),
                orderNumber: 1, batches: [{ batch_id: 1 }], setBatches: jest.fn()
            }}>
                <Shipping />
            </AppWrapper>
        )
    })
    const generateCertificatesButton = screen.getByText(/create certificates/i)
    await act(async () => {
        fireEvent.click(generateCertificatesButton)
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/update-batch-technician/`, { "params": { "batch_id": 1, "department": "shipping", "technician_id": 1 } })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/set-batch-active-state/`, { "params": { "batch_id": 1, "active_state": false } })
})

for (let i = 1; i <= 6; i++) {
    test(`calibration procedure ${i} gets triggered`, async () => {
        await act(async () => {
            render(
                <AppWrapper sharedState={{
                    setConfirmationMessage: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(),
                    orderNumber: i, batches: [], setBatches: jest.fn()
                }}>
                    <Shipping />
                </AppWrapper>
            )
        })
        const generateCertificatesButton = screen.getByText(/create certificates/i)
        expect(generateCertificatesButton).toBeInTheDocument()
        const orderLabel = screen.getByText(RegExp(`Order: ${i}`))
        expect(orderLabel).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(generateCertificatesButton)
        })
        expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-certificate/', expect.anything())
    })
}

test('confirming references makes correct api calls', async () => {
    const batches = [
        {
            batch_id: 1,
            calibration_procedure_id: 2
        }
    ]
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                setConfirmationMessage: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(),
                orderNumber: 2, batches: batches, setBatches: jest.fn()
            }}>
                <Shipping />
            </AppWrapper>
        )
    })

    const confirmationButton = screen.getByText(/confirm/i);
    expect(confirmationButton).toBeInTheDocument();
    await act(async () => {
        fireEvent.click(confirmationButton)
    })
    expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/verify-equipment-in-shipping/', expect.anything())
})

test('downloading return record calls api', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                setConfirmationMessage: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(),
                orderNumber: 2, batches: [], setBatches: jest.fn()
            }}>
                <Shipping />
            </AppWrapper>
        )
    })

    const downloadReturnRecordButton = screen.getByText(/download return record/i)
    expect(downloadReturnRecordButton).toBeInTheDocument();
    await act(async () => {
        fireEvent.click(downloadReturnRecordButton)
    })
    expect(fetch).toBeCalledWith('https://127.0.0.1:8000/api/generate-return-record/?order_id=2')
})

test('downloading certificates calls api', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{
                setConfirmationMessage: jest.fn(), technicianId: 1, setPopupMessage: jest.fn(),
                orderNumber: 2, batches: [], setBatches: jest.fn()
            }}>
                <Shipping />
            </AppWrapper>
        )
    })

    const downloadCertificatesButton = screen.getByText(/download certificates/i)
    expect(downloadCertificatesButton).toBeInTheDocument();
    await act(async () => {
        fireEvent.click(downloadCertificatesButton)
    })
    expect(fetch).toBeCalledWith('https://127.0.0.1:8000/api/generate-order-certificates?order_id=2')
})