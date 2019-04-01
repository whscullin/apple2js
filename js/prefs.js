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

export default function Prefs()
{
    var havePrefs = typeof window.localStorage !== 'undefined';

    return {
        havePrefs: function() {
            return havePrefs;
        },
        readPref: function(name) {
            if (havePrefs)
                return window.localStorage.getItem(name);
            return null;
        },
        writePref: function(name, value) {
            if (havePrefs)
                window.localStorage.setItem(name, value);
        }
    };
}
