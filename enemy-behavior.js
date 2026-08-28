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

  function finishEntry(entry){
    if(entry?.after==='relic_reward_wrap')root.RelicSystem?.wrapShowReward?.(root);
  }

  function loadRuntimeChain(entries,index=0){
    const entry=entries?.[index];
    if(!entry)return;
    const next=()=>{finishEntry(entry);loadRuntimeChain(entries,index+1)};
    if(root[entry.globalName]){next();return}
    loadScript(entry.src,entry.dataset,next);
  }

  function startRuntimeChain(){
    const chain=root.RuntimeLoaderChain;
    if(!chain?.ENTRIES)return;
    const errors=chain.validate?.(chain.ENTRIES)||[];
    if(errors.length){console.error?.('[runtime-loader-chain]',errors);return}
    loadRuntimeChain(chain.ENTRIES,0);
  }

  if(root.RuntimeLoaderChain)startRuntimeChain();
  else loadScript('runtime-loader-chain.js','trick-runtime-loader-chain',startRuntimeChain);
})(typeof globalThis!=='undefined'?globalThis:this);
