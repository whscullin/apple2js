import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import cs from 'classnames';

import { Apple2 as Apple2Impl } from 'js/apple2';
import { VideoPage } from 'js/videomodes';

import styles from './css/VideoModes.module.scss';
import debuggerStyles from './css/Debugger.module.scss';

export interface VideoModesProps {
    apple2: Apple2Impl | undefined;
}

const blit = (page: VideoPage, canvas: HTMLCanvasElement | null) => {
    if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
            context.putImageData(page.imageData, 0, 0);
        }
    }
};

export const VideoModes = ({ apple2 }: VideoModesProps) => {
    const [text, setText] = useState(false);
    const [hires, setHires] = useState(false);
    const [page2, setPage2] = useState(false);
    const canvas1 = useRef<HTMLCanvasElement>(null);
    const canvas2 = useRef<HTMLCanvasElement>(null);
    const canvas3 = useRef<HTMLCanvasElement>(null);
    const canvas4 = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    const animate = useCallback(() => {
        if (apple2) {
            const vm = apple2.getVideoModes();
            const text = vm.isText();
            const hires = vm.isHires();
            const page2 = vm.isPage2();

            vm.getLoresPage(1).refresh();
            vm.getLoresPage(2).refresh();
            vm.getHiresPage(1).refresh();
            vm.getHiresPage(2).refresh();
            blit(vm.getLoresPage(1), canvas1.current);
            blit(vm.getLoresPage(2), canvas2.current);
            blit(vm.getHiresPage(1), canvas3.current);
            blit(vm.getHiresPage(2), canvas4.current);

            setText(text);
            setHires(hires);
            setPage2(page2);
        }
        animationRef.current = requestAnimationFrame(animate);
    }, [apple2]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [animate]);

    return (
        <div className={styles.pages}>
            <div className={debuggerStyles.row}>
                <div
                    className={cs(styles.page, {
                        [styles.active]: (text || !hires) && !page2,
                    })}
                >
                    <div className={debuggerStyles.heading}>
                        Text/Lores Page 1
                    </div>
                    <canvas width="560" height="192" ref={canvas1} />
                </div>
                <div
                    className={cs(styles.page, {
                        [styles.active]: (text || !hires) && page2,
                    })}
                >
                    <div className={debuggerStyles.heading}>
                        Text/Lores Page 2
                    </div>
                    <canvas width="560" height="192" ref={canvas2} />
                </div>
            </div>
            <div className={debuggerStyles.row}>
                <div
                    className={cs(styles.page, {
                        [styles.active]: !text && hires && !page2,
                    })}
                >
                    <div className={debuggerStyles.heading}>Hires Page 1</div>
                    <canvas width="560" height="192" ref={canvas3} />
                </div>
                <div
                    className={cs(styles.page, {
                        [styles.active]: !text && hires && page2,
                    })}
                >
                    <div className={debuggerStyles.heading}>Hires Page 2</div>
                    <canvas width="560" height="192" ref={canvas4} />
                </div>
            </div>
        </div>
    );
};
