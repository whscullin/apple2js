import { h, Fragment } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { DriveNumber, MassStorage } from '../formats/types';
import { Modal, ModalContent, ModalFooter } from './Modal';

import styles from './css/DownloadModal.module.scss';

interface DownloadModalProps {
    isOpen: boolean;
    massStorage: MassStorage<unknown>;
    driveNo: DriveNumber;
    onClose: (closeBox?: boolean) => void;
}

export const DownloadModal = ({
    massStorage,
    driveNo,
    onClose,
    isOpen,
}: DownloadModalProps) => {
    const [href, setHref] = useState('');
    const [downloadName, setDownloadName] = useState('');
    const doCancel = useCallback(() => onClose(true), [onClose]);

    useEffect(() => {
        if (isOpen) {
            const storageData = massStorage.getBinary(driveNo);
            if (storageData) {
                const { ext, data } = storageData;
                const { name } = storageData.metadata;
                if (data.byteLength) {
                    const blob = new Blob([data], {
                        type: 'application/octet-stream',
                    });
                    const href = window.URL.createObjectURL(blob);
                    setHref(href);
                    setDownloadName(`${name}.${ext}`);
                    return;
                }
            }
            setHref('');
            setDownloadName('');
        }
    }, [isOpen, driveNo, massStorage]);

    return (
        <>
            <Modal title="Save File" isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <div className={styles.modalContent}>
                        {href ? (
                            <>
                                <span>Disk Name: {downloadName}</span>
                                <a
                                    role="button"
                                    href={href}
                                    download={downloadName}
                                >
                                    Download
                                </a>
                            </>
                        ) : (
                            <span>No Download Available</span>
                        )}
                    </div>
                </ModalContent>
                <ModalFooter>
                    <button onClick={doCancel}>Close</button>
                </ModalFooter>
            </Modal>
        </>
    );
};
