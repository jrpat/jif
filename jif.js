/**********************************************************************/
/*                                                                    */
/*                                                                    */
/*                               @@@@@@          @@@@@@@@@@@@         */
/*                @@@@@@@@@@@   @@@@@@@@       @@@@@@@@@@@@@@@@       */
/*                @@@@@@@@@@@  @@@@@@@@@@    @@@@@@@@@@@@@@@@@@@@     */
/*                @@@@@@@@@@@   @@@@@@@@    @@@@@@@@@@ @@@@@@@@@@@    */
/*                @@@@@@@@@@@    @@@@@@    @@@@@@@@@@@ @@@@@@@@@@@    */
/*                @@@@@@@@@@@              @@@@@@@@@@@ @@@@@@@@@@@    */
/*                @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@ @@@@@@@@@@@    */
/*    @@@@@@@@@@@ @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@                */
/*    @@@@@@@@@@@ @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@@@@@@           */
/*    @@@@@@@@@@@ @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@@@@@@           */
/*    @@@@@@@@@@@ @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@                */
/*    @@@@@@@@@@@ @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@                */
/*    @@@@@@@@@@@ @@@@@@@@@@@  @@@@@@@@@@  @@@@@@@@@@@                */
/*     @@@@@@@@@@@@@@@@@@@@@   @@@@@@@@@@  @@@@@@@@@@@                */
/*       @@@@@@@@@@@@@@@@@     @@@@@@@@@@  @@@@@@@@@@@                */
/*                                                                    */
/*                                                                    */
/**********************************************************************/
const D=document, U=undefined, N=null, O=Object, M=Math, LS=localStorage
const E_p=Element.prototype, ET_p=EventTarget.prototype
const $=D.querySelector.bind(D), $$=D.querySelectorAll.bind(D)
E_p.$ = E_p.querySelector; E_p.$$ = E_p.querySelectorAll
E_p.attr=function(k,v){ return this[
  ((v===U)?'get':((v===N)?'remove':'set'))+'Attribute'](k,v)}
ET_p.on = ET_p.addEventListener; ET_p.off = ET_p.removeEventListener
const AsyncFunction = (async function(){}).constructor
const the = (x => x)
const tojson = x => ((U===x || x==='') ? N : JSON.stringify(x))
const unjson = x => ((U===x || x==='') ? U : JSON.parse(x))
const db = {set:((k,v) => LS.setItem(k, db.to(k)(v))),
  get:(k => db.un(k)(LS.getItem(k))), del:(k => LS.removeItem(k)),
  to:(k=>k[0]=='='?(x=>x):tojson), un:(k=>k[0]=='='?(x=>x):unjson)}
const html = s => { let e,d=D.createElement('div');
  d.innerHTML=s; e=d.firstElementChild; e.remove(); return e }
const stopevt = e => (e.preventDefault(), e.stopPropagation(), false)
const clamp = (x,min,max) => (x<=min ? min : x>=max ? max : x)
const delay = (f, ms=1) => setTimeout(f, ms)
const isstr = s => (typeof(s) == 'string')
const int = (x) => parseInt(x, 10)
/**********************************************************************/
window.db = db // debugging convenience



////////////////////////////////////////////////////////////////////////
// State

let ed = $('#ed')

const jif = {
  opt: {
    trig_timeout: 1000,
    snip_lookahead: 500,
    cors: (url) => `https://cors.jif-editor.workers.dev/?${url}`
  },
  log: [],
  trigs: {},
  curpath: null,
}

const jpairs = {}

const api = {}



////////////////////////////////////////////////////////////////////////
// Integration

window.JIF ??= {}

JIF.autosave ??= async function(curpath, text='') {
  db.set('=curpath', curpath)
  db.set('=text', text)
}

JIF.autoload ??= async function() {
  jif.curpath = db.get('=curpath') ?? 'unknown.txt'
  ed.value = db.get('=text')
}

JIF.choose_file ??= function() {
  return new Promise((ok, err) => {
    const input = html(
      '<input type=file>')
    input.on('change', () => {
      const file = input.files[0]
      input.value = ''
      ok(file)
    })
    input.click()
  })
}

JIF.write_file ??= async function(path, content='') {
  const filename = path.split(/\/+/g).at(-1)
  const a = html(`<a download="${filename}" target=_blank>`)
  a.href = `data:text/plain,${encodeURI(content)}`
  a.click()
}

