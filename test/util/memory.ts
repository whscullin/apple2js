import { MemoryPages, byte } from '../../js/types';
import { assertByte } from './asserts';

export class TestMemory implements MemoryPages {
    private data: Buffer;

    constructor(private size: number) {
        this.data = Buffer.alloc(size << 8);
    }

    start() {
        return 0;
    }

    end() {
        return this.size - 1;
    }

    read(page: byte, off: byte) {
        assertByte(page);
        assertByte(off);

        return this.data[(page << 8) | off];
    }

    write(page: byte, off: byte, val: byte) {
        assertByte(page);
        assertByte(off);
        assertByte(val);

        this.data[(page << 8) | off] = val;
    }

    reset() {
    }
}

