BUN = bun
BUNX = bunx --bun

dep:
	$(BUN) install

dep.update:
	$(BUNX) taze -w

test:
	$(BUN) test

fmt:
	$(BUNX) prettier --write .

pub:
	$(BUNX) @morlay/bunpublish

install:
	rm -rf ~/.bun/bin/bunpublish
	$(BUN) link