JIF.rename_file ??= async function(oldpath, newpath) {
  alert("Cannot rename files in the web version")
}



////////////////////////////////////////////////////////////////////////
// Helpers

O.defineProperty(ed, 'value', {
  get: function() { return ed.innerText },
  set: function(x) { ed.innerText = x }
})

O.defineProperty(Selection.prototype, 'range', {
  get: function() { return this.getRangeAt(0) },
  set: function(r) { this.removeAllRanges(); this.addRange(r) }
})

Selection.prototype.selectNode = function(n) {
  const r = new Range()
  r.selectNode(n)
  this.removeAllRanges()
  this.addRange(r)
}



////////////////////////////////////////////////////////////////////////
// Text Operations

function cmd(c, arg) { ed.focus(); D.execCommand(c, false, arg) }

function deltxt()  { cmd('delete') }
function instxt(t) { cmd('insertText', t) }

function extsel(d,g,n) {while(n--) getSelection().modify('extend',d,g)}
function movcur(d,g,n) {while(n--) getSelection().modify('move',d,g)}

const dir = (d) => ((d < 0) ? 'backward' : 'forward')

function extchr(d=1) { extsel(dir(d), 'character', M.abs(d)) }
function movchr(d=1) { movcur(dir(d), 'character', M.abs(d)) }
function extwrd(d=1) { extsel(dir(d), 'word', M.abs(d)) }
function movwrd(d=1) { movcur(dir(d), 'word', M.abs(d)) }
function extlin(d=1) { extsel(dir(d), 'line', M.abs(d)) }
function movlin(d=1) { movcur(dir(d), 'line', M.abs(d)) }


function adjch(dir, idx, rev) {
  return function(n=1) {
    const s=getSelection(), r=s.range
    if (!s.isCollapsed) {
      const rr = r.cloneRange()
      s.range = (rr.collapse(idx == 0), rr)
    }
    let m = n
    while (m--) s.modify('extend', dir, 'character')
    const ch = s.toString()
    s.range = r
    return ch
  }
}

const nextch = adjch('forward',  -1)
const prevch = adjch('backward',  0)



////////////////////////////////////////////////////////////////////////
// Triggers

let T = null

const keyabbrs = {
  'esc':'escape', 'cr':'enter', 'space':' ', 'bslash':"\\",
  'bar':'|', 'bs':'backspace', 'lt':'<', 'left':'arrowleft',
  'right':'arrowright', 'up':'arrowup', 'down':'arrowdown'
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
  return (e.altKey ? 'a.' : '')
       + (e.ctrlKey ? 'c.' : '')
       + (e.metaKey ? 'm.' : '')
       + ((e.shiftKey && !shifted.includes(e.key)) ? 's.' : '')
       + e.key.toLowerCase()
}

function keyseq(k) {
  k = k.replaceAll('>', '> ').replaceAll('<', ' <')
  return k.split(/\s+/)
          .map(c => c[0]=='<' ? c : c.split(''))
          .flat().map(keyrep_str)
}

function addtrig(seq, fn) {
  let t, trigs = jif.trigs
  for (const rep of seq) {
    t = trigs[rep] ??= {f:null, trigs:{}}
    trigs = t.trigs
  }
  t.f = fn
}

function deltrig(seq) {
  let t, trigs = jif.trigs
  for (const rep of seq.slice(0,-1)) {
    t = trigs[rep]; if (!t) { return }
    trigs = t.trigs
  }
  delete trigs[seq.at(-1)]
}


function T_ignore() { T = 0; return true }
function T_reset() { T = null; return true }

function T_start(t) {
  if (T == 0) { return T_reset() }
  if (T) {
    clearTimeout(T.timer)
  } else {
    const s = getSelection()
    const fill = s.toString()
    T = {fill}
    const ins = T.ins = document.createElement('ins')
    s.range.surroundContents(ins)
    if (!fill.length) { ins.innerHTML = '&nbsp;' }
    s.selectNode(ins)
  }
  T.active = t
  const wait = O.keys(t.trigs).length > 0
  if (wait)
    T.timer = delay(T_fin, jif.opt.trig_timeout)
  else
    T_fin()
  return wait
}

