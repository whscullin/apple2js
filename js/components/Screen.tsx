import { h, Ref } from 'preact';

import styles from './css/Screen.module.css';

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
    return (
        <div className={styles.display}>
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
