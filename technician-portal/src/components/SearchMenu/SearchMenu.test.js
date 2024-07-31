/* eslint-disable testing-library/no-unnecessary-act */
import { render, screen, fireEvent, act } from '@testing-library/react';
import SearchMenu from './SearchMenu';
import mockSearch from '../../utils/search';
import { AppWrapper } from '../../contexts/app';

jest.mock('../../utils/search')

const mockData = {
    "order_id": 350,
    "received_timestamp": "2024-04-15T21:30:40.444Z",
    "customer_order_number": "TO4519",
    "customer_id": 1,
    "active": false,
    "shipped": true,
    "shipped_timestamp": "2024-07-17T02:52:25.872Z",
    "courier": "N/A",
    "batch_id": 593,
    "current_location": null,
    "calibration_procedure_id": 1,
    "receiving_technician_id": 2,
    "testing_technician_id": 2,
    "shipping_technician_id": 2,
    "sensor_id": 637269,
    "check_digit": "IMCUEI",
    "manufacturer": "Monnit Corporation",
    "sku": "MNS2-9-W2-TS-ST-L03",
    "certificate_id": 4156,
    "timestamp": "2024-04-15T22:53:37.375Z",
    "template": "temperatureCertificate.pdf",
    "calibration_procedure": "Monnit Standard Temperature Calibration, 3-Set Points, Leaded, Submersible",
    "log_id": 447,
    "generate_certificate_json": {
        "CS5": "PASS"
    },
    "receiving_start": "2024-04-15T21:30:43.396Z",
    "receiving_end": "2024-04-15T21:34:17.484Z",
    "testing_start": "2024-04-15T21:45:51.409Z",
    "testing_end": "2024-04-16T04:52:33.909Z",
    "shipping_start": "2024-04-16T04:53:35.891Z",
    "shipping_end": "2024-04-16T04:55:52.180Z",
    "receiving_start_technician_id": 2,
    "receiving_end_technician_id": 2,
    "testing_start_technician_id": 2,
    "testing_end_technician_id": 2,
    "shipping_start_technician_id": 2,
    "shipping_end_technician_id": 2
}

beforeEach(() => {
    jest.clearAllMocks()
    
    mockSearch.mockReturnValue([mockData]);
})

test('SearchMenu renders successfully with search', () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
            <SearchMenu />
        </AppWrapper>
    )
    const submitButton = screen.getByText(/Submit/i)
    expect(submitButton).toBeInTheDocument()
})

test('SearchMenu renders successfully with data', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
            <SearchMenu />
        </AppWrapper>
    )

    const searchBar = screen.getByPlaceholderText(/Search/i)
    expect(searchBar).toBeInTheDocument()
    fireEvent.change(searchBar, { target: { value: 637269 } })
    expect(searchBar).toHaveValue('637269')
    const form = screen.getByTestId('searchForm')
    await act(async () => {
        fireEvent.submit(form)
    })
    const sensorId = screen.getByText(/637269/)
    expect(sensorId).toBeInTheDocument()
    const batchId = screen.getByText(/593/)
    expect(batchId).toBeInTheDocument()
})
