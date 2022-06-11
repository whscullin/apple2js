import { h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import cs from 'classnames';
import Disk2 from '../cards/disk2';
import { ErrorModal } from './ErrorModal';
import { FileModal } from './FileModal';

import styles from './css/DiskII.module.css';
import { DiskDragTarget } from './DiskDragTarget';
import { NIBBLE_FORMATS } from 'js/formats/types';

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

    const doClose = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    return (
        <DiskDragTarget
            className={styles.disk}
            storage={disk2}
            drive={number}
            formats={NIBBLE_FORMATS}
            onError={setError}
        >
            <FileModal disk2={disk2} number={number} onClose={doClose} isOpen={modalOpen} />
            <ErrorModal error={error} setError={setError} />
            <div className={cs(styles.diskLight, { [styles.on]: on })} />
            <button title="Load Disk" onClick={onOpenModal}>
                <i className="fas fa-folder-open" />
            </button>
            <div className={styles.diskLabel}>
                {label}
            </div>
        </DiskDragTarget>
    );
};
