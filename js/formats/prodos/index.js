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

import { VDH } from './vdh';
import { BitMap } from './bit_map';

export function ProDOSVolume(disk) {
    var _disk = disk;
    var _vdh;
    var _bitMap;

    return {
        blocks() {
            return _disk.blocks;
        },

        vdh() {
            if (!_vdh) {
                _vdh = new VDH(this);
                _vdh.read();
            }
            return _vdh;
        },

        bitMap() {
            if (!_bitMap) {
                _bitMap = new BitMap(this);
            }
            return _bitMap;
        }
    };
}
