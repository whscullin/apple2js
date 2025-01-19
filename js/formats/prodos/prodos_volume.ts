import { VDH } from './vdh';
import { BitMap } from './bit_map';
import { BlockDisk } from '../types';

export class ProDOSVolume {
    private _vdh: VDH;
    private _bitMap: BitMap;

    constructor(private _disk: BlockDisk) {}

    disk() {
        return this._disk;
    }

    async vdh() {
        if (!this._vdh) {
            this._vdh = new VDH(this);
            await this._vdh.read();
        }
        return this._vdh;
    }

    async bitMap() {
        if (!this._bitMap) {
            this._bitMap = new BitMap(this);
        }
        return this._bitMap;
    }
}
