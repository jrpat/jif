window.alert = app_alert


////////////////////////////////////////////////////////////////////////
// Jif Integration

hotkey({
  'q': (() => app_quit()),
  'w': (() => app_closewin()),
  'z': ((e) => e.shiftKey ? cmd('redo') : cmd('undo')),
  'x': (() => cmd('cut')),
  'c': (() => cmd('copy')),
  'v': (() => cmd('paste')),
  'a': (() => cmd('selectAll')),
})



JIF.autosave = async function(path, text='') {
  console.log("autosave")
}

JIF.init = async function() {
  console.log('init')
}

JIF.autoload = async function() {
  console.log("autoload")
}

JIF.new_file = async function() {
  app_newwin();
}

JIF.choose_file_open = async function() {
  app_dialog_open()
}

JIF.choose_file_save = async function() {
  app_dialog_save()
}

JIF.write_file = async function() {
  console.log("write_file")
}

JIF.edit_config = async function() {
  console.log("edit_config")
}
