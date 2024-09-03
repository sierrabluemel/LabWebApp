/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import Admin from './Admin';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';

const equipment = require('../../utils/equipment.test.json')

jest.mock('axios')


beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/set-generator/`:
                return Promise.resolve()
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: equipment })
            default:
                return Promise.reject()
        }
    });
})

test('Admin menu renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn(), equipment: {current: equipment} }}>
                <Admin />
            </AppWrapper>
        )
    })
    const equipmentConfig = screen.getByText(/equipment configuration/i);
    expect(equipmentConfig).toBeInTheDocument();
})

test('Changing references with all correct data', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn(), equipment: {current: equipment} }}>
                <Admin />
            </AppWrapper>
        )
    })
    const dropdown = screen.getByTestId('Bath 1');
    const certificateNumberInput = screen.getByTestId('Bath 1certificateNumber');
    const calibrationDateInput = screen.getByTestId('Bath 1calibrationDate');
    const dueDateInput = screen.getByTestId('Bath 1dueDate');
    const saveButton = screen.getByText(/save/i);

    await act(async () => {
        fireEvent.change(dropdown, { target: { value: 'S000116' } });
        fireEvent.change(certificateNumberInput, { target: { value: '123456Test' } });
        fireEvent.change(calibrationDateInput, { target: { value: '09/03/2024' } });
        fireEvent.change(dueDateInput, { target: { value: '09/04/2025' } });
    });

    await act(async () => {
        fireEvent.click(saveButton);
    });

    const confirmationButton = screen.getByText(/confirm/i);

    await act(async () => {
        fireEvent.click(confirmationButton);
    });

    expect(mockAxios.get).toBeCalledWith(`http://${ip}/api/set-generator/`, expect.anything());

    expect(certificateNumberInput).toHaveValue('');
    expect(calibrationDateInput).toHaveValue('');
    expect(calibrationDateInput).toHaveValue('');
})