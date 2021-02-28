/** @fileoverview Test for base64.ts. */

import {
    base64_encode,
    base64_decode,
    base64_json_parse,
    base64_json_stringify,
} from '../../js/base64';

describe('base64', () => {
    let memory: Uint8Array;

    beforeEach(() => {
        memory = new Uint8Array([1,2,3,4,5,6]);
    });

    describe('base64_encode', () => {
        it('encodes Uint8Arrays', () => {
            expect(base64_encode(memory)).toEqual('AQIDBAUG');
        });
    });

    describe('base64_decode', () => {
        it('encodes Uint8Arrays', () => {
            expect(base64_decode('AQIDBAUG')).toEqual(memory);
        });
    });

    describe('base64_json_parse', () => {
        it('handles structures with Uint8Arrays', () => {
            expect(base64_json_parse(`\
{
    "foo": "bar",
    "baz": {
        "biff": "data:application/octet-stream;base64,AQIDBAUG"
    }
}
            `)).toEqual({
                foo: 'bar',
                baz: {
                    biff: memory
                }
            });
        });

    });

    describe('base64_json_stringify', () => {
        it('handles structures with Uint8Arrays', () => {
            expect(base64_json_stringify({
                foo: 'bar',
                baz: {
                    biff: memory
                }
            })).toEqual(
                '{"foo":"bar","baz":{"biff":"data:application/octet-stream;base64,AQIDBAUG"}}'
            );
        });
    });
});
