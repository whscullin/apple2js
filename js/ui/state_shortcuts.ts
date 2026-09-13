import { State } from '../apple2';
import { base64_json_parse, base64_json_stringify } from '../base64';
import { Restorable } from '../types';

// Catch inside the callback: the keyboard dispatcher does not await promises.
export function stateShortcuts(
    machine: Restorable<State>,
    storage: () => Pick<Storage, 'getItem' | 'setItem'>,
    reportError: (message: string) => void
) {
    let busy = false;
    const perform = async (action: () => Promise<void>) => {
        if (busy) {
            return;
        }
        busy = true;
        try {
            await action();
        } catch (error) {
            reportError(error instanceof Error ? error.message : String(error));
        } finally {
            busy = false;
        }
    };
    return {
        save: () =>
            perform(async () => {
                const state = await machine.getState();
                storage().setItem('state', base64_json_stringify(state));
            }),
        restore: () =>
            perform(async () => {
                const state = storage().getItem('state');
                if (state) {
                    await machine.setState(base64_json_parse(state) as State);
                }
            }),
    };
}
