/** @jest-environment jsdom */
import { h } from 'preact';
import { fireEvent, render, screen } from '@testing-library/preact';
import {
    ErrorModal,
} from 'js/components/ErrorModal';

describe('ErrorModal', () => {
    it('renders when there is an error', () => {
        const setError = jest.fn();
        render(
            <ErrorModal error="My Error" setError={setError} />
        );
        expect(screen.queryByRole('banner')).toBeVisible();
        expect(screen.queryByRole('banner')).toHaveTextContent('Error');
        expect(screen.queryByText('My Error')).toBeVisible();
    });

    it('does not render when there is not an error', () => {
        const setError = jest.fn();
        render(
            <ErrorModal error={undefined} setError={setError} />
        );
        expect(screen.queryByRole('banner')).not.toBeInTheDocument();
        expect(screen.queryByText('My Error')).not.toBeInTheDocument();
    });

    it('calls setError when close is clicked', () => {
        const setError = jest.fn();
        render(
            <ErrorModal error="My Error" setError={setError} />
        );
        fireEvent.click(screen.getByTitle('Close'));
        expect(setError).toHaveBeenCalledWith(undefined);
    });

    it('calls setError when OK is clicked', () => {
        const setError = jest.fn();
        render(
            <ErrorModal error="My Error" setError={setError} />
        );
        fireEvent.click(screen.getByText('OK'));
        expect(setError).toHaveBeenCalledWith(undefined);
    });
});
