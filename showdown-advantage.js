(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.ShowdownAdvantage=api;
    api.installBrowser(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='7.5-P';
  const ADVANTAGE_MULTIPLIER=1.25;

  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }

  function ensureAdvantageState(state){
    if(!state||typeof state!=='object')return null;
    if(!state.advantageState||typeof state.advantageState!=='object'){
      state.advantageState={player:false,enemy:false,playerSource:null,enemySource:null,grantedSet:null};
    }
    return state.advantageState;
  }

  function grantAdvantage(state,side='player',{source='effect'}={}){
    if(side!=='player'&&side!=='enemy')throw new TypeError(`Unknown advantage side: ${side}`);
    const advantage=ensureAdvantageState(state);
    if(!advantage)throw new TypeError('A battle state is required to grant advantage');
    advantage[side]=true;
    advantage[`${side}Source`]=source||'effect';
    advantage.grantedSet=state?.setIndex??state?.set??1;
    return advantage;
  }

  function hasAdvantage(state,side='player'){
    if(side!=='player'&&side!=='enemy')return false;
    return ensureAdvantageState(state)?.[side]===true;
  }

  function hasAnyAdvantage(state){return hasAdvantage(state,'player')||hasAdvantage(state,'enemy')}

  function consumeAdvantage(state){
    const advantage=ensureAdvantageState(state);
    if(!advantage)return null;
    advantage.player=false;
    advantage.enemy=false;
    advantage.playerSource=null;
    advantage.enemySource=null;
    advantage.grantedSet=null;
    return advantage;
  }

  function snapshot(state){
    const advantage=ensureAdvantageState(state)||{};
    const playerActive=advantage.player===true,enemyActive=advantage.enemy===true;
    return{
      mode:'explicit',
      automaticSuitComparison:false,
      multiplier:ADVANTAGE_MULTIPLIER,
      playerActive,
      enemyActive,
      playerSource:playerActive?advantage.playerSource:null,
      enemySource:enemyActive?advantage.enemySource:null
    };
  }

  function resolveExplicitShowdownAdvantage(_cards,state){return snapshot(state)}

  function scalePower(value,multiplier=ADVANTAGE_MULTIPLIER){
    const numeric=Number(value);
    if(!Number.isFinite(numeric))return value;
    return Math.round(numeric*multiplier);
  }

  function applyExplicitShowdownAdvantage(playerPower,enemyPower,advantage={}){
    const multiplier=Number(advantage.multiplier)||ADVANTAGE_MULTIPLIER;
    return{
      playerPower:advantage.playerActive?scalePower(playerPower,multiplier):playerPower,
      enemyPower:advantage.enemyActive?scalePower(enemyPower,multiplier):enemyPower
    };
  }

  function formatAdvantage(advantage){
    const parts=[];
    if(advantage?.playerActive)parts.push(`나 +${Math.round(((advantage.multiplier||ADVANTAGE_MULTIPLIER)-1)*100)}%`);
    if(advantage?.enemyActive)parts.push(`적 +${Math.round(((advantage.multiplier||ADVANTAGE_MULTIPLIER)-1)*100)}%`);
    return parts.join(' / ');
  }

  function patchShowdownTrace(state,advantage){
    if(!state||!Array.isArray(state.showdownTrace))return [];
    const filtered=state.showdownTrace.filter(line=>!/^플레이어 우세:|^적 우세:|^우세:/.test(String(line)));
    const advantageLines=[];
    if(advantage?.playerActive)advantageLines.push('우세: 플레이어 추가 배율 +25%');
    if(advantage?.enemyActive)advantageLines.push('우세: 적 추가 배율 +25%');
    const multiplierIndex=filtered.findIndex(line=>String(line).startsWith('배율:'));
    const finalIndex=filtered.findIndex(line=>String(line).startsWith('최종 위력:'));
    const insertAt=multiplierIndex>=0?multiplierIndex:(finalIndex<0?filtered.length:finalIndex);
    filtered.splice(insertAt,0,...advantageLines);
    state.showdownTrace=filtered;
    return filtered;
  }

  function wrapBattleCore(runtimeRoot=defaultRoot){
    const core=runtimeRoot?.BattleCore;
    if(!core||core.__tricklogExplicitAdvantage75P)return false;
    core.resolveShowdownAdvantage=function(){return snapshot(activeBattle(runtimeRoot));};
    core.showdownAdvantageBonus=function(){return 0};
    core.applyShowdownAdvantage=function(playerPower,enemyPower){return{playerPower,enemyPower};};
    try{delete core.SHOWDOWN_ADVANTAGE_POWER}catch(_error){}
    core.SHOWDOWN_ADVANTAGE_MULTIPLIER=ADVANTAGE_MULTIPLIER;
    core.__tricklogExplicitAdvantage75P=true;
    return true;
  }

  function wrapRunCardEffects(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.runCardEffects;
    if(typeof original!=='function'||original.__tricklogExplicitAdvantage75P)return false;
    function wrapped(trigger){
      const state=activeBattle(runtimeRoot),currentSet=state?.setIndex??state?.set??1,advantage=ensureAdvantageState(state);
      if(trigger==='on_set_start'&&advantage&&hasAnyAdvantage(state)&&advantage.grantedSet!==currentSet)consumeAdvantage(state);
      return original.apply(this,arguments);
    }
    wrapped.__tricklogExplicitAdvantage75P=true;
    wrapped.__original=original;
    runtimeRoot.runCardEffects=wrapped;
    return true;
  }

  function syncAdvantageHud(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;
    const edge=doc?.getElementById?.('edgeText');
    if(!edge)return false;
    const state=activeBattle(runtimeRoot),advantage=snapshot(state),visible=hasAnyAdvantage(state);
    edge.textContent=visible?formatAdvantage(advantage):'';
    const panel=edge.parentElement;
    if(panel?.style)panel.style.display=visible?'':'none';
    if(panel?.childNodes){
      const textNode=Array.from(panel.childNodes).find(node=>node?.nodeType===3);
      if(textNode&&visible)textNode.nodeValue='우세';
    }
    return visible;
  }

  function wrapRenderBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.renderBattle;
    if(typeof original!=='function'||original.__tricklogExplicitAdvantage75P)return false;
    function wrapped(){const result=original.apply(this,arguments);syncAdvantageHud(runtimeRoot);return result}
    wrapped.__tricklogExplicitAdvantage75P=true;
    wrapped.__original=original;
    runtimeRoot.renderBattle=wrapped;
    return true;
  }

  function wrapAdvantageText(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.advantageText;
    if(typeof original!=='function'||original.__tricklogExplicitAdvantage75P)return false;
    function wrapped(advantage){return formatAdvantage(advantage||snapshot(activeBattle(runtimeRoot)))}
    wrapped.__tricklogExplicitAdvantage75P=true;
    wrapped.__original=original;
    runtimeRoot.advantageText=wrapped;
    return true;
  }

  function wrapShowdownStep(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.showShowdownStep;
    if(typeof original!=='function'||original.__tricklogExplicitAdvantage75P)return false;
    function wrapped(title,body,kind){
      if(title==='우세 판정'){
        const advantage=snapshot(activeBattle(runtimeRoot));
        if(!advantage.playerActive&&!advantage.enemyActive)return null;
        return original.call(this,'우세',formatAdvantage(advantage),kind||'advantage');
      }
      return original.apply(this,arguments);
    }
    wrapped.__tricklogExplicitAdvantage75P=true;
    wrapped.__original=original;
    runtimeRoot.showShowdownStep=wrapped;
    return true;
  }

  function wrapAnimateShowdownSequence(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.animateShowdownSequence;
    if(typeof original!=='function'||original.__tricklogExplicitAdvantage75P)return false;
    async function wrapped(p,advantage){patchShowdownTrace(activeBattle(runtimeRoot),advantage);return original.apply(this,arguments)}
    wrapped.__tricklogExplicitAdvantage75P=true;
    wrapped.__original=original;
    runtimeRoot.animateShowdownSequence=wrapped;
    return true;
  }

  function installBrowser(runtimeRoot=defaultRoot){
    const installed={
      battleCore:wrapBattleCore(runtimeRoot),
      runCardEffects:wrapRunCardEffects(runtimeRoot),
      renderBattle:wrapRenderBattle(runtimeRoot),
      advantageText:wrapAdvantageText(runtimeRoot),
      showdownStep:wrapShowdownStep(runtimeRoot),
      showdownAnimation:wrapAnimateShowdownSequence(runtimeRoot)
    };
    syncAdvantageHud(runtimeRoot);
    return installed;
  }

  return{
    STAGE,ADVANTAGE_MULTIPLIER,
    activeBattle,ensureAdvantageState,grantAdvantage,hasAdvantage,hasAnyAdvantage,consumeAdvantage,
    snapshot,resolveExplicitShowdownAdvantage,scalePower,applyExplicitShowdownAdvantage,formatAdvantage,patchShowdownTrace,
    wrapBattleCore,wrapRunCardEffects,syncAdvantageHud,wrapRenderBattle,wrapAdvantageText,wrapShowdownStep,wrapAnimateShowdownSequence,installBrowser
  };
});
