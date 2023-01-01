////////////////////////////////////////////////////////////////////////
EventTarget.prototype.on = EventTarget.prototype.addEventListener
EventTarget.prototype.off = EventTarget.prototype.removeEventListener
////////////////////////////////////////////////////////////////////////


document.designMode = 'on' // needed for execCommand


const TRIG_TIMEOUT = 1000
const SNIP_LOOKAHEAD = 500


let ed = document.getElementById('ed')

let jif = {
  opt: {
    trig_timeout: 1000,
    snip_lookahead: 500,
  },
  trigs: {},
  api: {},
}

let T = null


const keyabbrs = {
  'lt':'<', 'esc':'escape', 'cr':'enter', 'space':' ', 'bslash':"\\", 'bar':'|', 
  'left':'arrowleft', 'right':'arrowright', 'up':'arrowup', 'down':'arrowdown'
}

const shifted = '~!@#$%^&*()-+{}|:"<>?'.split('')

function keyabbr(k) {
  return keyabbrs[k] || k
}

function keyrep_str(s) {
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


function curpos() {
  return ed.selectionEnd
}

function cursel() {
  return [ed.selectionStart, ed.selectionEnd]
}

function setpos(pos) {
  ed.setSelectionRange(pos, pos)
}

function setsel(bgn, end) {
  ed.setSelectionRange(bgn, end, (bgn < end) ? 'forward' : 'backward')
}

function lookat(pos, len) {
  if (pos == null) { pos = curpos() }
  return ed.value.slice(pos, pos + (len||1))
}

function instxt(text, bgn, end) {
  ed.focus()
  if (bgn != null) ed.setSelectionRange(bgn, (end==null ? bgn : end));
  document.execCommand('insertText', false, text)
}

function deltxt(bgn, end) {
  ed.focus()
  if (bgn != null) ed.setSelectionRange(bgn, (end==null ? bgn : end))
  document.execCommand('delete', false)
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

function snipexpand(snip, bgn, end) {
  if (bgn == null) { bgn = end = curpos() }
  instxt(snip, bgn, end)
  snipnext(bgn)
}

function snipnext(pos) {
  if (pos == null) { pos = curpos() }
  const look = ed.value.slice(pos, jif.opt.snip_lookahead)
  const matches = look.matchAll(/%\d+/g)
  let next = [9999, 0, 0]
  for (const match of matches) {
    const m = match[0]
    const mn = parseInt(m.slice(1), 10)
    if (mn < next[0]) {
      next = [mn, match.index, m.length]
      if (mn == 0) { break }
    }
  }
  let bgn = pos + next[1]
  let end = bgn + next[2]
  setsel(bgn, end)
  document.execCommand('delete')
}


function T_start(t) {
  if (!T) {
    T = {startpos: curpos()}
  } else {
    clearTimeout(T.timer)
  }
  T.active = t
  const wait = Object.keys(t.trigs).length > 0
  T.timer = setTimeout(T_fin, wait ? jif.opt.trig_timeout : 1)
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


const ignorekeys = ['Alt', 'Control', 'Meta', 'Shift']

ed.on('keydown', e => {
  if (e.repeat || (ignorekeys.includes(e.key))) { return true }

  if (e.key == 'Tab') { snipnext(); e.preventDefault(); return false }

  const rep = keyrep_evt(e)
  const trigs = (T ? T.active : jif).trigs
  const newtrig = trigs[rep]

  if (newtrig) {
    let ret = T_start(newtrig)
  } else {
    T_cancel()
  }

  return true
})


////////////////////////////////////////////////////////////////////////


jif.api.opt = (key, val) => {
  if (val === undefined) { return jif.opt[key] }
  jif.opt[key] = val
}

jif.api.key = (...args) => {
  const len = args.length
  for (let i=0; i < len; i+=2) {
    let [key, fn] = [args[i], args[i+1]]
    if (fn) addtrig(keyseq(key), fn)
  }
}

jif.api.map = (...args) => {
  const len = args.length
  for (let i=0; i < len; i+=2) {
    let [key, sub] = [args[i], args[i+1]]
    if (!sub) { continue }
    if (typeof(sub) == 'function') {
      addtrig(keyseq(key), () => {
        let pos = curpos()
        snipexpand(sub(), T.startpos, pos)
      })
    } else {
      if (/%\d+/.test(sub))
        addtrig(keyseq(key), () => snipexpand(sub, T.startpos, curpos()))
      else
        addtrig(keyseq(key), () => instxt(sub, T.startpos, curpos()))
    }
  }
}

jif.api.ins = instxt
jif.api.del = deltxt
jif.api.get = lookat
jif.api.pos = (n) => (n==null) ? curpos() : setpos(n)
jif.api.sel = (b,e) => (b==null) ? cursel() : setsel(b,e)

jif.api.tstart = () => T ? T.startpos : null

jif.api.left = () => setpos(curpos() - 1)
jif.api.right = () => setpos(curpos() + 1)


////////////////////////////////////////////////////////////////////////


window.api = jif.api


//jif.api.key(';[', () => { console.log("OK!") })

jif.api.map(';[', '$[%0]')
jif.api.map('(', '(%0)')
jif.api.map(';s', '$')

jif.api.map(')', () => {
  if (jif.api.get() == ')') { jif.api.del(curpos() + 1) }
  return ')'
})


