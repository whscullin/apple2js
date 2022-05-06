import { h } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { CPUMeter } from './CPUMeter';
import { Inset } from './Inset';
import { useHotKey } from './hooks/useHotKey';
import { Apple2 as Apple2Impl } from '../apple2';
import { Audio, SOUND_ENABLED_OPTION } from '../ui/audio';
import { OptionsModal} from './OptionsModal';
import { OptionsContext } from './OptionsContext';
import { ControlButton } from './ControlButton';
import { JoyStick } from '../ui/joystick';
import { Screen, SCREEN_FULL_PAGE } from '../ui/screen';
import { System } from '../ui/system';

const README = 'https://github.com/whscullin/apple2js#readme';

interface ControlStripProps {
    apple2?: Apple2Impl
    e: boolean
}

/**
 * Strip containing containing controls for various system
 * characteristics, like CPU speed, audio, and the system
 * options panel.
 *
 * @param apple2 Apple2 object
 * @param e Whether or not this is a //e
 * @returns ControlStrip component
 */

export const ControlStrip = ({ apple2, e }: ControlStripProps) => {
    const [running, setRunning] = useState(true);
    const [audio, setAudio] = useState<Audio>();
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const options = useContext(OptionsContext);

    useEffect(() => {
        if (apple2) {
            apple2.ready.then(() => {
                const io = apple2.getIO();
                const vm = apple2.getVideoModes();

                const system = new System(io, e);
                options.addOptions(system);

                const joystick = new JoyStick(io);
                options.addOptions(joystick);

                const screen = new Screen(vm);
                options.addOptions(screen);

                const audio = new Audio(io);
                options.addOptions(audio);
                setAudio(audio);
                setAudioEnabled(audio.isEnabled());
            }).catch(console.error);
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
        const on = !audio?.isEnabled();
        options.setOption(SOUND_ENABLED_OPTION, on);
        setAudioEnabled(on);
    }, [audio]);

    const doReset = useCallback(() =>
        apple2?.reset()
    , [apple2]);

    const doReadme = useCallback(() =>
        window.open(README, '_blank')
    , []);

    const doShowOptions = useCallback(() =>
        setShowOptions(true)
    , []);

    const doCloseOptions = useCallback(() =>
        setShowOptions(false)
    , []);

    const doToggleFullPage = useCallback(() =>
        options.setOption(
            SCREEN_FULL_PAGE,
            !options.getOption(SCREEN_FULL_PAGE)
        )
    , []);

    useHotKey('F2', doToggleFullPage);
    useHotKey('F4', doShowOptions);
    useHotKey('F12', doReset);

    return (
        <div id="reset-row">
            <OptionsModal isOpen={showOptions} onClose={doCloseOptions} />
            <Inset>
                <CPUMeter apple2={apple2} />
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
                <ControlButton
                    onClick={doToggleSound}
                    title="Toggle Sound"
                    icon={audioEnabled ? 'volume-up' : 'volume-off'}
                />
                <div style={{flexGrow: 1}} />
                <ControlButton onClick={doReadme} title="About" icon="info" />
                <ControlButton onClick={doShowOptions} title="Options (F4)" icon="cog" />
            </Inset>
            {e && (
                <button id="reset" onClick={doReset}>
                    Reset
                </button>
            )}
        </div>
    );
};
