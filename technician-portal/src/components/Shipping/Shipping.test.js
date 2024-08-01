/* eslint-disable testing-library/no-unnecessary-act */
import { render, screen, act, fireEvent } from '@testing-library/react';
import Shipping from './Shipping';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { AppWrapper } from '../../contexts/app';

const mockedUseNavigate = jest.fn()

jest.mock('axios')
jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => mockedUseNavigate,
}))

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-certificates-by-order-id/`:
                return Promise.resolve({ data: [{ certificate_id: 1, generate_certificate_json: { CS1: '1/1/1970', CS2: '1/1/1970' } }] })
            case `http://${ip}/api/get-order-by-id/`:
                return Promise.resolve({ data: { order_id: 1, customer_id: 1 } })
            case `http://${ip}/api/get-sensors-by-order-id/`:
                return Promise.resolve({ data: [{ sensor_id: 1 }] })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: [{ equipment_id: 1 }] })
            case `http://${ip}/api/get-customer-by-id/`:
                return Promise.resolve({ data: { customer_id: 1 } })
            case `http://${ip}/api/get-batch-by-id/`:
                return Promise.resolve({ data: { batch_id: 1 } })
            case `http://${ip}/api/get-readings-by-sensor-id/`:
                return Promise.resolve({ data: [{ reading_id: 1, timestamp: "2023-05-31T06:00:00.000Z" }] })
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

for (let i = 1; i <= 5; i++) {
    test(`calibration procedure ${i} gets triggered`, async () => {
        await act(async () => {

            mockAxios.get.mockImplementation(url => {
                switch (url) {
                    case `http://${ip}/api/get-certificates-by-order-id/`:
                        return Promise.resolve({ data: [{ certificate_id: 1 }] })
                    case `http://${ip}/api/get-order-by-id/`:
                        return Promise.resolve({ data: { order_id: 1, customer_id: 1 } })
                    case `http://${ip}/api/get-sensors-by-order-id/`:
                        return Promise.resolve({ data: [{ sensor_id: 1 }] })
                    case `http://${ip}/api/get-equipment/`:
                        return Promise.resolve({
                            data: [
                                {
                                    "equipment_id": 19,
                                    "asset_tag": "S000119",
                                    "description": "Rotronic HygroClip2 Humidity Reference",
                                    "last_calibration": "2023-01-11T07:00:00.000Z",
                                    "next_calibration": "2024-02-10T07:00:00.000Z",
                                    "calibration_certificate_number": "99-0494160502",
                                    "type": "Reference",
                                    "serial_number": "20657711"
                                },
                                {
                                    "equipment_id": 5,
                                    "asset_tag": "S000105",
                                    "description": "Rotronic HygroClip2 Humidity Reference",
                                    "last_calibration": "2023-01-11T07:00:00.000Z",
                                    "next_calibration": "2024-02-10T07:00:00.000Z",
                                    "calibration_certificate_number": "99-0494160502",
                                    "type": "Reference",
                                    "serial_number": "20657711"
                                },
                                {
                                    "equipment_id": 14,
                                    "asset_tag": "S000114",
                                    "description": "Rotronic HygroClip2 Humidity Reference",
                                    "last_calibration": "2023-01-11T07:00:00.000Z",
                                    "next_calibration": "2024-02-10T07:00:00.000Z",
                                    "calibration_certificate_number": "99-0494160502",
                                    "type": "Reference",
                                    "serial_number": "20657711"
                                },
                                {
                                    "equipment_id": 16,
                                    "asset_tag": "S000116",
                                    "description": "Rotronic HygroClip2 Humidity Reference",
                                    "last_calibration": "2023-01-11T07:00:00.000Z",
                                    "next_calibration": "2024-02-10T07:00:00.000Z",
                                    "calibration_certificate_number": "99-0494160502",
                                    "type": "Reference",
                                    "serial_number": "20657711"
                                },
                                {
                                    "equipment_id": 28,
                                    "asset_tag": "S000128",
                                    "description": "Rotronic HygroClip2 Humidity Reference",
                                    "last_calibration": "2023-01-11T07:00:00.000Z",
                                    "next_calibration": "2024-02-10T07:00:00.000Z",
                                    "calibration_certificate_number": "99-0494160502",
                                    "type": "Reference",
                                    "serial_number": "20657711"
                                },
                                {
                                    "equipment_id": 34,
                                    "asset_tag": "S000134",
                                    "description": "Rotronic HygroClip2 Humidity Reference",
                                    "last_calibration": "2023-01-11T07:00:00.000Z",
                                    "next_calibration": "2024-02-10T07:00:00.000Z",
                                    "calibration_certificate_number": "99-0494160502",
                                    "type": "Reference",
                                    "serial_number": "20657711"
                                },
                            ]
                        })
                    case `http://${ip}/api/get-customer-by-id/`:
                        return Promise.resolve({ data: { customer_id: 1 } })
                    case `http://${ip}/api/get-batch-by-id/`:
                        return Promise.resolve({ data: { batch_id: 1, calibration_procedure_id: i } })
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
        const orderLabel = screen.getByText(RegExp(`Order: ${i}`))
        await act(async () => {
            fireEvent.click(generateCertificatesButton)
        })
        expect(mockAxios.get).toBeCalledWith('http://127.0.0.1:8000/api/create-certificate/', expect.anything())
        expect(orderLabel).toBeInTheDocument()
    })
}