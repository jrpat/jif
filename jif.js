////////////////////////////////////////////////////////////////////////
const D=document, B=D.body, LS=localStorage, U=undefined, O=Object
const $=D.querySelector.bind(D), $$=D.querySelectorAll.bind(D)
const tojson = x => U===x ? '' : JSON.stringify(x)
const unjson = x => U===x ? undefined : JSON.parse(x)
const db = {set: (k,v) => LS.setItem(k, tojson(v)),
            get: (k) => unjson(LS.getItem(k)),
            del: (k) => LS.removeItem(k), raw: LS}
const AsyncFunction = (async function(){}).constructor
EventTarget.prototype.on = EventTarget.prototype.addEventListener
EventTarget.prototype.off = EventTarget.prototype.removeEventListener
Element.prototype.$ = Element.prototype.querySelector
Element.prototype.$$ = Element.prototype.querySelectorAll
const stopevt = e => { e.preventDefault(); e.stopPropagation(); }
////////////////////////////////////////////////////////////////////////


const cmd = (cmd, arg) => document.execCommand(cmd, false, arg)
const cors = url => `https://proxy.cors.sh/${url}`

const ed = $('#ed')
const ui = $('#ui')
const stat = $('#stat')


const api = {}

const jif = {
  opt: {
    trig_timeout: 1000,
    snip_lookahead: 500,
  },
  trigs: {},
}

let T = null


const keyabbrs = {
  'lt':'<', 'esc':'escape', 'cr':'enter', 'space':' ', 'bslash':"\\",
  'bar':'|', 'bs':'backspace',
  'left':'arrowleft', 'right':'arrowright', 'up':'arrowup', 'down':'arrowdown'
}

const shifted = '~!@#$%^&*()-+{}|:"<>?'.split('')

function keyabbr(k) {
  return keyabbrs[k] || k
}

function keyrep_str(s) {
  if (/^[A-Z]$/.test(s)) { s = '<s.'+s+'>' }
  s = s.trim().toLowerCase()
  if (s[0] != '<') { return s }
  let k = s.slice(1, -1).split(/[-.]/)
  let mods = Array.from(new Set(k.slice(0, -1))).sort()
  return [...mods, keyabbr(k.at(-1))].join('.')
}

function keyrep_evt(e) {
  let a = e.altKey ? 'a.' : ''
  let c = e.ctrlKey ? 'c.' : ''
  let m = e.metaKey ? 'm.' : ''
  let s = (e.shiftKey && !shifted.includes(e.key)) ? 's.' : ''
  return a + c + m + s + e.key.toLowerCase()
}

function keyseq(k) {
  k = k.replaceAll('>', '> ').replaceAll('<', ' <')
  return k
    .split(/\s+/)
    .map(c => c[0]=='<' ? c : c.split(''))
    .flat()
    .map(keyrep_str)
}

function withsel(bgn, end) {
  ed.focus()
  if (bgn != null) setsel(bgn, (end==null) ? bgn : end)
}

const curpos = () => ed.selectionEnd
const selbgn = () => ed.selectionStart
const cursel = () => [ed.selectionStart, ed.selectionEnd]
const setpos = (p) => ed.setSelectionRange(p, p)
const setsel = (b,e) => ed.setSelectionRange(b,e, ((b<e)?'for':'back')+'ward')
const gettxt = (b=curpos(), e=0) => ed.value.slice(b, (e ? e : b+1))
const instxt = (t,b,e) => { withsel(b,e); cmd('insertText', t) }
const deltxt = (b,e) => { withsel(b,e); cmd('delete') }

function addtrig(seq, fn) {
  let trigs = jif.trigs
  let slen = seq.length
  for (let i=0; i < slen; ++i) {
    let rep = seq[i]
    if (!trigs[rep]) { trigs[rep] = {f:null, trigs:{}} }
    if (i == slen-1) {
      trigs[rep].f = fn
    } else {
      trigs = trigs[rep].trigs
    }
  }
}


function snipexpand(snip, bgn, end) {
  if (!snip) { return }
  if (bgn == null) { bgn = end = curpos() }
  let sel = cursel()
  let zero = (sel[0] == sel[1]) ? '' : gettxt(...sel)
  instxt(snip, bgn, end)
  snipnext(zero, bgn, snip.length)
}

function snipnext(
  zero = '',
  pos = curpos(),
  lookahead = jif.opt.snip_lookahead,
) {
  const look = ed.value.slice(pos, pos+lookahead)
  const matches = look.matchAll(/%\d+/g)
  let next = [9999, -1, -1, null]
  for (const match of matches) {
    const m = match[0]
    const mn = parseInt(m.slice(1), 10)
    if (mn < next[0]) {
      next = [mn, match.index, m.length, m]
      if (mn == 0) { break }
    }
  }
  if (next[3] != null) {
    let bgn = pos + next[1]
    let end = bgn + next[2]
    setsel(bgn, end)
    if (next[0] == 0) { cmd('insertText', zero) }
  }
}


function T_start(t) {
  if (!T) {
    T = {pos: selbgn()}
  } else {
    clearTimeout(T.timer)
  }
  T.active = t
  const wait = Object.keys(t.trigs).length > 0
  T.timer = setTimeout(T_fin, wait ? jif.opt.trig_timeout : 1)
  return wait
}

