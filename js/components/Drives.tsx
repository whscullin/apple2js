import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import Disk2, { Callbacks } from '../cards/disk2';
import Apple2IO from '../apple2io';
import { DiskII, DiskIIData } from './DiskII';
import SmartPort from 'js/cards/smartport';
import CPU6502 from 'js/cpu6502';
import { BlockDisk } from './BlockDisk';
import { ErrorModal } from './ErrorModal';
import { ProgressModal } from './ProgressModal';
import { loadHttpUnknownFile, getHashParts, loadJSON, SmartStorageBroker } from './util/files';
import { useHash } from './hooks/useHash';
import { DISK_FORMATS, DRIVE_NUMBERS, SupportedSectors } from 'js/formats/types';
import { spawn, Ready } from './util/promises';

import styles from './css/Drives.module.scss';
import { DiskDragTarget } from './DiskDragTarget';

/**
 * Storage device storage
 */
interface StorageDevices {
    disk2: Disk2;
    smartPort: SmartPort;
    smartStorageBroker: SmartStorageBroker;
}

/**
 * Interface for Drives component.
 */
export interface DrivesProps {
    cpu: CPU6502 | undefined;
    io: Apple2IO | undefined;
    enhanced: boolean;
    sectors: SupportedSectors;
    ready: Ready;
}

/**
 * Drive interface component. Presents the interface to load disks.
 * Provides the callback to the Disk2 and SmartPort objects to update
 * the DiskII and BlockDisk components.
 * Handles initial loading of disks specified in the hash.
 *
 * @cpu CPU object
 * @param io Apple I/O object
 * @param sectors 13 or 16 sector rom mode
 * @enhanced Whether to create a SmartPort ROM device
 * @ready Signal disk availability
 * @returns Drives component
 */
export const Drives = ({ cpu, io, sectors, enhanced, ready }: DrivesProps) => {
    const [current, setCurrent] = useState(0);
    const [error, setError] = useState<unknown>();
    const [total, setTotal] = useState(0);
    const bodyRef = useRef(document.body);
    const onProgress = useCallback((current: number, total: number) => {
        setCurrent(current);
        setTotal(total);
    }, []);

    const [storageDevices, setStorageDevices] = useState<StorageDevices>();

    const [data1, setData1] = useState<DiskIIData>({
        on: false,
        number: 1,
        name: 'Disk 1',
    });
    const [data2, setData2] = useState<DiskIIData>({
        on: false,
        number: 2,
        name: 'Disk 2',
    });
    const [smartData1, setSmartData1] = useState<DiskIIData>({
        on: false,
        number: 1,
        name: 'HD 1'
    });
    const [smartData2, setSmartData2] = useState<DiskIIData>({
        on: false,
        number: 2,
        name: 'HD 2'
    });

    const hash = useHash();

    useEffect(() => {
        if (storageDevices) {
            const { smartStorageBroker, disk2 } = storageDevices;
            const hashParts = getHashParts(hash);
            const controllers: AbortController[] = [];
            let loading = 0;
            for (const driveNo of DRIVE_NUMBERS) {
                if (hashParts && hashParts[driveNo]) {
                    const hashPart = decodeURIComponent(hashParts[driveNo]);
                    const isHttp = hashPart.match(/^https?:/i);
                    const isJson = hashPart.match(/\.json$/i);
                    if (isHttp && !isJson) {
                        loading++;
                        controllers.push(spawn(async (signal) => {
                            try {
                                await loadHttpUnknownFile(
                                    smartStorageBroker,
                                    driveNo,
                                    hashPart,
                                    signal,
                                    onProgress);
                            } catch (e) {
                                setError(e);
                            }
                            if (--loading === 0) {
                                ready.onReady();
                            }
                            setCurrent(0);
                            setTotal(0);
                        }));
                    } else {
                        const url = isHttp ? hashPart : `json/disks/${hashPart}.json`;
                        loadJSON(disk2, driveNo, url).catch((e) => setError(e));
                    }
                }
            }
            if (!loading) {
                ready.onReady();
            }
            return () => controllers.forEach((controller) => controller.abort());
        }
    }, [hash, onProgress, ready, storageDevices]);

    useEffect(() => {
        const setData = [setData1, setData2];
        const setSmartData = [setSmartData1, setSmartData2];
        const callbacks: Callbacks = {
            driveLight: (drive, on) => {
                setData[drive - 1]?.(data => ({ ...data, on }));
            },
            label: (drive, name, side) => {
                setData[drive - 1]?.(data => ({
                    ...data,
                    name: name ?? `Disk ${drive}`,
                    side,
                }));
            },
            dirty: () => {
                // do nothing
            }
        };

        const smartPortCallbacks: Callbacks = {
            driveLight: (drive, on) => {
                setSmartData[drive - 1]?.(data => ({ ...data, on }));
            },
            label: (drive, name, side) => {
                setSmartData[drive - 1]?.(data => ({
                    ...data,
                    name: name ?? `HD ${drive}`,
                    side,
                }));
            },
            dirty: () => {/* Unused */ }
        };

        if (cpu && io) {
            const disk2 = new Disk2(io, callbacks, sectors);
            io.setSlot(6, disk2);
            const smartPort = new SmartPort(cpu, smartPortCallbacks, { block: !enhanced });
            io.setSlot(7, smartPort);

            const smartStorageBroker = new SmartStorageBroker(disk2, smartPort);
            setStorageDevices({ disk2, smartPort, smartStorageBroker });
        }
    }, [cpu, enhanced, io, sectors]);

    if (!storageDevices) {
        return null;
    }

    const { disk2, smartPort, smartStorageBroker } = storageDevices;

    return (
        <DiskDragTarget
            storage={smartStorageBroker}
            dropRef={bodyRef}
            className={styles.drives}
            onError={setError}
            formats={DISK_FORMATS}
        >
            <ProgressModal current={current} total={total} title="Loading..." />
            <ErrorModal error={error} setError={setError} />
            <div className={styles.driveBay}>
                <DiskII disk2={disk2} {...data1} />
                <DiskII disk2={disk2} {...data2} />
            </div>
            <div className={styles.driveBay}>
                <BlockDisk smartPort={smartPort} {...smartData1} />
                <BlockDisk smartPort={smartPort} {...smartData2} />
            </div>
        </DiskDragTarget>
    );
};
