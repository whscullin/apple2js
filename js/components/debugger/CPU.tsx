import { h, JSX } from 'preact';
import cs from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../../apple2';
import { ControlButton } from '../ControlButton';
import { FileChooser } from '../FileChooser';
import { loadLocalBinaryFile } from '../util/files';
import { spawn } from '../util/promises';
import { toHex } from 'js/util';

import styles from './css/CPU.module.css';
import debuggerStyles from './css/Debugger.module.css';

export interface CPUProps {
    apple2: Apple2Impl | undefined;
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
const VALID_PAGE = /^[0-9A-F]{1,2}$/i;
const VALID_ADDRESS = /^[0-9A-F]{1,4}$/i;

const ERROR_ICON = (
    <div className={styles.invalid}>
        <i
            className="fa-solid fa-triangle-exclamation"
            title="Invalid hex address"
        />
    </div>
);

export const CPU = ({ apple2 }: CPUProps) => {
    const debug = apple2?.getDebugger();
    const [data, setData] = useState<DebugData>({
        running: true,
        registers: '',
        stack: '',
        trace: '',
        zeroPage: '',
        memory: '',
    });
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

    const {
        memory,
        registers,
        running,
        stack,
        trace,
        zeroPage
    } = data;

    const memoryPageValid = VALID_PAGE.test(memoryPage);
    const loadAddressValid = VALID_ADDRESS.test(loadAddress);

    return (
        <div className={debuggerStyles.column}>
            <span className={debuggerStyles.subHeading}>Controls</span>
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
            <div className={debuggerStyles.row}>
                <div className={debuggerStyles.column}>
                    <span className={debuggerStyles.subHeading}>Registers</span>
                    <pre>
                        {registers}
                    </pre>
                    <span className={debuggerStyles.subHeading}>Trace</span>
                    <pre className={styles.trace}>
                        {trace}
                    </pre>
                    <span className={debuggerStyles.subHeading}>ZP</span>
                    <pre className={styles.zeroPage}>
                        {zeroPage}
                    </pre>
                </div>
                <div className={debuggerStyles.column}>
                    <span className={debuggerStyles.subHeading}>Stack</span>
                    <pre className={styles.stack}>
                        {stack}
                    </pre>
                </div>
            </div>
            <div>
                <hr />
                <span className={debuggerStyles.subHeading}>Memory Page: $ </span>
                <input
                    value={memoryPage}
                    onChange={doMemoryPage}
                    maxLength={2}
                    className={cs({ [styles.invalid]: !memoryPageValid })}
                />
                {memoryPageValid ? null : ERROR_ICON}
                <pre className={styles.zp}>
                    {memory}
                </pre>
            </div>
            <div>
                <hr />
                <span className={debuggerStyles.subHeading}>Load File: $ </span>
                <input
                    type="text"
                    value={loadAddress}
                    maxLength={4}
                    onChange={doLoadAddress}
                    className={cs({ [styles.invalid]: !loadAddressValid })}
                />
                {loadAddressValid ? null : ERROR_ICON}
                {' '}
                <input type="checkbox" checked={run} onChange={doRunCheck} />Run
                <div className={styles.fileChooser}>
                    <FileChooser onChange={doChooseFile} />
                </div>
            </div>
        </div>
    );
};
