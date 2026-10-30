import { fireEvent, render, screen } from '@testing-library/react';
import ErrorMessage from './ErrorMessage';
import { AppWrapper } from '../../contexts/app';

window.scroll = jest.fn()

test('ErrorMessage renders successfully', () => {
    const mockSetPopupMessage = jest.fn()
    render(
        <AppWrapper sharedState={{ popupMessage: 'test', setPopupMessage: mockSetPopupMessage }}>
            <ErrorMessage />
        </AppWrapper>
    )

    const messageText = screen.getByText('test')
    const closeButton = screen.getByText(/close/i)
    expect(messageText).toBeInTheDocument()
    expect(closeButton).toBeInTheDocument()
    fireEvent.click(closeButton)
    expect(mockSetPopupMessage).toBeCalledWith('')
})
test.each([
    ['Could not remove batch 3171', true],
    ['The batch was not moved successfully', true],
    ['Bin "X1" must look like B-Y21', true],
    ['Sensor 123 removed from batch 3171', false],
    ['Order 7 no longer expedited', false],
])('"%s" gets a red header: %s', (message, red) => {
    render(
        <AppWrapper sharedState={{ popupMessage: message, setPopupMessage: jest.fn() }}>
            <ErrorMessage />
        </AppWrapper>
    )
    expect(screen.getByText(message).className.includes('popup_header_error')).toBe(red)
})

test('an explicit error flag overrides the wording', () => {
    render(
        <AppWrapper sharedState={{ popupMessage: { message: 'Equipment out of calibration', details: 'A1 (bath) is out of calibration as of 1/2/2026', error: true }, setPopupMessage: jest.fn() }}>
            <ErrorMessage />
        </AppWrapper>
    )
    expect(screen.getByRole('heading').className.includes('popup_header_error')).toBe(true)
})

test('details go in the body under the header', () => {
    render(
        <AppWrapper sharedState={{ popupMessage: { message: 'Batch 3 removed', details: 'Order 7 was removed with it' }, setPopupMessage: jest.fn() }}>
            <ErrorMessage />
        </AppWrapper>
    )
    expect(screen.getByRole('heading')).toHaveTextContent('Batch 3 removed')
    expect(screen.getByText('Order 7 was removed with it')).toBeInTheDocument()
})

test('a message with an action shows its button, which closes the popup and runs it', () => {
    const setPopupMessage = jest.fn()
    const onClick = jest.fn()
    render(
        <AppWrapper sharedState={{ popupMessage: { message: 'Could not remove batch 3', action: { label: 'Delete anyway', onClick } }, setPopupMessage }}>
            <ErrorMessage />
        </AppWrapper>
    )
    expect(screen.getByText('Could not remove batch 3').className.includes('popup_header_error')).toBe(true)
    fireEvent.click(screen.getByText('Delete anyway'))
    expect(setPopupMessage).toBeCalledWith('')
    expect(onClick).toBeCalled()
})
