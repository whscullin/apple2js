import { h, Fragment } from 'preact';
import { useCallback } from 'preact/hooks';
import { Modal, ModalContent, ModalFooter } from './Modal';

export interface ErrorProps {
    error: string | undefined;
    setError: (error: string | undefined) => void;
}

export const ErrorModal = ({ error, setError } : ErrorProps) => {
    const onClose = useCallback(() => setError(undefined), [setError]);

    return (
        <>
            { error && (
                <Modal
                    title="Error"
                    icon="triangle-exclamation"
                    isOpen={true}
                    onClose={onClose}
                >
                    <ModalContent>
                        <div style={{ width: 320, fontSize: '1.1em', padding: '5px 11px'}}>
                            {error}
                        </div>
                    </ModalContent>
                    <ModalFooter>
                        <button onClick={onClose}>OK</button>
                    </ModalFooter>
                </Modal>
            )}
        </>
    );
};
