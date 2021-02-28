import { memory } from './types';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/** Encode an array of bytes in base64. */
export function base64_encode(data: null | undefined): undefined;
export function base64_encode(data: memory): string;
export function base64_encode(data: memory | null | undefined): string | undefined {
    // Twacked by Will Scullin to handle arrays of 'bytes'

    // http://kevin.vanzonneveld.net
    // +   original by: Tyler Akins (http://rumkin.com)
    // +   improved by: Bayron Guevara
    // +   improved by: Thunder.m
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Pellentesque Malesuada
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // -    depends on: utf8_encode
    // *     example 1: base64_encode('Kevin van Zonneveld');
    // *     returns 1: 'S2V2aW4gdmFuIFpvbm5ldmVsZA=='

    // mozilla has this native
    // - but breaks in 2.0.0.12!
    //if (typeof this.window['atob'] == 'function') {
    //    return atob(data);
    //}


    let o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc='';
    const tmp_arr = [];

    if (!data) {
        return undefined;
    }

    do { // pack three octets into four hexets
        o1 = data[i++];
        o2 = data[i++];
        o3 = data[i++];

        bits = o1<<16 | o2<<8 | o3;

        h1 = bits>>18 & 0x3f;
        h2 = bits>>12 & 0x3f;
        h3 = bits>>6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = B64.charAt(h1) + B64.charAt(h2) + B64.charAt(h3) + B64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
            break;
        case 2:
            enc = enc.slice(0, -1) + '=';
            break;
    }

    return enc;
}

/** Returns undefined if the input is null or undefined. */
export function base64_decode(data: null | undefined): undefined;
/** Returns an array of bytes from the given base64-encoded string. */
export function base64_decode(data: string): memory;
/** Returns an array of bytes from the given base64-encoded string. */
export function base64_decode(data: string | null | undefined): memory | undefined {
    // Twacked by Will Scullin to handle arrays of 'bytes'

    // http://kevin.vanzonneveld.net
    // +   original by: Tyler Akins (http://rumkin.com)
    // +   improved by: Thunder.m
    // +      input by: Aman Gupta
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   bugfixed by: Pellentesque Malesuada
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +      input by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // -    depends on: utf8_decode
    // *     example 1: base64_decode('S2V2aW4gdmFuIFpvbm5ldmVsZA==');
    // *     returns 1: 'Kevin van Zonneveld'

    // mozilla has this native
    // - but breaks in 2.0.0.12!
    //if (typeof this.window['btoa'] == 'function') {
    //    return btoa(data);
    //}

    let o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0;
    const tmp_arr = [];

    if (!data) {
        return undefined;
    }

    do {  // unpack four hexets into three octets using index points in B64
        h1 = B64.indexOf(data.charAt(i++));
        h2 = B64.indexOf(data.charAt(i++));
        h3 = B64.indexOf(data.charAt(i++));
        h4 = B64.indexOf(data.charAt(i++));

        bits = h1<<18 | h2<<12 | h3<<6 | h4;

        o1 = bits>>16 & 0xff;
        o2 = bits>>8 & 0xff;
        o3 = bits & 0xff;

        tmp_arr[ac++] = o1;
        if (h3 != 64) {
            tmp_arr[ac++] = o2;
        }
        if (h4 != 64) {
            tmp_arr[ac++] = o3;
        }
    } while (i < data.length);

    return new Uint8Array(tmp_arr);
}

const DATA_URL_PREFIX = 'data:application/octet-stream;base64,';

export function base64_json_parse(json: string) {
    const reviver = (_key: string, value: any) => {
        if (typeof value ==='string' && value.startsWith(DATA_URL_PREFIX)) {
            return base64_decode(value.slice(DATA_URL_PREFIX.length));
        }
        return value;
    };

    return JSON.parse(json, reviver);
}

export function base64_json_stringify(json: any) {
    const replacer = (_key: string, value: any) => {
        if (value instanceof Uint8Array) {
            return DATA_URL_PREFIX + base64_encode(value);
        }
        return value;
    };

    return JSON.stringify(json, replacer);
}
