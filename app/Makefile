arch := $(shell echo $(shell uname -s) | tr '[:upper:]' '[:lower:]')

iargs := -Ilib/webview

dep := .build/html.hh
src := jif.cc

res := ../www/jif.css \
			 ../www/jif.js \
			 app.js \
			 index.html \
			 .build/font.ttf.b64

ttf := ../www/fonts/iAWriterQuattroV.ttf


default: .build/$(arch)/jif
mac: .build/darwin/jif
lin: .build/linux/jif


.build/html.hh: $(res) Makefile | .build
	@printf 'constexpr const auto html = R"html(%s)html";' \
		"$$(perl -pe 's/\s*%%(.+?)%%/`cat $$1`/ge' index.html)" \
		> $@

.build/font.ttf.b64: $(ttf) Makefile | .build
	@base64 -i $(ttf) -o $@


.build/darwin/jif: $(src) $(dep) | .build/darwin
	$(CXX) $(src) -std=c++11 $(iargs) -framework WebKit -o $@

.build/linux/jif: $(src) $(dep) | .build/linux
	$(CXX) $(src) -std=c++11 $(iargs) -o $@ \
		$(pkg-config --cflags --libs gtk+-3.0 webkit2gtk-4.0)


.build:
	mkdir -p $@

.build/%:
	mkdir -p $@


run: .build/$(arch)/jif
	$<

clean:
	rm -rf .build

