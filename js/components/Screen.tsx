import { type Ref } from 'react';

import styles from './css/Screen.module.scss';
import { useOptions } from './hooks/useOptions';
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
    const { setOption } = useOptions();

    return (
        <div className={styles.display}>
            <div className={styles.exitFullScreen}>
                <button onClick={() => setOption(SCREEN_FULL_PAGE, false)}>
                    Exit Full Page
                </button>
            </div>
            <div className={styles.overscan}>
                <canvas
                    className={styles.screen}
                    width="592"
                    height="416"
                    ref={screenRef}
                    tabIndex={0}
                />
            </div>
        </div>
    );
};
