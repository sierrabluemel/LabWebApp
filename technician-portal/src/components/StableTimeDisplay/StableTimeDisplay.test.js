import {render, screen} from '@testing-library/react';
import StableTimeDisplay from './StableTimeDisplay';

test('StableTimeDisplay renders successfully', () => {
    render(<StableTimeDisplay stableTime={'test'} />)

    const stableElement = screen.getByText('test')
    expect(stableElement).toHaveClass('grid_entry')
    expect(stableElement).toBeInTheDocument()
})

test('StableTimeDisplay with stable time shows green', () => {
    render(<StableTimeDisplay stableTime={'Stable'} />)

    const stableElement = screen.getByText(/stable/i)
    expect(stableElement).toHaveClass('grid_entry_green')
})

test('StableTimeDisplay with 2 minutes ago time shows yellow', () => {
    render(<StableTimeDisplay stableTime={'2 minutes ago'} />)

    const stableElement = screen.getByText(/ago/i)
    expect(stableElement).toHaveClass('grid_entry_yellow')
})
