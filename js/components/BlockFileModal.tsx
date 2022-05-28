import { h, Fragment } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { DriveNumber, NibbleFormat } from '../formats/types';
import { ErrorModal } from './ErrorModal';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { loadLocalBlockFile, getHashParts, setHashParts } from './util/files';
import SmartPort from 'js/cards/smartport';
import { useHash } from './hooks/useHash';

export type NibbleFileCallback = (
    name: string,
    fmt: NibbleFormat,
    rawData: ArrayBuffer
) => boolean;

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
                    <input type="file" ref={inputRef} onChange={onChange} />
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
