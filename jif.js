////////////////////////////////////////////////////////////////////////
const D=document, B=D.body, LS=localStorage, U=undefined, O=Object
const $=D.querySelector.bind(D), $$=D.querySelectorAll.bind(D)
const tojson = x => ((U===x || x=='') ? null : JSON.stringify(x))
const unjson = x => ((U===x || x=='') ? undefined : JSON.parse(x))
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
const delay = (f, ms=1) => setTimeout(f, ms)
const is_string = s => (typeof(s) == 'string')
////////////////////////////////////////////////////////////////////////


const cmd = (cmd, arg) => document.execCommand(cmd, false, arg)

let ed = $('#ed')
const ui = $('#ui')


const api = {}

const jif = {
  opt: {
    trig_timeout: 1000,
    snip_lookahead: 500,
    cors: (url) => `https://cors.jif-editor.workers.dev/?${url}`
  },
  log: [],
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


function fed() { ed.focus() }

const curpos = () => ed.selectionEnd
const selbgn = () => ed.selectionStart
const cursel = () => ed.value.slice(selbgn(), curpos())
const setpos = (p) => (fed(), ed.setSelectionRange(p,p))
const setsel = (b,e,d) => { fed(); ed.setSelectionRange(b,e,d) }
const gettxt = (b=curpos(), e) => ed.value.slice(b, (e ?? b+1))
const instxt = (t,b=curpos(),e=b) => { setsel(b,e); cmd('insertText', t) }
const deltxt = (b,e=b) => { setsel(b,e); cmd('delete') }


function snipexpand(snip, bgn, end) {
  if (!snip) { return }
  if (bgn == null) { bgn = end = curpos() }
  let zero = cursel()
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


function toggle_ui(visible) {
  ui.classList.toggle('visible', visible)
  db.set('ui', ui.classList.contains('visible'))
}

function zoom_text(n, pt) {
  if (!pt) { pt = parseInt(ed.style.fontSize, 10) }
  pt += n
  ed.style.fontSize = pt+'pt'
  db.set('zoom', pt)
}

async function toggle_spell(spell) {
  spell ??= !ed.spellcheck
  ed.spellcheck = spell
  db.set('spell', spell)
  ed.focus()
  if (spell) {
    // Forcing spellcheck is non-trivial and takes a long time.
    // https://stackoverflow.com/questions/1884829/force-spell-check-on-a-textarea-in-webkit
    $('#spelltgl').innerHTML = `Check Spelling${'&nbsp;'.repeat(5)}✓`
    ed.focus()
  } else {
    $('#spelltgl').innerHTML = `Check Spelling${'&nbsp;'.repeat(6)}`
  }
}


function stat_calc() {
  $('#stat-chars').innerText = ed.value.length+' Characters'

  const nwords = (ed.value.match(/\s+/g) || []).length
  $('#stat-words').innerText = nwords+' Words'
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
  ed.focus()
}

async function fetch_config(url) {
  url = new URL(url)
  url.searchParams.set('jifbuster', Date.now())
  let resp = await(fetch(jif.opt.cors(url), {cache: 'no-store'}))
  if (resp.ok) { configure(await resp.text()) }
}

window.configure = (code) => {
  if (!code) { return }
  (new AsyncFunction(...O.keys(api), code))(...O.values(api))
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
  jif.log.push(`${c}('${sx}', ${sy})`)
  try { f(x, eval(y)) }
  catch(e) { f(x, sy) }
}

function show_log() {
  alert(jif.log.join('\n'))
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
    if (e.key == "\\") { stopevt(e); toggle_ui() }
    if (e.key == ";")  { stopevt(e); show_cli() }
    if (e.key == ':')  { stopevt(e); show_log() }
    if (e.key == "`")  { stopevt(e); show_config() }
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


$$('.uictrl > select').forEach(elem => {
  elem.on('change', (e) => {
    let f = (elem.handle||{})[e.target.value]
    if (f) { f() }
    delay(() => { e.target.firstElementChild.selected = true })
  })
})


////////////////////////////////////////////////////////////////////////


api.opt = (key, val) => {
  if (val === undefined) { return jif.opt[key] }
  jif.opt[key] = val
}

api.key = (keys, x) => {
  if (is_string(keys)) { keys = {[keys]: x} }
  for (const [key, fn] of O.entries(keys)) {
    addtrig(keyseq(key), (pos) => { deltxt(T.pos, pos); fn() })
  }
}

api.map = (maps, x) => {
  if (is_string(maps)) { maps = {[maps]: x} }
  for (const [key, sub] of O.entries(maps)) {
    const seq = keyseq(key)
    if (typeof(sub) == 'function')
      addtrig(seq, (pos) => snipexpand(sub(pos), T.pos, pos));
    else
      addtrig(seq, (pos) => snipexpand(sub, T.pos, pos));
  }
}

api.pair = (pairs, x) => {
  if (is_string(pairs)) { pairs = {[pairs]: x} }
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

