BUN = bun
BUNX = bunx --bun

dep:
	$(BUN) install

test:
	$(BUN) test

fmt:
	$(BUNX) prettier --write .

pub: install
	$(BUNX) @morlay/bunpublish

install:
	$(BUN) link