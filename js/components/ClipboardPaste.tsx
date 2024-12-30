import { h } from 'preact';
import cs from 'classnames';
import Apple2IO from 'js/apple2io';

import styles from './css/ControlButton.module.scss';

export interface PasteToClipboardProps {
    io: Apple2IO | undefined;
}

export function ClipboardPaste({ io }: PasteToClipboardProps) {
    function doPaste() {
        const asyncPaste = async function () {
            if (io) {
                const text = await navigator.clipboard.readText();
                io.setKeyBuffer(text);
            }
        };
        void asyncPaste();
    }
    return (
        <button className={styles.iconButton} onClick={doPaste} title="Paste">
            <i className={cs('fa', 'fa-paste')} />
        </button>
    );
}
