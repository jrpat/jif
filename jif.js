
document.designMode = 'on'


let ed = document.getElementById('ed')

let api = {}
let trigs = {}

let trigstate = {active:null, timer:null, startpos:null}


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


function keyrep_str(str) {
  str = str.trim().toLowerCase()
  if (str[0] != '<') { return str }
  let k = str.slice(1, -1).split(/[-.]/)
  let mods = Array.from(new Set(k.slice(0, -1))).sort()
  return [...mods, keyabbr(k.at(-1))].join('.')
}

function keyseq(k) {
  k = k.replaceAll('>', '> ').replaceAll('<', ' <')
  return k
    .split(/\s+/)
    .map(c => c[0]=='<' ? c : c.split(''))
    .flat()
    .map(keyrep)
}

function addtrig(seq, fn) {
  let t = trigs
  let slen = seq.length
  for (let i=0; i < slen; ++i) {
    let k = seq[i]
    if (!t[k]) { t[k] = {f:null, t:{}} }
    if (i == slen-1) {
      t[k].f = fn
    } else {
      t = t[k].t
    }
  }
}


////////////////////////////////////////////////////////////////////////


api.key = (key, fn) => {
  addtrig(keyseq(key), fn)
}

api.map = (key, sub) => {
  let seq = keyseq(key)
  let pos = curpos()
  addtrig(seq, () => api.ins(sub, curtrig.start, curpos()))
}

api.ins = (text, bgn, end) => {
  ed.focus()
  if (bgn != null) ed.setSelectionRange(bgn, (end==null ? bgn : end));
  document.execCommand('insertText', false, text)
}

api.pos = curpos

api.get = text


////////////////////////////////////////////////////////////////////////


window.api = api

