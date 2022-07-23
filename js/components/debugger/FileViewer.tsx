import { HiresPage2D, LoresPage2D, VideoModes2D } from 'js/canvas';
import { h, Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal, ModalContent, ModalFooter } from '../Modal';

import styles from './css/FileViewer.module.css';

export interface FileData {
    fileName: string;
    binary: Uint8Array;
    text: string;
}

export interface FileViewerProps {
    fileData: FileData | null;
    onClose: () => void;
}

const HiresPreview = ({ binary }: { binary: Uint8Array }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    if (binary.byteLength < 8187 || binary.byteLength > 8197) {
        return null;
    }

    if (canvasRef.current) {
        const vm = new VideoModes2D(canvasRef.current, true);
        const lores = new LoresPage2D(vm, 1, new Uint8Array(), false);
        const hires = new HiresPage2D(vm, 1);
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

    return <canvas ref={canvasRef} width={560} height={192} className={styles.hiresPreview} />;
};


export const FileViewer = ({ fileData, onClose }: FileViewerProps) => {
    const [binaryHref, setBinaryHref] = useState('');
    const [textHref, setTextHref] = useState('');

    useEffect(() => {
        if (fileData) {
            const { binary, text } = fileData;
            const binaryBlob = new Blob(
                [binary],
                { type: 'application/octet-stream' }
            );
            const binaryHref = window.URL.createObjectURL(binaryBlob);
            setBinaryHref(binaryHref);
            const textBlob = new Blob(
                [text],
                { type: 'application/octet-stream' }
            );
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
                        <pre className={styles.textViewer} tabIndex={-1} >
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
