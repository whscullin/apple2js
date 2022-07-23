import { h, Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
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

    const { fileName, text } = fileData;

    return (
        <>
            <Modal isOpen={true} onClose={onClose} title={fileName}>
                <ModalContent>
                    <pre className={styles.fileViewer} tabIndex={-1} >
                        {text}
                    </pre>
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
