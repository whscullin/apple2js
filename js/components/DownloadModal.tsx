import { h, Fragment } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { DriveNumber, MassStorage } from '../formats/types';
import { Modal, ModalContent, ModalFooter } from './Modal';

import styles from './css/DownloadModal.module.css';

interface DownloadModalProps {
    isOpen: boolean;
    massStorage: MassStorage<unknown>;
    number: DriveNumber;
    onClose: (closeBox?: boolean) => void;
}

export const DownloadModal = ({ massStorage, number, onClose, isOpen } : DownloadModalProps) => {
    const [href, setHref] = useState('');
    const [downloadName, setDownloadName] = useState('');
    const doCancel = useCallback(() => onClose(true), [onClose]);

    useEffect(() => {
        if (isOpen) {
            const storageData = massStorage.getBinary(number);
            if (storageData) {
                const { name, ext, data } = storageData;
                if (data.byteLength) {
                    const blob = new Blob(
                        [data],
                        { type: 'application/octet-stream' }
                    );
                    const href = window.URL.createObjectURL(blob);
                    setHref(href);
                    setDownloadName(`${name}.${ext}`);
                    return;
                }
            }
            setHref('');
            setDownloadName('');
        }
    }, [isOpen, number, massStorage]);

    return (
        <>
            <Modal title="Save File" isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <div className={styles.modalContent}>
                        { href
                            ? (
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
                            )
                        }
                    </div>
                </ModalContent>
                <ModalFooter>
                    <button onClick={doCancel}>Close</button>
                </ModalFooter>
            </Modal>
        </>
    );
};
