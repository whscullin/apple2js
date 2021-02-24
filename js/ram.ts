/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { base64_decode, base64_encode } from './base64';
import { byte, memory, Memory, Restorable } from './types';
import { allocMemPages } from './util';

export interface RAMState {
    /** Base64-encoded contents. */
    mem: string;
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
        return this.mem[(page - this.start_page) << 8 | offset];
    }

    public write(page: byte, offset: byte, val: byte) {
        this.mem[(page - this.start_page) << 8 | offset] = val;
    }

    public getState(): RAMState {
        return {
            mem: base64_encode(this.mem)
        };
    }

    public setState(state: RAMState) {
        this.mem = base64_decode(state.mem);
    }
}
