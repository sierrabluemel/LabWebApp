/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import EditCertificates from './EditCertificates';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

const certificates = [
    { certificate_id: 1, batch_id: 10, calibration_procedure_id: 1, sensor_id: 600001, cable_id: null, generate_certificate_json: { TechName: 'Ross', D2: 'Model: A' } },
    { certificate_id: 2, batch_id: 11, calibration_procedure_id: 3, sensor_id: 600002, cable_id: 30412, generate_certificate_json: { TechName: 'Ross', D2: 'Model: B' } },
]

beforeEach(() => {
    jest.clearAllMocks()
    window.history.pushState({}, '', '/admin')

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-certificates-by-order-id/`:
                return Promise.resolve({ data: certificates })
            case `http://${ip}/api/update-certificates-json/`:
                return Promise.resolve({ data: certificates })
            default:
                return Promise.reject({ response: { status: 500 } });
        }
    });
})

const renderAndLoad = async () => {
    const sharedState = { setPopupMessage: jest.fn() }
    render(
        <AppWrapper sharedState={sharedState}>
            <EditCertificates />
        </AppWrapper>
    )
    fireEvent.change(screen.getByLabelText('Order number'), { target: { value: '5' } })
    await act(async () => {
        fireEvent.click(screen.getByText('Load'))
    })
    return sharedState
}

test('loading an order shows shared values and marks differing ones', async () => {
    await renderAndLoad()
    expect(screen.getByLabelText('TechName')).toHaveValue('Ross')
    expect(screen.getByLabelText('D2')).toHaveValue('')
    expect(screen.getByLabelText('D2')).toHaveAttribute('placeholder', '(varies)')
    expect(screen.getByText('2 certificates')).toBeInTheDocument()
})

test('saving sends only changed fields for the selected batch', async () => {
    const state = await renderAndLoad()
    fireEvent.change(screen.getByLabelText('Batch'), { target: { value: '11' } })
    expect(screen.getByLabelText('D2')).toHaveValue('Model: B')
    fireEvent.change(screen.getByLabelText('TechName'), { target: { value: 'Jane' } })
    await act(async () => {
        fireEvent.click(screen.getByText('Save changes'))
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/update-certificates-json/`, expect.objectContaining({
        params: { order_id: '5', batch_id: '11', certificate_json: JSON.stringify({ TechName: 'Jane' }) }
    }))
    expect(state.setPopupMessage).toHaveBeenCalledWith('Updated 2 certificates')
})

test('picking one certificate edits only that one', async () => {
    const state = await renderAndLoad()
    fireEvent.change(screen.getByLabelText('Certificate'), { target: { value: '2' } })
    expect(screen.getByText('MNT-2 (lead 30412)')).toBeInTheDocument()
    expect(screen.getByText('1 certificate')).toBeInTheDocument()
    expect(screen.getByLabelText('D2')).toHaveValue('Model: B')
    fireEvent.change(screen.getByLabelText('D2'), { target: { value: 'Model: C' } })
    mockAxios.get.mockImplementation(url => Promise.resolve({ data: url.includes('update') ? [certificates[1]] : certificates }))
    await act(async () => {
        fireEvent.click(screen.getByText('Save changes'))
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/update-certificates-json/`, expect.objectContaining({
        params: { order_id: '5', certificate_id: '2', certificate_json: JSON.stringify({ D2: 'Model: C' }) }
    }))
    expect(state.setPopupMessage).toHaveBeenCalledWith('Updated 1 certificate')
    // the reload after saving stays on the edited certificate
    expect(screen.getByLabelText('Certificate')).toHaveValue('2')
    expect(screen.getByText('1 certificate')).toBeInTheDocument()
})

test('opening from a search link loads the order with that certificate selected', async () => {
    window.history.pushState({}, '', '/admin?tab=certificates&order_id=5&certificate_id=2')
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
                <EditCertificates />
            </AppWrapper>
        )
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/get-certificates-by-order-id/`, expect.objectContaining({ params: { order_id: '5' } }))
    expect(screen.getByLabelText('Batch')).toHaveValue('11')
    expect(screen.getByLabelText('Certificate')).toHaveValue('2')
    expect(screen.getByLabelText('D2')).toHaveValue('Model: B')
})

test('republish sends publish=true with no changes', async () => {
    const state = await renderAndLoad()
    await act(async () => {
        fireEvent.click(screen.getByText('Republish PDFs'))
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/update-certificates-json/`, expect.objectContaining({
        params: { order_id: '5', certificate_json: '{}', publish: 'true' }
    }))
    expect(state.setPopupMessage).toHaveBeenCalledWith('Republished 2 certificates')
})

test('a certificate with no order loads and saves by certificate number', async () => {
    const orphan = { ...certificates[1], certificate_id: 7, batch_id: null, calibration_procedure_id: undefined }
    mockAxios.get.mockImplementation(() => Promise.resolve({ data: [orphan] }))
    const state = { setPopupMessage: jest.fn() }
    render(
        <AppWrapper sharedState={state}>
            <EditCertificates />
        </AppWrapper>
    )
    fireEvent.change(screen.getByLabelText('Certificate number'), { target: { value: 'MNT-7' } })
    await act(async () => {
        fireEvent.click(screen.getByText('Load'))
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/get-certificates-by-order-id/`, expect.objectContaining({ params: { certificate_id: '7' } }))
    expect(screen.getByText('MNT-7 (lead 30412)')).toBeInTheDocument()
    expect(screen.getByLabelText('Batch').options).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('TechName'), { target: { value: 'Jane' } })
    await act(async () => {
        fireEvent.click(screen.getByText('Save changes'))
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/update-certificates-json/`, expect.objectContaining({
        params: { certificate_id: '7', certificate_json: JSON.stringify({ TechName: 'Jane' }) }
    }))
})

test('a search link with only a certificate id loads that certificate', async () => {
    window.history.pushState({}, '', '/admin?tab=certificates&certificate_id=2')
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
                <EditCertificates />
            </AppWrapper>
        )
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/get-certificates-by-order-id/`, expect.objectContaining({ params: { certificate_id: '2' } }))
    expect(screen.getByLabelText('Certificate')).toHaveValue('2')
})

test('a rejected save shows the backend error', async () => {
    mockAxios.get.mockImplementation(url => url === `http://${ip}/api/get-certificates-by-order-id/`
        ? Promise.resolve({ data: certificates })
        : Promise.reject({ response: { status: 403, data: { error: 'Admin access required' } } }))
    const state = await renderAndLoad()
    fireEvent.change(screen.getByLabelText('TechName'), { target: { value: 'Jane' } })
    await act(async () => {
        fireEvent.click(screen.getByText('Save changes'))
    })
    expect(state.setPopupMessage).toHaveBeenCalledWith('Admin access required')
})

test('pressing enter in the order number loads certificates', async () => {
    render(
        <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
            <EditCertificates />
        </AppWrapper>
    )
    const orderInput = screen.getByLabelText('Order number')
    fireEvent.change(orderInput, { target: { value: '5' } })
    await act(async () => {
        fireEvent.submit(orderInput.closest('form'))
    })
    expect(mockAxios.get).toHaveBeenCalledWith(`http://${ip}/api/get-certificates-by-order-id/`, expect.objectContaining({ params: { order_id: '5' } }))
    expect(screen.getByLabelText('TechName')).toHaveValue('Ross')
})

test('numbered fields share a row per certificate line', async () => {
    await renderAndLoad()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('TechName')).toBeInTheDocument()
})
