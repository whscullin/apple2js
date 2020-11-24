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
import { byte, memory, Memory } from './types';
import { allocMemPages } from './util';

export interface State {
    /** Start of memory region. */
    start: byte;
    /** End of memory region. */
    end: byte;
    /** Base64-encoded contents. */
    mem: string;
}

/**
 * Represents RAM from the start page `sp` to end page `ep`. The memory
 * is addressed by `page` and `offset`.
 */
export default class RAM implements Memory {
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

    public getState(): State {
        return {
            start: this.start_page,
            end: this.end_page,
            mem: base64_encode(this.mem)
        };
    }

    public setState(state: State) {
        this.start_page = state.start;
        this.end_page = state.end;
        this.mem = base64_decode(state.mem);
    }
}
