import { byte, memory, Memory, Restorable } from './types';
import { allocMemPages } from './util';

export interface RAMState {
    /** Copy of contents. */
    mem: memory;
}

/**
 * Represents RAM from the start page `sp` to end page `ep`. The memory
 * is addressed by `page` and `offset`.
 */
export default class RAM implements Memory, Restorable<RAMState> {
    private start_page: byte;
    private end_page: byte;
    private mem: memory;

    constructor(sp: byte, ep: byte) {
        this.start_page = sp;
        this.end_page = ep;

        this.mem = allocMemPages(ep - sp + 1);
    }

    public start(): byte {
        return this.start_page;
    }

    public end(): byte {
        return this.end_page;
    }

    public read(page: byte, offset: byte) {
        return this.mem[((page - this.start_page) << 8) | offset];
    }

    public write(page: byte, offset: byte, val: byte) {
        this.mem[((page - this.start_page) << 8) | offset] = val;
    }

    public getState(): RAMState {
        return {
            mem: new Uint8Array(this.mem),
        };
    }

    public setState(state: RAMState) {
        // Copy into the existing buffer rather than replacing it: getBuffer()
        // callers (e.g. LoresPage2D/HiresPage2D, js/canvas.ts) cache the
        // Uint8Array subarray view they get back at construction time and
        // read/write it directly on every access, never re-fetching it from
        // this RAM instance. Reassigning `this.mem` to a new Uint8Array would
        // silently detach every such cached view from the restored data,
        // leaving whatever was in memory before setState() visible (and
        // writable) through that view instead.
        this.mem.set(state.mem);
    }

    public getBuffer(start: byte, end: byte): memory {
        return this.mem.subarray(
            start << (8 - this.start_page),
            end << (8 - this.start_page)
        );
    }
}
