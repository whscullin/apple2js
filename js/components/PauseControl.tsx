import { h, Fragment } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from 'js/apple2';
import { ControlButton } from './ControlButton';

/**
 * PauseControl component properties.
 */
export interface PauseControlProps {
    apple2: Apple2Impl | undefined;
}

/**
 * Provides a control to pause and unpause the CPU.
 *
 * @param apple2 The Apple2 object
 * @returns PauseControl component
 */
export const PauseControl = ({ apple2 }: PauseControlProps) => {
    const [running, setRunning] = useState(true);

    const doPause = useCallback(() => {
        apple2?.stop();
        setRunning(false);
    }, [apple2]);

    const doRun = useCallback(() => {
        apple2?.run();
        setRunning(true);
    }, [apple2]);

    return (
        <>
            {running ? (
                <ControlButton
                    onClick={doPause}
                    title="Pause"
                    icon="pause"
                />
            ) : (
                <ControlButton
                    onClick={doRun}
                    title="Run"
                    icon="play"
                />
            )}
        </>
    );
};