function T_cancel() {
  if (!T) { return }
  clearTimeout(T.timer)
  T.ins.outerText = T.ins.innerText
  T = null
}

function T_fin() {
  if (!T) { return }
  clearTimeout(T.timer)
  const s = getSelection()
  const r = new Range()
  r.setStartAfter(T.ins)
  r.setEndAfter(T.ins)
  s.range = r
  T.ins.remove()
  const t = T.active
  if (t.f) { t.f() }
  T = null
}



////////////////////////////////////////////////////////////////////////
// Snippets

function snipexpand(snip, fill=(T.fill ?? '\xA0\xA0')) {
  if (!(snip && isstr(snip))) { return }
  const s=getSelection(), r=s.getRangeAt(0)
  const fillnode = new Text(fill)
  const places = snipnext.places = []
  let [t1, t2, ...rest] = snip.split(/__+/).map(s => new Text(s))
  if (rest.length) {
    rest.reverse()
    snipnext.last = rest[0]
    for (const t of rest) {
      r.insertNode(t)
      const place = D.createTextNode('•')
      places.push(place)
      r.insertNode(place)
    }
  } else {
    snipnext.last = t2
  }
  if (t2) { r.insertNode(t2) }
  r.insertNode(fillnode)
  r.insertNode(t1)
  s.selectNode(fillnode)
}

function snipnext() {
  if (snipnext.places?.length) {
    const place = snipnext.places.pop()
    getSelection().selectNode(place)
    return
  }
  const last = snipnext.last
  snipnext.last = null
  if (last) {
    const r = new Range()
    r.setStartAfter(last)
    r.setEndAfter(last)
    getSelection().range = r
  }
}



////////////////////////////////////////////////////////////////////////
// Files

async function load_file(f) {
  jif.curpath = f.name
  ed.value = await f.text()
  JIF.autosave(f.path, ed.value)
}

async function choose_file() {
  load_file(await JIF.choose_file())
}



////////////////////////////////////////////////////////////////////////
// UI

function set_scale(n) {
  n = clamp(n, -3, 3)
  ed.setAttribute('scale', n)
  db.set('scale', n)
}

function change_scale(n) {
  set_scale(int(ed.attr('scale'))+n)
}

function toggle_spell(spell) {
  spell ??= !ed.spellcheck
  ed.spellcheck = spell
  db.set('spell', spell)
  // Forcing spellcheck redrawing is non-trivial and takes a long time.
  // https://stackoverflow.com/questions/1884829/force-spell-check-on-a-textarea-in-webkit
  return spell
}

function stat_calc() {
  const v = ed.value
  return {
      nchars: v.length
    , nwords: (v.match(/\s+/g) || []).length
    , nsents: (v.match(/(\.(\s|$))|(\S\s+\n+)/g) || []).length
  }
}

function show_stats() {
  const s = stat_calc()
  alert(`
    ${s.nchars.toLocaleString()} Characters
    ${s.nwords.toLocaleString()} Words
    ${s.nsents.toLocaleString()} Sentences
  `)
}

function show_config() {
  if ($('#config')) { return }
  const frame = html('<iframe id=config src="/config.html">')
  D.body.appendChild(frame)
}

window.configure = function(code) {
  if (!code) { return }
  (new AsyncFunction(...O.keys(api), code))(...O.values(api))
}

window.hide_config = function() {
  const c = $('#config')
  if (!c) { return }
  db.set('=config', c.contentWindow.ed.innerText)
  c.remove()
  ed.focus()
}

async function fetch_config(loc) {
  if  (/^https?:/.test(loc)) {
    const url = new URL(loc)
    url.searchParams.set('jifbuster', Date.now())
    let resp = await(fetch(jif.opt.cors(url), {cache: 'no-store'}))
    if (resp.ok) { configure(await resp.text()) }
  } else {
    configure(await JIF.read_file(loc))
  }
}

function show_cli() {
  let r = getSelection().range
  let cmd = prompt('')
  if (!cmd) { return }
  cmd = cmd.match(/(\S+)\s+(\S+)\s+(.+)/)
  if (!cmd) { return }
  let [_, c, x, y] = cmd
  if (! (c && x && y)) { return }
  c = c.toLowerCase()
  let f = api[c]
  if (!f) { return }
  let sx = x.replace("'", "\\'")
  let sy = y.replace("'", "\\'")
  try {
    f(x, eval(y))
    jif.log.push(`${c}('${sx}', ${y})`)
  } catch(e) {
    f(x, y)
    jif.log.push(`${c}('${sx}', '${sy}')`)
  }
  getSelection().range = r
}

