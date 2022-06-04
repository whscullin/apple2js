import { h } from 'preact';
import cs from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import Apple2IO from '../apple2io';
import CPU6502 from '../cpu6502';
import { ControlStrip } from './ControlStrip';
import { ErrorModal } from './ErrorModal';
import { Inset } from './Inset';
import { Keyboard } from './Keyboard';
import { Mouse } from './Mouse';
import { Screen } from './Screen';
import { Drives } from './Drives';
import { Slinky } from './Slinky';
import { ThunderClock } from './ThunderClock';
import { Ready } from './util/promises';

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
    const drivesReady = useMemo(() => new Ready(), []);

    useEffect(() => {
        if (screen.current) {
            const options = {
                canvas: screen.current,
                tick: () => { /* do nothing */ },
                ...props,
            };
            const apple2 = new Apple2Impl(options);
            apple2.ready.then(() => {
                setApple2(apple2);
                const io = apple2.getIO();
                const cpu = apple2.getCPU();
                setIO(io);
                setCPU(cpu);
                return drivesReady.promise.then(() => {
                    apple2.reset();
                    apple2.run();
                });
            }).catch((e) => setError(e));
        }
    }, [props, drivesReady]);

    return (
        <div className={cs(styles.outer, { apple2e: e })}>
            <Screen screen={screen} />
            <Slinky io={io} slot={2} />
            <Mouse cpu={cpu} screen={screen} io={io} slot={4} />
            <ThunderClock io={io} slot={5} />
            <Inset>
                <Drives cpu={cpu} io={io} sectors={sectors} enhanced={enhanced} ready={drivesReady} />
            </Inset>
            <ControlStrip apple2={apple2} e={e} />
            <Inset>
                <Keyboard apple2={apple2} e={e} />
            </Inset>
            <ErrorModal error={error} setError={setError} />
        </div>
    );
};
