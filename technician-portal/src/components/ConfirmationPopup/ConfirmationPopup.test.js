import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmationPopup from "./ConfirmationPopup";

test('ConfirmationPopup renders successfully', () => {
    render(
        <ConfirmationPopup confirmationArray={['']} setConfirmationArray={jest.fn()} handleConfirm={jest.fn()} />
    )
    const dismissButton = screen.getByText(/dismiss/i);
    expect(dismissButton).toBeInTheDocument();
})

it('should call handleConfirm prop on confirm', () => {
    const mockHandleConfirm = jest.fn();
    render(
        <ConfirmationPopup confirmationArray={['']} setConfirmationArray={jest.fn()} handleConfirm={mockHandleConfirm} />
    )
    const confirmButton = screen.getByText(/confirm/i);
    fireEvent.click(confirmButton);
    expect(mockHandleConfirm).toHaveBeenCalled();
})

it('should call setConfirmationArray empty on dismiss', () => {
    const mockSetConfimrationArray = jest.fn();
    render(
        <ConfirmationPopup confirmationArray={['']} setConfirmationArray={mockSetConfimrationArray} handleConfirm={jest.fn()} />
    )
    const dismissButton = screen.getByText(/dismiss/i);
    fireEvent.click(dismissButton);
    expect(mockSetConfimrationArray).toHaveBeenCalledWith([]);
})

it('should use custom button labels and call handleDismiss', () => {
    const mockHandleDismiss = jest.fn();
    render(
        <ConfirmationPopup confirmationArray={['']} setConfirmationArray={jest.fn()} handleConfirm={jest.fn()} handleDismiss={mockHandleDismiss} confirmText={'Go to testing'} dismissText={'Add another order'} />
    )
    expect(screen.getByText(/go to testing/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/add another order/i));
    expect(mockHandleDismiss).toHaveBeenCalled();
})

it('should display items in confirmationArray', () => {
    const mockConfirmationArray = ['test1', 'test2'];
    render(
        <ConfirmationPopup confirmationArray={mockConfirmationArray} setConfirmationArray={jest.fn()} handleConfirm={jest.fn()} />
    )
    const firstElement = screen.getByText(/test1/i)
    const secondElement = screen.getByText(/test2/i)
    expect(firstElement).toBeInTheDocument()
    expect(secondElement).toBeInTheDocument()
})