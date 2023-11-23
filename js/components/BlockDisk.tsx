import { h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import cs from 'classnames';
import { BLOCK_FORMATS } from 'js/formats/types';
import SmartPort from '../cards/smartport';
import { BlockFileModal } from './BlockFileModal';
import { DiskDragTarget } from './DiskDragTarget';
import { DownloadModal } from './DownloadModal';
import { ErrorModal } from './ErrorModal';

import styles from './css/BlockDisk.module.scss';
import { ControlButton } from './ControlButton';

/**
 * Storage structure for drive state returned via callbacks.
 */
export interface BlockDiskData {
    number: 1 | 2;
    on: boolean;
    name?: string;
}

/**
 * Interface for BlockDisk.
 */
export interface BlockDiskProps extends BlockDiskData {
    smartPort: SmartPort;
}

/**
 * BlockDisk component
 *
 * Includes drive light, disk name and side, and UI for loading disks.
 *
 * @param smartPort SmartPort object
 * @param number Drive 1 or 2
 * @param on Active state
 * @param name Disk name identifier
 * @param side Disk side identifier
 * @returns BlockDisk component
 */
export const BlockDisk = ({ smartPort, number, on, name }: BlockDiskProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [error, setError] = useState<unknown>();

    const doClose = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    const doCloseDownload = useCallback(() => {
        setDownloadModalOpen(false);
    }, []);

    const onOpenDownloadModal = useCallback(() => {
        setDownloadModalOpen(true);
    }, []);

    return (
        <DiskDragTarget
            className={styles.disk}
            storage={smartPort}
            driveNo={number}
            formats={BLOCK_FORMATS}
            onError={setError}
        >
            <ErrorModal error={error} setError={setError} />
            <BlockFileModal
                smartPort={smartPort}
                driveNo={number}
                onClose={doClose}
                isOpen={modalOpen}
            />
            <DownloadModal
                driveNo={number}
                massStorage={smartPort}
                isOpen={downloadModalOpen}
                onClose={doCloseDownload}
            />
            <div
                id={`disk${number}`}
                className={cs(styles.diskLight, { [styles.on]: on })}
            />
            <ControlButton
                title="Load Disk"
                onClick={onOpenModal}
                icon="folder-open"
            />
            <ControlButton
                title="Save Disk"
                onClick={onOpenDownloadModal}
                icon="save"
            />
            <div id={`disk-label${number}`} className={styles.diskLabel}>
                {name}
            </div>
        </DiskDragTarget>
    );
};
