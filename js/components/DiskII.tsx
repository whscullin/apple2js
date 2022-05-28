import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import cs from 'classnames';
import Disk2 from '../cards/disk2';
import { ErrorModal } from './ErrorModal';
import { FileModal } from './FileModal';
import { loadJSON, loadHttpNibbleFile, getHashParts } from './util/files';
import { useHash } from './hooks/useHash';
import { includes } from 'js/types';
import { NIBBLE_FORMATS } from 'js/formats/types';

import styles from './css/DiskII.module.css';

/**
 * Storage structure for Disk II state returned via callbacks.
 */
export interface DiskIIData {
    number: 1 | 2;
    on: boolean;
    name: string;
    side?: string | undefined;
}

/**
 * Interface for Disk II component.
 */
export interface DiskIIProps extends DiskIIData {
    disk2: Disk2 | undefined;
}

/**
 * Disk II component
 *
 * Includes drive light, disk name and side, and UI for loading disks.
 * Handles initial loading of disks specified in the hash.
 *
 * @param disk2 Disk2 object
 * @param number Drive 1 or 2
 * @param on Active state
 * @param name Disk name identifier
 * @param side Disk side identifier
 * @returns DiskII component
 */
export const DiskII = ({ disk2, number, on, name, side }: DiskIIProps) => {
    const label = side ? `${name} - ${side}` : name;
    const [modalOpen, setModalOpen] = useState(false);
    const [error, setError] = useState<unknown>();
    const [currentHash, setCurrentHash] = useState<string>();

    const hash = useHash();

    useEffect(() => {
        const hashParts = getHashParts(hash);
        const newHash = hashParts[number];
        if (disk2 && newHash) {
            const hashPart = decodeURIComponent(newHash);
            if (hashPart !== currentHash) {
                if (hashPart.match(/^https?:/)) {
                    const fileParts = hashPart.split('.');
                    const ext = fileParts[fileParts.length - 1];
                    if (includes(NIBBLE_FORMATS, ext)) {
                        loadHttpNibbleFile(disk2, number, hashPart)
                            .catch((e) => setError(e));
                    }
                } else {
                    const filename = `/json/disks/${hashPart}.json`;
                    loadJSON(disk2, number, filename)
                        .catch((e) => setError(e));
                }
                setCurrentHash(hashPart);
            }
        }
    }, [currentHash, disk2, hash, number]);

    const doClose = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    return (
        <div className={styles.disk}>
            <FileModal disk2={disk2} number={number} onClose={doClose} isOpen={modalOpen} />
            <ErrorModal error={error} setError={setError} />
            <div className={cs(styles.diskLight, { [styles.on]: on })} />
            <button title="Load Disk" onClick={onOpenModal}>
                <i className="fas fa-folder-open" />
            </button>
            <div className={styles.diskLabel}>
                {label}
            </div>
        </div>
    );
};
