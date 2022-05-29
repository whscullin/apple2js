import { h, Fragment } from 'preact';
import {useEffect, useState } from 'preact/hooks';
import Disk2, { Callbacks } from '../cards/disk2';
import Apple2IO from '../apple2io';
import { DiskII, DiskIIData } from './DiskII';

/**
 * Interface for Drives component.
 */
export interface DrivesProps {
    io: Apple2IO | undefined;
    sectors: number;
}

/**
 * Drive interface component. Presents the interface to load disks.
 * Provides the callback to the Disk2 object to update the DiskII
 * components.
 *
 * @param io Apple I/O object
 * @returns Drives component
 */
export const Drives = ({ io, sectors }: DrivesProps) => {
    const [disk2, setDisk2] = useState<Disk2>();
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

    useEffect(() => {
        const setData = [setData1, setData2];
        const callbacks: Callbacks = {
            driveLight: (drive, on) => {
                setData[drive - 1]?.(data => ({...data, on }));
            },
            label: (drive, name, side) => {
                setData[drive - 1]?.(data => ({
                    ...data,
                    name: name ?? `Disk ${drive}`,
                    side,
                }));
            },
            dirty: () => {}
        };

        if (io) {
            const disk2 = new Disk2(io, callbacks, sectors);
            io.setSlot(6, disk2);
            setDisk2(disk2);
        }
    }, [io, sectors]);

    return (
        <>
            <DiskII disk2={disk2} {...data1} />
            <DiskII disk2={disk2} {...data2} />
        </>
    );
};
