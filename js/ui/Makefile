COMPRESS = java -jar $(HOME)/bin/compiler.jar --warning_level QUIET
JSLINT = jshint

JSFILES = copyright.js keyboard2.js printer.js

JSFILES2E = copyright.js keyboard2e.js printer.js

ALLJS = ${JSFILES} ${JSFILES2E}
CHECKEDJS := $(patsubst %.js,.checked-%.js,${ALLJS})

default: ui-all.min.js ui-all2e.min.js

ui-all.min.js: ui-all.js
	$(COMPRESS) < ui-all.js > ui-all.min.js

ui-all2e.min.js: ui-all2e.js
	$(COMPRESS) < ui-all2e.js > ui-all2e.min.js

ui-all.js: $(JSFILES) Makefile
	cat $(JSFILES) > ui-all.js

ui-all2e.js: $(JSFILES2E) Makefile
	cat $(JSFILES2E) > ui-all2e.js

clean:
	$(RM) -f ui-all.js ui-all.min.js ui-all2e.js ui-all2e.min.js .checked-*

lint: $(CHECKEDJS)

.checked-%.js: %.js
	$(JSLINT) $< 
	@touch $@
