/** @jest-environment jsdom */
import { Apple2 } from 'js/apple2';
import SmartPort from 'js/cards/smartport';
import { Card } from 'js/types';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

async function newMachine() {
    const machine = new Apple2({
        characterRom: 'apple2enh_char',
        enhanced: true,
        e: true,
        gl: false,
        rom: 'apple2e',
        canvas: document.createElement('canvas'),
        tick: () => {},
    });
    await machine.ready;
    machine.stop();
    return machine;
}

describe('machine state operations', () => {
    let machine: Apple2;
    beforeEach(async () => {
        machine = await newMachine();
    });
    afterEach(() => {
        machine.stop();
        jest.restoreAllMocks();
    });

    it('pauses before disk completion and captures the resulting RAM', async () => {
        const disk = new SmartPort(machine.getCPU(), null, { block: true });
        machine.getIO().setSlot(7, disk);
        const gate = deferred();
        disk.handleAsync(async () => {
            await gate.promise;
            machine.getCPU().write(0x04, 0, 0xab);
            return 0;
        });
        machine.run();
        const debuggerBefore = machine.getDebugger();
        const saved = machine.getState();
        expect(machine.isRunning()).toBe(false);
        machine.run();
        expect(machine.isRunning()).toBe(false);
        await expect(machine.getState()).rejects.toThrow('already in progress');
        gate.resolve();
        const state = await saved;
        expect(state.ram?.[0].mem[0x400]).toBe(0xab);
        expect(machine.getDebugger()).toBe(debuggerBefore);
        expect(machine.isRunning()).toBe(true);
    });

    it('keeps paused machines paused and respects an explicit stop', async () => {
        await machine.getState();
        expect(machine.isRunning()).toBe(false);
        machine.run();
        const gate = deferred();
        jest.spyOn(machine.getIO(), 'waitForIdle').mockReturnValue(
            gate.promise
        );
        const saving = machine.getState();
        machine.stop();
        gate.resolve();
        await saving;
        expect(machine.isRunning()).toBe(false);
    });

    it('resumes after a failed save and releases the guard', async () => {
        machine.run();
        const spy = jest
            .spyOn(machine.getIO(), 'getState')
            .mockRejectedValueOnce(new Error('read failed'));
        await expect(machine.getState()).rejects.toThrow('read failed');
        expect(machine.isRunning()).toBe(true);
        spy.mockRestore();
        await expect(machine.getState()).resolves.toBeDefined();
    });

    it.each([false, true])(
        'waits for every card after a restore failure (synchronous=%s)',
        async (synchronous) => {
            const state = await machine.getState();
            const gate = deferred();
            const started = deferred();
            const failure = new Error('restore failed');
            const first: Card = {
                read: () => 0,
                write: () => {},
                ioSwitch: () => 0,
                getState: () => null,
                setState: () => {
                    if (synchronous) {
                        throw failure;
                    }
                    return Promise.reject(failure);
                },
            };
            const second: Card = {
                ...first,
                setState: async () => {
                    started.resolve();
                    await gate.promise;
                },
            };
            machine.getIO().setSlot(1, first);
            machine.getIO().setSlot(2, second);
            state.io.cards[1] = null;
            state.io.cards[2] = null;
            machine.run();
            const restoring = machine.setState(state);
            const outcome = restoring.then(
                () => undefined,
                (error: unknown) => error
            );
            await started.promise;
            await expect(machine.setState(state)).rejects.toThrow(
                'already in progress'
            );
            machine.run();
            expect(machine.isRunning()).toBe(false);
            gate.resolve();
            expect(await outcome).toBe(failure);
            expect(machine.isRunning()).toBe(false);
            await expect(machine.getState()).resolves.toBeDefined();
        }
    );

    it('drains old disk work before restoring and resumes only after delayed cards finish', async () => {
        machine.getCPU().write(0x04, 0, 0x12);
        const state = await machine.getState();
        const disk = new SmartPort(machine.getCPU(), null, { block: true });
        machine.getIO().setSlot(7, disk);
        const gate = deferred();
        disk.handleAsync(async () => {
            await gate.promise;
            machine.getCPU().write(0x04, 0, 0xff);
            return 0;
        });
        const restoreGate = deferred();
        const entered = deferred();
        jest.spyOn(disk, 'setState').mockImplementation(async () => {
            entered.resolve();
            await restoreGate.promise;
        });
        state.io.cards[7] = null;
        machine.run();
        const restoring = machine.setState(state);
        gate.resolve();
        await entered.promise;
        expect(machine.isRunning()).toBe(false);
        restoreGate.resolve();
        await restoring;
        expect(machine.getCPU().read(0x04, 0)).toBe(0x12);
        expect(machine.isRunning()).toBe(true);
    });

    it.each(['save', 'idle'] as const)(
        'settles every card after a %s failure',
        async (operation) => {
            const gate = deferred();
            const entered = deferred();
            const failure = new Error('disk failure');
            const card: Card = {
                read: () => 0,
                write: () => {},
                ioSwitch: () => 0,
                getState: () => null,
                setState: () => {},
            };
            const broken = { ...card };
            const delayed = { ...card };
            if (operation === 'save') {
                broken.getState = () => {
                    throw failure;
                };
                delayed.getState = async () => {
                    entered.resolve();
                    await gate.promise;
                    return null;
                };
            } else {
                broken.waitForIdle = () => Promise.reject(failure);
                delayed.waitForIdle = async () => {
                    entered.resolve();
                    await gate.promise;
                };
            }
            machine.getIO().setSlot(1, broken);
            machine.getIO().setSlot(2, delayed);
            machine.run();
            const saving = machine.getState().then(
                () => undefined,
                (error: unknown) => error
            );
            await entered.promise;
            await expect(machine.getState()).rejects.toThrow(
                'already in progress'
            );
            expect(machine.isRunning()).toBe(false);
            gate.resolve();
            expect(await saving).toBe(failure);
            expect(machine.isRunning()).toBe(true);
        }
    );

    it('settles rejected emulated commands and records the device error', async () => {
        const disk = new SmartPort(machine.getCPU(), null, { block: true });
        machine.getIO().setSlot(7, disk);
        const failure = new Error('offline');
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        disk.handleAsync(() => Promise.reject(failure));
        await machine.getState();
        expect(log).toHaveBeenCalledWith(failure);
        expect((disk as Card).ioSwitch(0x81)).toBe(0x2f);
        await expect(disk.waitForIdle()).resolves.toBeUndefined();
    });
});
