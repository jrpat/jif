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
  pairs: {},
  curpath: null,
}

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

Selection.prototype.selectNodeContents = function(n) {
  const r = new Range()
  r.selectNodeContents(n)
  this.removeAllRanges()
  this.addRange(r)
}

Selection.prototype.insertNode = function(n) {
  this.getRangeAt(0).insertNode(n)
}

Selection.prototype.insertAndSelectNode = function(n) {
  this.getRangeAt(0).insertNode(n)
  this.selectNode(n)
}

Node.prototype.convertToText = function(trim) {
  const txt = this.innerText
  const t = D.createTextNode(trim ? txt.trim() : txt)
  this.parentNode.insertBefore(t, this)
  this.remove()
  return t
}



////////////////////////////////////////////////////////////////////////
// Text Operations

function cmd(c, arg) { ed.focus(); D.execCommand(c, false, arg) }

function deltxt()  { cmd('delete') }
function instxt(t) { cmd('insertText', t) }

function extcur(d,g) { getSelection().modify('extend', d, g) }
function movcur(d,g) { getSelection().modify('move', d, g) }

function extchr(d) { extcur((d<0)?'backward':'forward', 'character') }
function movchr(d) { movcur((d<0)?'backward':'forward', 'character') }
function extwrd(d) { extcur((d<0)?'backward':'forward', 'word') }
function movwrd(d) { movcur((d<0)?'backward':'forward', 'word') }
function extlin(d) { extcur((d<0)?'backward':'forward', 'line') }
function movlin(d) { movcur((d<0)?'backward':'forward', 'line') }

function adjch(fwd) {
  let oo = fwd ? 0 : -1
  let sib = (fwd ? 'next' : 'previous') + 'Sibling'
  return function() {
    let s=getSelection(), n=s.focusNode, o=(s.focusOffset + oo)
    let ch = n.textContent[o]
    if (!ch) {
      do {
        n = n[sib] ?? n.parentNode
        if (n == ed) { return [] }
      } while (n.textContent.length == 0)
      o = fwd ? 0 : (n?.textContent.length - 1)
      ch = n?.textContent[o]
    }
    return ch ? [ch, n, o] : []
  }
}

const prevch = adjch(false)
const nextch = adjch(true)



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
  let a = e.altKey ? 'a.' : ''
  let c = e.ctrlKey ? 'c.' : ''
  let m = e.metaKey ? 'm.' : ''
  let s = (e.shiftKey && !shifted.includes(e.key)) ? 's.' : ''
  return a + c + m + s + e.key.toLowerCase()
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
    T = {fill:s.toString()}
    s.deleteFromDocument()
    let ins = T.ins = html('<ins>&nbsp;</ins>')
    s.range.insertNode(ins)
    s.selectNode(ins)
  }
  T.active = t
  const wait = O.keys(t.trigs).length > 0
  T.timer = delay(T_fin, (wait ? jif.opt.trig_timeout : 1))
  return wait
}

function T_cancel() {
  if (!T) { return }
  clearTimeout(T.timer)
  T.ins.convertToText()
  T = null
}

function T_fin() {
  if (!T) { return }
  clearTimeout(T.timer)
  const s = getSelection()
  s.selectNodeContents(T.ins)
  const t = T.active
  if (t.f) { t.f() }
  T = null
}



////////////////////////////////////////////////////////////////////////
// Snippets

function mksnip(snip) {
  if (!isstr(snip)) { return snip }
  if (snip.length == 1) { return () => snip }
  snip = snip.replace(/\^([1-9]+)/g, '<var part=$1>&nbsp;</var>')
  snip = snip.replace(/\^{([1-9]+):(.+?)}/g, '<var part=$1>$2</var>')
  return (x) => snip.replace(/\^0/g, `<var part=0>${x.trim()}</var>`)
}

function snipexpand(snip, fill=T?.fill) {
  if (!snip) { return }
  if (isstr(snip)) { snip = mksnip(snip) }
  const s = getSelection()
  const ins = s.focusNode.parentElement.closest('ins')
  ed.contentEditable = 'true'
  if (ins) {
    ins.innerHTML = snip(fill);
    s.selectNode(ins)
  } else {
    cmd('insertHTML', `<ins>${snip(fill)}</ins>`);
  }
  ed.contentEditable = 'plaintext-only'
  snipnext(true)
}

