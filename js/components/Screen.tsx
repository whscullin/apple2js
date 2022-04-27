import { h, Ref } from 'preact';

export interface ScreenProps {
    screen: Ref<HTMLCanvasElement>
}

export const Screen = ({ screen }: ScreenProps) => {
    return (
        <div id="display">
            <div class="overscan">
                <canvas id="screen" width="592" height="416" ref={screen} />
            </div>
        </div>
    );
};
