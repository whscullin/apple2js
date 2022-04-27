import { h, Fragment } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import classNames from 'classnames';
import Disk2, { Callbacks } from '../cards/disk2';
import { NibbleFormat } from '../formats/types';
import Apple2IO from '../apple2io';
import { FileModal } from './FileModal';

export interface DiskIIProps {
    io?: Apple2IO
}

interface DriveData {
    number: 1 | 2
    on: boolean
    name?: string
    side?: string
}

interface DriveProps extends DriveData {
    disk2?: Disk2
}

const Drive = ({ disk2, number, on, name, side }: DriveProps) => {
    const label = side ? `${name} - ${side}` : name;

    const [modalOpen, setModalOpen] = useState(false);

    const onOpen = useCallback((name: string, fmt: NibbleFormat, rawData: ArrayBuffer) => {
        setModalOpen(false);
        return disk2?.setBinary(number, name, fmt, rawData) || false;
    }, [disk2, number]);

    const onCancel = useCallback(() => {
        setModalOpen(false);
    }, []);

    const onOpenModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    return (
        <div className="disk">
            <FileModal onOpen={onOpen} onCancel={onCancel} show={modalOpen} />
            <div
                id={`disk${number}`}
                className={classNames('disk-light', { on })}
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


export const DiskII = ({ io }: DiskIIProps) => {
    const [disk2, setDisk2] = useState<Disk2>();
    const [data1, setData1] = useState<DriveData>({ on: false, number: 1, name: 'Disk1' });
    const [data2, setData2] = useState<DriveData>({ on: false, number: 2, name: 'Disk2' });

    useEffect(() => {
        const setData = [setData1, setData2];
        const callbacks: Callbacks = {
            driveLight: (drive, on) => {
                setData[drive - 1]?.(data => ({...data, on }));
            },
            label: (drive, name, side) => {
                setData[drive - 1]?.(data => ({...data, name, side }));
            },
            dirty: () => {}
        };

        if (io) {
            const disk2 = new Disk2(io, callbacks);
            io.setSlot(6, disk2);
            setDisk2(disk2);
        }
    }, [io]);

    return (
        <>
            <Drive disk2={disk2} {...data1} />
            <Drive disk2={disk2} {...data2} />
        </>
    );
};
