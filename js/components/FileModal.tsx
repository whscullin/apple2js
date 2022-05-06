import { h, JSX } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { DiskDescriptor, DriveNumber, NibbleFormat } from '../formats/types';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { loadLocalFile, loadJSON, getHashParts, setHashParts } from './util/files';
import DiskII from '../cards/disk2';

import index from 'json/disks/index.json';

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

export type NibbleFileCallback = (
    name: string,
    fmt: NibbleFormat,
    rawData: ArrayBuffer
) => boolean

interface FileModalProps {
    isOpen: boolean
    disk2?: DiskII,
    number: DriveNumber,
    onClose: (closeBox?: boolean) => void
}

export const FileModal = ({ disk2, number, onClose, isOpen } : FileModalProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<boolean>(false);
    const [empty, setEmpty] = useState<boolean>(true);
    const [category, setCategory] = useState<string>();
    const [filename, setFilename] = useState<string>();

    const doCancel = useCallback(() => onClose(true), []);

    const doOpen = useCallback(() => {
        const hashParts = getHashParts();

        if (disk2 && inputRef.current && inputRef.current.files?.length === 1) {
            hashParts[number] = '';
            setBusy(true);
            loadLocalFile(disk2, number, inputRef.current.files[0])
                .catch(console.error)
                .finally(() => {
                    setBusy(false);
                    onClose();
                });
        }

        if (disk2 && filename) {
            const name = filename.match(/\/([^/]+).json$/) || ['', ''];
            hashParts[number] = name[1];
            setBusy(true);
            loadJSON(disk2, number, filename)
                .catch(console.error)
                .finally(() => {
                    setBusy(false);
                    onClose();
                });
        }

        setHashParts(hashParts);
    }, [ disk2, filename, number, onClose ]);

    const onChange = useCallback(() => {
        if (inputRef) {
            setEmpty(!inputRef.current?.files?.length);
        }
    }, [ inputRef ]);

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

    const disks = category ? categories[category] : [];

    return (
        <Modal title="Open File" isOpen={isOpen}>
            <ModalContent>
                <div id="load-modal">
                    <select multiple onChange={doSelectCategory}>
                        {categoryNames.map((name) => (
                            <option>{name}</option>
                        ))}
                    </select>
                    <select multiple onChange={doSelectFilename}>
                        {disks.map((disk) => (
                            <option value={disk.filename}>
                                {disk.name}
                                {disk.disk ? ` - ${disk.disk}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <input type="file" ref={inputRef} onChange={onChange} />
            </ModalContent>
            <ModalFooter>
                <button onClick={doCancel}>Cancel</button>
                <button onClick={doOpen} disabled={busy || empty}>Open</button>
            </ModalFooter>
        </Modal>
    );
};
