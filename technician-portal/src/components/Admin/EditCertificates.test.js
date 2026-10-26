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
    { certificate_id: 1, batch_id: 10, calibration_procedure_id: 1, generate_certificate_json: { TechName: 'Ross', D2: 'Model: A' } },
    { certificate_id: 2, batch_id: 11, calibration_procedure_id: 3, generate_certificate_json: { TechName: 'Ross', D2: 'Model: B' } },
]

beforeEach(() => {
    jest.clearAllMocks()

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
