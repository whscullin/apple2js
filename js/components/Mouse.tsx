import { RefObject } from 'preact';
import Apple2IO, { slot } from '../apple2io';
import { MouseUI } from '../ui/mouse';
import MouseCard from '../cards/mouse';
import CPU6502 from '../cpu6502';
import { useEffect } from 'preact/hooks';

/**
 * Mouse component properties.
 */
export interface MouseProps {
    cpu: CPU6502 | undefined;
    io: Apple2IO | undefined;
    screen: RefObject<HTMLCanvasElement>;
    slot: slot;
}

/**
 * Mouse card component that adds a simple mouse driver.
 *
 * @param cpu CPU6502 object
 * @param screen Screen element reference
 * @param io Apple2IO object
 * @param slot Slot to register card in
 * @returns Mouse component
 */
export const Mouse = ({ cpu, screen, io, slot }: MouseProps) => {
    useEffect(() => {
        if (cpu && io && screen.current) {
            const mouseUI = new MouseUI(screen.current);
            const mouse = new MouseCard(cpu, mouseUI);
            io.setSlot(slot, mouse);
        }
    }, [cpu, io, screen, slot]);

    return null;
};
