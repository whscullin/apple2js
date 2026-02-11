import { Modal, ModalContent } from './Modal';

import styles from './css/ProgressModal.module.scss';

export interface ErrorProps {
    title: string;
    current: number | undefined;
    total: number | undefined;
}

export const ProgressModal = ({ title, current, total }: ErrorProps) => {
    if (current && total) {
        return (
            <Modal title={title} isOpen={true}>
                <ModalContent>
                    <div className={styles.progressContainer}>
                        <div
                            className={styles.progressBar}
                            style={{
                                width: Math.floor(320 * (current / total)),
                            }}
                        />
                    </div>
                </ModalContent>
            </Modal>
        );
    } else {
        return null;
    }
};
