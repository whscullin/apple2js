import { h, Fragment, JSX } from 'preact';
import cs from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import {
    keys2,
    keys2e,
    mapKeyEvent,
    mapMouseEvent,
    keysAsTuples
} from './util/keyboard';

/**
 * Convenience function for massaging key labels for upper
 * and lower case
 *
 * @param key Raw key label
 * @returns Span representing that label
 */

const buildLabel = (key: string) => {
    const small = key.length > 1 && !key.startsWith('&');
    return (
        <span
            className={cs({ small })}
            dangerouslySetInnerHTML={{ __html: key }}
        />
    );
};

/**
 * Key properties
 */

interface KeyProps {
    lower: string
    upper: string
    active: boolean,
    pressed: boolean
    onMouseDown: (event: MouseEvent) => void
    onMouseUp: (event: MouseEvent) => void
}

/**
 * Individual Key components. Sets up DOM data attributes to be passed to mouse
 * handlers
 *
 * @param lower Lower key symbol
 * @param upper Upper key symbol
 * @param active Active state for shift, control, lock
 * @param pressed Pressed state
 * @param onMouseDown mouse down callback
 * @param onMouseUp mouse up callback
 */
export const Key = ({
    lower,
    upper,
    active,
    pressed,
    onMouseDown,
    onMouseUp
}: KeyProps) => {
    const keyName = lower.replace(/[&#;]/g, '');
    const center =
        lower === 'LOCK' ?
            'v-center2' :
            (upper === lower && upper.length > 1 ?
                'v-center'
                : ''
            );
    return (
        <div
            className={cs(
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

/**
 * Keyboard properties
 */
export interface KeyboardProps {
    apple2: Apple2Impl | undefined
    e: boolean
}

/**
 * Keyboard component that can render an Apple ][ or //e keyboard
 * and accept keyboard and mouse input. Relies heavily on the
 * ancient keyboard css to achieve its appearance.
 *
 * @param apple2 Apple2 object
 * @returns Keyboard component
 */

export const Keyboard = ({ apple2, e }: KeyboardProps) => {
    const [pressed, setPressed] = useState<string[]>([]);
    const [active, setActive] = useState<string[]>(['LOCK']);
    const keys = useMemo(() => keysAsTuples(e ? keys2e : keys2 ), [e]);

    // Set global keystroke handler
    useEffect(() => {
        const keyDown = (event: KeyboardEvent) => {
            const key = mapKeyEvent(event, active.includes('LOCK'));
            if (key !== 0xff) {
                // CTRL-SHIFT-DELETE for reset
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

    const onMouseUp = useCallback(
        (event: JSX.TargetedMouseEvent<HTMLElement>) => {
            const { keyLabel } = mapMouseEvent(
                event,
                active.includes('SHIFT'),
                active.includes('CTRL'),
                active.includes('LOCK'),
                true
            );
            apple2?.getIO().keyUp();
            setPressed(pressed.filter(x => x !== keyLabel));
        },
        [apple2, active, pressed]
    );

    const bindKey = ([lower, upper]: [string, string]) =>
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
        <div id="keyboard" style={{ marginLeft: e ? 0 : 15 }}>
            {rows}
        </div>
    );
};
