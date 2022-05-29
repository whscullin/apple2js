import { useEffect } from 'preact/hooks';
import Apple2IO, { slot } from '../apple2io';
import ThunderClockCard from '../cards/thunderclock';

/**
 * ThunderClock component properties.
 */
export interface ThunderClockProps {
    io: Apple2IO | undefined;
    slot: slot;
}

/**
 * ThunderClock card component.
 *
 * @param io Apple2IO object
 * @param slot Slot to register card in
 */
export const ThunderClock = ({ io, slot }: ThunderClockProps) => {
    useEffect(() => {
        if (io) {
            const clock = new ThunderClockCard();
            io.setSlot(slot, clock);
        }
    }, [io, slot]);

    return null;
};
