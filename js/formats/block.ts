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

import { DiskOptions, BlockDisk, ENCODING_BLOCK } from './types';

/**
 * Returns a `Disk` object for a block volume with block-ordered data.
 * @param options the disk image and options
 */
export default function createBlockDisk(options: DiskOptions): BlockDisk {
    const { rawData, readOnly, name } = options;

    if (!rawData) {
        throw new Error('Requires rawData');
    }

    const blocks = [];
    let offset = 0;
    while (offset  < rawData.byteLength) {
        blocks.push(new Uint8Array(rawData.slice(offset, offset + 0x200)));
        offset += 0x200;
    }

    const disk: BlockDisk = {
        encoding: ENCODING_BLOCK,
        blocks,
        name,
        readOnly,
    };

    return disk;
}
