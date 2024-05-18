import { VDH } from './vdh';
import { BitMap } from './bit_map';
import { BlockDisk } from '../types';

export class ProDOSVolume {
    _vdh: VDH;
    _bitMap: BitMap;

    constructor(private _disk: BlockDisk) {}

    disk() {
        return this._disk;
    }

    blocks() {
        return this._disk.blocks;
    }

    vdh() {
        if (!this._vdh) {
            this._vdh = new VDH(this);
            this._vdh.read();
        }
        return this._vdh;
    }

    bitMap() {
        if (!this._bitMap) {
            this._bitMap = new BitMap(this);
        }
        return this._bitMap;
    }
}
