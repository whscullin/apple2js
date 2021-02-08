import { PageHandler } from '../cpu6502';
import { byte, rom } from '../types';

export default class ROM implements PageHandler {

    constructor(
    private readonly startPage: byte,
    private readonly endPage: byte,
    private readonly rom: rom) {
        const expectedLength = (endPage-startPage+1) * 256;
        if (rom.length != expectedLength) {
            throw Error(`rom does not have the correct length: expected ${expectedLength} was ${rom.length}`);
        }
    }

    start() {
        return this.startPage;
    }
    end() {
        return this.endPage;
    }
    read(page: byte, off: byte) {
        return this.rom[(page - this.startPage) << 8 | off];
    }
    write() { 
    }
}
