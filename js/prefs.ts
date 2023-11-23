const havePrefs = typeof window.localStorage !== 'undefined';

export default class Prefs {
    url: URL;
    title: string;

    constructor() {
        this.url = new URL(window.location.href);
        this.title = window.document.title;
    }

    havePrefs() {
        return havePrefs;
    }

    readPref(name: string): string | null;
    readPref(name: string, defaultValue: string): string;
    readPref(name: string, defaultValue: string | null = null) {
        if (this.url.searchParams.has(name)) {
            return this.url.searchParams.get(name);
        }

        if (havePrefs) {
            return window.localStorage.getItem(name) ?? defaultValue;
        }
        return defaultValue;
    }

    writePref(name: string, value: string) {
        if (this.url.searchParams.has(name)) {
            this.url.searchParams.set(name, value);
            history.replaceState(null, this.title, this.url.toString());
        }

        if (havePrefs) {
            window.localStorage.setItem(name, value);
        }
    }
}