function snipnext(first) {
  const s = getSelection()
  const par = s.focusNode?.parentElement?.closest('ins')
  if (!par) { return }
  let r = new Range();
  let places = [...par.$$('var')]
  if (places.length) {
    let n = places.reduce(((min,p) => M.min(min, int(p.part))), 999)
    let next = par.$(`var[part="${n}"]`)
    let txt = next.convertToText()
    if (places.length == 1) {
      const pp = par.parentNode
      for (let n of [...par.childNodes]) {
        if (n == txt)
          n = pp.insertBefore(n, par);
        else
          pp.insertBefore(n, par);
      }
      par.remove()
    }
    r.selectNode(txt)
  } else {
    let txt = par.convertToText()
    r.selectNode(txt)
    r.collapse()
  }
  s.range = r
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

function togvis(selector, vis) {
  const elems = $$(selector)
  if (!elems.length) { return }
  for (const elem of $$(selector)) {
    const v = vis ?? !(elem.classList.contains('visible'))
    elem.classList.toggle('visible', v)
    if (elem.id) { db.set('vis/'+elem.id, v) }
  }
}

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
  ed.focus()
  // Forcing spellcheck redrawing is non-trivial and takes a long time.
  // https://stackoverflow.com/questions/1884829/force-spell-check-on-a-textarea-in-webkit
  $('#menu-Options-Spell').innerHTML =
    'Check Spelling    '+(spell?'✓':' ')
  return spell
}

function stat_calc() {
  const nchars = ed.value.length
  const nwords = (ed.value.match(/\s+/g) || []).length
  return {nchars, nwords}
}

function configure(code) {
  if (!code) { return }
  (new AsyncFunction(...O.keys(api), code))(...O.values(api))
}

function show_config() {
  if ($('#config')) { return }
  const frame = html('<iframe id=config src="/config.html">')
  D.body.appendChild(frame)
}

window.hide_config = function() {
  let frame = $('#config')
  if (!frame) { return }
  configure(frame.contentWindow.ed.value)
  frame.remove()
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
    f(x, sy)
    jif.log.push(`${c}('${sx}', '${sy}')`)
  }
}

function show_log() {
  alert(jif.log.join('\n'))
}



////////////////////////////////////////////////////////////////////////
// Menu

const menu_id = t => t.replace(/\W+/g, '_')

function menu_btn(name, items) {
  const handlers = {}
  const btn = html(`<div class=menubtn>${name}</div>`)
  const menu = html(`<select id=menu-${menu_id(name)}></select>`)
  const title = `${name}${' '.repeat(32 - name.length)}`
  const titleopt = html(`<option disabled selected>${title}</option>`)
  menu.appendChild(titleopt)
  btn.appendChild(menu)
  menu.on('change', e => {
    handlers[e.target.value]()
    delay(() => { titleopt.selected = true })
  })
  for (const it of items) {
    if (isstr(it)) {
      menu.lastElementChild.divafter = true
    } else {
      const [text, fn] = it
      const id = `menu-${menu_id(name)}-${menu_id(text)}`
      menu.insertAdjacentHTML('beforeend',
        `<option id=${id} value="${text}">${text}</option>`)
      handlers[text] = fn || (function(){})
    }
  }
  if (/Firefox/.test(navigator.userAgent)) {
    let l = M.max(items.reduce((l,i) => (M.max(i[0].length, l)), 0), 20)
    let div = '─'.repeat(l * 0.55)
    ;[...menu.children].forEach(it => {
      if (it.divafter) it.insertAdjacentHTML('afterend',
          `<option disabled>${div}&nbsp;</option>`);
    })
  } else {
    // https://codepen.io/tigt/post/separators-inside-the-select-element
    ;[...menu.children].forEach(it => {
      if (it.divafter)
        menu.insertBefore(D.createElement('hr'), it.nextSibling);
    })
  }
  return btn
}

function menu_space() {
  return html('<div flex=1></div>')
}

