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



const currange = () => window.getSelection().getRangeAt(0)

O.defineProperty(ed, 'value', {
  get: (() => ed.innerText),
  set: (x) => { ed.innerText = x }
})

O.defineProperty(ed, 'selectionStart', {
  get: () => (currange().startOffset),
  set: (i) => { let r=currange(); r.setStart(r.startContainer, i) }
})

O.defineProperty(ed, 'selectionEnd', {
  get: () => (currange().endOffset),
  set: (i) => { let r=currange(); r.setEnd(r.endContainer, i) }
})

ed.setSelectionRange = (b,e) => {
  ed.selectionStart = b
  ed.selectionEnd = e
}




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

//JIF.choose_project ??= function() {
//  const mkfile = (name, f) => ((f.path = f.webkitRelativePath), f)
//  const mkdir = (name, d) => ({name,
//    list: async () => O.entries(d)
//      .sort((a, b) => a[0] < b[0] ? -1 : 1)
//      .map((e) => e[0].at(-1)=='/' ? mkdir(...e) : mkfile(...e))
//  })
//  return new Promise((ok, err) => {
//    const input = html(
//      '<input type=file webkitdirectory directory multiple>')
//    input.on('change', () => {
//      const root = {}
//      for (const f of input.files) {
//        const path = f.webkitRelativePath.split('/')
//        let dir = root
//        for (const seg of path.slice(0,-1))
//          dir = dir[seg+'/'] ??= {};
//        dir[path.at(-1)] = f
//      }
//      input.value = ''
//      ok(mkdir('', root))
//    })
//    input.click()
//  })
//}

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
  return k
    .split(/\s+/)
    .map(c => c[0]=='<' ? c : c.split(''))
    .flat()
    .map(keyrep_str)
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
  if (T) { clearTimeout(T.timer) }
  const s = cursel()
  T ??= {fill:s+'', anc:selanc(s), foc:selfoc(s)}
//  T ??= {pos:ed.selectionStart, fill:gettxt(...cursel())}
  T.active = t
  const wait = O.keys(t.trigs).length > 0
  T.timer = delay(T_fin, (wait ? jif.opt.trig_timeout : 1))
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
  if (t.f) { t.f(curpos()) }
  T = null
}



////////////////////////////////////////////////////////////////////////
// Text Operations

const cmd = (c, arg) => { ed.focus(); D.execCommand(c, false, arg) }

const cursel = () => window.getSelection()
const selanc = (s=getSelection()) => [s.anchorNode, s.anchorOffset]
const selfoc = (s=getSelection()) => [s.focusNode, s.focusOffset]

const curpos = () => ed.selectionEnd
//const cursel = () => [ed.selectionStart, ed.selectionEnd]
const setpos = (p) => ed.setSelectionRange(p,p)
const setsel = (b,e,d) => (b!=null) && ed.setSelectionRange(b,e??b,d)
const gettxt = (b=curpos(), e) => ed.value.slice(b, (e ?? b+1))
const deltxt = (b,e=b) => { setsel(b,e); cmd('delete') }
const instxt = (t,b,e=b) => { setsel(b,e); cmd('insertText', t) }



////////////////////////////////////////////////////////////////////////
// Snippets

function snipexpand(snip, fill=T?.fill) {
  if (!snip) { return }
  snip = snip.replace(/\^0/g, `<b>${fill}</b>`)
  snip = snip.replace(/\^(\d+)/g, '<i place=$1></i>')
  ed.contentEditable = 'true'
  cmd('insertHTML', `<p>${snip}</p>`)
  ed.contentEditable = 'plaintext-only'
  snipnext(true)
}

function snipnext(first) {
  const s = cursel()
  const par = s.focusNode.parentElement.closest('p')
  let next = first ? par.$('b') : par.$('i:empty')
  if (next) {
    const nextind = [...par.childNodes].indexOf(next) + 1
    console.log(nextind)
    s.setBaseAndExtent(par, nextind, par, 1)
  }
}


////////////////////////////////////////////////////////////////////////
// Files

