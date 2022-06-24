import { h, JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import { Inset } from './Inset';

import styles from './css/Debugger.module.css';
import { ControlButton } from './ControlButton';

export interface DebuggerProps {
    apple2: Apple2Impl | undefined;
    e: boolean;
}

interface DebugData {
    memory: string;
    registers: string;
    running: boolean;
    stack: string;
    trace: string;
    zeroPage: string;
}

export const Debugger = ({ apple2 }: DebuggerProps) => {
    const debug = apple2?.getDebugger();
    const [data, setData] = useState<DebugData>();
    const [memoryPage, setMemoryPage] = useState('08');
    const animationRef = useRef<number>(0);

    const animate = useCallback(() => {
        if (debug) {
            setData({
                registers: debug.dumpRegisters(),
                running: debug.isRunning(),
                stack: debug.getStack(38),
                trace: debug.getTrace(16),
                zeroPage: debug.dumpPage(0),
                memory: debug.dumpPage(parseInt(memoryPage, 16) || 0)
            });
        }
        animationRef.current = requestAnimationFrame(animate);
    }, [debug, memoryPage]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [animate]);

    const doPause = useCallback(() => {
        apple2?.stop();
    }, [apple2]);

    const doRun = useCallback(() => {
        apple2?.run();
    }, [apple2]);

    const doStep = useCallback(() => {
        debug?.step();
    }, [debug]);

    const doMemoryPage = useCallback((event: JSX.TargetedMouseEvent<HTMLInputElement>) => {
        setMemoryPage(event.currentTarget.value);
    }, []);

    if (!data) {
        return null;
    }

    const {
        memory,
        registers,
        running,
        stack,
        trace,
        zeroPage
    } = data;

    return (
        <Inset className={styles.inset}>
            <div className={styles.debugger}>
                <div className={styles.heading}>Debugger</div>
                <span className={styles.subHeading}>Controls</span>
                <div className={styles.controls}>
                    {running ? (
                        <ControlButton
                            onClick={doPause}
                            disabled={!apple2}
                            title="Pause"
                            icon="pause"
                        />
                    ) : (
                        <ControlButton
                            onClick={doRun}
                            disabled={!apple2}
                            title="Run"
                            icon="play"
                        />
                    )}
                    <ControlButton
                        onClick={doStep}
                        disabled={!apple2 || running}
                        title="Step"
                        icon="forward-step"
                    />
                </div>
                <div className={styles.row}>
                    <div className={styles.column}>
                        <span className={styles.subHeading}>Registers</span>
                        <pre>
                            {registers}
                        </pre>
                        <span className={styles.subHeading}>Trace</span>
                        <pre className={styles.trace}>
                            {trace}
                        </pre>
                        <span className={styles.subHeading}>ZP</span>
                        <pre className={styles.zeroPage}>
                            {zeroPage}
                        </pre>
                    </div>
                    <div className={styles.column}>
                        <span className={styles.subHeading}>Stack</span>
                        <pre className={styles.stack}>
                            {stack}
                        </pre>
                    </div>
                </div>
                <div>
                    <span className={styles.subHeading}>Memory Page: $</span>
                    <input
                        min={0x00}
                        max={0xff}
                        value={memoryPage}
                        onChange={doMemoryPage}
                        maxLength={2}
                    />
                    <pre className={styles.zp}>
                        {memory}
                    </pre>
                </div>
            </div>
        </Inset>
    );
};
