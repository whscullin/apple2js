/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal, ModalContent, ModalFooter } from 'js/components/Modal';

describe('Modal', () => {
    it('renders a title and content when open', () => {
        render(
            <Modal title="My Title" isOpen={true}>
                <ModalContent>My Content</ModalContent>
            </Modal>
        );
        expect(screen.queryByRole('banner')).toBeVisible();
        expect(screen.queryByRole('banner')).toHaveTextContent('My Title');
        expect(screen.queryByText('My Content')).toBeVisible();

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
    });

    it('does not render a title and content when not open', () => {
        render(
            <Modal title="My Title" isOpen={false}>
                <ModalContent>My Content</ModalContent>
            </Modal>
        );
        expect(screen.queryByRole('banner')).not.toBeInTheDocument();
        expect(screen.queryByText('My Content')).not.toBeInTheDocument();
    });

    it('renders a footer', () => {
        render(
            <Modal title="My Title" isOpen={true}>
                <ModalContent>My Content</ModalContent>
                <ModalFooter>My Footer</ModalFooter>
            </Modal>
        );
        expect(screen.queryByRole('banner')).toHaveTextContent('My Title');
        expect(screen.queryByText('My Content')).toBeVisible();
        expect(screen.getByRole('contentinfo')).toHaveTextContent('My Footer');
    });

    it('can have a close button', () => {
        const onClose = jest.fn();
        render(
            <Modal title="My Title" isOpen={true} onClose={onClose}>
                <ModalContent>My Content</ModalContent>
            </Modal>
        );
        const button = screen.getByTitle('Close');
        expect(button).toBeVisible();
        fireEvent.click(button);
        expect(onClose).toHaveBeenCalledWith(true);
    });

    it('can have an icon', () => {
        render(
            <Modal title="My Title" isOpen={true} icon="warning">
                <ModalContent>My Content</ModalContent>
            </Modal>
        );
        expect(screen.getByRole('img')).toBeVisible();
    });
});
