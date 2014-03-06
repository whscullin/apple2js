JSLINT = jshint

JSFILES = copyright.js audio.js keyboard2.js gamepad.js printer.js

JSFILES2E = copyright.js audio.js keyboard2e.js gamepad.js printer.js

ALLJS = ${JSFILES} ${JSFILES2E}
CHECKEDJS := $(patsubst %.js,.checked-%.js,${ALLJS})

default:

clean:
	$(RM) -f .checked-*

lint: $(CHECKEDJS)

.checked-%.js: %.js
	$(JSLINT) $< 
	@touch $@
