import { h, Fragment, JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { DiskDescriptor, DriveNumber, FLOPPY_FORMATS, NibbleFormat } from '../formats/types';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { loadLocalNibbleFile, loadJSON, getHashParts, setHashParts } from './util/files';
import DiskII from '../cards/disk2';
import { ErrorModal } from './ErrorModal';

import { noAwait, spawn } from './util/promises';
import { useHash } from './hooks/useHash';
import { FileChooser, FilePickerAcceptType } from './FileChooser';

import styles from './css/FileModal.module.scss';

const DISK_TYPES: FilePickerAcceptType[] = [
    {
        description: 'Disk Images',
        accept: { 'application/octet-stream': FLOPPY_FORMATS.map(x => '.' + x) },
    }
];

export type NibbleFileCallback = (
    name: string,
    fmt: NibbleFormat,
    rawData: ArrayBuffer
) => boolean;

interface FileModalProps {
    isOpen: boolean;
    disk2: DiskII;
    driveNo: DriveNumber;
    onClose: (closeBox?: boolean) => void;
}

interface IndexEntry {
    filename: string;
    name: string;
    category: string;
}

export const FileModal = ({ disk2, driveNo, onClose, isOpen }: FileModalProps) => {
    const [busy, setBusy] = useState<boolean>(false);
    const [empty, setEmpty] = useState<boolean>(true);
    const [category, setCategory] = useState<string>();
    const [handles, setHandles] = useState<FileSystemFileHandle[]>();
    const [filename, setFilename] = useState<string>();
    const [error, setError] = useState<unknown>();
    const [index, setIndex] = useState<IndexEntry[]>();
    const hash = useHash();

    useEffect(() => {
        spawn(async () => {
            try {
                const indexResponse = await fetch('json/disks/index.json');
                const index = await indexResponse.json() as IndexEntry[];
                setIndex(index);
            } catch (error) {
                setIndex([]);
                setError(error);
            }
        });
    }, []);

    const doCancel = useCallback(() => onClose(true), [onClose]);

    const doOpen = useCallback(async () => {
        const hashParts = getHashParts(hash);
        setBusy(true);

        try {
            if (handles?.length === 1) {
                hashParts[driveNo] = '';
                await loadLocalNibbleFile(disk2, driveNo, await handles[0].getFile());
            }
            if (filename) {
                const name = filename.match(/\/([^/]+).json$/) || ['', ''];
                hashParts[driveNo] = name[1];
                await loadJSON(disk2, driveNo, filename);
            }
        } catch (e) {
            setError(e);
        } finally {
            setHashParts(hashParts);
            setBusy(false);
            onClose();
        }

        setHashParts(hashParts);
    }, [disk2, filename, driveNo, onClose, handles, hash]);

    const onChange = useCallback((handles: FileSystemFileHandle[]) => {
        setEmpty(handles.length === 0);
        setHandles(handles);
    }, []);

    const doSelectCategory = useCallback(
        (event: JSX.TargetedMouseEvent<HTMLSelectElement>) =>
            setCategory(event.currentTarget.value)
        , []
    );

    const doSelectFilename = useCallback(
        (event: JSX.TargetedMouseEvent<HTMLSelectElement>) => {
            setEmpty(!event.currentTarget.value);
            setFilename(event.currentTarget.value);
        }, []
    );

    if (!index) {
        return null;
    }

    const categories = index.reduce<Record<string, DiskDescriptor[]>>(
        (
            acc: Record<string, DiskDescriptor[]>,
            disk: DiskDescriptor
        ) => {
            const category = disk.category || 'Misc';
            acc[category] = [disk, ...(acc[category] || [])];

            return acc;
        },
        {}
    );
    const categoryNames = Object.keys(categories).sort();

    const disks = category ? categories[category].sort() : [];

    return (
        <>
            <Modal title="Open File" isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <div className={styles.loadModal}>
                        <select multiple onChange={doSelectCategory}>
                            {categoryNames.map((name) => (
                                <option key={name}>{name}</option>
                            ))}
                        </select>
                        <select multiple onChange={doSelectFilename}>
                            {disks.map((disk) => (
                                <option key={disk.filename} value={disk.filename}>
                                    {disk.name}
                                    {disk.disk ? ` - ${disk.disk}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <FileChooser onChange={onChange} accept={DISK_TYPES} />
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
