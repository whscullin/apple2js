const havePrefs = typeof window.localStorage !== 'undefined';

export default class Prefs {
    params: URLSearchParams;

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
