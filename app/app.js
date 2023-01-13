////////////////////////////////////////////////////////////////////////
// Shims

window.alert = function(msg) {
  console.log("alert")
}


////////////////////////////////////////////////////////////////////////
// Jif Integration

hotkey({
  'q': (() => quit()),
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


JIF.choose_file = async function() {
  console.log("choose_file")
}


JIF.write_file = async function() {
  console.log("write_file")
}
