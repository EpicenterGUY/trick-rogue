(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.BattleFeedback=api;if(typeof document!=='undefined'){api.loadRunStartV2Runtime(document,root);api.loadRuleGlossaryRuntime(document);api.loadDeveloperToolsRuntime(document,root.location);api.loadReadableFeedbackRuntime(document)}})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SHAKE_PROFILES=Object.freeze({small:Object.freeze({amplitude:1,duration:80}),normal:Object.freeze({amplitude:3,duration:110}),large:Object.freeze({amplitude:4,duration:135}),showdown:Object.freeze({amplitude:6,duration:150})});
  const RUN_START_SELECTOR='script[data-trick-run-start-v2-runtime]';
  const READABLE_FEEDBACK_SELECTOR='script[data-trick-readable-feedback]';
  function damageTier(amount){if(amount<=2)return'small';if(amount>=8)return'large';return'normal'}
  function shakeFrames(amplitude){return[{transform:'translate(0, 0)'},{transform:`translate(${-amplitude}px, ${Math.ceil(amplitude/2)}px)`},{transform:`translate(${amplitude}px, ${-Math.floor(amplitude/2)}px)`},{transform:`translate(${-Math.ceil(amplitude/2)}px, 0)`},{transform:'translate(0, 0)'}]}
  function createController({element,reducedMotion=()=>false}={}){let activeAnimation=null;function shake(tier){const profile=SHAKE_PROFILES[tier]||SHAKE_PROFILES.normal;if(activeAnimation)activeAnimation.cancel();if(!element?.animate||reducedMotion()){activeAnimation=null;return profile}activeAnimation=element.animate(shakeFrames(profile.amplitude),{duration:profile.duration,easing:'linear'});activeAnimation.finished.catch(()=>{}).finally(()=>{activeAnimation=null});return profile}return{shake,damage(amount){return shake(damageTier(amount))},cancel(){if(activeAnimation)activeAnimation.cancel();activeAnimation=null}}}
  function setStartBootHidden(doc,hidden){
    const screen=doc?.getElementById?.('startScreen');if(!screen?.style)return false;
    screen.style.visibility=hidden?'hidden':'';return true;
  }
  function installRunStartV2WhenReady(doc,runtimeRoot){
    if(!doc)return false;let attempts=0;
    const attempt=()=>{
      const start=runtimeRoot?.RunStartV2;
      if(start?.installBrowser?.(runtimeRoot)){
        start.renderStart?.(runtimeRoot);setStartBootHidden(doc,false);return true;
      }
      if(attempts++<80){const schedule=runtimeRoot?.setTimeout||setTimeout;schedule(attempt,25);return false}
      setStartBootHidden(doc,false);runtimeRoot?.console?.warn?.('[run-start-v2] 새 시작 화면 초기화가 지연되어 기본 화면을 표시합니다.');return false;
    };
    if(doc.readyState==='loading'&&typeof doc.addEventListener==='function'){doc.addEventListener('DOMContentLoaded',attempt,{once:true});return true}
    return attempt();
  }
  function loadRunStartV2Runtime(doc,runtimeRoot){
    if(!doc?.createElement)return false;
    setStartBootHidden(doc,true);installRunStartV2WhenReady(doc,runtimeRoot);
    if(runtimeRoot?.RunStartV2)return true;
    const existing=doc.querySelector?.(RUN_START_SELECTOR);
    if(existing){
      if(existing.dataset?.loaded!=='true'&&typeof existing.addEventListener==='function')existing.addEventListener('load',()=>{existing.dataset.loaded='true'},{once:true});
      return true;
    }
    const script=doc.createElement('script');script.src='run-start-v2.js';script.async=false;script.dataset.trickRunStartV2Runtime='true';
    const markLoaded=()=>{script.dataset.loaded='true'};
    if(typeof script.addEventListener==='function')script.addEventListener('load',markLoaded,{once:true});else script.onload=markLoaded;
    (doc.head||doc.documentElement)?.appendChild(script);return true;
  }
  function loadRuleGlossaryRuntime(doc){
    if(!doc?.createElement)return false;
    if(doc.querySelector?.('script[data-trick-rule-glossary-sync]'))return false;
    const script=doc.createElement('script');
    script.src='rules-glossary-sync.js';
    script.dataset.trickRuleGlossarySync='true';
    (doc.head||doc.documentElement)?.appendChild(script);
    return true;
  }
  function loadReadableFeedbackRuntime(doc){
    if(!doc?.createElement)return false;
    const load=()=>{
      if(doc.querySelector?.(READABLE_FEEDBACK_SELECTOR))return false;
      const script=doc.createElement('script');script.src='battle-readable-feedback.js';script.async=false;script.dataset.trickReadableFeedback='true';
      (doc.head||doc.documentElement)?.appendChild(script);return true;
    };
    if(doc.readyState==='loading'&&typeof doc.addEventListener==='function'){doc.addEventListener('DOMContentLoaded',load,{once:true});return true}
    return load();
  }
  function isDeveloperMode(locationLike){
    const search=typeof locationLike==='string'?locationLike:(locationLike?.search||'');
    try{return new URLSearchParams(search).get('dev')==='1'}catch(_){return false}
  }
  function loadDeveloperM2Runtime(doc,locationLike){
    if(!doc?.createElement||!isDeveloperMode(locationLike))return false;
    if(doc.querySelector?.('script[data-trick-dev-m2]'))return false;
    const script=doc.createElement('script');
    script.src='dev-m2-runtime.js';
    script.dataset.trickDevM2='true';
    (doc.head||doc.documentElement)?.appendChild(script);
    return true;
  }
  function loadDeveloperToolsRuntime(doc,locationLike){
    if(!doc?.createElement||!isDeveloperMode(locationLike))return false;
    if(doc.querySelector?.('script[data-trick-dev-tools]'))return false;
    const script=doc.createElement('script');
    script.src='dev-tools.js';
    script.dataset.trickDevTools='true';
    const loadFinal=()=>loadDeveloperM2Runtime(doc,locationLike);
    if(typeof script.addEventListener==='function')script.addEventListener('load',loadFinal,{once:true});else script.onload=loadFinal;
    (doc.head||doc.documentElement)?.appendChild(script);
    return true;
  }
  return{SHAKE_PROFILES,RUN_START_SELECTOR,READABLE_FEEDBACK_SELECTOR,damageTier,shakeFrames,createController,setStartBootHidden,installRunStartV2WhenReady,loadRunStartV2Runtime,loadRuleGlossaryRuntime,loadReadableFeedbackRuntime,isDeveloperMode,loadDeveloperM2Runtime,loadDeveloperToolsRuntime};
});
