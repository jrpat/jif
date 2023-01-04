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
const html = (s) => { let e,d=document.createElement('div');
  d.innerHTML=s; e=d.firstElementChild; e.remove(); return e }
const stopevt = e => (e.preventDefault(), e.stopPropagation(), false)
const debounce = (ms, f) => {let t; return (...args) => {
  clearTimeout(t); t = setTimeout(f.bind(null, ...args), ms)}}
const wait = (ms) => new Promise(r => setTimeout(r, ms))
////////////////////////////////////////////////////////////////////////


const cmd = (cmd, arg) => document.execCommand(cmd, false, arg)

let ed = $('#ed')
const ui = $('#ui')
const stat = $('#stat')


const api = {}

const jif = {
  opt: {
    trig_timeout: 1000,
    snip_lookahead: 500,
    cors: (url) => `https://cors.jif-editor.workers.dev/?${url}`
  },
  trigs: {},
  pairs: {},
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

function eddo(f) {
  ed.focus()
  return f()
}

function withsel(b, e) {
  ed.focus()
  if (b != null) ed.setSelectionRange(b, (e==null) ? b : e)
}

const curpos = () => ed.selectionEnd
const selbgn = () => ed.selectionStart
const cursel = () => eddo(window.getSelection)
const setpos = (p) => eddo(() => ed.setSelectionRange(p,p))
const setsel = (b,e,d) => eddo(() => ed.setSelectionRange(b,e,d))
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
  let zero = cursel().toString()
  instxt(snip, bgn, end)
  snipnext(zero, bgn, snip.length)
}

function snipnext(
  zero = '',
  pos = curpos(),
  lookahead = jif.opt.snip_lookahead,
) {
  const look = ed.value.slice(pos, pos+lookahead)
  const matches = look.matchAll(/\^\d+/g)
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
  if (T == 0) { T = null; return true } // ctrl-v
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
  if (t.f) { t.f(curpos()) }
  T = null
}


function ui_toggle() {
  ui.classList.toggle('visible')
}

function zoom_text(n, pt) {
  if (!pt) { pt = parseInt(ed.style.fontSize, 10) }
  pt += n
  ed.style.fontSize = pt+'pt'
  db.set('zoom', pt)
}

async function toggle_spell(spell) {
  if (spell === undefined) { spell = !ed.spellcheck }
  ed.spellcheck = spell
  db.set('spell', spell)
  $('#spelltoggle').classList.toggle('checked', spell)

  if (spell) {
    // Forcing spellcheck is non-trivial and takes a long time.
    // See https://stackoverflow.com/questions/1884829/force-spell-check-on-a-textarea-in-webkit
    ed.focus()
  } else {
    // This hack removes the spellcheck lines that are already there.
    let par = ed.parentElement
    let st = ed.scrollTop
    let ss = ed.selectionStart
    let se = ed.selectionEnd
    ed.remove()
    let ned = ed.cloneNode()
    ed = ned
    setTimeout(() => {
      par.appendChild(ed)
      setTimeout(() => {
        ed.focus()
        ed.scrollTop = st
        ed.selectionStart = ss
        ed.selectionEnd = se
      }, 1)
    }, 1)
  }
}


function stat_calc() {
  $('#stat-chars').innerText = ed.value.length+' Characters'

  const nwords = (ed.value.match(/\s+/g) || []).length
  $('#stat-words').innerText = nwords+' Words'
}

function stat_change() {
  e.target.firstElementChild.selected = true
}


function open_file(f) {
  if (f == null) {
    const input = html('<input type="file">')
    input.dispatchEvent(new Event('click'))
  }
}


function show_config() {
  if ($('#config')) { return }
  const frame = html('<iframe id=config src="/config.html">')
  B.appendChild(frame)
}

function hide_config() {
  let frame = $('#config')
  if (!frame) { return }
  configure(frame.contentWindow.ed.value)
  frame.remove()
}

async function fetch_config(url) {
  url = new URL(url)
  url.searchParams.set('jifbuster', Date.now())
  let resp = await(fetch(jif.opt.cors(url), {cache: 'no-store'}))
  if (resp.ok) { configure(await resp.text()) }
}

window.configure = function configure(code) {
  if (!code) { return }
  (new AsyncFunction(...O.keys(api), code))(...O.values(api))
}


////////////////////////////////////////////////////////////////////////


const ignorekeys = new Set(['Alt', 'Control', 'Meta', 'Shift'])


ed.on('keydown', e => {
  if (e.repeat || (ignorekeys.has(e.key))) {
    return true
  }

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
    T = 0; instxt('¬')
    const pos = curpos()
    setsel(pos-1, pos)
    return true
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
    if (e.key == 'Control') { return }
    if (e.key == "\\") { stopevt(e); ui_toggle() }
    if (e.key == ";")  { stopevt(e); show_config() }
    if (e.key == 'o')  { stopevt(e); open_file() }
  }

  if (e.metaKey) {
    if (e.key == 'Meta') { return }
    if (e.key == '=') { stopevt(e); zoom_text( 2) }
    if (e.key == '-') { stopevt(e); zoom_text(-2) }
    if (e.key == '0') { stopevt(e); zoom_text(0, 16) }
    if (e.key == 'o') { stopevt(e); open_file() }
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
      addtrig(seq, (pos) => snipexpand(sub(pos), T.pos, pos));
    else
      addtrig(seq, (pos) => snipexpand(sub, T.pos, pos));
  }
}

api.pair = (pairs) => {
  for (const [a,z] of O.entries(pairs)) {
    jif.pairs[a] = z
    if (a != z) {
      api.map({
        [a]: `${a}^0${z}`,
        [z]: (p) => ((gettxt() == z && deltxt(p+1)), z)
      })
    } else {
      api.map({
        [a]: (p) => (gettxt() == z ? (deltxt(p+1), z) : `${a}^0${z}`)
      })
    }
  }
}

api.ins = instxt
api.del = deltxt
api.get = gettxt
api.pos = (n) => (n==null) ? curpos() : setpos(n)
api.sel = (b,e) => (b==null) ? cursel() : setsel(b,e)

api.tstart = () => T ? T.pos : null

api.config = fetch_config

api.move = (n) => setpos(curpos() + n)
api.left = () => api.move(-1)
api.right = () => api.move(1)


window.api = api


////////////////////////////////////////////////////////////////////////


api.pair({'(':')', '[':']', '{':'}', '"':'"'})


////////////////////////////////////////////////////////////////////////


configure(localStorage.getItem('config'))
zoom_text(0, db.get('zoom'))
toggle_spell(db.get('spell'))


