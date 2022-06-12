/** @jest-environment jsdom */

import { Ready, spawn } from 'js/components/util/promises';

describe('promises', () => {
    describe('spawn', () => {
        it('returns an AbortController', () => {
            const controller = spawn(() => Promise.resolve(1));
            expect(controller).not.toBeNull();
            expect(controller).toBeInstanceOf(AbortController);
        });

        it('passes an AbortSignal to the target function', () => {
            let signalCapture: AbortSignal | null = null;
            spawn((signal) => {
                signalCapture = signal;
                return Promise.resolve(1);
            });
            expect(signalCapture).not.toBeNull();
            expect(signalCapture).toBeInstanceOf(AbortSignal);
        });

        it('has the controller hooked up to the signal', async () => {
            let isAborted = false;

            const controllerIsAborted = new Ready();
            const spawnHasRecorded = new Ready();

            const controller = spawn(async (signal) => {
                await controllerIsAborted.ready;
                isAborted = signal.aborted;
                spawnHasRecorded.onReady();
            });

            controller.abort();
            controllerIsAborted.onReady();

            await spawnHasRecorded.ready;
            expect(isAborted).toBe(true);
        });

        it('allows long-running tasks to be stopped', async () => {
            let isFinished = false;

            const innerReady = new Ready();
            const innerFinished = new Ready();

            const controller = spawn(async (signal) => {
                innerReady.onReady();
                let i = 0;
                while (!signal.aborted) {
                    i++;
                    await tick();
                }
                expect(i).toBe(2);
                isFinished = true;
                innerFinished.onReady();
            });
            await innerReady.ready;
            await tick();
            controller.abort();
            await innerFinished.ready;

            expect(isFinished).toBe(true);
        });

        it('allows nesting via listeners', async () => {
            let isInnerAborted = false;

            const innerReady = new Ready();
            const outerReady = new Ready();
            const abortRecorded = new Ready();

            const controller = spawn(async (signal) => {
                const innerController = spawn(async (innerSignal) => {
                    await innerReady.ready;
                    isInnerAborted = innerSignal.aborted;
                    abortRecorded.onReady();
                });
                // TODO(flan): Chain signal.reason when calling innerController.abort()
                // once jsdom 19 has wider adoption (currently on 16.6.0). Likewise there
                // are some subtle problems with signal.addEventListener that should be
                // addressed by https://github.com/jsdom/jsdom/pull/3347.
                // signal.addEventListener('abort', () => innerController.abort(signal.reason));
                signal.addEventListener('abort', () => innerController.abort());
                await outerReady.ready;
            });

            // Abort the outer controller, but don't let the outer block run.
            controller.abort();
            // Let the inner block run.
            innerReady.onReady();
            await abortRecorded.ready;

            // Inner block is aborted.
            expect(isInnerAborted).toBe(true);

            // Let outer block finish.
            outerReady.onReady();
        });
    });
});

function tick() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
