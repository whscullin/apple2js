import { h, Fragment } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { DriveNumber, BLOCK_FORMATS } from '../formats/types';
import { ErrorModal } from './ErrorModal';
import { FileChooser } from './FileChooser';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { loadLocalBlockFile, getHashParts, setHashParts } from './util/files';
import SmartPort from 'js/cards/smartport';
import { useHash } from './hooks/useHash';
import { noAwait } from './util/promises';

import styles from './css/BlockFileModal.module.css';

const DISK_TYPES: FilePickerAcceptType[] = [
    {
        description: 'Disk Images',
        accept: { 'application/octet-stream': BLOCK_FORMATS.map(x => '.' + x) },
    }
];

interface BlockFileModalProps {
    isOpen: boolean;
    smartPort: SmartPort;
    number: DriveNumber;
    onClose: (closeBox?: boolean) => void;
}

export const BlockFileModal = ({ smartPort, number, onClose, isOpen } : BlockFileModalProps) => {
    const [handles, setHandles] = useState<FileSystemFileHandle[]>();
    const [busy, setBusy] = useState<boolean>(false);
    const [empty, setEmpty] = useState<boolean>(true);
    const [error, setError] = useState<unknown>();
    const hash = useHash();

    const doCancel = useCallback(() => onClose(true), [onClose]);

    const doOpen = useCallback(async () => {
        const hashParts = getHashParts(hash);

        if (handles?.length === 1) {
            hashParts[number] = '';
            setBusy(true);
            try {
                await loadLocalBlockFile(smartPort, number, await handles[0].getFile());
            } catch (error) {
                setError(error);
            } finally {
                setBusy(false);
                onClose();
            }
        }

        setHashParts(hashParts);
    }, [handles, hash, smartPort, number, onClose]);

    const onChange = useCallback((handles: FileSystemFileHandle[]) => {
        setEmpty(handles.length === 0);
        setHandles(handles);
    }, []);

    return (
        <>
            <Modal title="Open File" isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <div className={styles.modalContent}>
                        <FileChooser onChange={onChange} accept={DISK_TYPES} />
                    </div>
                </ModalContent>
                <ModalFooter>
                    <button onClick={doCancel}>Cancel</button>
                    <button onClick={noAwait(doOpen)} disabled={busy || empty}>Open</button>
                </ModalFooter>
            </Modal>
            <ErrorModal error={error} setError={setError} />
        </>
    );
};
