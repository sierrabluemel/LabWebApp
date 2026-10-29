import { fireEvent, render, screen } from '@testing-library/react';
import Dialog from './Dialog';

test('renders the title as the header, children in between and the footer, and closes on the backdrop', () => {
    const onClose = jest.fn()
    render(
        <Dialog title='Batch 3 removed' label='Removed' onClose={onClose} error footer={<button>Close</button>}>
            <p>Order 7 went with it</p>
        </Dialog>
    )
    expect(screen.getByRole('heading')).toHaveTextContent('Batch 3 removed')
    expect(screen.getByRole('heading').className.includes('popup_header_error')).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Removed' })).toBeInTheDocument()
    expect(screen.getByText('Order 7 went with it')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('dialog').previousSibling)
    expect(onClose).toBeCalled()
})
