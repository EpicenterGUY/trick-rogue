(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.BattleLayout=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STYLE_ID='trick-battle-layout-fixes';
  const ENEMY_CONTENT_DATASET='trick-enemy-content-9-b';
  const CONTENT_EXPANSION_DATASET='trick-content-expansion-9-c';
  const PURE_SYNERGY_DATASET='trick-pure-synergy-9-d';
  const CHIP_BUILD_DATASET='trick-chip-builds-9-e';
  const CHIP_BUILD_COMPENDIUM_BRIDGE_DATASET='trick-chip-builds-9-e-compendium-bridge';
  const COMPENDIUM_DATASET='trick-compendium-8-h';
  const COMPENDIUM_BRIDGE_DATASET='trick-compendium-8-h-runtime-bridge';
  const MOBILE_STAGE_WIDTH=92;
  const MOBILE_STAGE_HEIGHT=140;
  const MOBILE_SHOWDOWN_CARD_WIDTH=56;
  const MOBILE_MAP_NODE_WIDTH=66;
  const MOBILE_MAP_NODE_HEIGHT=48;
  const MOBILE_MAP_DECK_COLUMNS=7;
  const STYLE_TEXT=`
#overlay .rewardGrid{align-items:stretch}
#overlay .rewardBox{display:flex;flex-direction:column;min-width:0;overflow:hidden}
#overlay .rewardBox>.cardArt{height:auto!important;aspect-ratio:100/148;margin:0;flex:0 0 auto;overflow:hidden}
#overlay .rewardBox>.cardArt svg,#overlay .rewardBox>.cardArt img{width:100%;height:100%;display:block}
#overlay .rewardBox>h3{min-height:24px}
#overlay .rewardBox>p{min-height:0}
#overlay .rewardBox>.tiny{display:block;margin-top:auto;padding-top:4px}
#overlay .rewardBox>.rewardBtns{margin-top:4px}
@media (max-width:899px){
  #versus{min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageCard{height:${MOBILE_STAGE_HEIGHT}px;min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageInner{width:min(${MOBILE_STAGE_WIDTH}px,100%)}
  #slotRow .slot.fill{padding:1px}
  #slotRow .slotArt{width:min(${MOBILE_SHOWDOWN_CARD_WIDTH}px,calc(100% - 2px));height:auto;aspect-ratio:100/148;margin:0 auto}

  #statusTop{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px}
  #statusTop .midStat{display:none!important}
  #statusTop.has-showdown-advantage{grid-template-columns:minmax(0,1fr) minmax(72px,88px) minmax(0,1fr)}
  #statusTop.has-showdown-advantage .midStat{display:block!important;padding:4px 2px;font-size:7px;line-height:1.2}
  #statusTop.has-showdown-advantage .midStat b{font-size:8px;margin-top:2px;white-space:normal}
  #statusTop .hpPanel{padding:5px 6px}
  #statusTop .hpHead{font-size:10px}
  #statusTop .hpBar{height:7px;margin-top:3px}
  #battleScreen .arenaMeta{position:relative;top:auto;right:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;width:100%;justify-content:stretch}
  #battleScreen .arenaMeta .badge{justify-content:space-between;min-width:0;padding:4px 6px;font-size:10px;border-width:1px;box-shadow:0 0 0 1px #2e3850 inset}
  #battleScreen .arenaMeta .badge:nth-child(2){background:#102126;box-shadow:0 0 0 1px #31545c inset}
  #battleScreen .forecastRow{display:none}
  #battleScreen .forecastRow.is-active{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}
  #battleScreen .forecastRow.has-player-forecast:not(.has-enemy-forecast),#battleScreen .forecastRow.has-enemy-forecast:not(.has-player-forecast){grid-template-columns:minmax(0,1fr)}
  #battleScreen .forecastRow:not(.has-player-forecast)>:first-child{display:none}
  #battleScreen .forecastRow:not(.has-enemy-forecast)>:last-child{display:none}
  #battleScreen .forecastRow .badge{justify-content:space-between;min-width:0;padding:3px 5px;font-size:9px;border-width:1px;box-shadow:0 0 0 1px #29354a inset}
  #statuses.is-empty{display:none}
  #statuses:not(.is-empty){display:flex;gap:3px;flex-wrap:wrap;max-height:42px;overflow:auto}
  #battleScreen>.topbar .pixelBtn{background:#171d28;box-shadow:0 0 0 1px #3b465c inset;opacity:.9}

  #mapScreen{padding-bottom:max(6px,env(safe-area-inset-bottom))}
  #mapScreen>.topbar{padding:6px 8px 4px;gap:4px;align-items:center}
  #mapScreen>.topbar .logo{font-size:14px}
  #mapScreen>.topbar .sub{display:none}
  #mapScreen>.topbar .pixelBtn{padding:5px 7px;font-size:9px}
  #mapScreen>.topbar .pixelBtn[onclick="showNewPack()"]{display:none}
  #mapScreen>.section{padding:0 8px 4px!important}
  #mapScreen>.section .row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
  #mapScreen>.section .badge{justify-content:space-between;min-width:0;padding:4px 6px;font-size:10px}
  #mapScreen>.section .badge:nth-child(n+3){font-size:9px;color:#9ba7c2;background:#0d121b;box-shadow:0 0 0 1px #29334a inset}
  #mapWrap{margin:4px 8px 0;height:min(44dvh,360px);min-height:280px;max-height:360px;padding:10px}
  #mapSvg{left:10px;top:10px;right:auto;bottom:auto}
  #mapGrid .node{width:${MOBILE_MAP_NODE_WIDTH}px;height:${MOBILE_MAP_NODE_HEIGHT}px;margin-left:3px;margin-top:3px}
  #mapGrid .node .icon{font-size:16px}
  #mapGrid .node .nm{font-size:9px}
  #mapGrid .node.current{opacity:1;filter:none;background:linear-gradient(180deg,#2d4557,#1b2b38)}
  #mapGrid .node.lock{opacity:1;filter:grayscale(1) brightness(.42);color:#6f7788}
  #mapGrid .node.done{opacity:1;filter:saturate(.35) brightness(.58)}
  #mapSvg line{stroke:#7183a6;stroke-width:3px;opacity:.58;vector-effect:non-scaling-stroke}
  #mapScreen>.sectionTitle{padding:0 8px!important;margin:5px 0 3px!important;font-size:10px}
  #mapDeckStrip{margin:0 8px 8px;padding:5px;display:grid;grid-template-columns:repeat(${MOBILE_MAP_DECK_COLUMNS},minmax(0,1fr));gap:4px;overflow:hidden;align-items:start}
  #mapDeckStrip .miniCard{min-width:0;width:100%;height:auto;aspect-ratio:100/148}
}
`;

  function appendScript(doc,src,dataset,ready){
    if(ready?.())return true;
    if(!doc||typeof doc.createElement!=='function')return false;
    const existing=doc.querySelector?.(`script[data-${dataset}]`);if(existing)return true;
    const script=doc.createElement('script');script.src=src;script.async=false;script.setAttribute(`data-${dataset}`,'true');(doc.head||doc.documentElement)?.appendChild(script);return true;
  }
  function loadEnemyContent(doc=root.document){return appendScript(doc,'enemy-content-9-b.js',ENEMY_CONTENT_DATASET,()=>!!root.EnemyContent9B)}
  function loadContentExpansion(doc=root.document){return appendScript(doc,'content-expansion-9-c.js',CONTENT_EXPANSION_DATASET,()=>!!root.ContentExpansion9C)}
  function loadPureSynergies(doc=root.document){return appendScript(doc,'pure-synergies-9-d.js',PURE_SYNERGY_DATASET,()=>!!root.PureSynergy9D)}
  function loadChipBuilds(doc=root.document){return appendScript(doc,'chip-builds-9-e.js',CHIP_BUILD_DATASET,()=>!!root.ChipBuilds9E)}
  function loadChipBuildCompendiumBridge(doc=root.document){return appendScript(doc,'chip-builds-9-e-compendium-bridge.js',CHIP_BUILD_COMPENDIUM_BRIDGE_DATASET,()=>!!root.ChipBuilds9ECompendiumBridge)}
  function loadCompendium(doc=root.document){return appendScript(doc,'compendium-8-h.js',COMPENDIUM_DATASET,()=>!!root.Compendium8H)}
  function loadCompendiumBridge(doc=root.document){return appendScript(doc,'compendium-8-h-runtime-bridge.js',COMPENDIUM_BRIDGE_DATASET,()=>!!root.Compendium8HRuntimeBridge)}
  function activeBattle(runtimeRoot=root){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function battleHudState(state=activeBattle(root)){
    const advantage=!!(state?.advantageState?.player||state?.advantageState?.enemy);
    const playerForecast=Number(state?.myForecast)>0,enemyForecast=Number(state?.enemyForecast)>0;
    return{advantage,playerForecast,enemyForecast,forecastActive:playerForecast||enemyForecast};
  }
  function toggleClass(element,name,active){element?.classList?.toggle?.(name,!!active)}
  function syncBattleHud(doc=root.document,state=activeBattle(root)){
    if(!doc?.getElementById)return false;const hud=battleHudState(state),statusTop=doc.getElementById('statusTop'),forecast=doc.querySelector?.('.forecastRow'),statuses=doc.getElementById('statuses');
    toggleClass(statusTop,'has-showdown-advantage',hud.advantage);
    toggleClass(forecast,'is-active',hud.forecastActive);toggleClass(forecast,'has-player-forecast',hud.playerForecast);toggleClass(forecast,'has-enemy-forecast',hud.enemyForecast);
    if(statuses)toggleClass(statuses,'is-empty',String(statuses.textContent||'').trim()==='상태 없음'||!String(statuses.textContent||'').trim());
    return true;
  }
  function wrapRenderBattle(runtimeRoot=root){
    const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__tricklogMobileHudM3)return true;
    function wrapped(...args){const result=original.apply(this,args);syncBattleHud(runtimeRoot.document,activeBattle(runtimeRoot));return result}
    wrapped.__tricklogMobileHudM3=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function install(doc=root.document){
    if(!doc||typeof doc.createElement!=='function')return false;
    loadEnemyContent(doc);loadContentExpansion(doc);loadPureSynergies(doc);loadChipBuilds(doc);loadChipBuildCompendiumBridge(doc);loadCompendium(doc);loadCompendiumBridge(doc);wrapRenderBattle(root);syncBattleHud(doc,activeBattle(root));
    if(doc.getElementById?.(STYLE_ID))return true;
    const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=STYLE_TEXT;(doc.head||doc.documentElement)?.appendChild(style);return true;
  }

  return{STYLE_ID,ENEMY_CONTENT_DATASET,CONTENT_EXPANSION_DATASET,PURE_SYNERGY_DATASET,CHIP_BUILD_DATASET,CHIP_BUILD_COMPENDIUM_BRIDGE_DATASET,COMPENDIUM_DATASET,COMPENDIUM_BRIDGE_DATASET,MOBILE_STAGE_WIDTH,MOBILE_STAGE_HEIGHT,MOBILE_SHOWDOWN_CARD_WIDTH,MOBILE_MAP_NODE_WIDTH,MOBILE_MAP_NODE_HEIGHT,MOBILE_MAP_DECK_COLUMNS,STYLE_TEXT,appendScript,loadEnemyContent,loadContentExpansion,loadPureSynergies,loadChipBuilds,loadChipBuildCompendiumBridge,loadCompendium,loadCompendiumBridge,activeBattle,battleHudState,toggleClass,syncBattleHud,wrapRenderBattle,install};
});