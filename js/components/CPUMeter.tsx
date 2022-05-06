import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import type { Stats} from '../apple2';

/**
 * Interface for CPUMeter
 */
export interface CPUMeterProps {
    apple2: Apple2Impl | undefined
}

/**
 * A simple display that can cycle between emulator Khz
 * performance, frames/second and rendered frames/second
 *
 * @param apple2 Apple2 object
 * @returns CPU Meter component
 */

export const CPUMeter = ({ apple2 }: CPUMeterProps) => {
    const lastStats = useRef<Stats>({
        frames: 0,
        renderedFrames: 0,
        cycles: 0,
    });
    const lastTime = useRef<number>(Date.now());
    const [khz, setKhz] = useState<number>(0);
    const [fps, setFps] = useState<number>(0);
    const [rps, setRps] = useState<number>(0);
    const [mode, setMode] = useState<number>(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const { cycles, frames, renderedFrames } = lastStats.current;
            const stats = apple2?.getStats();
            const time = Date.now();
            const delta = time - lastTime.current;
            if (stats) {
                setKhz(
                    Math.floor(
                        (stats.cycles - cycles) / delta
                    )
                );
                setFps(
                    Math.floor(
                        (stats.frames - frames) / delta * 1000
                    )
                );
                setRps(
                    Math.floor(
                        (stats.renderedFrames - renderedFrames) / delta * 1000
                    )
                );
                lastStats.current = { ...stats };
                lastTime.current = time;
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [apple2]);

    const onClick = useCallback(() => {
        setMode((mode) => (mode + 1) % 3);
    }, []);

    return (
        <div id="khz" onClick={onClick}>
            {mode === 0 && `${khz} Khz`}
            {mode === 1 && `${fps} fps`}
            {mode === 2 && `${rps} rps`}
        </div>
    );
};
