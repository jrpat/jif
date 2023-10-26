#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

#include "webview.h"

#include "platform_folders.h"
#include "platform_folders.cpp"
#include "portable-file-dialogs.h"
#include "subprocess.hpp"

#include ".build/html.hh"


namespace sp = subprocess;
using namespace sp::literals;


using Str = std::string;


std::vector<webview::webview> wins;
std::string bin;


Str js_alert(Str args) {
  pfd::message {"Alert", args};
  return "";
}

Str js_dialog_open(Str args) {
  pfd::open_file {"Choose a file to open"};
  return "";
}

Str js_dialog_save(Str args) {
  pfd::save_file {"Save As..."};
  return "";
}

Str js_newwin(Str args) {
  return "";
}

Str js_quit(Str args) {
  for (auto& it : wins) { it.terminate(); }
  return "";
}


int main(int argc, char* argv[]) {
  auto& wv = wins.emplace_back(true, nullptr);

  wv.bind("app_alert", js_alert);
  wv.bind("app_dialog_open", js_dialog_open);
  wv.bind("app_dialog_save", js_dialog_save);
  wv.bind("app_newwin", js_newwin);
  wv.bind("app_quit", js_quit);
  wv.bind("app_closewin", [&](Str) -> Str {
    wv.terminate();
    for (auto end=wins.end(), it=wins.begin(); it != end; ++it) {
      if (&wv == &*it) { wins.erase(it); }
      std::cout << "Windows left: " << wins.size() << std::endl;
    }
    return "";
  });

  wv.set_title("JIF");
  wv.set_size(940, 940, WEBVIEW_HINT_NONE);
  wv.set_html(html);
  wv.run();

//   ("/bin/sh -c 'ls -l'"_cmd).run();

  return 0;
}
