import { h, Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import styles from './css/ControlButton.module.scss';
import cs from 'classnames';

import Apple2IO from 'js/apple2io';
import Tape, { TAPE_TYPES } from 'js/ui/tape';
import { debug } from 'js/util';
import { noAwait } from './util/promises';

import { FileChooser } from './FileChooser';
import { Modal, ModalContent } from './Modal';

const CASSETTE_TYPES: FilePickerAcceptType[] = [
    {
        description: 'Audio Files',
        accept: {
            'application/octet-stream': TAPE_TYPES.map((x) => '.' + x),
        },
    },
];

export interface CassetteParams {
    io: Apple2IO | undefined;
}

export const Cassette = ({ io }: CassetteParams) => {
    const tape = useMemo(() => (io ? new Tape(io) : null), [io]);
    const [active, setActive] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const onClose = () => setIsOpen(false);
    const onChange = (handles: FileSystemFileHandle[]) => {
        if (tape && handles.length > 0) {
            const load = async () => {
                debug('Loading Cassette');
                const file = await handles[0].getFile();
                tape.doLoadLocalTape(file, () => debug('Cassette Loaded'));
            };
            noAwait(load)();
            onClose();
            setActive(true);
        }
    };

    return (
        <>
            <Modal
                title="Select Audio Cassette"
                isOpen={isOpen}
                onClose={onClose}
            >
                <ModalContent>
                    <FileChooser onChange={onChange} accept={CASSETTE_TYPES} />
                </ModalContent>
            </Modal>
            <button
                className={styles.iconButton}
                onClick={() => setIsOpen(true)}
                title="Cassette"
            >
                <i
                    className={cs('bi', 'bi-cassette', {
                        [styles.active]: active,
                    })}
                />
            </button>
        </>
    );
};
