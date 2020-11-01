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
import { byte, memory } from './types';
import { allocMemPages } from './util';

export interface State {
    /** Start of memory region. */
    start: byte;
    /** End of memory region. */
    end: byte;
    /** Base64-encoded contents. */
    mem: string;
};

/**
 * Represents RAM from the start page `sp` to end page `ep`. The memory
 * is addressed by `page` and `offset`.
 */
export default function RAM(sp: byte, ep: byte) {
    let start_page = sp;
    let end_page = ep;

    let mem = allocMemPages(ep - sp + 1);

    return {
        start: function () {
            return start_page;
        },
        end: function () {
            return end_page;
        },
        read: function (page: byte, offset: byte) {
            return mem[(page - start_page) << 8 | offset];
        },
        write: function (page: byte, offset: byte, val: byte) {
            mem[(page - start_page) << 8 | offset] = val;
        },

        getState: function (): State {
            return {
                start: start_page,
                end: end_page,
                mem: base64_encode(mem)
            };
        },

        setState: function (state: State) {
            start_page = state.start;
            end_page = state.end;
            mem = base64_decode(state.mem);
        }
    };
}
