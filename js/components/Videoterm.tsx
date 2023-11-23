import { useEffect } from 'preact/hooks';
import Apple2IO, { slot } from 'js/apple2io';
import VideotermImpl from 'js/cards/videoterm';
/**
 * VideoTerm component properties
 */
export interface VideotermProps {
    io: Apple2IO | undefined;
    slot: slot;
}

export const Videoterm = ({ io, slot }: VideotermProps) => {
    useEffect(() => {
        if (io) {
            const videoterm = new VideotermImpl();
            io.setSlot(slot, videoterm);
        }
    }, [io, slot]);
    return null;
};
