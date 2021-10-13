import type { CpuState } from 'js/cpu6502';
import { toHex } from 'js/util';
import { dumpStatusRegister } from 'js/debugger';

const detail = !!process.env.JEST_DETAIL;

export function toReadableState(state: CpuState) {
    if (detail) {
        const { pc, sp, a, x, y, s } = state;

        return {
            pc: toHex(pc, 4),
            sp: toHex(sp),
            a: toHex(a),
            x: toHex(x),
            y: toHex(y),
            s: dumpStatusRegister(s)
        };
    } else {
        return state;
    }
}
