import { h } from 'preact';
import cs from 'classnames';
import { VideoModes } from 'js/videomodes';

import styles from './css/ControlButton.module.scss';

export interface ClipboardCopyProps {
    vm: VideoModes | undefined;
}

export function ClipboardCopy({ vm }: ClipboardCopyProps) {
    const doCopy = function () {
        const asyncCopy = async function () {
            if (vm) {
                await navigator.clipboard.writeText(vm.getText());
            }
        };
        void asyncCopy();
    };
    return (
        <button className={styles.iconButton} onClick={doCopy} title="Copy">
            <i className={cs('fa', 'fa-copy')} />
        </button>
    );
}
