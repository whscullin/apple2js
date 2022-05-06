import { h, Ref } from 'preact';

/**
 * Screen properties
 */
export interface ScreenProps {
    screen: Ref<HTMLCanvasElement>
}

/**
 * Styled canvas element that the Apple II display is
 * rendered to by VideoModes
 *
 * @param screen Canvas element reference
 * @returns
 */

export const Screen = ({ screen }: ScreenProps) => {
    return (
        <div id="display">
            <div class="overscan">
                <canvas id="screen" width="592" height="416" ref={screen} />
            </div>
        </div>
    );
};
