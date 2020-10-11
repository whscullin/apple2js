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
  *
  * @param {string} el The selector of the element on which to bind the "paper".
  */
export default function Printer(el) {
    var paper = document.querySelector(el);
    var _lineBuffer = '';
    var _line;

    function newLine() {
        _line = document.createElement('div');
        _line.classList.add('line');
        _line.innerText = _lineBuffer;
        paper.append(_line);
        _lineBuffer = '';
    }

    newLine();

    return {
        putChar: function(val) {
            var ascii = val & 0x7f;
            var visible = val >= 0x20;
            var c = String.fromCharCode(ascii);

            if (c === '\r') {
                newLine();
            } else if (c === '\n') {
                // eat for now
            } else if (c === '\t') {
                _lineBuffer += '        ';
            } else if (ascii === 0x04) {
                _lineBuffer = _lineBuffer.slice(0, -1);
            } else if (visible) {
                _lineBuffer += c;
            }
            _line.innerText = _lineBuffer;
        },

        clear: function() {
            _lineBuffer = '';
            paper.innerHTML = "";
            newLine();
        },

        hasPrintout: function() {
            return paper.text.length;
        }
    };
}
