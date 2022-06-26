import { h, JSX } from 'preact';
import cs from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import { ControlButton } from './ControlButton';
import { FileChooser } from './FileChooser';
import { Inset } from './Inset';
import { loadLocalBinaryFile } from './util/files';

import styles from './css/Debugger.module.css';
import { spawn } from './util/promises';
import { toHex } from 'js/util';

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

const CIDERPRESS_EXTENSION = /#([0-9a-f]{2})([0-9a-f]{4})$/i;

export const Debugger = ({ apple2 }: DebuggerProps) => {
    const debug = apple2?.getDebugger();
    const [data, setData] = useState<DebugData>();
    const [memoryPage, setMemoryPage] = useState('08');
    const [loadAddress, setLoadAddress] = useState('0800');
    const [run, setRun] = useState(true);
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

    const doLoadAddress = useCallback((event: JSX.TargetedEvent<HTMLInputElement>) => {
        setLoadAddress(event.currentTarget.value);
    }, []);
    const doRunCheck = useCallback((event: JSX.TargetedEvent<HTMLInputElement>) => {
        setRun(event.currentTarget.checked);
    }, []);

    const doMemoryPage = useCallback((event: JSX.TargetedEvent<HTMLInputElement>) => {
        setMemoryPage(event.currentTarget.value);
    }, []);

    const doChooseFile = useCallback((handles: FileSystemFileHandle[]) => {
        if (debug && handles.length === 1) {
            spawn(async () => {
                const file = await handles[0].getFile();
                let atAddress = parseInt(loadAddress, 16) || 0x800;

                const matches = file.name.match(CIDERPRESS_EXTENSION);
                if (matches && matches.length === 3) {
                    const [, , aux] = matches;
                    atAddress = parseInt(aux, 16);
                }

                await loadLocalBinaryFile(file, atAddress, debug);
                setLoadAddress(toHex(atAddress, 4));
                if (run) {
                    debug?.runAt(atAddress);
                }
            });
        }
    }, [debug, loadAddress, run]);

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
            <div className={cs(styles.debugger, styles.column)}>
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
                    <hr />
                    <span className={styles.subHeading}>Memory Page: $ </span>
                    <input
                        value={memoryPage}
                        onChange={doMemoryPage}
                        maxLength={2}
                    />
                    <pre className={styles.zp}>
                        {memory}
                    </pre>
                </div>
                <div>
                    <hr />
                    <span className={styles.subHeading}>Load File: $ </span>
                    <input
                        type="text"
                        value={loadAddress}
                        maxLength={4}
                        onChange={doLoadAddress}
                    />
                    {' '}
                    <input type="checkbox" checked={run} onChange={doRunCheck} />Run
                    <div className={styles.fileChooser}>
                        <FileChooser onChange={doChooseFile} />
                    </div>
                </div>
            </div>
        </Inset>
    );
};
