import Apple2IO from 'js/apple2io';
import SmartPort from 'js/cards/smartport';
import { base64_json_parse, base64_json_stringify } from 'js/base64';
import { CPU6502 } from '@whscullin/cpu6502';
import { VideoModes } from 'js/videomodes';

// Reproduces a real save/restore-state bug (apple2js's F6/F9 keyboard
// shortcuts, js/ui/apple2.ts, go through this exact path): SmartPort is the
// only stock card whose getState()/setState() are genuinely async (block-disk
// I/O), which Restorable<T> explicitly allows for getState() (`T |
// Promise<T>`) but Apple2IO's own getState()/setState() never awaited. A bare
// Promise has no enumerable own properties, so serializing it (JSON.stringify
// via base64_json_stringify, or any other JSON-based persistence) collapsed
// SmartPort's slot to `{}`; restoring that `{}` then threw inside
// SmartPort.setState() (`state.disks[idx]` on undefined) as an *unhandled*
// promise rejection, since nothing awaited that call either.
describe('Apple2IO getState()/setState() with an async card (SmartPort)', () => {
    const fakeCPU = {} as unknown as CPU6502;
    const fakeVM = {} as unknown as VideoModes;

    function newIOWithSmartPort() {
        const io = new Apple2IO(fakeCPU, fakeVM);
        io.setSlot(7, new SmartPort(fakeCPU, null, { block: true }));
        return io;
    }

    it("resolves an async card's real state instead of a bare Promise", async () => {
        const io = newIOWithSmartPort();
        const state = await io.getState();
        expect(state.cards[7]).not.toBeInstanceOf(Promise);
        expect(state.cards[7]).toEqual({
            disks: [null, null, null],
            statusByte: 0x80,
            xReg: 0,
            yReg: 0,
        });
    });

    it('round-trips through JSON (the real F6/F9 save/restore path) without an unhandled rejection', async () => {
        const io = newIOWithSmartPort();
        const errors: unknown[] = [];
        const onRejection = (err: unknown) => errors.push(err);
        process.on('unhandledRejection', onRejection);
        try {
            const saved = base64_json_stringify(await io.getState());
            const restoredIO = newIOWithSmartPort();
            await restoredIO.setState(
                base64_json_parse(saved) as Awaited<
                    ReturnType<Apple2IO['getState']>
                >
            );
            // Let any unhandled rejection from a still-broken implementation
            // surface before asserting.
            await new Promise((resolve) => setTimeout(resolve, 0));
        } finally {
            process.off('unhandledRejection', onRejection);
        }
        expect(errors).toEqual([]);
    });
});
