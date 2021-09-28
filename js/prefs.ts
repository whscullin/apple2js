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

const havePrefs = typeof window.localStorage !== 'undefined';

export default class Prefs {
    params: URLSearchParams

    constructor() {
        this.params = new URLSearchParams(window.location.search);
    }

    havePrefs() {
        return havePrefs;
    }

    readPref(name: string): string | null
    readPref(name: string, defaultValue: string): string
    readPref(name: string, defaultValue: string | null = null) {
        if (this.params.has(name)) {
            return this.params.get(name);
        }

        if (havePrefs) {
            return window.localStorage.getItem(name) ?? defaultValue;
        }
        return defaultValue;
    }

    writePref(name: string, value: string) {
        if (havePrefs) {
            window.localStorage.setItem(name, value);
        }
    }
}
