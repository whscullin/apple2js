import { h } from 'preact';
import cs from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import { ControlStrip } from './ControlStrip';
import { Debugger } from './debugger/Debugger';
import { ErrorModal } from './ErrorModal';
import { Inset } from './Inset';
import { Keyboard } from './Keyboard';
import { LanguageCard } from './LanguageCard';
import { Mouse } from './Mouse';
import { Screen } from './Screen';
import { Drives } from './Drives';
import { Slinky } from './Slinky';
import { ThunderClock } from './ThunderClock';
import { Videoterm } from './Videoterm';
import { spawn, Ready } from './util/promises';

import styles from './css/Apple2.module.scss';
import { SupportedSectors } from 'js/formats/types';

declare global {
    interface Window {
        apple2: Apple2Impl;
    }
}

/**
 * Interface for the Apple2 component.
 */
export interface Apple2Props {
    characterRom: string;
    enhanced: boolean;
    e: boolean;
    gl: boolean;
    rom: string;
    sectors: SupportedSectors;
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
    const screenRef = useRef<HTMLCanvasElement>(null);
    const [apple2, setApple2] = useState<Apple2Impl>();
    const [error, setError] = useState<unknown>();
    const [ready, setReady] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const drivesReady = useMemo(() => new Ready(setError), []);

    const io = apple2?.getIO();
    const cpu = apple2?.getCPU();
    const vm = apple2?.getVideoModes();
    const rom = apple2?.getROM();

    const doPaste = useCallback((event: Event) => {
        if (
            (document.activeElement !== screenRef.current) &&
            (document.activeElement !== document.body)
        ) {
            return;
        }
        if (io) {
            const paste = (event.clipboardData || window.clipboardData)?.getData('text');
            if (paste) {
                io.setKeyBuffer(paste);
            }
        }
        event.preventDefault();
    }, [io]);

    const doCopy = useCallback((event: Event) => {
        if (
            (document.activeElement !== screenRef.current) &&
            (document.activeElement !== document.body)
        ) {
            return;
        }
        if (vm) {
            event.clipboardData?.setData('text/plain', vm.getText());
        }
        event.preventDefault();
    }, [vm]);

    useEffect(() => {
        if (screenRef.current) {
            const options = {
                canvas: screenRef.current,
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
                    await drivesReady.ready;
                    if (signal.aborted) {
                        setApple2(undefined);
                        return;
                    }
                    apple2.reset();
                    apple2.run();
                } catch (e) {
                    setError(e);
                }
                setReady(true);
            });

            window.apple2 = apple2;

            return () => controller.abort();
        }
    }, [props, drivesReady]);

    useEffect(() => {
        const { current } = screenRef;

        window.addEventListener('paste', doPaste);
        window.addEventListener('copy', doCopy);

        current?.addEventListener('paste', doPaste);
        current?.addEventListener('copy', doCopy);

        return () => {
            window.removeEventListener('paste', doPaste);
            window.removeEventListener('copy', doCopy);

            current?.removeEventListener('paste', doPaste);
            current?.removeEventListener('copy', doCopy);
        };
    }, [doCopy, doPaste]);

    const toggleDebugger = useCallback(() => {
        setShowDebug((on) => !on);
    }, []);

    return (
        <div className={styles.container}>
            <div
                className={cs(styles.outer, { apple2e: e, [styles.ready]: ready })}
            >
                <Screen screenRef={screenRef} />
                {!e ? <LanguageCard cpu={cpu} io={io} rom={rom} slot={0} /> : null}
                <Slinky io={io} slot={2} />
                {!e ? <Videoterm io={io} slot={3} /> : null}
                <Mouse cpu={cpu} screenRef={screenRef} io={io} slot={4} />
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
            {showDebug ? <Debugger apple2={apple2} /> : null}
        </div>
    );
};
