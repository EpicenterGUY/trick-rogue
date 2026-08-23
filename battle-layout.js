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
  const COMPENDIUM_DATASET='trick-compendium-8-h';
  const COMPENDIUM_BRIDGE_DATASET='trick-compendium-8-h-runtime-bridge';
  const MOBILE_STAGE_WIDTH=92;
  const MOBILE_STAGE_HEIGHT=140;
  const MOBILE_SHOWDOWN_CARD_WIDTH=56;
  const STYLE_TEXT=`
@media (max-width:899px){
  #versus{min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageCard{height:${MOBILE_STAGE_HEIGHT}px;min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageInner{width:min(${MOBILE_STAGE_WIDTH}px,100%)}
  #slotRow .slot.fill{padding:1px}
  #slotRow .slotArt{width:min(${MOBILE_SHOWDOWN_CARD_WIDTH}px,calc(100% - 2px));height:auto;aspect-ratio:100/148;margin:0 auto}
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
  function loadCompendium(doc=root.document){return appendScript(doc,'compendium-8-h.js',COMPENDIUM_DATASET,()=>!!root.Compendium8H)}
  function loadCompendiumBridge(doc=root.document){return appendScript(doc,'compendium-8-h-runtime-bridge.js',COMPENDIUM_BRIDGE_DATASET,()=>!!root.Compendium8HRuntimeBridge)}
  function install(doc=root.document){
    if(!doc||typeof doc.createElement!=='function')return false;
    loadEnemyContent(doc);loadContentExpansion(doc);loadPureSynergies(doc);loadChipBuilds(doc);loadCompendium(doc);loadCompendiumBridge(doc);
    if(doc.getElementById?.(STYLE_ID))return true;
    const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=STYLE_TEXT;(doc.head||doc.documentElement)?.appendChild(style);return true;
  }

  return{STYLE_ID,ENEMY_CONTENT_DATASET,CONTENT_EXPANSION_DATASET,PURE_SYNERGY_DATASET,CHIP_BUILD_DATASET,COMPENDIUM_DATASET,COMPENDIUM_BRIDGE_DATASET,MOBILE_STAGE_WIDTH,MOBILE_STAGE_HEIGHT,MOBILE_SHOWDOWN_CARD_WIDTH,STYLE_TEXT,appendScript,loadEnemyContent,loadContentExpansion,loadPureSynergies,loadChipBuilds,loadCompendium,loadCompendiumBridge,install};
});