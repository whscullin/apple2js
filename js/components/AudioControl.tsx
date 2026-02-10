import { useCallback, useEffect, useState } from 'react';
import { ControlButton } from './ControlButton';
import { Audio, SOUND_ENABLED_OPTION } from '../ui/audio';
import { Apple2 as Apple2Impl } from '../apple2';
import { useOptions } from './hooks/useOptions';

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
    const { setOption, addOptions } = useOptions();

    useEffect(() => {
        if (apple2) {
            const io = apple2.getIO();
            const audio = new Audio(io);
            addOptions(audio);
            setAudio(audio);
            setAudioEnabled(audio.isEnabled());
        }
    }, [apple2, addOptions]);

    const doToggleSound = useCallback(() => {
        const on = !audio?.isEnabled();
        setOption(SOUND_ENABLED_OPTION, on);
        setAudioEnabled(on);
    }, [audio, setOption]);

    return (
        <ControlButton
            onClick={doToggleSound}
            title="Toggle Sound"
            disabled={!audio}
            icon={audioEnabled ? 'volume-up' : 'volume-off'}
        />
    );
};
