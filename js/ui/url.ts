/**
 * Returns the value of a query parameter or the empty string if it does not
 * exist.
 * @param name the parameter name.
 */

export function gup(name: string) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
}

/**
 * Returns the URL hash fragment minus the hash symbol or the empty
 * string if it does not exist.
 */

export function hup() {
    const regex = new RegExp('#(.*)');
    const hash = decodeURIComponent(window.location.hash);
    const results = regex.exec(hash);
    if (!results)
        return '';
    else
        return results[1];
}
