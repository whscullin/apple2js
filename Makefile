default:
	$(MAKE) -C js

index:
	./scripts/index.pl > json/disks/index.js

clean:
	$(MAKE) -C js clean

lint:
	$(MAKE) -C js lint
