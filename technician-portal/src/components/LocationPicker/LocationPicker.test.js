/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/no-node-access */
import { fireEvent, render, screen, act } from '@testing-library/react';
import LocationPicker from './LocationPicker';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

const api = (endPoint) => `http://${ip}/api/${endPoint}/`
const moved = (location) =>
    expect(mockAxios.get).toBeCalledWith(api('create-location-log'), expect.objectContaining({ params: { location, batch_id: 3000 } }))

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case api('get-locations'):
                return Promise.resolve({ data: ['R-A1', 'T-AMB', 'T-B1', 'T-B2', 'T-C1', 'T-STD'] })
            case api('create-location-log'):
            case api('log-batch-interaction'):
            case api('set-batch-active-state'):
            case api('move-batch-to-network-group'):
            case api('change-batch-heartbeats'):
                return Promise.resolve({ data: {} })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
})

let setPopupMessage

const renderPicker = async () => {
    setPopupMessage = jest.fn()
    const onMoved = jest.fn()
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage, technicianId: 1 }} >
                <LocationPicker batchNumber={3000} onMoved={onMoved} />
            </AppWrapper>
        )
    })
    return onMoved
}

const openGrid = () => fireEvent.click(screen.getByLabelText('Location'))

test('grid is closed until the box is clicked, then lists bins by stage', async () => {
    await renderPicker()
    expect(screen.queryByRole('button', { name: 'R-A1' })).not.toBeInTheDocument()
    openGrid()
    const stageOf = (location) => screen.getByRole('button', { name: location }).parentElement.parentElement.previousSibling.textContent
    expect(stageOf('R-A1')).toBe('Receiving')
    expect(stageOf('T-AMB')).toBe('Testing')
    expect(screen.getByRole('button', { name: 'T-B2' })).toHaveTextContent(/^B2$/)
})

test('each shelf row gets its own line, named spots go last', async () => {
    await renderPicker()
    openGrid()
    const lineOf = (location) => [...screen.getByRole('button', { name: location }).parentElement.children].map(b => b.getAttribute('aria-label'))
    expect(lineOf('T-B1')).toEqual(['T-B1', 'T-B2'])
    expect(lineOf('T-C1')).toEqual(['T-C1'])
    expect(lineOf('T-AMB')).toEqual(['T-AMB', 'T-STD'])
    const testingLines = [...screen.getByRole('button', { name: 'T-B1' }).parentElement.parentElement.children]
    expect(testingLines.map(line => line.firstChild.getAttribute('aria-label'))).toEqual(['T-B1', 'T-C1', 'T-AMB'])
})

test('clicking a bin closes the grid and moves the batch right away', async () => {
    const onMoved = await renderPicker()
    openGrid()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'T-B2' })) })
    expect(screen.queryByRole('button', { name: 'R-A1' })).not.toBeInTheDocument()
    moved('T-B2')
    expect(onMoved).toBeCalledWith('T-B2')
    expect(screen.getByLabelText('Location')).toHaveTextContent('Move to location...')
})

test('Enter on the box with nothing picked does not move', async () => {
    await renderPicker()
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Location'), { key: 'Enter' }) })
    expect(mockAxios.get).not.toBeCalledWith(api('create-location-log'), expect.anything())
})

test('clicking outside closes the grid', async () => {
    await renderPicker()
    openGrid()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('button', { name: 'R-A1' })).not.toBeInTheDocument()
})

test('a new location can be typed and is added to the grid', async () => {
    const onMoved = await renderPicker()
    openGrid()
    fireEvent.click(screen.getByText('New location...'))
    const box = screen.getByPlaceholderText(/new location/i)
    fireEvent.change(box, { target: { value: 's-c3' } })
    await act(async () => { fireEvent.submit(screen.getByTestId('locationForm')) })
    moved('S-C3')
    expect(onMoved).toBeCalledWith('S-C3')
    expect(screen.queryByPlaceholderText(/new location/i)).not.toBeInTheDocument()
    openGrid()
    expect(screen.getByRole('button', { name: 'S-C3' })).toBeInTheDocument()
})

test('a failing step after the location is recorded says which step failed and still shows the new location', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation(url => url === api('change-batch-heartbeats')
        ? Promise.reject({ response: { status: 500, data: { Result: 'Unable to change heartbeats' } } })
        : defaultGet(url))
    const onMoved = await renderPicker()
    openGrid()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'T-B2' })) })
    expect(setPopupMessage).toHaveBeenLastCalledWith('Batch 3000 was moved to T-B2 but could not change its heartbeats: Unable to change heartbeats')
    expect(onMoved).toBeCalledWith('T-B2')
})

test('a failing first step says the batch was not moved', async () => {
    const defaultGet = mockAxios.get.getMockImplementation()
    mockAxios.get.mockImplementation(url => url === api('create-location-log')
        ? Promise.reject({ response: { status: 500, data: { error: 'Unable to create location log' } } })
        : defaultGet(url))
    const onMoved = await renderPicker()
    openGrid()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'T-B2' })) })
    expect(setPopupMessage).toHaveBeenLastCalledWith('Could not move batch 3000 to T-B2: Unable to create location log')
    expect(onMoved).not.toBeCalled()
})
