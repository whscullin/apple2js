import { h, Fragment } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { DriveNumber, BLOCK_FORMATS } from '../formats/types';
import { ErrorModal } from './ErrorModal';
import { FileChooser } from './FileChooser';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { loadLocalBlockFile, getHashParts, setHashParts } from './util/files';
import SmartPort from 'js/cards/smartport';
import { useHash } from './hooks/useHash';

import styles from './css/BlockFileModal.module.css';

const DISK_TYPES: FilePickerAcceptType[] = [
    {
        description: 'Disk Images',
        accept: { 'application/octet-stream': BLOCK_FORMATS.map(x => '.' + x) },
    }
];

interface BlockFileModalProps {
    isOpen: boolean;
    smartPort: SmartPort | undefined;
    number: DriveNumber;
    onClose: (closeBox?: boolean) => void;
}

export const BlockFileModal = ({ smartPort, number, onClose, isOpen } : BlockFileModalProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<boolean>(false);
    const [empty, setEmpty] = useState<boolean>(true);
    const [error, setError] = useState<unknown>();
    const hash = useHash();

    const doCancel = useCallback(() => onClose(true), [onClose]);

    const doOpen = useCallback(() => {
        const hashParts = getHashParts(hash);

        if (smartPort && inputRef.current && inputRef.current.files?.length === 1) {
            hashParts[number] = '';
            setBusy(true);
            loadLocalBlockFile(smartPort, number, inputRef.current.files[0])
                .catch((error) => setError(error))
                .finally(() => {
                    setBusy(false);
                    onClose();
                });
        }

        setHashParts(hashParts);
    }, [hash, smartPort, number, onClose]);

    const onChange = useCallback(() => {
        if (inputRef) {
            setEmpty(!inputRef.current?.files?.length);
        }
    }, [ inputRef ]);

    return (
        <>
            <Modal title="Open File" isOpen={isOpen}>
                <ModalContent>
                    <div className={styles.modalContent}>
                        <FileChooser onChange={onChange} accept={DISK_TYPES} />
                    </div>
                </ModalContent>
                <ModalFooter>
                    <button onClick={doCancel}>Cancel</button>
                    <button onClick={doOpen} disabled={busy || empty}>Open</button>
                </ModalFooter>
            </Modal>
            <ErrorModal error={error} setError={setError} />
        </>
    );
};
