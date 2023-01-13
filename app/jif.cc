#include <cstdint>
#include <string>

#include "webview.h"

#include ".build/html.hh"


webview::webview w {true, nullptr};


std::string quit(std::string) {
  w.terminate();
  return "";
}


int main() {
  w.bind("quit", quit);

  w.set_title("JIF");
  w.set_size(940, 940, WEBVIEW_HINT_NONE);
  w.set_html(html);
  w.run();

  return 0;
}
