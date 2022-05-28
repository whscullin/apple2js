import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import cs from 'classnames';
import SmartPort from '../cards/smartport';
import { BlockFileModal } from './BlockFileModal';
import { ErrorModal } from './ErrorModal';
import { ProgressModal } from './ProgressModal';
import { loadHttpBlockFile, getHashParts } from './util/files';
import { useHash } from './hooks/useHash';
import { includes } from 'js/types';
import { BLOCK_FORMATS } from 'js/formats/types';

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
    const [current, setCurrent] = useState(0);
    const [error, setError] = useState<unknown>();
    const [total, setTotal] = useState(0);
    const onProgress = useCallback((current: number, total: number) => {
        setCurrent(current);
        setTotal(total);
    }, []);

    const hash = useHash();

    useEffect(() => {
        const hashParts = getHashParts(hash);
        if (smartPort && hashParts && hashParts[number]) {
            const hashPart = decodeURIComponent(hashParts[number]);
            if (hashPart.match(/^https?:/)) {
                const fileParts = hashPart.split('.');
                const ext = fileParts[fileParts.length - 1];
                if (includes(BLOCK_FORMATS, ext)) {
                    loadHttpBlockFile(smartPort, number, hashPart, onProgress)
                        .catch((e) => setError(e))
                        .finally(() => {
                            setCurrent(0);
                            setTotal(0);
                        });
                }
            }
        }
    }, [hash, number, onProgress, smartPort]);

    const doClose = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    return (
        <div className="disk">
            <ProgressModal current={current} total={total} title="Loading..." />
            <ErrorModal error={error} setError={setError} />
            <BlockFileModal
                smartPort={smartPort}
                number={number}
                onClose={doClose}
                isOpen={modalOpen}
            />
            <div
                id={`disk${number}`}
                className={cs('disk-light', { on })}
            />
            <button title="Load Disk">
                <i className="fas fa-folder-open" onClick={onOpenModal} />
            </button>
            <div
                id={`disk-label${number}`}
                className="disk-label"
            >
                {name}
            </div>
        </div>
    );
};
