import { VDH } from './vdh';
import { BitMap } from './bit_map';

export function ProDOSVolume(disk) {
    var _disk = disk;
    var _vdh;
    var _bitMap;

    return {
        disk() {
            return _disk;
        },

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
