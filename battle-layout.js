(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.BattleLayout=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STYLE_ID='trick-battle-layout-fixes';
  const MOBILE_STAGE_WIDTH=92;
  const MOBILE_STAGE_HEIGHT=140;
  const STYLE_TEXT=`
@media (max-width:899px){
  #versus{min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageCard{height:${MOBILE_STAGE_HEIGHT}px;min-height:${MOBILE_STAGE_HEIGHT}px}
  .stageInner{width:min(${MOBILE_STAGE_WIDTH}px,100%)}
}
`;

  function install(doc=root.document){
    if(!doc||typeof doc.createElement!=='function')return false;
    if(doc.getElementById?.(STYLE_ID))return true;
    const style=doc.createElement('style');
    style.id=STYLE_ID;
    style.textContent=STYLE_TEXT;
    (doc.head||doc.documentElement)?.appendChild(style);
    return true;
  }

  return{STYLE_ID,MOBILE_STAGE_WIDTH,MOBILE_STAGE_HEIGHT,STYLE_TEXT,install};
});
