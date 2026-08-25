(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{root.GameUI=api;if(typeof document!=='undefined')api.install(root)}
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STYLE_ID='trick-game-ui-v1';
  const REGION_THEME={region_theater:'theater',region_observatory:'observatory',region_frontier:'frontier',final:'final',final_region:'final'};
  const STYLE_TEXT=`
:root{--game-gold:#e7bf67;--game-cyan:#6ad7d3;--game-red:#ed6475;--game-ink:#0a0e15;--game-panel:#101722;--game-line:#33445c}
#app{background:radial-gradient(circle at 50% -10%,#22324a66,transparent 30%),linear-gradient(180deg,#111722,#070a0f 72%)}
.screen>.topbar{border-bottom:1px solid #ffffff0d;background:linear-gradient(180deg,#0b1018e8,#0b1018a8 70%,transparent)}
.screen>.topbar .logo{text-shadow:2px 2px 0 #000;font-weight:900}.pixelBtn{border:1px solid #05070b;border-radius:5px;box-shadow:inset 0 0 0 1px #51607955,0 3px 0 #0007;background:linear-gradient(180deg,#283247,#151c29)}
.pixelBtn:active{transform:translateY(2px);box-shadow:inset 0 0 0 1px #51607955,0 1px 0 #0008}
#startScreen .hero.pixel{border-radius:14px;border:1px solid #ffffff12;background:radial-gradient(circle at 80% 30%,#32777b44,transparent 32%),linear-gradient(145deg,#1b2535,#111722);box-shadow:0 16px 38px #0008,inset 0 0 0 1px #60739322}
#startScreen .option.pixel{border-radius:10px;border:1px solid #ffffff10;background:linear-gradient(180deg,#202c40,#141b29);box-shadow:0 8px 20px #0005,inset 0 0 0 1px #62759720}
#startScreen .option.sel{outline:1px solid var(--game-cyan);box-shadow:0 0 18px #67d3d033,inset 0 0 0 1px #67d3d055}
#mapWrap.pixel{border:1px solid #ffffff12;border-radius:14px;background:radial-gradient(circle at 50% 20%,#31566a2e,transparent 36%),linear-gradient(180deg,#121b28,#0b1018);box-shadow:0 14px 34px #0008,inset 0 0 0 1px #7ea0c51c}
#mapGrid .node{border:1px solid #06090e;border-radius:10px;background:linear-gradient(180deg,#25344a,#141c29);box-shadow:0 5px 0 #0008,inset 0 0 0 1px #6d85a330}
#mapGrid .node.current{outline:2px solid var(--game-cyan);box-shadow:0 0 18px #67d3d044,0 5px 0 #0008,inset 0 0 0 1px #6d85a355}
#mapGrid .node.done{filter:saturate(.45) brightness(.7)}#mapGrid .node.lock{filter:grayscale(1) brightness(.42)}
#mapDeckStrip.pixel{border:1px solid #ffffff0d;border-radius:10px;background:#0b1018bd;box-shadow:inset 0 0 0 1px #5f738f14}
#overlay{backdrop-filter:blur(4px);background:#02050bcc}
#overlay .modal{border:1px solid #070a0f;border-radius:14px;background:radial-gradient(circle at 50% 0,#33435d44,transparent 34%),linear-gradient(180deg,#1a2333,#0e141f);box-shadow:0 20px 50px #000b,inset 0 0 0 1px #7185a333}
#overlay .modal h2{color:#f2dfad;text-shadow:2px 2px 0 #000}
#overlay .choice{border:1px solid #070a0f;border-radius:8px;background:linear-gradient(180deg,#25334a,#151d2a);box-shadow:0 4px 0 #0007,inset 0 0 0 1px #7890b12c}
#overlay .choice:active{transform:translateY(2px);box-shadow:0 2px 0 #0008}
#overlay .rewardBox{border-radius:8px;box-shadow:0 7px 16px #0007,inset 0 0 0 1px #b9a77a}
#overlay .brmShell{gap:9px}#overlay .brmTop{padding:2px 2px 0}#overlay .brmWallet{padding:6px 9px;border-radius:16px;background:#0b1018;box-shadow:inset 0 0 0 1px #d9b95d55}
#overlay .brmCard{border-radius:7px;box-shadow:0 5px 0 #0008,inset 0 0 0 1px #9f9279}#overlay .brmCard.is-selected{box-shadow:0 0 0 2px var(--game-cyan),0 8px 14px #0009}
#overlay .brmDetail{border:1px solid #05080d;border-radius:9px;background:linear-gradient(180deg,#121d2d,#0b121d);box-shadow:inset 0 0 0 1px #697b9830}
#overlay .brmLeave{border-radius:8px}
#battlePileHud{display:grid;grid-template-columns:1fr minmax(76px,.72fr) 1fr;gap:8px;align-items:end;padding:3px 12px 1px;position:relative;z-index:6}
.battlePile{appearance:none;border:0;background:transparent;color:#e8edf4;padding:0;display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px;align-items:center;text-align:left;min-width:0}
.battlePile:disabled{opacity:1}.pileStack{position:relative;width:46px;height:60px;border-radius:5px;background:linear-gradient(145deg,#1e3850,#0b1521);box-shadow:0 4px 0 #0008,inset 0 0 0 2px #568297,0 0 0 1px #05070b}
.pileStack:before,.pileStack:after{content:'';position:absolute;inset:0;border-radius:5px;border:1px solid #05070b;background:inherit;z-index:-1}.pileStack:before{transform:translate(-4px,4px);filter:brightness(.75)}.pileStack:after{transform:translate(-7px,7px);filter:brightness(.55)}
.pileStack .pileMark{position:absolute;inset:8px;display:grid;place-items:center;border:1px solid #6eb9c066;color:#7fd8d6;font-size:15px;background:repeating-linear-gradient(45deg,#102231 0 6px,#152c3d 6px 12px)}
.battlePile.discard .pileStack{background:linear-gradient(145deg,#4a2630,#1a0e13);box-shadow:0 4px 0 #0008,inset 0 0 0 2px #9b4f61,0 0 0 1px #05070b}.battlePile.discard .pileMark{color:#ef7182;border-color:#a74e6266;background:repeating-linear-gradient(45deg,#291219 0 6px,#351821 6px 12px)}
.pileCopy{min-width:0}.pileLabel{display:block;font-size:8px;letter-spacing:.14em;color:#8190a7}.pileCount{display:block;font-size:20px;line-height:1;color:#f0f5f7;text-shadow:2px 2px 0 #000;margin-top:2px}.battlePile.deck .pileCount{color:#7ce2df}.battlePile.discard .pileCount{color:#f27b8c}
#battlePileCenter{text-align:center;padding-bottom:7px}.pileCenterLabel{display:block;font-size:8px;color:#77869d;letter-spacing:.1em}.pileCenterValue{display:block;font-size:11px;color:#d8c690;margin-top:3px}
#handPanel.pixel{margin:0 8px 3px;border:0;border-radius:12px;background:linear-gradient(180deg,#0c121bc4,#070b12e8);box-shadow:inset 0 0 0 1px #ffffff0b,0 -8px 24px #0005}
#handPanel .panelTitle{padding:0 3px;color:#8f9bb0}#handPanel #drawInfo{font-size:8px;color:#66758c}
#inspect.pixel{margin:0 8px 8px;border:0;border-radius:10px;background:linear-gradient(180deg,#141c29f2,#0b111bf2);box-shadow:inset 0 0 0 1px #ffffff10,0 7px 18px #0005}
#playBtn.pixelBtn.primary{border-radius:8px;background:linear-gradient(180deg,#2d7775,#194a4d);box-shadow:inset 0 0 0 1px #77d5d1aa,0 4px 0 #071011}
@media(max-width:899px){
  #battlePileHud{padding:4px 18px 0;gap:5px}.battlePile{grid-template-columns:42px 1fr;gap:6px}.pileStack{width:40px;height:52px}.pileStack .pileMark{inset:7px;font-size:13px}.pileCount{font-size:17px}.pileLabel{font-size:7px}#battlePileCenter{padding-bottom:5px}.pileCenterLabel{font-size:7px}.pileCenterValue{font-size:9px}
  #overlay .modal{max-height:94dvh;padding:10px}#overlay .brmGrid{gap:5px}
}
@media(min-width:900px){#battlePileHud{grid-area:hand;margin-top:-4px;padding:0 12px 6px;align-self:end;pointer-events:none}#battlePileHud+.pixel{margin-top:72px}.battlePile.deck{pointer-events:auto}}
`;
  function activeBattle(runtimeRoot=root){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function finiteLength(value){return Array.isArray(value)?value.length:null}
  function parseCount(text,label){const match=String(text||'').match(new RegExp(`${label}\\s*(\\d+)`));return match?Number(match[1]):null}
  function pileCounts(state=activeBattle(root),doc=root.document){
    const info=doc?.getElementById?.('drawInfo')?.textContent||'';
    let deck=finiteLength(state?.deck);if(deck===null)deck=finiteLength(state?.drawPile);if(deck===null)deck=finiteLength(state?.draw);if(deck===null)deck=parseCount(info,'덱');
    let discard=finiteLength(state?.discard);if(discard===null)discard=finiteLength(state?.discardPile);if(discard===null)discard=parseCount(info,'버림');
    const exchange=(String(info).match(/교환\s*(\d+)\s*회?/)||[])[1];
    return{deck:deck??0,discard:discard??0,exchange:exchange!==undefined?Number(exchange):null};
  }
  function regionId(runtimeRoot=root,state=activeBattle(runtimeRoot)){
    const runState=activeRun(runtimeRoot);return state?.node?.regionPlan?.regionId||state?.node?.regionId||runState?.runFlow?.currentRegionId||runState?.actId||null;
  }
  function themeForRegion(id){return REGION_THEME[id]||'neutral'}
  function ensurePileHud(doc=root.document,runtimeRoot=root){
    const hand=doc?.getElementById?.('handPanel');if(!hand?.parentNode)return null;
    let hud=doc.getElementById('battlePileHud');if(hud)return hud;
    hud=doc.createElement('div');hud.id='battlePileHud';hud.setAttribute('aria-label','전투 덱과 버림 더미');
    hud.innerHTML='<button type="button" class="battlePile deck" id="battleDeckPile" aria-label="덱 보기"><span class="pileStack"><span class="pileMark">◆</span></span><span class="pileCopy"><span class="pileLabel">DECK</span><strong class="pileCount" id="battleDeckCount">0</strong></span></button><div id="battlePileCenter"><span class="pileCenterLabel">DRAW PILES</span><strong class="pileCenterValue" id="battleExchangeCount">전투 덱</strong></div><div class="battlePile discard" id="battleDiscardPile"><span class="pileStack"><span class="pileMark">◇</span></span><span class="pileCopy"><span class="pileLabel">DISCARD</span><strong class="pileCount" id="battleDiscardCount">0</strong></span></div>';
    hand.parentNode.insertBefore(hud,hand);
    const deckButton=hud.querySelector('#battleDeckPile');deckButton?.addEventListener?.('click',()=>{if(typeof runtimeRoot?.showDeck==='function')runtimeRoot.showDeck()});
    return hud;
  }
  function setTextIfChanged(element,value){if(!element)return false;const next=String(value);if(element.textContent===next)return false;element.textContent=next;return true}
  function syncPileHud(doc=root.document,state=activeBattle(root),runtimeRoot=root){
    const hud=ensurePileHud(doc,runtimeRoot);if(!hud)return false;const counts=pileCounts(state,doc);
    const deck=doc.getElementById('battleDeckCount'),discard=doc.getElementById('battleDiscardCount'),exchange=doc.getElementById('battleExchangeCount');
    setTextIfChanged(deck,counts.deck);setTextIfChanged(discard,counts.discard);setTextIfChanged(exchange,counts.exchange===null?'전투 덱':`교환 ${counts.exchange}회`);
    hud.dataset.deckEmpty=counts.deck===0?'true':'false';hud.dataset.discardEmpty=counts.discard===0?'true':'false';return counts;
  }
  function syncTheme(doc=root.document,runtimeRoot=root,state=activeBattle(runtimeRoot)){
    const id=regionId(runtimeRoot,state),theme=themeForRegion(id),app=doc?.getElementById?.('app'),battleScreen=doc?.getElementById?.('battleScreen'),mapScreen=doc?.getElementById?.('mapScreen');
    if(app)app.dataset.gameRegion=theme;if(battleScreen)battleScreen.dataset.gameTheme=theme;if(mapScreen)mapScreen.dataset.gameTheme=theme;return theme;
  }
  function sync(runtimeRoot=root){const doc=runtimeRoot?.document||root.document;if(!doc)return false;syncTheme(doc,runtimeRoot,activeBattle(runtimeRoot));syncPileHud(doc,activeBattle(runtimeRoot),runtimeRoot);return true}
  function wrapRenderBattle(runtimeRoot=root){const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__trickGameUi)return true;function wrapped(...args){const result=original.apply(this,args);sync(runtimeRoot);return result}wrapped.__trickGameUi=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true}
  function installStyle(doc=root.document){if(!doc?.createElement)return false;if(doc.getElementById(STYLE_ID))return true;const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=STYLE_TEXT;(doc.head||doc.documentElement).appendChild(style);return true}
  function observe(runtimeRoot=root){const doc=runtimeRoot?.document||root.document;if(!doc||typeof MutationObserver==='undefined'||doc.__trickGameUiObserver)return false;const observer=new MutationObserver(()=>sync(runtimeRoot));observer.observe(doc.getElementById('app')||doc.body,{subtree:true,attributes:true,attributeFilter:['class']});doc.__trickGameUiObserver=observer;return true}
  function install(runtimeRoot=root){const doc=runtimeRoot?.document||root.document;if(!doc)return false;installStyle(doc);let attempts=0;const attempt=()=>{wrapRenderBattle(runtimeRoot);sync(runtimeRoot);observe(runtimeRoot);if(typeof runtimeRoot.renderBattle!=='function'&&attempts++<80)setTimeout(attempt,25)};if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  return{STYLE_ID,REGION_THEME,STYLE_TEXT,activeBattle,activeRun,parseCount,pileCounts,regionId,themeForRegion,ensurePileHud,setTextIfChanged,syncPileHud,syncTheme,sync,wrapRenderBattle,installStyle,observe,install};
});
