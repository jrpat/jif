////////////////////////////////////////////////////////////////////////
EventTarget.prototype.on = EventTarget.prototype.addEventListener
EventTarget.prototype.off = EventTarget.prototype.removeEventListener
////////////////////////////////////////////////////////////////////////


document.designMode = 'on' // needed for execCommand


const TRIG_TIMEOUT = 1000


let ed = document.getElementById('ed')

let jif = {
  api: {},
  trigs: {},
}

let T = null


const keyabbrs = {
  'lt':'<', 'esc':'escape', 'cr':'enter', 'space':' ', 'bslash':"\\", 'bar':'|', 
  'left':'arrowleft', 'right':'arrowright', 'up':'arrowup', 'down':'arrowdown'
}


function keyabbr(k) {
  return keyabbrs[k] || k
}


function curpos() {
  return ed.selectionEnd
}

function text(bgn, end) {
  return ed.value.slice(bgn, end ? end : bgn+1)
}

function selection() {
  return text(ed.selectionStart, curpos())
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
  let s = e.shiftKey ? 's.' : ''
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

function cancel_trig() {
  if (!T) { return }
  clearTimeout(T.timer)
  T = null
}

function finish_trig() {
  const t = T.active
  if (t.f) { t.f() }
  T = null
}


const ignorekeys = ['Alt', 'Control', 'Meta', 'Shift']

ed.on('keydown', e => {
  if (e.repeat || (e.key in ignorekeys)) { return true }

  const trigs = (T ? T.active : jif).trigs
  const rep = keyrep_evt(e)

  if (!trigs[rep]) {
    cancel_trig()
    return true
  }

  if (!T) {
    T = {
      active: trigs[rep],
      timer: setTimeout(finish_trig, TRIG_TIMEOUT),
      startpos: curpos()
    }
  } else {
    clearTimeout(T.timer)
    T.active = trigs[rep]
    if (!T.active) {
      cancel_trig()
      return true
    } else {
      if (Object.keys(T.active.trigs).length) {
        T.timer = setTimeout(finish_trig, TRIG_TIMEOUT)
      } else {
        T.timer = setTimeout(finish_trig, 10)
      }
    }
  }
  return true
})


////////////////////////////////////////////////////////////////////////


jif.api.key = (key, fn) => {
  addtrig(keyseq(key), fn)
}

jif.api.map = (key, sub) => {
  let seq = keyseq(key)
  let pos = curpos()
  addtrig(seq, () => api.ins(sub, T.startpos, curpos()))
}

jif.api.ins = (text, bgn, end) => {
  ed.focus()
  if (bgn != null) ed.setSelectionRange(bgn, (end==null ? bgn : end));
  document.execCommand('insertText', false, text)
}

jif.api.pos = curpos

jif.api.get = text


////////////////////////////////////////////////////////////////////////


window.api = jif.api


//jif.api.key(';[', () => { console.log("OK!") })

jif.api.map(';[', "foo")

