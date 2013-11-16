JSLINT = jshint

JSFILES = copyright.js keyboard2.js printer.js

JSFILES2E = copyright.js keyboard2e.js printer.js

ALLJS = ${JSFILES} ${JSFILES2E}
CHECKEDJS := $(patsubst %.js,.checked-%.js,${ALLJS})

default:

clean:
	$(RM) -f .checked-*

lint: $(CHECKEDJS)

.checked-%.js: %.js
	$(JSLINT) $< 
	@touch $@
