import { h, Fragment, JSX } from 'preact';
import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import { mapKeyEvent, keys2e, mapMouseEvent } from './util/keyboard';

export interface KeyboardProps {
    apple2: Apple2Impl | undefined
}

const keysAsTuples = (): string[][][] => {
    const rows = [];
    for (let idx = 0; idx < keys2e[0].length; idx++) {
        const upper = keys2e[0][idx];
        const lower = keys2e[1][idx];
        const keys = [];
        for (let jdx = 0; jdx < upper.length; jdx++) {
            keys.push([upper[jdx], lower[jdx]]);
        }
        rows.push(keys);
    }
    return rows;
};

const keys = keysAsTuples();

const buildLabel = (key: string) => {
    const small = key.length > 1 && !key.startsWith('&');
    return (
        <span
            className={classNames({ small })}
            dangerouslySetInnerHTML={{__html: key}}
        />
    );
};

interface KeyProps {
    lower: string
    upper: string
    active: boolean,
    pressed: boolean
    onMouseDown: (event: MouseEvent) => void
    onMouseUp: (event: MouseEvent) => void
}

export const Key = ({ lower, upper, active, pressed, onMouseDown, onMouseUp }: KeyProps) => {
    const keyName = lower.replace(/[&#;]/g, '');
    const center =
        lower === 'LOCK' ?
            'v-center2' :
            (upper === lower && upper.length > 0 ?
                'v-center'
                : ''
            );
    return (
        <div
            className={classNames(
                'key',
                `key-${keyName}`,
                center,
                { pressed, active },
            )}
            data-key1={lower}
            data-key2={upper}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
        >
            <div>
                {buildLabel(upper)}
                {upper !== lower && <><br />{buildLabel(lower)}</>}
            </div>
        </div>
    );
};

export const Keyboard = ({ apple2 }: KeyboardProps) => {
    const [pressed, setPressed] = useState<string[]>([]);
    const [active, setActive] = useState<string[]>(['LOCK']);

    // Set global keystroke handler
    useEffect(() => {
        const keyDown = (event: KeyboardEvent) => {
            const key = mapKeyEvent(event, active.includes('LOCK'));
            if (key !== 0xff) {
                if (key === 0x7F && event.shiftKey && event.ctrlKey) {
                    apple2?.reset();
                } else {
                    apple2?.getIO().keyDown(key);
                }
            }
        };
        const keyUp = () => {
            apple2?.getIO().keyUp();
        };
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);

        return () => {
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('keyup', keyUp);
        };
    }, [apple2, active]);

    const onMouseDown = useCallback(
        (event: JSX.TargetedMouseEvent<HTMLElement>) => {
            if (!apple2) {
                return;
            }
            const toggleActive = (key: string) => {
                if (!active.includes(key)) {
                    setActive([...active, key]);
                } else {
                    setActive(active.filter(x => x !== key));
                }
            };

            const io = apple2.getIO();
            const { keyCode, key, keyLabel } = mapMouseEvent(
                event,
                active.includes('SHIFT'),
                active.includes('CTRL'),
                active.includes('LOCK'),
                true
            );
            if (keyCode !== 0xff) {
                io.keyDown(keyCode);
            } else if (key) {
                switch (key) {
                    case 'SHIFT':
                    case 'CTRL':
                    case 'LOCK':
                        toggleActive(key);
                        break;
                    case 'RESET':
                        apple2.reset();
                        break;
                    case 'OPEN_APPLE':
                        io.ioSwitch(0, io.ioSwitch(0) ? 0 : 1);
                        toggleActive(key);
                        break;
                    case 'CLOSED_APPLE':
                        io.ioSwitch(1, io.ioSwitch(1) ? 0 : 1);
                        toggleActive(key);
                        break;
                    default:
                        break;
                }
            }
            setPressed([...pressed, keyLabel]);
        },
        [apple2, active, pressed]
    );

    const onMouseUp = useCallback((event: JSX.TargetedMouseEvent<HTMLElement>) => {
        const { keyLabel } = mapMouseEvent(
            event,
            active.includes('SHIFT'),
            active.includes('CTRL'),
            active.includes('LOCK'),
            true
        );
        apple2?.getIO().keyUp();
        setPressed(pressed.filter(x => x !== keyLabel));
    }, [apple2, active, pressed]);

    const bindKey = ([lower, upper] : [string, string]) =>
        <Key
            lower={lower}
            upper={upper}
            active={active.includes(lower)}
            pressed={pressed.includes(upper)}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
        />;

    const rows = keys.map((row, idx) =>
        <div className={`row row${idx}`}>
            {row.map(bindKey)}
        </div>
    );

    return (
        <div id="keyboard">
            {rows}
        </div>
    );
};
