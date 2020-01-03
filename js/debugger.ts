import { debug, toHex } from './util';
import { word } from './types';

import SYMBOLS from './symbols';
import CPU6502, { DebugInfo } from './cpu6502';

const alwaysBreak = (_info: DebugInfo) => { return true; };

export default class Debugger {
    private TRACE = false;
    private MAX_TRACE = 256;
    private trace: DebugInfo[] = [];
    private breakpoints: Map<number, (info: DebugInfo) => boolean> = new Map()

    constructor(private cpu: CPU6502) {}

    stepCycles(step: number) {
        this.cpu.stepCyclesDebug(this.TRACE ? 1 : step, () => {
            const info = this.cpu.getDebugInfo();
            const addr = info[0];

            if (this.breakpoints.get(addr)?.(info)) {
                debug(this.cpu.printDebugInfo(info, SYMBOLS));
                stop();
            }
            if (this.TRACE) {
                debug(this.cpu.printDebugInfo(info, SYMBOLS));
            } else {
                this.trace.push(info);
                if (this.trace.length > this.MAX_TRACE) {
                    this.trace.shift();
                }
            }
        });
    }

    getTrace() {
        return this.trace.map((info) => this.cpu.printDebugInfo(info, SYMBOLS)).join('\n');
    }

    printTrace() {
        debug(this.getTrace());
    }

    setBreakpoint(addr: word, exp: (info: DebugInfo) => boolean) {
        this.breakpoints.set(addr, exp || alwaysBreak);
    }

    clearBreakpoint(addr: word) {
        this.breakpoints.delete(addr);
    }

    listBreakpoints() {
        for(const [addr, fn] of this.breakpoints.entries()) {
            debug(toHex(addr, 4), fn);
        }
    }
}

