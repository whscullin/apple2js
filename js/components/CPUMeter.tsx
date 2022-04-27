import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import type { Stats} from '../apple2';

export interface CPUMeterProps {
    apple2: Apple2Impl | undefined
}
export const CPUMeter = ({ apple2 }: CPUMeterProps) => {
    const lastStats = useRef<Stats>({
        frames: 0,
        renderedFrames: 0,
        cycles: 0,
    });
    const lastTime = useRef<number>(Date.now());
    const [khz, setKhz] = useState<number>(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const stats = apple2?.getStats();
            const time = Date.now();
            if (stats) {
                setKhz(
                    Math.floor(
                        (stats.cycles - lastStats.current.cycles) /
                        (time - lastTime.current)
                    )
                );
                lastStats.current = { ...stats };
                lastTime.current = time;
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [apple2]);

    return (
        <div id="khz">
            {khz} Khz
        </div>
    );
};
