import { h } from 'preact';
import { useCallback } from 'preact/hooks';
import { Modal, ModalContent, ModalFooter } from './Modal';

export interface ErrorProps {
    error: unknown | undefined;
    setError: (error: string | undefined) => void;
}

export const ErrorModal = ({ error, setError }: ErrorProps) => {
    const onClose = useCallback(() => setError(undefined), [setError]);
    let errorStr = null;
    if (error) {
        if (error instanceof Error) {
            errorStr = error.message;
        } else if (typeof error === 'string') {
            errorStr = error;
        } else {
            errorStr = 'Unknown Error';
            console.error(error);
        }
    }

    if (errorStr) {
        return (
            <Modal
                title="Error"
                icon="triangle-exclamation"
                isOpen={true}
                onClose={onClose}
            >
                <ModalContent>
                    <div style={{ width: 320, fontSize: '1.1em', padding: '5px 11px' }}>
                        {errorStr}
                    </div>
                </ModalContent>
                <ModalFooter>
                    <button onClick={onClose}>OK</button>
                </ModalFooter>
            </Modal>
        );
    } else {
        return null;
    }
};