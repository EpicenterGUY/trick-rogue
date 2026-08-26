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
  const BATTLE_SCENE_V2_DATASET='trick-battle-scene-v2';
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

/* game-like battle presentation */
#battleScreen{
  --battle-accent:#6fd8d4;--battle-accent-soft:#244e56;--battle-sky:#101a29;--battle-floor:#0c1718;--battle-glow:#64d4d42b;
  background:
    radial-gradient(circle at 50% 32%,var(--battle-glow),transparent 38%),
    linear-gradient(180deg,var(--battle-sky),#090c12 72%);
}
#battleScreen[data-battle-region="region_theater"]{--battle-accent:#e49bcf;--battle-accent-soft:#5c3155;--battle-sky:#24172c;--battle-floor:#201522;--battle-glow:#c951b538}
#battleScreen[data-battle-region="region_observatory"]{--battle-accent:#83dce4;--battle-accent-soft:#285565;--battle-sky:#102632;--battle-floor:#102126;--battle-glow:#5dccdb32}
#battleScreen[data-battle-region="region_frontier"]{--battle-accent:#e7b666;--battle-accent-soft:#63492d;--battle-sky:#2a2019;--battle-floor:#221913;--battle-glow:#db984133}
#battleScreen[data-battle-region="final"]{--battle-accent:#e96273;--battle-accent-soft:#64313b;--battle-sky:#26131b;--battle-floor:#1c1015;--battle-glow:#e14a6238}
@media (max-width:899px){
  #battleScreen{padding-bottom:max(4px,env(safe-area-inset-bottom));overflow-y:auto}
  #battleScreen>.topbar{padding:6px 9px 4px;min-height:44px;background:linear-gradient(180deg,#080b11d9,#080b1188 72%,transparent);position:relative;z-index:8}
  #battleScreen>.topbar .logo{font-size:14px;letter-spacing:0;color:#f7f0df}
  #battleScreen>.topbar .sub{font-size:8px;color:#aeb9cb}
  #battleScreen>.topbar .row{gap:4px}
  #battleScreen>.topbar .pixelBtn{min-width:42px;padding:5px 6px;font-size:9px;border:1px solid #000;background:#101722a8;box-shadow:inset 0 0 0 1px #35435c}
  #battleMain{gap:0;padding:0;overflow:visible}

  #statusTop{padding:0 9px 5px;position:relative;z-index:7}
  #statusTop .hpPanel.pixel{border:0;background:#0a0e16b8;box-shadow:none;padding:5px 7px;border-radius:5px;outline:1px solid #ffffff12}
  #statusTop .hpHead{font-size:9px;text-shadow:1px 1px #000}
  #statusTop .hpBar{height:6px;border:0;background:#020407;box-shadow:0 0 0 1px #000 inset;margin-top:3px;border-radius:4px;overflow:hidden}
  #statusTop .hpFill{box-shadow:0 0 8px currentColor}
  #statusTop.has-showdown-advantage .midStat.pixel{border:0;background:#0a0e16cc;box-shadow:none;outline:1px solid var(--battle-accent-soft);border-radius:5px;color:#aeb9c7}

  #arena.pixel{margin:0 6px;border:0;box-shadow:inset 0 0 0 1px #ffffff0c,0 12px 28px #0007;padding:8px 8px 12px;min-height:394px;gap:7px;border-radius:12px;background:
    radial-gradient(ellipse at 50% 48%,var(--battle-glow),transparent 42%),
    linear-gradient(180deg,#121a25c4 0 27%,var(--battle-floor) 64%,#080b0d 100%);overflow:hidden}
  #arena:before{left:8%;right:8%;bottom:12%;height:36%;clip-path:none;border-radius:50%;background:radial-gradient(ellipse at center,var(--battle-accent-soft),transparent 66%);opacity:.26;filter:blur(1px)}
  #arena:after{background:repeating-linear-gradient(180deg,#ffffff025 0 1px,#0000 1px 4px);opacity:.18}

  .intentWrap{grid-template-columns:62px minmax(0,1fr);gap:8px;align-items:center;padding:0 3px;min-height:64px}
  .portrait{width:62px;height:62px;border:1px solid #05070b;border-radius:8px;background:linear-gradient(180deg,var(--battle-accent-soft),#111722);box-shadow:0 0 0 2px #ffffff0c inset,0 4px 12px #0008,0 0 14px var(--battle-glow)}
  .intentBox.pixel{min-height:58px;padding:7px 9px;border:0;border-left:2px solid var(--battle-accent);background:linear-gradient(90deg,#0b101bd9,#0b101b7d);box-shadow:none;border-radius:0 7px 7px 0}
  .intentTitle{font-size:8px;letter-spacing:.1em;color:var(--battle-accent)}
  .intentMain{font-size:12px;margin-top:2px;color:#f5ead9}
  .intentSub{font-size:8px;margin-top:2px;line-height:1.25;color:#aeb8c9}

  #battleScreen .arenaMeta{width:auto;margin:0 4px;gap:4px}
  #battleScreen .arenaMeta .badge{border:0;border-radius:12px;background:#080d15c9!important;box-shadow:inset 0 0 0 1px #ffffff12!important;padding:4px 7px;font-size:9px;color:#9daac0}
  #battleScreen .arenaMeta .badge b{color:#f4ead7;font-size:10px}
  #battleScreen .arenaMeta .badge:nth-child(2) b{color:var(--battle-accent)}

  #versus{min-height:142px;margin:-2px 2px 0;grid-template-columns:minmax(0,1fr) 38px minmax(0,1fr)}
  .stageCard{height:136px;min-height:136px}
  .stageInner{width:min(90px,100%);filter:drop-shadow(0 8px 8px #000b)}
  .stageLabel{top:-6px;border:0;border-radius:10px;background:#080d15e8;box-shadow:inset 0 0 0 1px #ffffff1c;color:#dbe6f2;padding:3px 7px}
  .vsText{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;font-size:10px;color:var(--battle-accent);background:#080c13;box-shadow:inset 0 0 0 1px var(--battle-accent-soft),0 0 14px var(--battle-glow);text-shadow:0 0 6px var(--battle-accent)}

  #slotRow{margin:10px 2px 0;padding:6px 4px 5px;gap:4px;border-top:1px solid var(--battle-accent-soft);background:linear-gradient(180deg,#070a0ea6,#070a0e38);border-radius:0 0 8px 8px}
  #slotRow:before{content:"SHOWDOWN";position:absolute;left:50%;top:-11px;transform:translateX(-50%);padding:1px 7px;background:var(--battle-floor);color:var(--battle-accent);font-size:7px;letter-spacing:.16em;text-shadow:1px 1px #000}
  #slotRow .slot{height:83px;border:1px dashed #ffffff20;background:#05080c85;border-radius:5px;color:#667286;font-size:8px}
  #slotRow .slot.fill{border:0;background:transparent;box-shadow:none;padding:0;overflow:visible}
  #slotRow .slot.inspecting{outline:1px solid var(--battle-accent);transform:translateY(-3px);filter:drop-shadow(0 0 6px var(--battle-glow))}
  #slotRow .slotArt{width:min(52px,calc(100% - 1px));filter:drop-shadow(0 4px 3px #0008)}
  #statuses:not(.is-empty){margin:0 4px;justify-content:center;max-height:36px}
  #statuses .stateChip{border:0;border-radius:10px;background:#0a0e16d9;box-shadow:inset 0 0 0 1px #ffffff12;font-size:8px;padding:3px 6px}
  #showdownSequence{top:53%}

  #handPanel.pixel{margin:-1px 0 0;padding:4px 6px 1px;border:0;background:linear-gradient(180deg,transparent,#080b12c9);box-shadow:none;overflow:visible;position:relative;z-index:8}
  #handPanel .panelTitle{padding:0 6px;margin:0 0 -2px;font-size:8px;color:#8794aa;text-transform:uppercase;letter-spacing:.08em}
  #handRow{min-height:142px;display:flex;justify-content:center;align-items:flex-start;gap:0;overflow:visible;padding:10px 0 0}
  #handRow .card{min-width:92px;width:92px;height:136px;margin-left:-12px;transform:translateX(var(--fan-x,0px)) translateY(var(--fan-y,0px)) rotate(var(--fan-angle,0deg));transform-origin:50% 112%;filter:drop-shadow(0 6px 5px #0009);z-index:var(--fan-z,1)}
  #handRow .card:first-child{margin-left:0}
  #handRow.has-selection .card:not(.sel){transform:translateX(var(--fan-x,0px)) translateY(calc(var(--fan-y,0px) + 5px)) rotate(var(--fan-angle,0deg));filter:brightness(.72) drop-shadow(0 5px 4px #0008)}
  #handRow .card.sel,#handRow .card.sel:hover{transform:translateX(var(--fan-x,0px)) translateY(calc(var(--fan-y,0px) - 13px)) rotate(0deg) scale(1.055);filter:drop-shadow(0 0 9px var(--battle-accent)) drop-shadow(0 8px 5px #0009);z-index:20}
  #handRow .card:active{transform:translateX(var(--fan-x,0px)) translateY(calc(var(--fan-y,0px) - 6px)) rotate(0deg) scale(1.02)}

  #inspect.pixel{margin:0 8px 7px;min-height:62px;max-height:116px;padding:7px 7px 7px 9px;border:0;border-top:1px solid var(--battle-accent-soft);background:linear-gradient(180deg,#111722f2,#090d14f7);box-shadow:0 -8px 18px #0003;grid-template-columns:minmax(0,1fr) 82px;border-radius:8px}
  #inspect.collapsed{min-height:54px;max-height:54px}
  #inspect>div{max-height:98px}
  #inspectTitle{font-size:10px;background:transparent;color:#f1e7d7;padding:0}
  #inspectDesc{font-size:8px;line-height:1.35;color:#aeb9ca}
  #inspectApply{font-size:8px}
  #termRow{gap:3px;margin-top:4px}.termBtn{border:0;border-radius:8px;background:#0b111b;box-shadow:inset 0 0 0 1px #ffffff12;font-size:7px;padding:2px 5px}
  #playBtn{position:static;min-width:82px;padding:10px 7px;border:0;border-radius:6px;background:linear-gradient(180deg,var(--battle-accent),var(--battle-accent-soft));box-shadow:inset 0 0 0 1px #ffffff45,0 4px 0 #030405;color:#fff9ec;text-shadow:1px 1px #000;font-size:11px}
  #playBtn:disabled{filter:grayscale(.7) brightness(.55);opacity:.7}
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
  function loadBattleSceneV2(doc=root.document){return appendScript(doc,'battle-scene-v2.js',BATTLE_SCENE_V2_DATASET,()=>!!root.BattleSceneV2)}
  function activeBattle(runtimeRoot=root){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
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
  function battleRegionId(runState=activeRun(root)){
    const raw=runState?.runFlow?.currentRegionId||runState?.actId||'common';
    return['region_theater','region_observatory','region_frontier','final'].includes(raw)?raw:'common';
  }
  function handFanModel(count){
    const total=Math.max(0,Number(count)||0),center=(total-1)/2;
    return Array.from({length:total},(_,index)=>{const offset=index-center;return{angle:offset*5,y:Math.abs(offset)*5,x:offset*1.5,z:10-Math.round(Math.abs(offset))}});
  }
  function syncBattlePresentation(doc=root.document,runState=activeRun(root)){
    if(!doc?.getElementById)return false;const screen=doc.getElementById('battleScreen'),handRow=doc.getElementById('handRow');
    if(screen?.dataset)screen.dataset.battleRegion=battleRegionId(runState);
    const cards=[...(handRow?.querySelectorAll?.('.card')||[])],fan=handFanModel(cards.length);
    cards.forEach((card,index)=>{const model=fan[index];card?.style?.setProperty?.('--fan-angle',`${model.angle}deg`);card?.style?.setProperty?.('--fan-y',`${model.y}px`);card?.style?.setProperty?.('--fan-x',`${model.x}px`);card?.style?.setProperty?.('--fan-z',String(model.z))});
    toggleClass(screen,'has-card-selection',!!handRow?.querySelector?.('.card.sel'));return true;
  }
  function wrapRenderBattle(runtimeRoot=root){
    const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__tricklogMobileHudM3)return true;
    function wrapped(...args){const result=original.apply(this,args);syncBattleHud(runtimeRoot.document,activeBattle(runtimeRoot));syncBattlePresentation(runtimeRoot.document,activeRun(runtimeRoot));return result}
    wrapped.__tricklogMobileHudM3=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function install(doc=root.document){
    if(!doc||typeof doc.createElement!=='function')return false;
    loadEnemyContent(doc);loadContentExpansion(doc);loadPureSynergies(doc);loadChipBuilds(doc);loadChipBuildCompendiumBridge(doc);loadCompendium(doc);loadCompendiumBridge(doc);loadBattleSceneV2(doc);wrapRenderBattle(root);syncBattleHud(doc,activeBattle(root));syncBattlePresentation(doc,activeRun(root));
    if(doc.getElementById?.(STYLE_ID))return true;
    const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=STYLE_TEXT;(doc.head||doc.documentElement)?.appendChild(style);return true;
  }

  return{STYLE_ID,ENEMY_CONTENT_DATASET,CONTENT_EXPANSION_DATASET,PURE_SYNERGY_DATASET,CHIP_BUILD_DATASET,CHIP_BUILD_COMPENDIUM_BRIDGE_DATASET,COMPENDIUM_DATASET,COMPENDIUM_BRIDGE_DATASET,BATTLE_SCENE_V2_DATASET,MOBILE_STAGE_WIDTH,MOBILE_STAGE_HEIGHT,MOBILE_SHOWDOWN_CARD_WIDTH,MOBILE_MAP_NODE_WIDTH,MOBILE_MAP_NODE_HEIGHT,MOBILE_MAP_DECK_COLUMNS,STYLE_TEXT,appendScript,loadEnemyContent,loadContentExpansion,loadPureSynergies,loadChipBuilds,loadChipBuildCompendiumBridge,loadCompendium,loadCompendiumBridge,loadBattleSceneV2,activeBattle,activeRun,battleHudState,toggleClass,syncBattleHud,battleRegionId,handFanModel,syncBattlePresentation,wrapRenderBattle,install};
});