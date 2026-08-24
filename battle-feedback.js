(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.BattleFeedback=api;if(typeof document!=='undefined')api.loadRuleGlossaryRuntime(document)})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SHAKE_PROFILES=Object.freeze({small:Object.freeze({amplitude:1,duration:80}),normal:Object.freeze({amplitude:3,duration:110}),large:Object.freeze({amplitude:4,duration:135}),showdown:Object.freeze({amplitude:6,duration:150})});
  function damageTier(amount){if(amount<=2)return'small';if(amount>=8)return'large';return'normal'}
  function shakeFrames(amplitude){return[{transform:'translate(0, 0)'},{transform:`translate(${-amplitude}px, ${Math.ceil(amplitude/2)}px)`},{transform:`translate(${amplitude}px, ${-Math.floor(amplitude/2)}px)`},{transform:`translate(${-Math.ceil(amplitude/2)}px, 0)`},{transform:'translate(0, 0)'}]}
  function createController({element,reducedMotion=()=>false}={}){let activeAnimation=null;function shake(tier){const profile=SHAKE_PROFILES[tier]||SHAKE_PROFILES.normal;if(activeAnimation)activeAnimation.cancel();if(!element?.animate||reducedMotion()){activeAnimation=null;return profile}activeAnimation=element.animate(shakeFrames(profile.amplitude),{duration:profile.duration,easing:'linear'});activeAnimation.finished.catch(()=>{}).finally(()=>{activeAnimation=null});return profile}return{shake,damage(amount){return shake(damageTier(amount))},cancel(){if(activeAnimation)activeAnimation.cancel();activeAnimation=null}}}
  function loadRuleGlossaryRuntime(doc){
    if(!doc?.createElement)return false;
    if(doc.querySelector?.('script[data-trick-rule-glossary-sync]'))return false;
    const script=doc.createElement('script');
    script.src='rules-glossary-sync.js';
    script.dataset.trickRuleGlossarySync='true';
    (doc.head||doc.documentElement)?.appendChild(script);
    return true;
  }
  return{SHAKE_PROFILES,damageTier,shakeFrames,createController,loadRuleGlossaryRuntime};
});
