import { h } from 'preact';
import cs from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import Apple2IO from '../apple2io';
import CPU6502 from '../cpu6502';
import { ControlStrip } from './ControlStrip';
import { Debugger } from './Debugger';
import { ErrorModal } from './ErrorModal';
import { Inset } from './Inset';
import { Keyboard } from './Keyboard';
import { Mouse } from './Mouse';
import { Screen } from './Screen';
import { Drives } from './Drives';
import { Slinky } from './Slinky';
import { ThunderClock } from './ThunderClock';
import { Videoterm } from './Videoterm';
import { spawn, Ready } from './util/promises';

import styles from './css/Apple2.module.css';

/**
 * Interface for the Apple2 component.
 */
export interface Apple2Props {
    characterRom: string;
    enhanced: boolean;
    e: boolean;
    gl: boolean;
    rom: string;
    sectors: number;
}

/**
 * Component to bind various UI components together to form
 * the application layout. Includes the screen, drives,
 * emulator controls and keyboard. Bootstraps the core
 * Apple2 emulator.
 *
 * @param props Apple2 initialization props
 * @returns
 */
export const Apple2 = (props: Apple2Props) => {
    const { e, enhanced, sectors } = props;
    const screen = useRef<HTMLCanvasElement>(null);
    const [apple2, setApple2] = useState<Apple2Impl>();
    const [io, setIO] = useState<Apple2IO>();
    const [cpu, setCPU] = useState<CPU6502>();
    const [error, setError] = useState<unknown>();
    const [ready, setReady] = useState(false);
    const [showDebug, setShowDebug] = useState(true);
    const drivesReady = useMemo(() => new Ready(setError), []);

    useEffect(() => {
        if (screen.current) {
            const options = {
                canvas: screen.current,
                tick: () => { /* do nothing */ },
                ...props,
            };
            const apple2 = new Apple2Impl(options);
            const controller = spawn(async (signal) => {
                try {
                    await apple2.ready;
                    if (signal.aborted) {
                        return;
                    }
                    setApple2(apple2);
                    setIO(apple2.getIO());
                    setCPU(apple2.getCPU());
                    await drivesReady.ready;
                    if (signal.aborted) {
                        setApple2(undefined);
                        setIO(undefined);
                        setCPU(undefined);
                        return;
                    }
                    apple2.reset();
                    apple2.run();
                } catch (e) {
                    setError(e);
                }
                setReady(true);
            });
            return () => controller.abort();
        }
    }, [props, drivesReady]);

    const toggleDebugger = useCallback(() => {
        setShowDebug((on) => !on);
    }, []);

    return (
        <div className={styles.container}>
            <div className={cs(styles.outer, { apple2e: e, [styles.ready]: ready })}>
                <Screen screen={screen} />
                <Slinky io={io} slot={2} />
                {!e ? <Videoterm io={io} slot={3} /> : null}
                <Mouse cpu={cpu} screen={screen} io={io} slot={4} />
                <ThunderClock io={io} slot={5} />
                <Inset>
                    <Drives cpu={cpu} io={io} sectors={sectors} enhanced={enhanced} ready={drivesReady} />
                </Inset>
                <ControlStrip apple2={apple2} e={e} toggleDebugger={toggleDebugger} />
                <Inset>
                    <Keyboard apple2={apple2} e={e} />
                </Inset>
                <ErrorModal error={error} setError={setError} />
            </div>
            {showDebug ? <Debugger apple2={apple2} e={e} /> : null}
        </div>
    );
};
