import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchBar from './SearchBar';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

jest.mock('react-router-dom', () => ({
    ...(jest.requireActual('react-router-dom')),
    useNavigate: () => jest.fn(),
}))

// One row per sensor like the real search-data join: order 1 / batch 1 holds sensors 100-115 and 201
const sensorRows = [...Array.from({ length: 16 }, (_, i) => 100 + i), 201].map(sensor_id => ({
    order_id: 1, customer_order_number: 'SO-A', batch_id: 1, sensor_id, cable_id: null,
}))
const searchData = [
    ...sensorRows,
    { order_id: 21, customer_order_number: 'SO-B', batch_id: null, sensor_id: null, cable_id: null },
    { order_id: 10, customer_order_number: 'SO-C', batch_id: null, sensor_id: null, cable_id: null },
    { order_id: 3, customer_order_number: 'SO-D', batch_id: null, sensor_id: null, cable_id: null },
]

beforeEach(() => {
    jest.clearAllMocks()
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/search-data/`:
                return Promise.resolve({ data: searchData })
            default:
                return Promise.reject({ response: { status: 500 } });
        }
    });
})

const search = async (text) => {
    render(
        <AppWrapper sharedState={{ setSearchSelection: jest.fn() }}>
            <SearchBar />
        </AppWrapper>
    )
    await waitFor(() => expect(mockAxios.get).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: text } })
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0))
    return screen.getAllByRole('option').map(o => o.textContent)
}

test('one character ranks exact and prefix matches first and caps each group', async () => {
    const options = await search('1')
    expect(options).toEqual([
        '1', '10', '21',                 // orders: exact, prefix, contains; order 3 left out
        '1',                             // batch, once despite one row per sensor
        '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', // sensors capped at 10
    ])
    expect(screen.getByText('7 more, keep typing')).toBeInTheDocument()
    expect(screen.getAllByText(/more, keep typing/)).toHaveLength(1)
})

test('certificate ids get their own group', async () => {
    searchData.push({ order_id: 3, customer_order_number: 'SO-D', batch_id: 7, sensor_id: 300, cable_id: null, certificate_id: 98765 })
    expect(await search('9876')).toEqual(['98765'])
    expect(screen.getByText('Certificate ID')).toBeInTheDocument()
    searchData.pop()
})

test('lead ids are labeled Lead ID', async () => {
    searchData.push({ order_id: 3, customer_order_number: 'SO-D', batch_id: 7, sensor_id: 300, cable_id: 30412 })
    expect(await search('30412')).toEqual(['30412'])
    expect(screen.getByText('Lead ID')).toBeInTheDocument()
    searchData.pop()
})

test('multiple words must all match', async () => {
    expect(await search('10 5')).toEqual(['105'])
})