function menu(menus) {
  const elem = $('#menu')
  for (const m of menus) {
    elem.appendChild(isstr(m) ? menu_space() : menu_btn(...m))
  }
}



////////////////////////////////////////////////////////////////////////
// Keyboard Handling

let autosave_timer
const autosave = function() { JIF.autosave(jif.curpath, ed.value) }

ed.on('keydown', e => {
  if ((e.altKey && e.key=='Alt') || (e.ctrlKey && e.key=='Control') ||
      (e.metaKey && e.key=='Meta') || (e.shiftKey && e.key=='Shift')) {
    return true
  }

  clearTimeout(autosave_timer)
  autosave_timer = setTimeout(autosave, 1000)

  if (e.key == 'Backspace') {
    const s = getSelection()
    if (!s.isCollapsed) { return true }
    const [pch, pnode, poff] = prevch()
    const close = jif.pairs[pch]
    if (!close) { return true }
    const [nch, nnode, noff] = nextch()
    if (nch == close) {
      let r = new Range()
      r.setStart(pnode, poff)
      r.setEnd(nnode, noff + 1)
      s.range = r
    }
    return true
  }

  if (e.key == 'Tab') {
    snipnext()
    return stopevt(e)
  }

  if (e.ctrlKey && (e.key == 'v')) {
    T_ignore()
    instxt('¬')
    extcur('backward', 'character')
    return stopevt(e)
  }

  const rep = keyrep_evt(e)
  const trigs = (T ? T.active : jif).trigs
  const trig = trigs[rep]

  if (trig) {
    T_start(trig)
    if (e.metaKey) { stopevt(e) }
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
  if (e.ctrlKey) {
    if (e.key == 'Control') { return true }
    switch (e.key) {
      case "-":  togvis('#menu');    break;
      case "\\": togvis('#sidebar'); break;
      case ",":  show_config();      break;
      case ";":  show_cli();         break;
      case ":":  show_log();         break;
//      case "o":  choose_project();     break;
      case "o":  choose_file();      break;
      case "r":  reload_css();       break;
      case "s":  save_file();        break;
      case "p":  choose_project();   break;
      default: return
    }
    return stopevt(e)
  }

  if (e.metaKey) {
    if (e.key == 'Meta') { return true }
    switch (e.key) {
      case '=': change_scale(+1);     break;
      case '-': change_scale(-1);     break;
      case '0': set_scale(0);         break;
//      case 'o': choose_project();       break;
      case 'o': choose_file();        break;
      case ',': show_config();        break;
      case '.': togvis('.ui');        break;
      case 's': save_file();          break;
      default: return
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
    if (!sub) {
      deltrig(seq)
    } else if (typeof(sub) == 'function') {
      addtrig(seq, () => snipexpand(sub()))
    } else {
      sub = mksnip(sub)
      addtrig(seq, () => snipexpand(sub))
    }
  }
}

api.pair = (pairs, x) => {
  if (isstr(pairs)) { pairs = {[pairs]: x} }
  const ext=api.ext, nextis=api.nextis
  for (const [a,z] of O.entries(pairs)) {
    jif.pairs[a] = z
    if (a != z) {
      api.map({[a]: `${a}^0${z}`,
               [z]: () => {
//                 if (nextis(z)) { extchr() }
                 extchr()
                 return z
               }
//               [z]: () => ((nextis(z) && extchr()), z)
      })
    } else {
      api.map({[a]: () => (nextis(z) ? (extchr(), z) : `${a}^0${z}`)})
    }
  }
}

api.ins = instxt
api.del = deltxt

api.mov = movcur
api.ext = extcur

api.prev = prevch
api.next = nextch
api.previs = (ch) => prevch()[0] == ch
api.nextis = (ch) => nextch()[0] == ch

api.extchr = extchr
api.movchr = movchr
api.extwrd = extwrd
api.movwrd = movwrd
api.extlin = extlin
api.movlin = movlin

api.fill = () => T?.fill

api.config = fetch_config

api.opt = (k,v) => (v==null) ? jif.opt[k] : (jif.opt[k] = v)



////////////////////////////////////////////////////////////////////////
// Default Config

api.pair({'(':')', '[':']', '{':'}', '"':'"'})

