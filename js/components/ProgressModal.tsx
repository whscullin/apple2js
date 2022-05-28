import { h, Fragment } from 'preact';
import { Modal, ModalContent } from './Modal';

export interface ErrorProps {
    title: string;
    current: number | undefined;
    total: number | undefined;
}

export const ProgressModal = ({ title, current, total } : ErrorProps) => {
    return (
        <>
            { current && total ? (
                <Modal title={title} isOpen={true}>
                    <ModalContent>
                        <div style={{ width: 320, height: 20, background: '#000'}}>
                            <div style={{ width: 320 * (current / total), background: '#0f0' }} />
                        </div>
                    </ModalContent>
                </Modal>
            ) : null}
        </>
    );
};
