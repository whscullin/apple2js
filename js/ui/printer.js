/*exported Printer */

function Printer(paper) {
    var _lineBuffer;
    var _line;

    function newLine() {
        _line = $('<div>').addClass('line').text(_lineBuffer);
        paper.append(_line);
        _lineBuffer = '';
    }

    newLine();

    return {
        putChar: function(val) {
            var ascii = val & 0x7f;
            var visible = val >= 0x20;
            var c = String.fromCharCode(ascii);

            if (c == '\r') {
                newLine();
                _lineBuffer = '';
            } else if (c == '\t') {
                _lineBuffer += '        ';
            } else if (c == '\010') {
                _lineBuffer = _lineBuffer.slice(0, -1);
            } else {
                if (visible) {
                    _lineBuffer += c;
                }
            }
            _line.text(_lineBuffer);
        },

        clear: function() {
            _lineBuffer = '';
            paper.empty();
            newLine();
        },

        hasPrintout: function() {
            return paper.text().length();
        }
    };
}
