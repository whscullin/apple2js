import { MemoryPages, byte, word } from 'js/types';
import { assertByte } from './asserts';

export type Log = [address: word, value: byte, types: 'read'|'write']
export class TestMemory implements MemoryPages {
    private data: Buffer;
    private logging: boolean = false;
    private log: Log[] = [];

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

        const val = this.data[(page << 8) | off];
        if (this.logging) {
            this.log.push([page << 8 | off, val, 'read']);
        }
        return val;
    }

    write(page: byte, off: byte, val: byte) {
        assertByte(page);
        assertByte(off);
        assertByte(val);

        if (this.logging) {
            this.log.push([page << 8 | off, val, 'write']);
        }
        this.data[(page << 8) | off] = val;
    }

    reset() {
        this.log = [];
    }

    logStart() {
        this.log = [];
        this.logging = true;
    }

    logStop() {
        this.logging = false;
    }

    getLog() {
        return this.log;
    }
}

