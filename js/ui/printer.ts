import { byte } from '../types';

/**
  * Printer UI. The "paper" is bound to the element selected by the input.
  *
  * Every line that is output to the printer is added as a <div> to the paper.
  * The high bit of all characters is stripped and only visible characters are
  * added to the output. The following characters receive special treatment:
  *
  * *   `EOT` (ASCII 4): deletes last character
  * *   `HT` (ASCII 9): replaced with 8 spaces
  * *   `LF` (ASCII 10): silently removed
  * *   `CR` (ASCII 13): a newline and carriage return
  */
export default class Printer {
    private paper: HTMLElement;
    private _lineBuffer = '';
    private _line: HTMLElement;
    private _rawLen = 0;
    private _raw = new Uint8Array(1024);

    /**
     * Creates a new printer bound to the given element.
     * @param {string} el The selector of the element on which to bind the "paper".
     */
    constructor(el: string) {
        this.paper = document.querySelector(el)!;
        this.newLine();
    }

    private newLine() {
        this._line = document.createElement('div');
        this._line.classList.add('line');
        this._line.innerText = this._lineBuffer;
        this.paper.append(this._line);
        this._lineBuffer = '';
    }

    putChar(val: byte) {
        const ascii = val & 0x7f;
        const visible = val >= 0x20;
        const c = String.fromCharCode(ascii);

        if (c === '\r') {
            this.newLine();
        } else if (c === '\n') {
            // eat for now
        } else if (c === '\t') {
            // possibly not right due to tab stops
            this._lineBuffer += '        ';
        } else if (ascii === 0x04) {
            this._lineBuffer = this._lineBuffer.slice(0, -1);
        } else if (visible) {
            this._lineBuffer += c;
        }
        this._line.innerText = this._lineBuffer;
        this._raw[this._rawLen] = val;
        this._rawLen++;
        if (this._rawLen > this._raw.length) {
            const newRaw = new Uint8Array(this._raw.length * 2);
            newRaw.set(this._raw);
            this._raw = newRaw;
        }
    }

    clear() {
        this._lineBuffer = '';
        this.paper.innerHTML = '';
        this.newLine();
        this._raw = new Uint8Array(1024);
        this._rawLen = 0;
    }

    hasPrintout() {
        return this.paper.innerText.length > 0;
    }

    getRawOutput() {
        return this._raw.slice(0, this._rawLen);
    }
}
