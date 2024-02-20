BUN = bun
BUNX = bunx --bun

dep:
	$(BUN) install

dep.update:
	$(BUNX) npm-check-updates -ui

test:
	$(BUN) test

fmt:
	$(BUNX) prettier --write .

pub:
	$(BUNX) @morlay/bunpublish

install:
	$(BUN) link