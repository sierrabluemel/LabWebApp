/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import StabilityTimes from './StabilityTimes';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';
import procedures from '../ManageBatch/calibration_procedures.test.json';

jest.mock('axios')
jest.spyOn(global.console, 'error').mockImplementation(() => { });

let sharedState;

beforeEach(() => {
    jest.clearAllMocks()
    sharedState = { setPopupMessage: jest.fn() }

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-calibration-procedures/`:
                return Promise.resolve({ data: procedures })
            case `http://${ip}/api/update-set-point-minutes/`:
                return Promise.resolve({ data: [{ calibration_procedure_id: 1 }] })
            default:
                return Promise.reject({ response: { status: 500 } });
        }
    });
})

const renderAndLoad = async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={sharedState}>
                <StabilityTimes />
            </AppWrapper>
        )
    })
}

test('shows stored minutes and the 1.5 default', async () => {
    await renderAndLoad()
    expect(screen.getByLabelText('CP1 28.00°C minutes')).toHaveValue(3)
    expect(screen.getByLabelText('CP3 40.00°C / 20.00%RH minutes')).toHaveValue(1.5)
    expect(screen.getByLabelText('CP1 -999.00°C minutes')).toHaveValue(1.5)
})

test('changing a value saves it by procedure and index', async () => {
    await renderAndLoad()
    const input = screen.getByLabelText('CP1 -25.00°C minutes')
    fireEvent.change(input, { target: { value: '6' } })
    await act(async () => {
        fireEvent.blur(input)
    })
    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/update-set-point-minutes/`, expect.objectContaining({ params: { calibration_procedure_id: 1, set_point_index: 2, minutes: 6 } }))
})

test('rejects a non-positive value without calling the api', async () => {
    await renderAndLoad()
    const input = screen.getByLabelText('CP1 -25.00°C minutes')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    expect(sharedState.setPopupMessage).toBeCalledWith('Minutes must be a number greater than 0')
    expect(mockAxios.get).not.toBeCalledWith(`http://${ip}/api/update-set-point-minutes/`, expect.anything())
})
