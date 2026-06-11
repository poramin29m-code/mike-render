// v1.2 functional test — stub DOM, eval inline JS, exercise MATLIB/compile/mode
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let src = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];

// --- DOM stubs ---
function mkEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(), children: [], style: {}, dataset: {},
    classList: {
      _s: new Set(),
      add(...c){c.forEach(x=>this._s.add(x));}, remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){ if(f===undefined) f=!this._s.has(c); f?this._s.add(c):this._s.delete(c); return f; },
      contains(c){return this._s.has(c);}
    },
    _ih:"", attrs:{},
    setAttribute(k,v){this.attrs[k]=v;}, appendChild(c){this.children.push(c); return c;},
    insertBefore(c){this.children.unshift(c); return c;}, remove(){},
    querySelector(){return mkEl();}, querySelectorAll(){return [];},
    addEventListener(){}, scrollIntoView(){}, click(){}, dispatchEvent(){},
    files:[],
  };
  Object.defineProperty(el,"innerHTML",{get(){return this._ih;},set(v){this._ih=v;}});
  Object.defineProperty(el,"textContent",{get(){return this._tc||"";},set(v){this._tc=v;}});
  Object.defineProperty(el,"onclick",{get(){return this._oc;},set(v){this._oc=v;}});
  Object.defineProperty(el,"oninput",{get(){return this._oi;},set(v){this._oi=v;}});
  Object.defineProperty(el,"onchange",{get(){return this._och;},set(v){this._och=v;}});
  el.value=""; el.disabled=false; el.type="";
  return el;
}
const elCache = {};
global.document = {
  createElement: t => mkEl(t),
  querySelector: s => (elCache[s] = elCache[s] || mkEl()),
  querySelectorAll: () => [],
  body: mkEl("body"),
};
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
global.navigator = { clipboard:{writeText:()=>Promise.resolve()} };
global.FileReader = function(){ this.readAsDataURL=()=>{}; };
global.Event = function(n){this.name=n;};
global.setTimeout = setTimeout; global.clearTimeout = clearTimeout;

// --- append tests INTO the eval'd source (strict eval scoping) ---
src += `
;(function(){
  const A=(cond,msg)=>{ if(!cond){console.error("FAIL:",msg); process.exitCode=1;} else console.log("ok  -",msg); };

  // MATLIB integrity
  A(Array.isArray(MATLIB) && MATLIB.length>=70, "MATLIB has "+MATLIB.length+" items (>=70)");
  const ids=new Set(); let dup=null;
  MATLIB.forEach(m=>{ if(ids.has(m.id)) dup=m.id; ids.add(m.id); });
  A(!dup, "no duplicate ids"+(dup?" (dup: "+dup+")":""));
  A(MATLIB.every(m=>m.th&&m.en&&Array.isArray(m.cat)&&m.cat.length), "every item has th/en/cat");
  const knownCats=Object.keys(CATTH);
  A(MATLIB.every(m=>m.cat.every(c=>knownCats.includes(c))), "all cats are canonical");
  A(MATLIB.filter(m=>m.img).length===28, "28 items flagged img (have: "+MATLIB.filter(m=>m.img).length+")");
  // key interpreter entries
  [["terrazzo","terrazzo"],["washed_sand","exposed aggregate"],["polished_concrete","polished concrete"],["breeze_block","breeze blocks"],["stamped_concrete","stamped concrete"]].forEach(([id,kw])=>{
    const m=matById(id); A(m && m.en.toLowerCase().includes(kw), id+" → '"+kw+"'");
  });
  // TOPIC_LIB filters non-empty
  Object.entries(TOPIC_LIB).forEach(([tid,cats])=>{
    const n=MATLIB.filter(m=>m.cat.some(c=>cats.includes(c))).length;
    A(n>=5, tid+" filter yields "+n+" items (>=5)");
  });

  // compile() with lib: selections
  state.model="model.png";
  state.topics.matWall="lib:brick";
  state.topics.matFloor="lib:terrazzo";
  state.topics.matGlass="lib:frosted_glass";
  const P=compile();
  A(P.gpt.includes("walls: exposed red clay brick"), "compile walls lib → prompt");
  A(P.gpt.includes("entrance floor/steps: terrazzo"), "compile floor lib → prompt");
  A(P.gpt.includes("glass: frosted translucent glass"), "compile glass lib → prompt");
  A(P.gpt.includes("PRESERVE EXACTLY"), "PRESERVE block intact");
  A(P.gem.includes("strict re-texture"), "gem dialect header intact");

  // lib + ref coexistence
  state.refs[0]="ref1.jpg";
  state.topics.matAccent="ref1";
  const P2=compile();
  A(P2.gpt.includes("accent material reference"), "ref role override still works");
  A(P2.gpt.includes("walls: exposed red clay brick"), "lib survives alongside ref");

  // frag() returns null for lib values
  A(frag("matWall")===null, "frag() null on lib:");

  // pro flags exist
  const proCount=CFG.reduce((n,g)=>n+g.topics.filter(t=>t.pro).length,0);
  A(proCount===13, "13 pro topics (have: "+proCount+")");

  // openLib renders without throwing
  let threw=false;
  try{ openLib("matWall"); renderMMGrid(); }catch(e){ threw=true; console.error(e); }
  A(!threw, "openLib/renderMMGrid no throw");

  // setMode toggles
  setMode("pro"); A(localStorage.getItem("mr-mode")==="pro", "setMode persists");
  setMode("basic");

  console.log("\\nDONE");
})();`;
eval(src);
