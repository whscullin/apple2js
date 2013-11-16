JSLINT = jshint

JSFILES = copyright.js util.js prefs.js ram.js langcard.js fpbasic.js apple2char.js canvas2.js apple2io.js parallel.js ramfactor.js disk2.js cpu6502.js base64.js

JSFILES2E = copyright.js util.js prefs.js ram.js mmu.js apple2e.js apple2e-enhanced.js apple2echar.js canvas2e.js apple2io.js parallel.js slot3.js ramfactor.js thunderclock.js disk2.js cpu6502.js base64.js

ALLJS = ${JSFILES} ${JSFILES2E}
CHECKEDJS := $(patsubst %.js,.checked-%.js,${ALLJS})

default:
	$(MAKE) -C ui

clean:
	$(RM) -f .checked-*
	$(MAKE) -C ui clean

lint: $(CHECKEDJS)
	$(MAKE) -C ui lint

.checked-%.js: %.js
	$(JSLINT) $< 
	@touch $@
