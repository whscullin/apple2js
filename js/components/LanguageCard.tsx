import { CPU6502 } from '@whscullin/cpu6502';
import { Memory } from 'js/types';
import { useEffect } from 'react';
import Apple2IO, { slot } from '../apple2io';
import LanguageCardImpl from '../cards/langcard';

/**
 * Language Card component properties
 */
export interface LanguageCardProps {
    io: Apple2IO | undefined;
    cpu: CPU6502 | undefined;
    rom: Memory | undefined;
    slot: slot;
}

/**
 * Language card component. Adds 16KB of memory.
 *
 * @param cpu 6502 object
 * @param io Apple2IO object
 * @param slot Slot to register card in
 * @returns LanguageCard component
 */
export const LanguageCard = ({ cpu, io, rom, slot }: LanguageCardProps) => {
    useEffect(() => {
        if (io && cpu && rom) {
            const lc = new LanguageCardImpl(rom);
            io.setSlot(slot, lc);
            cpu.addPageHandler(lc);
        }
    }, [io, cpu, rom, slot]);

    return null;
};
