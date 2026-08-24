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
@media (max-width:899px){
  #versus{min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageCard{height:${MOBILE_STAGE_HEIGHT}px;min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageInner{width:min(${MOBILE_STAGE_WIDTH}px,100%)}
  #slotRow .slot.fill{padding:1px}
  #slotRow .slotArt{width:min(${MOBILE_SHOWDOWN_CARD_WIDTH}px,calc(100% - 2px));height:auto;aspect-ratio:100/148;margin:0 auto}

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
  #mapWrap{margin:4px 8px 0;height:min(44dvh,360px);min-height:280px;max-height:360px;padding:8px}
  #mapGrid .node{width:${MOBILE_MAP_NODE_WIDTH}px;height:${MOBILE_MAP_NODE_HEIGHT}px;margin-left:3px;margin-top:3px}
  #mapGrid .node .icon{font-size:16px}
  #mapGrid .node .nm{font-size:9px}
  #mapGrid .node.current{opacity:1;filter:none;background:linear-gradient(180deg,#2d4557,#1b2b38)}
  #mapGrid .node.lock{opacity:.16;filter:grayscale(1) brightness(.72)}
  #mapGrid .node.done{opacity:.32;filter:saturate(.35)}
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
  function install(doc=root.document){
    if(!doc||typeof doc.createElement!=='function')return false;
    loadEnemyContent(doc);loadContentExpansion(doc);loadPureSynergies(doc);loadChipBuilds(doc);loadChipBuildCompendiumBridge(doc);loadCompendium(doc);loadCompendiumBridge(doc);
    if(doc.getElementById?.(STYLE_ID))return true;
    const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=STYLE_TEXT;(doc.head||doc.documentElement)?.appendChild(style);return true;
  }

  return{STYLE_ID,ENEMY_CONTENT_DATASET,CONTENT_EXPANSION_DATASET,PURE_SYNERGY_DATASET,CHIP_BUILD_DATASET,CHIP_BUILD_COMPENDIUM_BRIDGE_DATASET,COMPENDIUM_DATASET,COMPENDIUM_BRIDGE_DATASET,MOBILE_STAGE_WIDTH,MOBILE_STAGE_HEIGHT,MOBILE_SHOWDOWN_CARD_WIDTH,MOBILE_MAP_NODE_WIDTH,MOBILE_MAP_NODE_HEIGHT,MOBILE_MAP_DECK_COLUMNS,STYLE_TEXT,appendScript,loadEnemyContent,loadContentExpansion,loadPureSynergies,loadChipBuilds,loadChipBuildCompendiumBridge,loadCompendium,loadCompendiumBridge,install};
});