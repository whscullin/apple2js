import { h } from 'preact';
import {useEffect, useState } from 'preact/hooks';
import Disk2, { Callbacks } from '../cards/disk2';
import Apple2IO from '../apple2io';
import { DiskII, DiskIIData } from './DiskII';
import SmartPort from 'js/cards/smartport';
import CPU6502 from 'js/cpu6502';
import { BlockDisk } from './BlockDisk';

/**
 * Interface for Drives component.
 */
export interface DrivesProps {
    cpu: CPU6502 | undefined;
    io: Apple2IO | undefined;
    e: boolean;
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
export const Drives = ({ cpu, io, sectors, e }: DrivesProps) => {
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
    const [smartData1, setSmartData1] = useState<DiskIIData>({
        on: false,
        number: 1,
        name: 'Disk 1'
    });
    const [smartData2, setSmartData2] = useState<DiskIIData>({
        on: false,
        number: 2,
        name: 'Disk 2'
    });

    const [smartPort, setSmartPort] = useState<SmartPort>();

    useEffect(() => {
        const setData = [setData1, setData2];
        const setSmartData = [setSmartData1, setSmartData2];
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
            dirty: () => {
                // do nothing
            }
        };

        const smartPortCallbacks: Callbacks = {
            driveLight: (drive, on) => {
                setSmartData[drive - 1]?.(data => ({...data, on }));
            },
            label: (drive, name, side) => {
                setSmartData[drive - 1]?.(data => ({
                    ...data,
                    name: name ?? `Disk ${drive}`,
                    side,
                }));
            },
            dirty: () => {}
        };

        if (cpu && io) {
            const disk2 = new Disk2(io, callbacks, sectors);
            io.setSlot(6, disk2);
            setDisk2(disk2);
            const smartPort = new SmartPort(cpu, smartPortCallbacks, { block: !e });
            io.setSlot(7, smartPort);
            setSmartPort(smartPort);
        }
    }, [io, sectors]);

    return (
        <div style={{display: 'flex', width: '100%'}}>
            <div style={{display: 'flex', flexDirection: 'column', flex: '1 1 auto'}}>
                <DiskII disk2={disk2} {...data1} />
                <DiskII disk2={disk2} {...data2} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', flex: '1 1 auto'}}>
                <BlockDisk smartPort={smartPort} {...smartData1} />
                <BlockDisk smartPort={smartPort} {...smartData2} />
            </div>
        </div>
    );
};
