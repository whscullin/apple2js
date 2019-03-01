/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*eslint no-console: 0*/

var hex_digits = '0123456789ABCDEF';
var bin_digits = '01';

export function allocMem(size) {
    function garbage() {
        return (Math.random() * 0x100) & 0xff;
    }
    var result;
    if (window.Uint8Array) {
        result = new Uint8Array(size);
    } else {
        result = new Array(size);
    }
    var idx;
    for (idx = 0; idx < size; idx++) {
        result[idx] = (idx & 0x02) ? 0x00 : 0xff;
    }
    // Borrowed from AppleWin (https://github.com/AppleWin/AppleWin)
    for(idx = 0; idx < size; idx += 0x200 ) {
        result[idx + 0x28] = garbage();
        result[idx + 0x29] = garbage();
        result[idx + 0x68] = garbage();
        result[idx + 0x69] = garbage();
    }
    return result;
}

export function allocMemPages(pages) {
    return allocMem(pages * 0x100);
}

export function bytify(ary) {
    var result = ary;
    if (window.Uint8Array) {
        result = new Uint8Array(ary);
    }
    return result;
}

export function debug() {
    if (typeof console != 'undefined' && 'log' in console) {
        console.log.apply(console, arguments);
    }
}

export function toHex(v, n) {
    if (!n) {
        n = v < 256 ? 2 : 4;
    }
    var result = '';
    for (var idx = 0; idx < n; idx++) {
        result = hex_digits[v & 0x0f] + result;
        v >>= 4;
    }
    return result;
}

export function toBinary(v) {
    var result = '';
    for (var idx = 0; idx < 8; idx++) {
        result = bin_digits[v & 0x01] + result;
        v >>= 1;
    }
    return result;
}

// From http://www.netlobo.com/url_query_string_javascript.html
export function gup( name )
{
    name = name.replace(/[[]/,'\\[').replace(/[\]]/,'\\]');
    var regexS = '[\\?&]'+name+'=([^&#]*)';
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( !results )
        return '';
    else
        return results[1];
}

export function hup() {
    var regex = new RegExp('#(.*)');
    var results = regex.exec(window.location.hash);
    if ( !results )
        return '';
    else
        return results[1];
}

export function keys(obj) {
    var result = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            result.push(key);
        }
    }
    return result;
}

export function each(obj, fn) {
    keys(obj).forEach(fn);
}
