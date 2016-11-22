/*exported Printer */

function Printer() {
    var _printer = null;
    return {
        putChar: function(val) {
            if (!_printer || _printer.closed) {
                _printer = window.open('', '_blank','toolbar=0,location=0');
                _printer.document.title = 'Printer';
                _printer.document.write('<div style="font: 12px courier">');
                _printer.document.write('<span>');
                window.focus();
            }
            var c = String.fromCharCode(val & 0x7f);
            if (c == '\r') {
                _printer.document.write('<br /></span>');
            } else if (c == ' ') {
                _printer.document.write('&nbsp;');
            } else {
                _printer.document.write(c);
            }
        }
    };
}