function show_log() {
  alert(jif.log.join('\n'))
}



////////////////////////////////////////////////////////////////////////
// Keyboard Handling

let autosave_timer
const autosave = function() { JIF.autosave(jif.curpath, ed.value) }

const modkeys = ['Alt', 'Control', 'Meta', 'Shift']

ed.on('keydown', e => {
  const ismod = e.altKey || e.ctrlKey || e.metaKey

  if ((ismod || e.shiftKey) && modkeys.includes(e.key)) {
    return true
  }

  clearTimeout(autosave_timer)
  autosave_timer = setTimeout(autosave, 1000)

  if (!ismod) {
    if (e.key == 'Backspace') {
      const s = getSelection()
      const prev = s.focusNode.textContent[s.focusOffset-1]
      const close = jpairs[prev]
      if (!close) { return true }
      const next = nextch()
      if (next == close) {
        s.modify('move', 'backward', 'character')
        s.modify('extend', 'forward', 'character')
        s.modify('extend', 'forward', 'character')
      }
      return true
    }

    if (e.key == 'Tab') {
      snipnext()
      return stopevt(e)
    }
  }

  if (e.ctrlKey && (e.key == 'v')) {
    T_ignore()
    cmd('insertText', '¬')
    extsel('backward', 'character')
    return stopevt(e)
  }

  const rep = keyrep_evt(e)
  const trigs = (T ? T.active : jif).trigs
  const trig = trigs[rep]

  if (trig) {
    const wait = T_start(trig)
    if (e.metaKey || !wait) { stopevt(e) }
  } else {
    T_cancel()
  }
})


function reload_css() {
  let oldcss = D.head.$('link[rel="stylesheet"]')
  let newcss = html(`<link rel=stylesheet href="${oldcss.href}">`)
  D.head.appendChild(newcss)
  delay(() => oldcss.remove(), 100)
}

function save_file() {
  JIF.write_file(jif.curpath, ed.value)
}


document.on('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if ((e.key == 'Control') || e.key == 'Meta') {
      return true
    }
    switch (e.key) {
      case ',': show_config();      break;
      case ';': show_cli();         break;
      case ':': show_log();         break;
      case 'o': choose_file();      break;
      case 'r': reload_css();       break;
      case 's': save_file();        break;
      case '=': change_scale(+1);   break;
      case '-': change_scale(-1);   break;
      case '0': set_scale(0);       break;
      case '3': show_stats();       break;
      default: return true
    }
    return stopevt(e)
  }
}, true)



////////////////////////////////////////////////////////////////////////
// API

window.api = api

api.map = (maps, x) => {
  if (isstr(maps)) { maps = {[maps]: x} }
  for (let [key, sub] of O.entries(maps)) {
    const seq = keyseq(key)
    if (!sub)
      deltrig(seq)
    else if (typeof(sub) == 'function')
      addtrig(seq, () => snipexpand(sub()))
    else
      addtrig(seq, () => snipexpand(sub))
  }
}

api.pair = (pairs, x) => {
  if (isstr(pairs)) { pairs = {[pairs]: x} }
  for (const [a,z] of O.entries(pairs)) {
    jpairs[a] = z
    if (a != z) {
      api.map({[a]: `${a}__${z}`,
               [z]: () => (nextch()==z ? movchr() : z)})
    } else {
      api.map({[a]: () => (nextch()==z ? movchr() : `${a}__${z}`)})
    }
  }
}

api.ins = instxt
api.del = deltxt

api.mov = movcur
api.ext = extsel

api.extchr = extchr
api.movchr = movchr
api.extwrd = extwrd
api.movwrd = movwrd
api.extlin = extlin
api.movlin = movlin

api.prev = prevch
api.next = nextch

api.fill = () => T?.fill

api.config = fetch_config

api.opt = (k,v) => (v==null) ? jif.opt[k] : (jif.opt[k] = v)



////////////////////////////////////////////////////////////////////////
// Default Config

api.pair({'(':')', '[':']', '{':'}', '"':'"'})

