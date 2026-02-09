import { useEffect } from 'react';

/**
 * Hook to allow registering hotkey that will automatically
 * be cleaned up when they leave scope
 *
 * @param key KeyboardEvent key value to match
 * @param callback Invoked when key is pressed
 */
export const useHotKey = (
    key: string,
    callback: (ev: KeyboardEvent) => void
) => {
    useEffect(() => {
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key === key) {
                ev.preventDefault();
                ev.stopPropagation();
                callback(ev);
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [key, callback]);
};
