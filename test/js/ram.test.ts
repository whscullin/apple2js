import RAM from 'js/ram';

// getBuffer() is called once at construction time by every consumer that
// needs a direct view into a page range (LoresPage2D/HiresPage2D in
// js/canvas.ts cache the returned Uint8Array and read/write it directly on
// every subsequent access, never re-fetching it from the owning RAM
// instance). setState() must therefore preserve `this.mem`'s object identity
// -- restoring state by copying bytes into the existing buffer, not by
// pointing `this.mem` at a brand new Uint8Array -- or every such cached view
// silently keeps seeing pre-restore data (and writes through it never reach
// the "restored" RAM at all).
describe('RAM', () => {
    it('setState() is visible through a Uint8Array view obtained from getBuffer() before the restore', () => {
        const ram = new RAM(0x00, 0xbf);
        const view = ram.getBuffer(0x04, 0x08);

        ram.write(0x04, 0x00, 0xab);
        expect(view[0]).toBe(0xab);

        const state = ram.getState();
        ram.write(0x04, 0x00, 0xcd);
        expect(view[0]).toBe(0xcd);

        ram.setState(state);

        expect(ram.read(0x04, 0x00)).toBe(0xab);
        expect(view[0]).toBe(0xab);
    });
});
