// Source: https://github.com/jhawthorn/fzy.js/blob/master/index.js
// Minified by: https://try.terser.org
var r=-1/0,e=1/0,n=-.005,t=-.005,a=-.01,o=1,f=.9,u=.8,i=.7,v=.6;function w(r){return r.toUpperCase()===r}function h(e,a,o,f){for(var u=e.length,i=a.length,v=e.toLowerCase(),h=a.toLowerCase(),l=function(r){for(var e,n=r.length,t=new Array(n),a="/",o=0;o<n;o++){var f=r[o];"/"===a?t[o]=.9:"-"===a||"_"===a||" "===a?t[o]=.8:"."===a?t[o]=.6:(e=a).toLowerCase()===e&&w(f)?t[o]=.7:t[o]=0,a=f}return t}(a),g=0;g<u;g++){o[g]=new Array(i),f[g]=new Array(i);for(var y=r,A=g===u-1?t:-.01,s=0;s<i;s++)if(v[g]===h[s]){var c=r;g?s&&(c=Math.max(f[g-1][s-1]+l[s],o[g-1][s-1]+1)):c=s*n+l[s],o[g][s]=c,f[g][s]=y=Math.max(c,y+A)}else o[g][s]=r,f[g][s]=y+=A}}function l(n,t){var a=n.length,o=t.length;if(!a||!o)return r;if(a===o)return e;if(o>1024)return r;var f=new Array(a),u=new Array(a);return h(n,t,f,u),u[a-1][o-1]}function g(e,n){var t=e.length,a=n.length,o=new Array(t);if(!t||!a)return o;if(t===a){for(var f=0;f<t;f++)o[f]=f;return o}if(a>1024)return o;var u=new Array(t),i=new Array(t);h(e,n,u,i);for(var v=!1,w=(f=t-1,a-1);f>=0;f--)for(;w>=0;w--)if(u[f][w]!==r&&(v||u[f][w]===i[f][w])){v=f&&w&&i[f][w]===u[f-1][w-1]+1,o[f]=w--;break}return o}function y(r,e){r=r.toLowerCase(),e=e.toLowerCase();for(var n=r.length,t=0,a=0;t<n;t+=1)if(0===(a=e.indexOf(r[t],a)+1))return!1;return!0}export{r as SCORE_MIN,e as SCORE_MAX,n as SCORE_GAP_LEADING,t as SCORE_GAP_TRAILING,a as SCORE_GAP_INNER,o as SCORE_MATCH_CONSECUTIVE,f as SCORE_MATCH_SLASH,u as SCORE_MATCH_WORD,i as SCORE_MATCH_CAPITAL,v as SCORE_MATCH_DOT,l as score,g as positions,y as hasMatch};