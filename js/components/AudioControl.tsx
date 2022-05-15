import { h } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { ControlButton } from './ControlButton';
import { OptionsContext } from './OptionsContext';
import { Audio, SOUND_ENABLED_OPTION } from '../ui/audio';
import { Apple2 as Apple2Impl } from '../apple2';

/**
 * AudioControl component properties.
 */
export interface AudioControlProps {
    apple2: Apple2Impl | undefined;
}

/**
 * Control that instantiates the Audio object and provides
 * a control to mute and unmute audio.
 *
 * @param apple2 The Apple2 object
 * @returns AudioControl component
 */
export const AudioControl = ({ apple2 }: AudioControlProps) => {
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [audio, setAudio] = useState<Audio>();
    const options = useContext(OptionsContext);

    useEffect(() => {
        if (apple2) {
            apple2.ready.then(() => {
                const io = apple2.getIO();
                const audio = new Audio(io);
                options.addOptions(audio);
                setAudio(audio);
                setAudioEnabled(audio.isEnabled());
            }).catch(console.error);
        }
    }, [apple2]);

    const doToggleSound = useCallback(() => {
        const on = !audio?.isEnabled();
        options.setOption(SOUND_ENABLED_OPTION, on);
        setAudioEnabled(on);
    }, [audio]);

    return (
        <ControlButton
            onClick={doToggleSound}
            title="Toggle Sound"
            icon={audioEnabled ? 'volume-up' : 'volume-off'}
        />
    );
};
