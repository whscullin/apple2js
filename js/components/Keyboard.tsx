import React from 'react';
import cs from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Apple2 as Apple2Impl } from '../apple2';
import {
    keys2,
    keys2e,
    mapMouseEvent,
    keysAsTuples,
    mapKeyboardEvent,
} from './util/keyboard';

import styles from './css/Keyboard.module.scss';

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
            className={cs({ [styles.small]: small })}
            dangerouslySetInnerHTML={{ __html: key }}
        />
    );
};

/**
 * Key properties
 */
interface KeyProps {
    lower: string;
    upper: string;
    active: boolean;
    pressed: boolean;
    onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseUp: (event: React.MouseEvent<HTMLElement>) => void;
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
    onMouseUp,
}: KeyProps) => {
    const keyName = lower.replace(/[&#;]/g, '');
    const center =
        lower === 'LOCK'
            ? styles.vCenter2
            : upper === lower && upper.length > 1
              ? styles.vCenter
              : '';
    return (
        <div
            className={cs(styles.key, styles[`key-${keyName}`], center, {
                [styles.pressed]: pressed,
                [styles.active]: active,
            })}
            data-key1={lower}
            data-key2={upper}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
        >
            <div>
                {buildLabel(upper)}
                {upper !== lower && (
                    <>
                        <br />
                        {buildLabel(lower)}
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * Keyboard properties
 */
export interface KeyboardProps {
    apple2: Apple2Impl | undefined;
    layout: string;
}

/**
 * Keyboard component that can render an Apple ][ or //e keyboard
 * and accept keyboard and mouse input. Relies heavily on the
 * ancient keyboard css to achieve its appearance.
 *
 * @param apple2 Apple2 object
 * @returns Keyboard component
 */
export const Keyboard = ({ apple2, layout }: KeyboardProps) => {
    const [pressed, setPressed] = useState<string[]>([]);
    const [active, setActive] = useState<string[]>(['LOCK']);
    const keys = useMemo(
        () => keysAsTuples(layout === 'apple2e' ? keys2e : keys2),
        [layout]
    );

    // Set global keystroke handler
    useEffect(() => {
        const keyDown = (event: KeyboardEvent) => {
            if (!apple2) {
                return;
            }

            if (
                document.activeElement &&
                document.activeElement !== document.body
            ) {
                return;
            }

            event.preventDefault();

            const { key, keyCode, keyLabel } = mapKeyboardEvent(
                event,
                active.includes('LOCK'),
                active.includes('CTRL')
            );
            setPressed((pressed) => pressed.concat([keyLabel]));
            setActive((active) => active.concat([keyLabel]));

            if (key === 'RESET') {
                apple2.reset();
                return;
            }

            const io = apple2.getIO();
            if (key === 'OPEN_APPLE') {
                io.buttonDown(0, true);
                return;
            }
            if (key === 'CLOSED_APPLE') {
                io.buttonDown(1, true);
                return;
            }

            if (keyCode !== 0xff) {
                apple2.getIO().keyDown(keyCode);
            }
        };
        const keyUp = (event: KeyboardEvent) => {
            if (!apple2) {
                return;
            }
            const { key, keyLabel } = mapKeyboardEvent(event);
            setPressed((pressed) => pressed.filter((k) => k !== keyLabel));
            setActive((active) => active.filter((k) => k !== keyLabel));

            const io = apple2.getIO();
            if (key === 'OPEN_APPLE') {
                io.buttonDown(0, false);
            }
            if (key === 'CLOSED_APPLE') {
                io.buttonDown(1, false);
            }
            apple2.getIO().keyUp();
        };
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);

        return () => {
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('keyup', keyUp);
        };
    }, [apple2, active]);

    const onMouseDown = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            if (!apple2) {
                return;
            }
            // Sometimes control-clicking will open a menu, so don't do that.
            event.preventDefault();
            const toggleActive = (key: string) => {
                if (!active.includes(key)) {
                    setActive([...active, key]);
                    return true;
                }
                setActive(active.filter((x) => x !== key));
                return false;
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
                        io.buttonDown(0, toggleActive(key));
                        toggleActive(key);
                        break;
                    case 'CLOSED_APPLE':
                        io.buttonDown(1, toggleActive(key));
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
        (event: React.MouseEvent<HTMLElement>) => {
            const { keyLabel } = mapMouseEvent(
                event,
                active.includes('SHIFT'),
                active.includes('CTRL'),
                active.includes('LOCK'),
                true
            );
            apple2?.getIO().keyUp();
            setPressed(pressed.filter((x) => x !== keyLabel));
        },
        [apple2, active, pressed]
    );

    const bindKey = ([lower, upper]: [string, string]) => (
        <Key
            lower={lower}
            upper={upper}
            active={active.includes(lower)}
            pressed={pressed.includes(lower)}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
        />
    );

    const rows = keys.map((row, idx) => (
        <div key={idx} className={cs(styles.row, styles[`row${idx}`])}>
            {row.map(bindKey)}
        </div>
    ));

    return <div className={styles.keyboard}>{rows}</div>;
};
