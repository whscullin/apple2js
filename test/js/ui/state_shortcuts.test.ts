import { stateShortcuts } from 'js/ui/state_shortcuts';
import { State } from 'js/apple2';

describe('state shortcuts', () => {
    const state = {} as State;
    function setup() {
        const machine = {
            getState: jest.fn(async () => state),
            setState: jest.fn(async (_state: State) => {}),
        };
        const storage = {
            getItem: jest.fn((): string | null => '{}'),
            setItem: jest.fn(),
        };
        const report = jest.fn();
        return {
            machine,
            storage,
            report,
            shortcuts: stateShortcuts(machine, () => storage, report),
        };
    }

    it.each(['save', 'restore'] as const)(
        'reports rejected %s operations and can retry',
        async (action) => {
            const { machine, report, shortcuts } = setup();
            if (action === 'save') {
                machine.getState.mockRejectedValueOnce(
                    new Error('card failed')
                );
            } else {
                machine.setState.mockRejectedValueOnce(
                    new Error('card failed')
                );
            }
            await expect(shortcuts[action]()).resolves.toBeUndefined();
            expect(report).toHaveBeenCalledWith('card failed');
            await shortcuts[action]();
            expect(report).toHaveBeenCalledTimes(1);
        }
    );

    it('reports malformed JSON, storage read errors, and quota errors', async () => {
        const { storage, report, shortcuts } = setup();
        storage.getItem.mockReturnValueOnce('{');
        await shortcuts.restore();
        expect(report).toHaveBeenCalledTimes(1);
        storage.getItem.mockImplementationOnce(() => {
            throw new Error('storage denied');
        });
        await shortcuts.restore();
        expect(report).toHaveBeenLastCalledWith('storage denied');
        storage.setItem.mockImplementationOnce(() => {
            throw new Error('quota');
        });
        await shortcuts.save();
        expect(report).toHaveBeenLastCalledWith('quota');
    });

    it('reports errors obtaining storage itself', async () => {
        const { machine, report } = setup();
        const shortcuts = stateShortcuts(
            machine,
            () => {
                throw new Error('denied');
            },
            report
        );
        await shortcuts.save();
        await shortcuts.restore();
        expect(report).toHaveBeenCalledTimes(2);
    });

    it('ignores repeated save and restore shortcuts until persistence completes', async () => {
        const { machine, storage, shortcuts } = setup();
        let resolve!: (state: State) => void;
        machine.getState.mockReturnValueOnce(
            new Promise<State>((done) => {
                resolve = done;
            })
        );
        const saving = shortcuts.save();
        await shortcuts.save();
        await shortcuts.restore();
        expect(machine.getState).toHaveBeenCalledTimes(1);
        expect(storage.getItem).not.toHaveBeenCalled();
        resolve(state);
        await saving;
        expect(storage.setItem).toHaveBeenCalledTimes(1);
        await shortcuts.restore();
        expect(machine.setState).toHaveBeenCalledWith(state);
    });

    it('does nothing when no saved state exists', async () => {
        const { storage, machine, shortcuts } = setup();
        storage.getItem.mockReturnValue(null);
        await shortcuts.restore();
        expect(machine.setState).not.toHaveBeenCalled();
    });
});
