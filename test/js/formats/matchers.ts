/* eslint-disable @typescript-eslint/no-namespace */
import '';

interface CustomMatchers<R = unknown> {
    equalsUint8Array(other: Uint8Array): R;
}

declare global {
    namespace jest {
        interface Expect extends CustomMatchers {}
        interface Matchers<R> extends CustomMatchers<R> {}
        interface InverseAsymmetricMatchers extends CustomMatchers {}
    }
}

function short(o: { toString(): string }): string {
    const result = o.toString();
    return  result.length > 8 ? result.substring(0, 5) + '...' : result;
}

function smallDiff(a: Uint8Array, b: Uint8Array): string {
    let result = '';

    if (!(a instanceof Uint8Array)) {
        result += `${short(a)} is not a Uint8Array`;
    }
    if (!(b instanceof Uint8Array)) {
        result += `${short(b)} is not a Uint8Array`;
    }
    if (result.length) {
        return result;
    }

    if (a.length !== b.length) {
        return `${short(a)} is not the same length as ${short(b)}: ${a.length} !== ${b.length}`;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            result += `first diff at ${i}:\n`;
            result += `    ${a.subarray(i, Math.min(i + 5, a.length)).toString()}\n`;
            result += `    ${b.subarray(i, Math.min(i + 5, b.length)).toString()}`;
            return result;
        }
    }

    return 'no differences found';
}

expect.extend({
    /**
     * Jest matcher for large Uint8Arrays
     */
    equalsUint8Array(received: Uint8Array, other: Uint8Array) {
        const pass = received.length === other.length && received.every((value, i) => other[i] === value);
        if (pass) {
            return {
                message: () => 'expected arrays not to be equal',
                pass: true,
            };
        } else {
            return {
                message: () => `expected arrays to be equal: ${smallDiff(received, other)}`,
                pass: false,
            };
        }
    }
});
