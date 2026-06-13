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
  getElementById: id => (elCache["#"+id] = elCache["#"+id] || mkEl()), // v1.4: cats UI
  body: mkEl("body"),
};
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
global.navigator = { clipboard:{writeText:()=>Promise.resolve()} };
global.FileReader = function(){ this.readAsDataURL=()=>{}; };
global.Event = function(n){this.name=n;};
global.setTimeout = setTimeout; global.clearTimeout = clearTimeout;
global.window = global; // v1.3: window.EyeDropper guard in build loop

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
  A(proCount===22, "22 pro topics (have: "+proCount+")"); // v1.4: +mood +extlight +fx

  // v1.2.1: MJ dialect
  A(typeof P.mj==="string" && P.mj.includes("--style raw"), "mj dialect present + --style raw");
  A(P.mj.includes("--ar 4:3"), "mj default --ar 4:3 (have: "+P.mj.slice(-30)+")");
  A(P.mj.includes("walls: exposed red clay brick"), "mj includes lib material");
  state.topics.aspect="169";
  A(compile().mj.includes("--ar 16:9"), "mj --ar follows aspect 16:9");
  state.topics.aspect="auto";

  // v1.2.1: target includes mj
  const targetTopic=CFG.flatMap(g=>g.topics).find(t=>t.id==="target");
  A(targetTopic && targetTopic.opts.some(o=>o.v==="mj"), "target opts include mj");

  // v1.2.1: props topic + life block
  const propsTopic=CFG.flatMap(g=>g.topics).find(t=>t.id==="props");
  A(propsTopic && propsTopic.pro, "props topic exists (pro)");
  state.topics.props="outdoor";
  A(compile().gpt.includes("outdoor furniture set"), "props frag reaches prompt");
  state.topics.props="auto";

  // v1.3: intlight is now a Kelvin slider
  const il=CFG.flatMap(g=>g.topics).find(t=>t.id==="intlight");
  A(il && il.type==="slider" && il.smin===2700 && il.smax===6500, "intlight = slider 2700-6500K");

  // v1.2.1: BTYPES expanded + per-type chips
  A(BTYPES.length>=10, "BTYPES >=10 (have: "+BTYPES.length+")");
  A(typeof DCHIPS_BY==="object" && DCHIPS_BY.warehouse && DCHIPS_BY.house, "DCHIPS_BY has per-type chips");

  // v1.2.1→v1.4: MATLIB 91 + new items + position filter
  A(MATLIB.length===91, "MATLIB 91 items (have: "+MATLIB.length+")");
  A(matById("bamboo") && matById("acp"), "bamboo + ACP in library (family coverage)");
  A(matById("flamed_granite") && matById("alum_louver"), "new v1.2.1 materials present");
  A(useOf(matById("flamed_granite")).has("pstair"), "flamed_granite usable on stairs");
  A(useOf(matById("brick")).has("pwall") && !useOf(matById("brick")).has("pfloor"), "brick = wall only");
  let threw2=false; try{ openLib("matFloor"); renderMMUses(); mmUse="pstair"; renderMMGrid(); mmUse="all"; }catch(e){ threw2=true; console.error(e); }
  A(!threw2, "position filter render no throw");

  // openLib renders without throwing
  let threw=false;
  try{ openLib("matWall"); renderMMGrid(); }catch(e){ threw=true; console.error(e); }
  A(!threw, "openLib/renderMMGrid no throw");

  // setMode toggles
  setMode("pro"); A(localStorage.getItem("mr-mode")==="pro", "setMode persists");
  setMode("basic");

  /* ---------- v1.3 ---------- */

  // time slider → band frag
  A(timeKey("17")==="golden" && timeKey("12")==="midday" && timeKey("22")==="night" && timeKey("6")==="dawn", "timeKey bands correct");
  state.topics.time="17";
  const P3=compile();
  A(P3.gpt.includes("golden hour") && P3.gpt.includes("(around 17:00)"), "time slider 17 → golden + HH:MM in prompt");
  A(hhmm("6.5")==="06:30", "hhmm half-hour format");
  state.topics.time="22";
  A(compile().gpt.includes("warm interior lights glowing"), "night band auto interior lights");
  state.topics.time="auto";

  // kelvin slider → frag bands
  A(kelvinFrag("2700").startsWith("warm 2700K"), "2700 → warm");
  A(kelvinFrag("3000").startsWith("soft warm-white"), "3000 → soft warm-white");
  A(kelvinFrag("4000").startsWith("neutral white LED"), "4000 → neutral");
  A(kelvinFrag("6500").startsWith("cool white LED"), "6500 → cool");
  A(kelvinFrag("off")==="interior lights off" && kelvinFrag("auto")===null, "kelvin off/auto");
  state.topics.intlight="3000";
  A(compile().gpt.includes("3000K interior lighting"), "kelvin slider reaches prompt");
  state.topics.intlight="auto";

  // hex custom color
  state.topics.matWall="hex:#ff8800";
  const Ph=compile();
  A(Ph.gpt.includes("walls: painted in exact color #FF8800 — a vivid orange (RGB 255, 136, 0)"), "hex color → exact RGB + human name in prompt"); // v1.4 hexName
  A(frag("matWall")===null, "frag() null on hex:");
  state.topics.matWall="lib:brick";

  // v1.4: site = dedicated slot (image 2) — ref เลื่อนเป็น image 3+
  state.site="site.jpg";
  const Ps=compile();
  A(Ps.gpt.includes("SITE COMPOSITE: place the building from image 1 into the real site photo (image 2)"), "site slot → SITE COMPOSITE image 2");
  A(Ps.gpt.includes("image 2 = the REAL SITE photograph"), "site declared in image roles");
  A(Ps.gpt.includes("perspective and scale anchors") && Ps.gpt.includes("camera viewpoint MUST be that of the site photo"), "perspective anchor text present");
  A(Ps.gpt.indexOf("SITE COMPOSITE")<Ps.gpt.indexOf("Render as:"), "SITE COMPOSITE comes first in CHANGE");
  A(Ps.gpt.includes("image 3 = accent material reference"), "ref shifts to image 3 when site present");
  A(!ROLES.some(r=>r.v==="site"), "site removed from ref ROLES dropdown");
  state.site=null;
  A(compile().gpt.includes("image 2 = accent material reference"), "ref back to image 2 when no site");

  // archstyle mood
  state.topics.archstyle="modern";
  A(compile().gpt.includes("Overall mood —") && compile().gpt.includes("do NOT change the building's geometry"), "archstyle mood + geometry guard");
  state.topics.archstyle="auto";

  // BT_CATS 2-level
  A(Array.isArray(BT_CATS) && BT_CATS.length>=4, "BT_CATS categories (have: "+BT_CATS.length+")");
  A(BTYPES.length>=18, "BTYPES flattened >=18 (have: "+BTYPES.length+")");
  A(catOfBtype("house")==="res" && catOfBtype("hotel")==="com" && catOfBtype("school")==="pub", "catOfBtype maps correctly");
  A(DCHIPS_BY.condo && DCHIPS_BY.hotel && DCHIPS_BY.temple, "DCHIPS_BY covers new subtypes");

  // season/trees split + bg expanded
  const trees=CFG.flatMap(g=>g.topics).find(t=>t.id==="trees");
  A(trees && trees.pro, "trees topic split from season");
  const bg=CFG.flatMap(g=>g.topics).find(t=>t.id==="bg");
  A(bg && bg.opts.length>=12, "bg landscape >=12 opts (have: "+bg.opts.length+")");
  state.topics.trees="none";
  A(compile().gpt.includes("no vegetation"), "trees frag reaches prompt");
  state.topics.trees="auto";

  // new material topics wired
  ["matSlat","matTerrace","matDoor","matGutter"].forEach(id=>{
    const t2=CFG.flatMap(g=>g.topics).find(x=>x.id===id);
    A(t2 && t2.pro && t2.refable, id+" topic exists (pro+refable)");
    A(TOPIC_LIB[id], id+" wired into TOPIC_LIB");
  });
  state.topics.matGutter="lib:alum_louver"; state.topics.matGutter="auto"; // smoke
  state.topics.matDoor="lib:teak"; // teak? may not exist — fallback below
  if(!matById("teak")) state.topics.matDoor="auto";
  else { A(compile().gpt.includes("main entrance door"), "matDoor lib reaches prompt"); state.topics.matDoor="auto"; }

  // perspective enforcement on life block
  state.topics.cars="parked";
  A(compile().gpt.includes("vanishing points") && compile().gpt.includes("no pasted-on look"), "car perspective enforcement");
  state.topics.cars="auto";

  // colorpill plumbing exists
  A(Array.isArray(COLORABLE) && COLORABLE.includes("matWall"), "COLORABLE defined");
  A(typeof syncSliders==="function" && sliderEls.time && sliderEls.intlight, "slider engine registered time+intlight");

  // conflicts use timeKey (no throw with numeric time)
  state.topics.time="22"; state.topics.shadow="hard";
  let threw3=false; try{ getConflicts(); }catch(e){ threw3=true; console.error(e); }
  A(!threw3, "getConflicts handles numeric time");
  state.topics.time="auto"; state.topics.shadow="auto";

  // modal scroll lock
  openLib("matWall");
  A(document.body.style.overflow==="hidden", "openLib locks body scroll");
  closeLib();
  A(document.body.style.overflow==="", "closeLib restores body scroll");

  /* ---------- v1.4 ---------- */

  // vocab expansion: archstyle 18 + cats 2-level
  const as=CFG.flatMap(g=>g.topics).find(t=>t.id==="archstyle");
  A(as && as.opts.length===19, "archstyle 18 styles + AUTO (have: "+(as.opts.length-1)+")");
  A(Array.isArray(as.cats) && as.cats.length===4, "archstyle has 4 cats");
  A(as.cats.every(c=>c.vs.every(v=>as.opts.some(o=>o.v===v))), "every archstyle cat value maps to an opt");
  const allCatVs=as.cats.flatMap(c=>c.vs);
  A(as.opts.filter(o=>o.v!=="auto").every(o=>allCatVs.includes(o.v)), "every archstyle opt belongs to a cat");

  // fence 2-level 16 opts
  const fe=CFG.flatMap(g=>g.topics).find(t=>t.id==="fence");
  A(fe && Array.isArray(fe.cats) && fe.cats.length===5, "fence has 5 cats");
  A(fe.opts.length===17, "fence 16 opts + AUTO (have: "+(fe.opts.length-1)+")");
  A(fe.cats.every(c=>c.vs.every(v=>fe.opts.some(o=>o.v===v))), "every fence cat value maps to an opt");

  // new topics: mood / extlight / fx
  ["mood","extlight","fx"].forEach(id=>{
    const t2=CFG.flatMap(g=>g.topics).find(x=>x.id===id);
    A(t2 && t2.pro, id+" topic exists (pro)");
  });
  state.topics.mood="cinema"; state.topics.extlight="combo"; state.topics.fx="rim";
  const P4=compile();
  A(P4.gpt.includes("Mood — cinematic lighting"), "mood frag reaches prompt");
  A(P4.gpt.includes("layered exterior lighting"), "extlight frag reaches atmosphere");
  A(P4.gpt.includes("rim light glowing"), "fx frag reaches camera block");
  A(P4.mj.includes("cinematic lighting"), "mood reaches mj dialect");
  state.topics.mood="auto"; state.topics.extlight="auto"; state.topics.fx="auto";

  // word presets on slider topics (hybrid)
  A(timeKey("w_golden")==="golden" && timeKey("w_civil")==="blue" && timeKey("w_night")==="night", "TIME_WORD maps to bands");
  state.topics.time="w_golden";
  const Pw=compile();
  A(Pw.gpt.includes("warm golden hour light, low sun, long soft shadows"), "time word preset → en frag");
  A(!Pw.gpt.includes("(around"), "word preset has no HH:MM");
  state.topics.time="w_night";
  A(compile().gpt.includes("warm interior lights glowing"), "word night triggers auto interior lights");
  state.topics.time="w_golden"; state.topics.weather="cloud";
  A(compile().gpt.includes("warm low sun breaking through clouds") && !compile().gpt.includes("NaN"), "conflict resolution safe with word time");
  state.topics.time="auto"; state.topics.weather="auto";
  state.topics.intlight="w_warm";
  A(compile().gpt.includes("warm cozy interior lighting"), "intlight word preset → en frag");
  state.topics.intlight="auto";

  // hexName bands
  A(hexName("#ffffff")==="near-white" && hexName("#000000")==="near-black", "hexName white/black");
  A(hexName("#8b5a2b").includes("brown"), "hexName earth tone → brown");
  A(hexName("#3b82f6").includes("blue"), "hexName blue");

  // MATLIB v1.4 entries + interior prep
  A(matById("zinc_patina") && matById("limewash") && matById("rammed_earth") && matById("mirror_glass"), "new exterior materials present");
  A(matById("herringbone") && matById("oak_floor") && matById("acoustic_slat"), "interior-prep materials present");
  A(CATTH.interior, "interior cat registered in CATTH");
  A(TOPIC_LIB.matAccent.includes("interior"), "matAccent reaches interior items");
  A(matById("corten").cat.includes("wall"), "corten reachable from wall topics");

  // PRESET SYSTEM
  A(Array.isArray(PRESETS) && PRESETS.length===5, "5 built-in presets");
  A(PRESETS.every(p=>Object.entries(p.topics).every(([k,v])=>{
    const t2=CFG.flatMap(g=>g.topics).find(x=>x.id===k);
    return t2 && (t2.opts.some(o=>o.v===v)||t2.type==="slider");
  })), "every preset value is a valid opt");
  state.topics.matWall="lib:brick"; // pre-existing user value — apply must reset it
  applyPreset(PRESETS[0]);
  A(state.topics.time==="w_golden" && state.topics.mood==="serene", "applyPreset sets preset topics");
  A(state.topics.matWall==="auto", "applyPreset resets non-preset topics to default");
  A(activePreset===PRESETS[0].id, "activePreset tracked");
  A(presetModified(PRESETS[0])===false, "freshly applied preset = not modified");
  state.topics.weather="storm";
  A(presetModified(PRESETS[0])===true, "changing a topic flags ✱ modified");
  let threwP=false; try{ renderPresetBar(); }catch(e){ threwP=true; console.error(e); }
  A(!threwP, "renderPresetBar no throw");
  // user preset save/load roundtrip via localStorage
  localStorage.setItem("mr-presets", JSON.stringify([{id:"u_1",th:"⭐ test",topics:{mood:"lux"}}]));
  A(userPresets().length===1 && userPresets()[0].topics.mood==="lux", "user presets roundtrip");
  applyPreset(userPresets()[0]);
  A(state.topics.mood==="lux" && state.topics.time==="auto", "user preset applies + resets");
  localStorage.removeItem("mr-presets");
  // reset state for cleanliness
  CFG.forEach(g=>g.topics.forEach(t=>state.topics[t.id]=t.def||"auto"));

  // cats UI engine
  A(typeof renderCatRow==="function" && typeof topicCats==="object", "cats engine present");

  /* ---------- v1.4.1: PASSPORT ENGINE ---------- */
  A(state.passport && state.passport.mode==="new" && Array.isArray(state.passport.editKeys), "state.passport initialised (mode new)");

  // buildSchedule keys + legacy Materials-line formatting preserved
  CFG.forEach(g=>g.topics.forEach(t=>state.topics[t.id]=t.def||"auto"));
  state.model="model.png";
  state.topics.matWall="brick";          // plain opt → bare in Materials line (no "walls:")
  state.topics.matFloor="lib:terrazzo";  // lib → "label: en"
  const sch=currentSchedule();
  A(sch.length===2 && sch[0].key==="W1" && sch[1].key==="W2", "schedule keyed W1/W2 in order");
  A(sch[0].label==="walls" && sch[0].en==="exposed brick walls", "schedule resolves plain opt en");
  A(sch[0].mats==="exposed brick walls", "legacy Materials line stays bare for plain opt (no label:)");
  A(sch[1].mats==="entrance floor/steps: terrazzo with stone chips", "lib item keeps 'label:' prefix in Materials line");
  const Ppp=compile();
  A(Ppp.gpt.includes("Materials — exposed brick walls; entrance floor/steps: terrazzo with stone chips"), "compile Materials line matches legacy formatting");

  // passport block: id + form + keyed schedule, in all 3 structured dialects
  A(Ppp.gpt.includes('=== BUILDING PASSPORT · "Building-1"'), "default passport id = Building-1");
  A(Ppp.gpt.includes("FORM (locked):") && Ppp.gpt.includes("single-family detached house"), "passport FORM block present");
  A(Ppp.gpt.includes("MATERIAL SCHEDULE (locked") && Ppp.gpt.includes("W1 — walls: exposed brick walls"), "passport material schedule keyed W1");
  A(Ppp.gem.includes("BUILDING PASSPORT") && Ppp.gen.includes("BUILDING PASSPORT"), "passport injected into gem + gen too");

  // named passport → id in prompt + mj identity token (named only)
  state.passport.name="Baan-A";
  const Pn=compile();
  A(Pn.gpt.includes('=== BUILDING PASSPORT · "Baan-A"'), "passport name reaches prompt");
  A(Pn.mj.includes('consistent design identity "Baan-A"'), "mj identity token when named");
  state.passport.name="";
  A(!compile().mj.includes("consistent design identity"), "mj has no identity token by default");

  // massing note in FORM
  state.passport.massing="two-storey L-shaped, gable roof";
  A(compile().gpt.includes("two-storey L-shaped, gable roof"), "massing note in FORM block");
  state.passport.massing="";

  // mode: new = no lock directive
  A(!compile().gpt.includes("SAME BUILDING — NEW CAMERA ANGLE") && !compile().gpt.includes("SINGLE-ITEM EDIT"), "new mode = no lock directive");

  // mode: view
  state.passport.mode="view";
  const Pv=compile();
  A(Pv.gpt.includes("SAME BUILDING — NEW CAMERA ANGLE") && Pv.gpt.includes("ONLY the camera angle"), "view mode injects same-building directive");

  // mode: edit targeting selected W#
  state.passport.mode="edit"; state.passport.editKeys=["matWall"];
  const Pe=compile();
  A(Pe.gpt.includes("SINGLE-ITEM EDIT") && Pe.gpt.includes("W1 (walls)"), "edit mode targets selected W#");
  A(Pe.gpt.includes("Every OTHER material"), "edit mode preserves the rest");
  state.passport.mode="new"; state.passport.editKeys=[];

  // passport UI renders without throwing (new/view/edit)
  let threwPP=false; try{ renderPPMode(); renderPPEdit(); state.passport.mode="edit"; renderPPEdit(); state.passport.mode="view"; renderPPEdit(); state.passport.mode="new"; renderPPEdit(); }catch(e){ threwPP=true; console.error(e); }
  A(!threwPP, "passport UI renders (new/view/edit) no throw");

  // cleanup
  CFG.forEach(g=>g.topics.forEach(t=>state.topics[t.id]=t.def||"auto"));

  console.log("\\nDONE");
})();`;
eval(src);
