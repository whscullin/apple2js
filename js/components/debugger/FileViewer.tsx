import { HiresPage2D, LoresPage2D, VideoModes2D } from 'js/canvas';
import { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalFooter } from '../Modal';

import styles from './css/FileViewer.module.scss';
import RAM from 'js/ram';

/**
 * Binary and text representation of file to be previewed
 */
export interface FileData {
    fileName: string;
    binary: Uint8Array;
    text: string;
}

/**
 * FileViewer props
 */
export interface FileViewerProps {
    fileData: FileData | null;
    onClose: () => void;
}

/**
 * Preview a file as a hires image if a file is roughly 8192 bytes.
 * Leverages HiresPage2D.
 *
 * @param binary Potential file to preview
 * @returns HiresPreview component
 */
const HiresPreview = ({ binary }: { binary: Uint8Array }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Hires pictures are often a few bytes short of 8192 bytes
    // because that saves a sector on DOS 3.3 disks.
    if (binary.byteLength < 8184 || binary.byteLength > 8192) {
        return null;
    }

    if (canvasRef.current) {
        const vm = new VideoModes2D(canvasRef.current, true);
        const lores = new LoresPage2D(
            vm,
            1,
            [new RAM(0x4, 0x8)],
            new Uint8Array(),
            false
        );
        const hires = new HiresPage2D(vm, 1, [new RAM(0x2, 0x4)]);
        vm.setLoresPage(1, lores);
        vm.setHiresPage(1, hires);
        vm.text(false);
        vm.hires(true);
        vm.doubleHires(false);
        vm.page(1);

        for (let idx = 0; idx < 0x20; idx++) {
            for (let jdx = 0; jdx < 0x100; jdx++) {
                hires.write(idx + 0x20, jdx, binary[idx * 0x100 + jdx]);
            }
        }
        vm.blit();
    }

    return (
        <canvas
            ref={canvasRef}
            width={560}
            height={384}
            className={styles.hiresPreview}
        />
    );
};

/**
 * Preview a file as a double hires if a file is roughly 16384 bytes.
 *
 * @param binary Potential file to preview
 * @returns DoubleHiresPreview component
 */
const DoubleHiresPreview = ({ binary }: { binary: Uint8Array }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    if (binary.byteLength < 16376 || binary.byteLength > 16384) {
        return null;
    }

    if (canvasRef.current) {
        const vm = new VideoModes2D(canvasRef.current, true);
        const lores = new LoresPage2D(
            vm,
            1,
            [new RAM(0x2, 0x4), new RAM(0x2, 0x4)],
            new Uint8Array(),
            false
        );
        const hires = new HiresPage2D(vm, 1, [
            new RAM(0x02, 0x04),
            new RAM(0x02, 0x04),
        ]);
        vm.setLoresPage(1, lores);
        vm.setHiresPage(1, hires);
        vm.text(false);
        vm.hires(true);
        vm._80col(true);
        vm.doubleHires(true);
        vm.page(1);

        for (let idx = 0; idx < 0x20; idx++) {
            for (let jdx = 0; jdx < 0x100; jdx++) {
                hires.bank1().write(idx + 0x20, jdx, binary[idx * 0x100 + jdx]);
            }
        }
        for (let idx = 0x20; idx < 0x40; idx++) {
            for (let jdx = 0; jdx < 0x100; jdx++) {
                hires.bank0().write(idx, jdx, binary[idx * 0x100 + jdx]);
            }
        }
        vm.blit();
    }

    return (
        <canvas
            ref={canvasRef}
            width={560}
            height={384}
            className={styles.hiresPreview}
        />
    );
};

/**
 * Apple file preview component. Supports a binary dump and hires and
 * double hires images.
 *
 * @param fileData
 * @param onClose Close button callback
 * @returns
 */
export const FileViewer = ({ fileData, onClose }: FileViewerProps) => {
    const [binaryHref, setBinaryHref] = useState('');
    const [textHref, setTextHref] = useState('');

    useEffect(() => {
        if (fileData) {
            const { binary, text } = fileData;
            const binaryBlob = new Blob([binary as BlobPart], {
                type: 'application/octet-stream',
            });
            const binaryHref = window.URL.createObjectURL(binaryBlob);
            setBinaryHref(binaryHref);
            const textBlob = new Blob([text], {
                type: 'application/octet-stream',
            });
            const textHref = window.URL.createObjectURL(textBlob);
            setTextHref(textHref);
        }
    }, [fileData]);

    if (!fileData) {
        return null;
    }

    const { fileName, text, binary } = fileData;

    return (
        <>
            <Modal isOpen={true} onClose={onClose} title={fileName}>
                <ModalContent>
                    <div className={styles.fileViewer}>
                        <HiresPreview binary={binary} />
                        <DoubleHiresPreview binary={binary} />
                        <pre className={styles.textViewer} tabIndex={-1}>
                            {text}
                        </pre>
                    </div>
                </ModalContent>
                <ModalFooter>
                    <a
                        download={`${fileName}.bin`}
                        href={binaryHref}
                        role="button"
                    >
                        Download Raw
                    </a>
                    <a
                        download={`${fileName}.txt`}
                        href={textHref}
                        role="button"
                    >
                        Download Text
                    </a>
                    <button onClick={onClose}>Close</button>
                </ModalFooter>
            </Modal>
        </>
    );
};
