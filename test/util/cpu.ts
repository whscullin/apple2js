import { flags } from 'js/cpu6502';
import type { CpuState } from 'js/cpu6502';
import type { byte } from 'js/types';
import { toHex } from 'js/util';

const detail = !!process.env.JEST_DETAIL;

export function toReadableFlags(sr: byte) {
    return [
        ((sr & flags.N) ? 'N' : '-'),
        ((sr & flags.V) ? 'V' : '-'),
        ((sr & flags.X) ? 'X' : '-'),
        ((sr & flags.B) ? 'B' : '-'),
        ((sr & flags.D) ? 'D' : '-'),
        ((sr & flags.I) ? 'I' : '-'),
        ((sr & flags.Z) ? 'Z' : '-'),
        ((sr & flags.C) ? 'C' : '-')
    ].join('');
}

export function toReadableState(state: CpuState) {
    if (detail) {
        const { pc, sp, a, x, y, s } = state;

        return {
            pc: toHex(pc, 4),
            sp: toHex(sp),
            a: toHex(a),
            x: toHex(x),
            y: toHex(y),
            s: toReadableFlags(s)
        };
    } else {
        return state;
    }
}
