import { h } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { includes } from '../types';
import { NibbleFormat, DISK_FORMATS, NIBBLE_FORMATS } from '../formats/types';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { initGamepad } from '../ui/gamepad';

interface FileModalProps {
    show: boolean
    onOpen: (name: string, fmt: NibbleFormat, rawData: ArrayBuffer) => boolean
    onCancel: () => void
}

export const FileModal = ({ show, onOpen, onCancel } : FileModalProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<boolean>(false);
    const [empty, setEmpty] = useState<boolean>(true);

    const onClick = useCallback(() => {
        if (inputRef.current && inputRef.current.files?.length === 1) {
            setBusy(true);
            const file = inputRef.current.files[0];
            const fileReader = new FileReader();
            fileReader.onload = function () {
                const result = this.result as ArrayBuffer;
                const parts = file.name.split('.');
                const ext = parts.pop()!.toLowerCase();
                const name = parts.join('.');

                if (includes(DISK_FORMATS, ext)) {
                    if (result.byteLength >= 800 * 1024) {
                        console.error(`Unable to load ${name}`);
                    } else {
                        if (
                            includes(NIBBLE_FORMATS, ext) &&
                            onOpen(name, ext, result)
                        ) {
                            initGamepad();
                        } else {
                            console.error(`Unable to load ${name}`);
                        }
                    }
                }
                setBusy(false);
            };
            fileReader.readAsArrayBuffer(file);
        }
    }, [ onOpen ]);

    const onChange = useCallback(() => {
        if (inputRef) {
            setEmpty(!inputRef.current?.files?.length);
        }
    }, [ inputRef ]);

    return (
        <Modal title="Open File" show={show}>
            <ModalContent>
                <input type="file" ref={inputRef} onChange={onChange} />
            </ModalContent>
            <ModalFooter>
                <button onClick={onCancel}>Cancel</button>
                <button onClick={onClick} disabled={busy || empty}>Open</button>
            </ModalFooter>
        </Modal>
    );
};
