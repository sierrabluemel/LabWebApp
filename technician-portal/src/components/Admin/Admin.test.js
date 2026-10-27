/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import Admin from './Admin';
import { AppWrapper } from '../../contexts/app';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';

// the shared fixture predates the prt/rotronic/bath types the variance forms need
const equipment = [
    ...require('../../utils/equipment.test.json'),
    { asset_tag: 'T000001', type: 'prt', active: true },
    { asset_tag: 'T000002', type: 'rotronic', active: true },
    { asset_tag: 'T000003', type: 'bath', active: true }
]

jest.mock('axios')


beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/set-generator/`:
                return Promise.resolve({ data: {} })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: equipment })
            case `http://${ip}/api/get-technicians/`:
            case `http://${ip}/api/get-variances/`:
            case `http://${ip}/api/get-humidity-variances/`:
                return Promise.resolve({ data: [] })
            default:
                return Promise.reject({ response: { status: 500 } })
        }
    });
})

test('Admin menu renders successfully', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn(), equipmentList: equipment }}>
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
            <AppWrapper sharedState={{ setPopupMessage: jest.fn(), equipmentList: equipment }}>
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

test('Switching tabs shows only that section', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn(), equipmentList: equipment }}>
                <Admin />
            </AppWrapper>
        )
    })
    expect(screen.getByRole('heading', { name: /create notification/i, hidden: true })).toBeVisible();
    expect(screen.getByText(/equipment configuration/i)).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Equipment' }));

    expect(screen.getByText(/equipment configuration/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: /create notification/i, hidden: true })).not.toBeVisible();
})