function T_cancel() {
  if (!T) { return }
  clearTimeout(T.timer)
  T = null
}

function T_fin() {
  if (!T) { return }
  clearTimeout(T.timer)
  const t = T.active
  if (t.f) { t.f() }
  T = null
}


function ui_toggle() {
  ui.classList.toggle('visible')
}

function ui_show() {

}


function zoom_text(n) {
  const pt = parseInt(ed.style.fontSize, 10)
  ed.style.fontSize = (pt + n)+'pt'
}


////////////////////////////////////////////////////////////////////////


const ignorekeys = new Set('Alt', 'Control', 'Meta', 'Shift')
const brackets = {'(':')', '[':']', '{':'}'}


ed.on('keydown', e => {
  if (e.repeat || (ignorekeys.has(e.key))) {
    return true
  }

  if (e.key == 'Backspace') {
    const pos = curpos()
    const close = brackets[ed.value[pos-1]]
    if (close && (ed.value[pos] == close)) { cmd('forwardDelete') }
    return true
  }

  if (e.key == 'Tab') {
    stopevt(e)
    snipnext()
    return false
  }

  const rep = keyrep_evt(e)
  const trigs = (T ? T.active : jif).trigs
  const trig = trigs[rep]

  if (trig) {
    const wait = T_start(trig)
    if (!wait) { stopevt(e) }
  }
  else {
    T_cancel()
  }
})


document.on('keydown', e => {
  if (e.ctrlKey) {
    if (e.key == "\\") { stopevt(e); ui_toggle() }
    if (e.key == ";")  { stopevt(e); cli_toggle() }
  }

  if (e.metaKey) {
    if (e.key == '=') { stopevt(e); zoom_text( 2) }
    if (e.key == '-') { stopevt(e); zoom_text(-2) }
    if (e.key == '0') { ed.style.fontSize = '16pt' }
  }
}, true)


////////////////////////////////////////////////////////////////////////


api.opt = (key, val) => {
  if (val === undefined) { return jif.opt[key] }
  jif.opt[key] = val
}

api.key = (keys) => {
  for (const [key, fn] of O.entries(keys)) {
    addtrig(keyseq(key), fn)
  }
}

api.map = (maps) => {
  for (const [key, sub] of O.entries(maps)) {
    const seq = keyseq(key)
    if (typeof(sub) == 'function')
      addtrig(seq, (pos=curpos()) => snipexpand(sub(), T.pos, pos));
    else
      addtrig(seq, () => snipexpand(sub, T.pos, curpos()))
  }
}

api.ins = instxt
api.del = deltxt
api.get = gettxt
api.pos = (n) => (n==null) ? curpos() : setpos(n)
api.sel = (b,e) => (b==null) ? cursel() : setsel(b,e)

api.tstart = () => T ? T.pos : null

api.move = (n) => setpos(curpos() + n)
api.left = () => api.move(-1)
api.right = () => api.move(1)

api.map({
  '(': '(%0)',
  '[': '[%0]',
  '{': '{%0}',
})

api.map({
  ')': () => ((gettxt() == ')' && deltxt(curpos()+1)), ')'),
  ']': () => ((gettxt() == ']' && deltxt(curpos()+1)), ']'),
  '}': () => ((gettxt() == '}' && deltxt(curpos()+1)), '}'),
})


window.api = api


////////////////////////////////////////////////////////////////////////


window.config = async function(code) {
  (new AsyncFunction(...O.keys(api), code))(...O.values(api))
}

async function load_config(loc) {
  if (loc.startsWith('http')) {
    const resp = await fetch(`${loc}?jifbuster=${Date.now()}`, {cache:'no-cache'})
    const text = await resp.text()
    config(text)
  } else {

  }
}


const configs = db.get('configs') || []

function find_config(path) {
  return configs.find(c => c.path == path)
}

function list_config(c) {
  const elem = $('#configs')
  elem.innerHTML += `<div hbox=between-center>
    <input name=auto type=checkbox ${c.auto ? 'checked' : ''}>
    <input name=path disabled value="${c.path}">
    <button name=load>↺</button>
  </div>`
}

if (configs) {
  configs.forEach(c => {
    if (c.auto) { load_config(c.path) }
    list_config(c)
  })
}


$('#configs').on('click', e => {
  const t = e.target
  if (t.name == 'load') {
    load_config(t.parentElement.$('[name="path"]').value)
  }
})

$('#configs').on('change', e => {
  const t = e.target
  if (t.name == 'auto') {
    const par = t.parentElement
    const path = par.$('[name="path"]').value
    load_config(path)
    find_config(path).auto = t.checked
    db.set('configs', configs)
  }
})

$('#add-config').on('click', () => {
  const path = prompt('Config path:')
  let cfg = find_config(path)
  if (!cfg) {
    cfg = {auto:false, path}
    configs.push(cfg)
    list_config(cfg)
  }
  db.set('configs', configs)
})


////////////////////////////////////////////////////////////////////////


api.map({
  '<m.i>': '\\I{%0}',
  '<m.b>': '\\B{%0}',
  ':S:':   '\\S{%0}',
})



