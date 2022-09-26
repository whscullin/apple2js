import { useEffect } from 'preact/hooks';
import Apple2IO, { slot } from '../apple2io';
import RAMFactor from '../cards/ramfactor';

/**
 * Slinky component properties
 */
export interface SlinkyProps {
    io: Apple2IO | undefined;
    slot: slot;
}

/**
 * RAMFactory (Slinky) memory card component. Adds
 * 1MB of slinky compatible memory.
 *
 * @param io Apple2IO object
 * @param slot Slot to register card in
 * @returns Slinky component
 */
export const Slinky = ({ io, slot }: SlinkyProps) => {
    useEffect(() => {
        if (io) {
            const slinky = new RAMFactor(1024 * 1024);
            io.setSlot(slot, slinky);
        }
    }, [io, slot]);

    return null;
};
