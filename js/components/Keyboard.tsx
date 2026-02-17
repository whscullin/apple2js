import React from 'react';
import cs from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Apple2 as Apple2Impl } from '../apple2';
import {
    keys2,
    keys2e,
    keyspravetz82,
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
const Label = ({ symbol }: { symbol: string }) => {
    const small = symbol.length > 1 && !symbol.startsWith('&');
    return (
        <div
            className={cs(styles.symbol, { [styles.small]: small })}
            dangerouslySetInnerHTML={{ __html: symbol }}
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
    const twoSymbol = upper !== lower;
    const center = upper.length > 1 && upper !== 'BELL';
    return (
        <div
            className={cs(styles.key, styles[`key-${keyName}`], {
                [styles.center]: center,
                [styles.pressed]: pressed,
                [styles.active]: active,
            })}
            data-key1={lower}
            data-key2={upper}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
        >
            <Label symbol={upper} />
            {twoSymbol && <Label symbol={lower} />}
        </div>
    );
};

/**
 * Keyboard properties
 */
export interface KeyboardProps {
    apple2: Apple2Impl | undefined;
    layout: 'apple2' | 'apple2e' | 'pravetz82';
    screenRef: React.RefObject<HTMLCanvasElement>;
}

/**
 * Keyboard component that can render an Apple ][ or //e keyboard
 * and accept keyboard and mouse input. Relies heavily on the
 * ancient keyboard css to achieve its appearance.
 *
 * @param apple2 Apple2 object
 * @returns Keyboard component
 */
export const Keyboard = ({ apple2, layout, screenRef }: KeyboardProps) => {
    const [pressed, setPressed] = useState<string[]>([]);
    const keyboardRef = React.useRef<HTMLDivElement>(null);
    const [active, setActive] = useState<string[]>(['LOCK']);
    const keys = useMemo(() => {
        switch (layout) {
            case 'apple2e':
                return keysAsTuples(keys2e);
            case 'pravetz82':
                return keysAsTuples(keyspravetz82);
            default:
                return keysAsTuples(keys2);
        }
    }, [layout]);

    // Set global keystroke handler
    useEffect(() => {
        const keyDown = (event: KeyboardEvent) => {
            if (!apple2) {
                return;
            }

            const targetElements: Array<Element | null> = [
                screenRef.current,
                keyboardRef.current,
            ];
            if (
                document.activeElement &&
                !targetElements.includes(document.activeElement)
            ) {
                return;
            }

            event.preventDefault();

            const { key, keyCode, keyLabel } = mapKeyboardEvent(
                event,
                layout,
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
            const { key, keyLabel } = mapKeyboardEvent(event, layout);
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
    }, [apple2, layout, active, screenRef]);

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
                layout,
                active.includes('SHIFT') || active.includes('ЛАТ'),
                active.includes('CTRL'),
                active.includes('LOCK')
            );
            if (keyCode !== 0xff) {
                io.keyDown(keyCode);
            } else if (key) {
                switch (key) {
                    case 'SHIFT':
                    case 'ЛАТ': // Shift on Pravetz 82 switches to cyrillic.'
                    case 'CTRL':
                    case 'LOCK':
                        toggleActive(key);
                        break;
                    case 'RESET':
                    case 'RST':
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
        [apple2, layout, active, pressed]
    );

    const onMouseUp = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            const { keyLabel } = mapMouseEvent(
                event,
                layout,
                active.includes('SHIFT') || active.includes('ЛАТ'),
                active.includes('CTRL'),
                active.includes('LOCK')
            );
            apple2?.getIO().keyUp();
            setPressed(pressed.filter((x) => x !== keyLabel));
        },
        [apple2, layout, active, pressed]
    );

    const bindKey = ([lower, upper]: [string, string], index: number) => (
        <Key
            key={`${lower}-${upper}-${index}`}
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

    return (
        <div className={styles.keyboard} tabIndex={0} ref={keyboardRef}>
            {rows}
        </div>
    );
};
