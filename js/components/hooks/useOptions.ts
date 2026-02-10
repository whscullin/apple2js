import { useSyncExternalStore } from 'react';
import { OptionsStore, type Options } from 'js/options';

const options = new OptionsStore();

let snapshot: Options = options;

const subscribe = (callback: () => void) => {
    const handler = () => {
        snapshot = { ...options };
        callback();
    };
    options.addEventListener('change', handler);
    return () => {
        options.removeEventListener('change', handler);
    };
};

const getSnapshot = () => {
    return snapshot;
};

export const useOptions = (): Options => {
    return useSyncExternalStore(subscribe, getSnapshot);
};
