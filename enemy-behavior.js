(function(root){
  if(typeof module!=='undefined'){
    module.exports=require('./enemy-behavior-core.js');
    return;
  }
  if(typeof document==='undefined')return;
  function loadScript(src,datasetKey,onload){
    const selector=`script[data-${datasetKey}]`;
    const existing=document.querySelector(selector);
    if(existing){
      if(typeof onload==='function'){
        if(existing.dataset.loaded==='true')onload();else existing.addEventListener('load',onload,{once:true});
      }
      return existing;
    }
    const script=document.createElement('script');
    script.src=src;script.async=false;script.setAttribute(`data-${datasetKey}`,'true');
    script.addEventListener('load',()=>{script.dataset.loaded='true';if(typeof onload==='function')onload()},{once:true});
    document.head.appendChild(script);return script;
  }
  function loadEncounterRules(){
    if(root.EncounterRules)return;
    loadScript('encounter-rules.js','trick-encounter-rules-runtime');
  }
  if(root.EnemyBehavior)loadEncounterRules();
  else loadScript('enemy-behavior-core.js','trick-enemy-behavior-core',loadEncounterRules);
})(typeof globalThis!=='undefined'?globalThis:this);