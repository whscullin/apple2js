import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { CPUMeter } from './CPUMeter';
import { Inset } from './Inset';
import { Apple2 as Apple2Impl } from '../apple2';
import { Audio } from '../ui/audio';

const README = 'https://github.com/whscullin/apple2js#readme';

interface ControlStripProps {
    apple2?: Apple2Impl
    e: boolean
}

export const ControlStrip = ({ apple2, e }: ControlStripProps) => {
    const [running, setRunning] = useState(true);
    const [audio, setAudio] = useState<Audio>();

    useEffect(() => {
        if (apple2) {
            apple2.ready.then(() =>
                setAudio(new Audio(apple2.getIO()))
            ).catch(console.error);
        }
    }, [apple2]);

    const doPause = useCallback(() => {
        apple2?.stop();
        setRunning(false);
    }, [apple2]);

    const doRun = useCallback(() => {
        apple2?.run();
        setRunning(true);
    }, [apple2]);

    const doToggleSound = useCallback(() => {
        audio?.isEnabled();
    }, [audio]);

    const doReset = useCallback(() => {
        apple2?.reset();
    }, [apple2]);

    const doReadme = useCallback(() => {
        window.open(README, '_blank');
    }, []);

    return (
        <div id="reset-row">
            <Inset>
                <CPUMeter apple2={apple2} />
                {running ? (
                    <button onClick={doPause} title="About">
                        <i class="fas fa-pause"></i>
                    </button>
                ) : (
                    <button onClick={doRun} title="About">
                        <i class="fas fa-play"></i>
                    </button>
                )}
                <button id="toggle-sound" onClick={doToggleSound} title="Toggle Sound">
                    <i class="fas fa-volume-off"></i>
                </button>
                <div style={{flexGrow: 1}} />
                <button onClick={doReadme} title="About">
                    <i class="fas fa-info"></i>
                </button>
            </Inset>
            {e && (
                <button id="reset" onClick={doReset}>
                    Reset
                </button>
            )}
        </div>
    );
};
