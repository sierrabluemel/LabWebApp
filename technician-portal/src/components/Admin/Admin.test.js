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
            <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
                <Admin />
            </AppWrapper>
        )
    })
    const equipmentConfig = screen.getByText(/equipment configuration/i);
    expect(equipmentConfig).toBeInTheDocument();
})

test('Changing references updates correctly', async () => {
    await act(async () => {
        render(
            <AppWrapper sharedState={{ setPopupMessage: jest.fn() }}>
                <Admin />
            </AppWrapper>
        )
    })
    const dropdown1 = screen.getByTestId('Bath 1');
    const dropdown2 = screen.getByTestId('superDaqDropdown');
    const saveButton = screen.getByText(/save/i);

    await act(async () => {
        fireEvent.change(dropdown1, { target: { value: 'S000115' } });
        fireEvent.change(dropdown2, { target: { value: 'S000120' } });
    });

    await act(async () => {
        fireEvent.click(saveButton);
    });
})