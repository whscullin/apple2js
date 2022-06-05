/**
 * Converts a function type returning a `Promise` to a function type returning `void`.
 */
export type NoAwait<F extends (...args: unknown[]) => Promise<unknown>> =
    (...args: Parameters<F>) => void;

/**
 * Signals that the argument returns a `Promise` that is intentionally not being awaited.
 */
export function noAwait<F extends (...args: unknown[]) => Promise<unknown>>(f: F): NoAwait<F> {
    return f as NoAwait<F>;
}

/**
 * Utility class that allows a promise to be passed to a
 * service to be resolved.
 */

export class Ready {
    onError: (value?: unknown) => void;
    onReady: (value?: unknown) => void;

    ready: Promise<unknown>;

    constructor() {
        this.ready = new Promise((resolve, reject) => {
            this.onReady = resolve;
            this.onError = reject;
        }).catch(console.error);
    }
}
