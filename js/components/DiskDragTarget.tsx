import { BLOCK_FORMATS, DISK_FORMATS, DriveNumber, FLOPPY_FORMATS, MassStorage } from 'js/formats/types';
import { h, JSX, RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import {  loadLocalFile } from './util/files';
import { spawn } from './util/promises';

export interface DiskDragTargetProps<T> extends JSX.HTMLAttributes<HTMLDivElement> {
    storage: MassStorage<T> | undefined;
    drive?: DriveNumber;
    formats: typeof FLOPPY_FORMATS
        | typeof BLOCK_FORMATS
        | typeof DISK_FORMATS;
    dropRef?: RefObject<HTMLElement>;
    onError: (error: unknown) => void;
}

export const DiskDragTarget = ({
    storage,
    drive,
    dropRef,
    formats,
    onError,
    children,
    ...props
}: DiskDragTargetProps<unknown>) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const div = dropRef?.current || ref.current;
        if (div) {
            const onDragOver = (event: DragEvent) => {
                event.preventDefault();
                const dt = event.dataTransfer;
                if (dt) {
                    if (Array.from(dt.items).every((item) => item.kind === 'file')) {
                        dt.dropEffect = 'copy';
                    } else {
                        dt.dropEffect = 'none';
                    }
                }
            };

            const onDragEnd = (event: DragEvent) => {
                const dt = event.dataTransfer;
                if (dt?.items) {
                    for (let i = 0; i < dt.items.length; i++) {
                        dt.items.remove(i);
                    }
                } else {
                    dt?.clearData();
                }
            };

            const onDrop = (event: DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
                const targetDrive = drive ?? 1;  //TODO(whscullin) Maybe pick available drive

                const dt = event.dataTransfer;
                if (dt?.files.length === 1 && storage) {
                    spawn(async () => {
                        try {
                            await loadLocalFile(storage, formats, targetDrive, dt.files[0]);
                        } catch (e) {
                            onError(e);
                        }
                    });
                } else if (dt?.files.length === 2 && storage) {
                    spawn(async () => {
                        try {
                            await loadLocalFile(storage, formats, 1, dt.files[0]);
                            await loadLocalFile(storage, formats, 2, dt.files[1]);
                        } catch (e) {
                            onError(e);
                        }
                    });
                }
            };

            div.addEventListener('dragover', onDragOver);
            div.addEventListener('dragend', onDragEnd);
            div.addEventListener('drop', onDrop);

            return () => {
                div.removeEventListener('dragover', onDragOver);
                div.removeEventListener('dragend', onDragEnd);
                div.removeEventListener('drop', onDrop);
            };
        }
    }, [drive, dropRef, formats, onError, storage]);

    return (
        <div ref={ref} {...props}>
            {children}
        </div>
    );
};
