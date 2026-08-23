(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.BattleLayout=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STYLE_ID='trick-battle-layout-fixes';
  const ENEMY_CONTENT_DATASET='trick-enemy-content-9-b';
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

  function loadEnemyContent(doc=root.document){
    if(root.EnemyContent9B)return true;
    if(!doc||typeof doc.createElement!=='function')return false;
    const existing=doc.querySelector?.(`script[data-${ENEMY_CONTENT_DATASET}]`);
    if(existing)return true;
    const script=doc.createElement('script');script.src='enemy-content-9-b.js';script.async=false;script.setAttribute(`data-${ENEMY_CONTENT_DATASET}`,'true');(doc.head||doc.documentElement)?.appendChild(script);return true;
  }
  function install(doc=root.document){
    if(!doc||typeof doc.createElement!=='function')return false;
    loadEnemyContent(doc);
    if(doc.getElementById?.(STYLE_ID))return true;
    const style=doc.createElement('style');
    style.id=STYLE_ID;
    style.textContent=STYLE_TEXT;
    (doc.head||doc.documentElement)?.appendChild(style);
    return true;
  }

  return{STYLE_ID,ENEMY_CONTENT_DATASET,MOBILE_STAGE_WIDTH,MOBILE_STAGE_HEIGHT,MOBILE_SHOWDOWN_CARD_WIDTH,STYLE_TEXT,loadEnemyContent,install};
});
