import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import cs from 'classnames';
import Disk2 from '../cards/disk2';
import { FileModal } from './FileModal';
import { loadJSON, loadHttpFile, getHashParts } from './util/files';

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

    useEffect(() => {
        const hashParts = getHashParts();
        if (disk2 && hashParts && hashParts[number]) {
            const hashPart = decodeURIComponent(hashParts[number]);
            if (hashPart.match(/^https?:/)) {
                loadHttpFile(disk2, number, hashPart)
                    .catch((error) =>
                        console.error(error)
                    );
            } else {
                const filename = `/json/disks/${hashPart}.json`;
                loadJSON(disk2, number, filename)
                    .catch((error) =>
                        console.error(error)
                    );
            }
        }
    }, [disk2, number]);

    const doClose = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    return (
        <div className="disk">
            <FileModal disk2={disk2} number={number} onClose={doClose} isOpen={modalOpen} />
            <div
                id={`disk${number}`}
                className={cs('disk-light', { on })}
            />
            <button title="Load Disk">
                <i class="fas fa-folder-open" onClick={onOpenModal} />
            </button>
            <div
                id={`disk-label${number}`}
                className="disk-label"
            >
                {label}
            </div>
        </div>
    );
};
