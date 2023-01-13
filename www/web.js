////////////////////////////////////////////////////////////////////////
const LS=localStorage
const tojson = x => ((U===x || x==='') ? N : JSON.stringify(x))
const unjson = x => ((U===x || x==='') ? U : JSON.parse(x))
const db = {set:((k,v) => (v===U)?db.del(k):LS.setItem(k,db.to(k)(v))),
  get:(k => db.un(k)(LS.getItem(k))), del:(k => LS.removeItem(k)),
  to:(k=>k[0]=='='?(x=>x):tojson), un:(k=>k[0]=='='?(x=>x):unjson)}
////////////////////////////////////////////////////////////////////////
window.db = db // debugging convenience
////////////////////////////////////////////////////////////////////////


JIF.autosave = async function(curpath, text='') {
  db.set('=curpath', curpath)
  db.set('=text', text)
}

JIF.init = async function() {
  configure(db.get('=config'))
  jif.curpath = db.get('=curpath')
  ed.value = db.get('=text')
  const prefs = set_prefs(db.get('prefs')) || {}
  set_scale(prefs.scale ?? 0)
  toggle_spell(prefs.spell ?? true)
}

JIF.choose_file = function() {
  return new Promise((ok, err) => {
    const input = html(
      '<input type=file>')
    input.on('change', () => {
      const file = input.files[0]
      file.path = file.name
      input.value = ''
      ok(file)
    })
    input.click()
  })
}

JIF.load_file = async function(path) {
  return new File('', path)
}

JIF.write_file = async function(path, content='') {
  const filename = path.split(/\/+/g).at(-1)
  const a = html(`<a download="${filename}" target=_blank>`)
  a.href = `data:text/plain,${encodeURI(content)}`
  a.click()
}

JIF.edit_config = function() {
  if ($('#config')) { return }
  const frame = html('<iframe id=config src="/config.html">')
  D.body.appendChild(frame)
}

JIF.save_prefs = function(prefs) {
  db.set('prefs', prefs)
}


////////////////////////////////////////////////////////////////////////


window.hide_config = function() {
  const c = $('#config')
  if (!c) { return }
  db.set('=config', c.contentWindow.ed.innerText)
  c.remove()
  ed.focus()
}


////////////////////////////////////////////////////////////////////////

JIF.init()

