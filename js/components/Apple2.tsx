import { h } from 'preact';
import cs from 'classnames';
import {useEffect, useRef, useState } from 'preact/hooks';
import { Apple2 as Apple2Impl } from '../apple2';
import Apple2IO from '../apple2io';
import { ControlStrip } from './ControlStrip';
import { Inset } from './Inset';
import { Keyboard } from './Keyboard';
import { Screen } from './Screen';
import { Drives } from './Drives';

/**
 * Interface for the Apple2 component
 */
export interface Apple2Props {
    characterRom: string
    enhanced: boolean
    e: boolean
    gl: boolean
    rom: string
    sectors: number
}

/**
 * Component to bind various UI components together to form
 * the application layout. Includes the screen, drives,
 * emulator controls and keyboard. Bootstraps the core
 * Apple2 emulator.
 *
 * @param props Apple2 initialization props
 * @returns
 */

export const Apple2 = (props: Apple2Props) => {
    const { e, sectors } = props;
    const screen = useRef<HTMLCanvasElement>(null);
    const [apple2, setApple2] = useState<Apple2Impl>();
    const [io, setIO] = useState<Apple2IO>();

    useEffect(() => {
        if (screen.current && !apple2) {
            const options = {
                canvas: screen.current,
                tick: () => {},
                ...props,
            };
            const apple2 = new Apple2Impl(options);
            setApple2(apple2);
            apple2.ready.then(() => {
                const io = apple2.getIO();
                setIO(io);
                apple2.getCPU().reset();
                apple2.run();
            }).catch(error => console.error(error));
        }
    }, [screen.current]);

    return (
        <div className={cs('outer', { apple2e: e})}>
            <Screen screen={screen} />
            <Inset>
                <Drives io={io} sectors={sectors} />
            </Inset>
            <ControlStrip apple2={apple2} e={e} />
            <Inset>
                <Keyboard apple2={apple2} e={e} />
            </Inset>
        </div>
    );
};
