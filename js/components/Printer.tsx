import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Apple2IO, { slot } from 'js/apple2io';
import Parallel, { ParallelOptions } from 'js/cards/parallel';
import { Modal, ModalContent, ModalFooter } from './Modal';

import styles from './css/Printer.module.scss';
import { ControlButton } from './ControlButton';
import { byte } from 'js/types';

export interface PrinterProps {
    io: Apple2IO | undefined;
    slot: slot;
}

export const Printer = ({ io, slot }: PrinterProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState('');
    const raw = useRef(new Uint8Array(1024));
    const rawLength = useRef(0);
    const [href, setHref] = useState('');

    const cbs = useMemo<ParallelOptions>(
        () => ({
            putChar: (val: byte) => {
                const ascii = val & 0x7f;
                const visible = val >= 0x20;
                const char = String.fromCharCode(ascii);

                if (char === '\r') {
                    // Skip for once
                } else if (char === '\t') {
                    // possibly not right due to tab stops
                    setContent((content) => (content += '        '));
                } else if (ascii === 0x04) {
                    setContent((content) => (content = content.slice(0, -1)));
                    return;
                } else if (visible) {
                    setContent((content) => (content += char));
                }

                raw.current[rawLength.current++] = val;
                if (rawLength.current > raw.current.length) {
                    const newRaw = new Uint8Array(raw.current.length * 2);
                    newRaw.set(raw.current);
                    raw.current = newRaw;
                }
            },
        }),
        [rawLength]
    );

    useEffect(() => {
        if (io) {
            const parallel = new Parallel(cbs);
            io.setSlot(slot, parallel);
        }
    }, [cbs, io, slot]);

    useEffect(() => {
        if (isOpen) {
            const blob = new Blob([raw.current.slice(0, rawLength.current)], {
                type: 'application/octet-stream',
            });
            const href = window.URL.createObjectURL(blob);
            setHref(href);
        }
    }, [isOpen]);

    const onClear = useCallback(() => {
        setContent('');
        rawLength.current = 0;
    }, []);
    const onClose = useCallback(() => {
        setIsOpen(false);
    }, []);
    const onOpen = useCallback(() => {
        setIsOpen(true);
    }, []);

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Printer">
                <ModalContent>
                    <pre className={styles.printer} tabIndex={-1}>
                        {content}
                    </pre>
                </ModalContent>
                <ModalFooter>
                    <a
                        download="raw_printer_output.bin"
                        href={href}
                        role="button"
                    >
                        Download Raw
                    </a>
                    <button onClick={onClear}>Clear</button>
                    <button onClick={onClose}>OK</button>
                </ModalFooter>
            </Modal>
            <ControlButton
                icon="print"
                title="Printer"
                onClick={onOpen}
                active={content.length > 0}
            />
        </>
    );
};
