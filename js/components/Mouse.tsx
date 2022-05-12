import { RefObject } from 'preact';
import Apple2IO from '../apple2io';
import { MouseUI } from '../ui/mouse';
import MouseCard from '../cards/mouse';
import CPU6502 from '../cpu6502';
import { useEffect } from 'preact/hooks';

export interface MouseProps {
    cpu: CPU6502 | undefined;
    io: Apple2IO | undefined;
    screen: RefObject<HTMLCanvasElement>;
}

export const Mouse = ({ cpu, screen, io }: MouseProps) => {
    useEffect(() => {
        if (cpu && io && screen.current) {
            const mouseUI = new MouseUI(screen.current);
            const mouse = new MouseCard(cpu, mouseUI);
            io.setSlot(4, mouse);
        }
    }, [cpu, io]);

    return null;
};
