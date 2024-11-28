import { h, Ref } from 'preact';

import styles from './css/Screen.module.scss';
import { useContext } from 'preact/hooks';
import { OptionsContext } from './OptionsContext';
import { SCREEN_FULL_PAGE } from 'js/ui/screen';

/**
 * Screen properties
 */
export interface ScreenProps {
    screenRef: Ref<HTMLCanvasElement>;
}

/**
 * Styled canvas element that the Apple II display is
 * rendered to by VideoModes.
 *
 * @param screen Canvas element reference
 * @returns
 */
export const Screen = ({ screenRef }: ScreenProps) => {
    const options = useContext(OptionsContext);

    return (
        <div className={styles.display}>
            <div className={styles.exitFullScreen}>
                <button
                    onClick={() => options.setOption(SCREEN_FULL_PAGE, false)}
                >
                    Exit Full Page
                </button>
            </div>
            <div className={styles.overscan}>
                <canvas
                    className={styles.screen}
                    width="592"
                    height="416"
                    ref={screenRef}
                />
            </div>
        </div>
    );
};
