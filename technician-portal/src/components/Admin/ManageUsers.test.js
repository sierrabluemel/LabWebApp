/* eslint-disable testing-library/no-unnecessary-act */
import { fireEvent, render, screen } from '@testing-library/react';
import ManageUsers from './ManageUsers';
import { AppWrapper } from '../../contexts/app';
import ip from '../../utils/ip/ip';
import mockAxios from 'axios';
import { act } from 'react-dom/test-utils';

jest.mock('axios')

let sharedState;

beforeEach(() => {
    jest.clearAllMocks()
    sharedState = { setPopupMessage: jest.fn() }
    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-technicians/`:
                return Promise.resolve({ data: [{ user_id: 7, first_name: 'Ada', last_name: 'Lovelace' }] })
            default:
                return Promise.reject({ response: { status: 500 } });
        }
    });
})

const renderAndLoad = async () => {
    await act(async () => {
        render(<AppWrapper sharedState={sharedState}><ManageUsers /></AppWrapper>)
    })
}

const fillCreateForm = () => {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Hopper' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'grace@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
}

test('Creating a technician posts the form and clears it', async () => {
    mockAxios.post.mockResolvedValue({ data: { technician_id: 1 } });
    await renderAndLoad();
    fillCreateForm();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create Technician' })) });

    expect(mockAxios.post).toBeCalledWith(`http://${ip}/api/create-technician/`,
        { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', password: 'hunter2', admin: false }, expect.anything());
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(sharedState.setPopupMessage).toBeCalledWith('Technician created');
})

test('Duplicate email shows the server error', async () => {
    mockAxios.post.mockRejectedValue({ response: { status: 409, data: { error: 'User with that email already exists' } } });
    await renderAndLoad();
    fillCreateForm();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create Technician' })) });

    expect(sharedState.setPopupMessage).toBeCalledWith('User with that email already exists');
    expect(screen.getByLabelText('Email')).toHaveValue('grace@example.com');
})

test('Setting a password needs a technician selected', async () => {
    await renderAndLoad();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Set Password' })) });
    expect(mockAxios.post).not.toBeCalled();
    expect(sharedState.setPopupMessage).toBeCalledWith('Select a technician first');
})
