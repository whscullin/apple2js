import { h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import cs from 'classnames';
import SmartPort from '../cards/smartport';
import { BlockFileModal } from './BlockFileModal';
import { ErrorModal } from './ErrorModal';

import styles from './css/DiskII.module.css';

/**
 * Storage structure for Disk II state returned via callbacks.
 */
export interface DiskIIData {
    number: 1 | 2;
    on: boolean;
    name?: string;
}

/**
 * Interface for Disk II component.
 */
export interface BlockDiskProps extends DiskIIData {
    smartPort: SmartPort | undefined;
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
 * @returns BlockDisk component
 */
export const BlockDisk = ({ smartPort, number, on, name }: BlockDiskProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [error, setError] = useState<unknown>();

    const doClose = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    return (
        <div className={styles.disk}>
            <ErrorModal error={error} setError={setError} />
            <BlockFileModal
                smartPort={smartPort}
                number={number}
                onClose={doClose}
                isOpen={modalOpen}
            />
            <div
                id={`disk${number}`}
                className={cs(styles.diskLight, { [styles.on]: on })}
            />
            <button title="Load Disk" onClick={onOpenModal}>
                <i className="fas fa-folder-open" />
            </button>
            <div
                id={`disk-label${number}`}
                className={styles.diskLabel}
            >
                {name}
            </div>
        </div>
    );
};
