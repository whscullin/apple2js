COMPRESS = java -jar $(HOME)/bin/compiler.jar --warning_level QUIET
JSLINT = jshint

JSFILES = copyright.js util.js prefs.js ram.js langcard.js fpbasic.js apple2char.js canvas2.js apple2io.js parallel.js ramfactor.js disk2.js cpu6502.js base64.js

JSFILES2E = copyright.js util.js prefs.js ram.js mmu.js apple2e.js apple2e-enhanced.js apple2echar.js canvas2e.js apple2io.js parallel.js slot3.js ramfactor.js thunderclock.js disk2.js cpu6502.js base64.js

ALLJS = ${JSFILES} ${JSFILES2E}
CHECKEDJS := $(patsubst %.js,.checked-%.js,${ALLJS})

default: all.min.js all2e.min.js
	$(MAKE) -C ui

all.min.js: all.js
	$(COMPRESS) < all.js > all.min.js

all2e.min.js: all2e.js
	$(COMPRESS) < all2e.js > all2e.min.js

all.js: $(JSFILES) Makefile
	cat $(JSFILES) > all.js

all2e.js: $(JSFILES2E) Makefile
	cat $(JSFILES2E) > all2e.js

clean:
	$(RM) -f all.js all.min.js all2e.js all2e.min.js .checked-*
	$(MAKE) -C ui clean

lint: $(CHECKEDJS)
	$(MAKE) -C ui lint

.checked-%.js: %.js
	$(JSLINT) $< 
	@touch $@
