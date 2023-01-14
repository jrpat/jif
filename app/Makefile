arch := $(shell echo $(shell uname -s) | tr '[:upper:]' '[:lower:]')

IFLAGS := -Ilib

dep := .build/html.hh
src := jif.cc

lib := lib/webview.h \
			 lib/platform_folders.h \
			 lib/platform_folders.cpp \
			 lib/portable-file-dialogs.h \
			 lib/subprocess.hpp

res := ../jif.css \
			 ../jif.js \
			 app.js \
			 index.html \
			 .build/font.ttf.b64

ttf := ../fonts/iAWriterQuattroV.ttf


default: .build/$(arch)/jif
mac: .build/darwin/jif
lin: .build/linux/jif


.build/html.hh: $(res) Makefile | .build
	@printf 'constexpr const auto html = R"html(%s)html";' \
		"$$(perl -pe 's/\s*%%(.+?)%%/`cat $$1`/ge' index.html)" \
		> $@

.build/font.ttf.b64: $(ttf) Makefile | .build
	@base64 -i $(ttf) -o $@


.build/darwin/jif: $(src) $(dep) $(lib) | .build/darwin
	$(CXX) $(src) -std=c++17 $(IFLAGS) -framework WebKit -o $@

.build/linux/jif: $(src) $(dep) $(lib) | .build/linux
	$(CXX) $(src) -std=c++17 $(IFLAGS) -o $@ \
		$(pkg-config --cflags --libs gtk+-3.0 webkit2gtk-4.0)


v-webview := 73aee3dae7457e3b08b9f4445793b10985c50803
lib/webview.h:
	cd lib && wget -q 'https://raw.githubusercontent.com/webview/webview/$(v-webview)/webview.h'

v-platform_folders := 784f8ceb8bbd042722caf2cdec427c7b80e0a960
lib/platform_folders.%:
	cd lib && wget -q 'https://raw.githubusercontent.com/sago007/PlatformFolders/$(v-platform_folders)/sago/platform_folders.$*'

v-portable-file-dialogs := 7f852d88a480020d7f91957cbcefe514fc95000c
lib/portable-file-dialogs.h:
	cd lib && wget -q 'https://raw.githubusercontent.com/samhocevar/portable-file-dialogs/$(v-portable-file-dialogs)/portable-file-dialogs.h'

v-subprocess := 251e020e10bd5e32e622b576245acb595bdf08dd
lib/subprocess.hpp:
	cd lib && wget -q 'https://raw.githubusercontent.com/rajatjain1997/subprocess/$(v-subprocess)/include/subprocess/subprocess.hpp'


.build:
	mkdir -p $@

.build/%:
	mkdir -p $@


run: .build/$(arch)/jif
	$<

clean:
	rm -rf .build

