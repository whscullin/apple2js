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
 * Calls the given `Promise`-returning function, `f`, and does not await
 * the result. The function `f` is passed an {@link Interrupted} function
 * that returns `true` if it should stop doing work.  `spawn` returns an
 * {@link Interrupt} function that, when called, causes the `Interrupted`
 * function to return `true`. This can be used in `useEffect` calls as the
 * cleanup function.
 */
export function spawn(f: (abortSignal: AbortSignal) => Promise<unknown>): AbortController {
    const abortController = new AbortController();
    noAwait(f)(abortController.signal);
    return abortController;
}

/**
 * Utility class that allows a promise to be passed to a
 * service to be resolved.
 */

export class Ready {
    onError: (value?: unknown) => void;
    onReady: (value?: unknown) => void;

    ready: Promise<unknown>;

    constructor(private errorHandler = console.error) {
        this.ready = new Promise((resolve, reject) => {
            this.onReady = resolve;
            this.onError = reject;
        }).catch(this.errorHandler);
    }
}