//async function mkfolder(f, lvl) {
//  const name = f.name.slice(0, -1)
//  const e = html(`
//    <details><summary class="item dir" level=${lvl}><i>${name}`)
//  const load = async () => {
//    ++lvl
//    const fs = await f.list()
//    for (const f of fs)
//      e.appendChild(await (f.list ? mkfolder(f, lvl) : mkfile(f, lvl)));
//    e.off('toggle', load)
//  }
//  if (lvl == 0) { load(); e.open = true; }
//  else { e.on('toggle', load) }
//  return e
//}
//
//async function mkfile(f, lvl) {
//  const e = html(`<div class="item file" level=${lvl}><i>${f.name}`)
//  e.on('click', () => load_file(f))
//  return e
//}
//
//async function choose_project() {
//  const root = await JIF.choose_project()
//  const bar = $('#sidebar')
//  bar.innerHTML = ''
//  const list = await root.list()
//  for (const f of list) {
//    bar.appendChild(await (f.list ? mkfolder(f, 0) : mkfile(f, 0)))
//  }
//}

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

let as_timer
const autosave = function() { JIF.autosave(jif.curpath, ed.value) }

ed.on('keydown', e => {
  if ((e.altKey && e.key=='Alt') || (e.ctrlKey && e.key=='Control') ||
      (e.metaKey && e.key=='Meta') || (e.shiftKey && e.key=='Shift')) {
    return true
  }

  clearTimeout(as_timer)
  setTimeout(autosave, 1000)

  if (e.key == 'Backspace') {
    const p = curpos()
    const close = jif.pairs[ed.value[p-1]]
    if (close && (ed.value[p] == close)) { cmd('forwardDelete') }
    return true
  }

  if (e.key == 'Tab') {
    stopevt(e)
    snipnext()
    return false
  }

  if (e.ctrlKey && (e.key == 'v')) {
    T_ignore()
    instxt('¬')
    cursel().modify('extend', 'backward', 'character')
    stopevt(e)
    return false
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
    stopevt(e)
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
    stopevt(e)
  }
}, true)



////////////////////////////////////////////////////////////////////////
// API

window.api = api

api.map = (maps, x) => {
  if (isstr(maps)) { maps = {[maps]: x} }
  for (const [key, sub] of O.entries(maps)) {
    const seq = keyseq(key)
    if (!sub)
      deltrig(seq)
    else if (typeof(sub) == 'function')
      addtrig(seq, (p) => { setsel(T.pos, p); snipexpand(sub(p)) });
    else
      addtrig(seq, (p) => {
        const s = cursel()
        s.setBaseAndExtent(...T.anc, ...selfoc(s))
        snipexpand(sub)
      })
  }
}

api.pair = (pairs, x) => {
  if (isstr(pairs)) { pairs = {[pairs]: x} }
  const get=api.get, ext=api.ext
  for (const [a,z] of O.entries(pairs)) {
    jif.pairs[a] = z
    if (a != z) {
      api.map({[a]: `${a}^0${z}`,
               [z]: p => ((get()==z && ext(1)), z)})
    } else {
      api.map({[a]: p => (get()==z ? (ext(1), z) : `${a}^0${z}`)})
    }
  }
}

api.ins = instxt
api.del = deltxt
api.get = gettxt
api.pos = (n) => (n==null) ? curpos() : setpos(n)
api.anc = (n) => (n==null) ? selanc() : setsel(n, curpos())
api.sel = (b,e) => (b==null) ? cursel() : setsel(b,e)
api.ext = (n) => (ed.selectionEnd += n)

api.snip = snipexpand

api.tstart = () => T ? T.pos : null
api.tfill = () => T ? T.fill : null

api.config = fetch_config

api.move = (n) => setpos(curpos() + n)
api.left = () => api.move(-1)
api.right = () => api.move(1)
api.up = () => selobj().modify('move', 'backward', 'line')
api.down = () => selobj().modify('move', 'forward', 'line')

api.opt = (k,v) => (v==null) ? jif.opt[k] : (jif.opt[k] = v)



////////////////////////////////////////////////////////////////////////
// Default Config

api.pair({'(':')', '[':']', '{':'}', '"':'"'})

