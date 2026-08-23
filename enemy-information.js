(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.EnemyInformation=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STAGE='7.5-K';
  const STATE_KEY='enemyInformation';
  const KNOWLEDGE=Object.freeze({HIDDEN:0,PARTIAL:1,APPROXIMATE:2,EXACT:3});

  function normalizeRank(value){
    const rank=Number(value);
    return Number.isFinite(rank)?rank:null;
  }
  function strengthBand(rank){
    const value=normalizeRank(rank);
    if(value===null)return'unknown';
    if(value<=6)return'low';
    if(value<=10)return'mid';
    return'high';
  }
  function strengthLabel(rank){
    const band=strengthBand(rank);
    return band==='low'?'낮음':band==='mid'?'중간':band==='high'?'높음':'알 수 없음';
  }
  function cardSuit(card){return card?.trickSuit??card?.effectiveSuit??card?.suit??null}
  function isTrump(card,trump){return !!card&&!!trump&&cardSuit(card)===trump}
  function trumpLabel(card,trump){return isTrump(card,trump)?'트럼프':'비트럼프'}
  function partialHint(card,trump){
    if(!card)return'정보 없음';
    return`${strengthLabel(card.rank)} · ${trumpLabel(card,trump)}`;
  }
  function rankText(rank,root={}){
    try{if(typeof root?.rankLabel==='function')return String(root.rankLabel(rank))}catch{}
    if(rank===14)return'A';if(rank===13)return'K';if(rank===12)return'Q';if(rank===11)return'J';return String(rank);
  }
  function suitText(suit,root={}){
    try{if(typeof root?.suitObj==='function')return String(root.suitObj(suit)?.sym||suit)}catch{}
    return({S:'♠',H:'♥',D:'♦',C:'♣'})[suit]||String(suit||'?');
  }
  function exactText(card,root={}){
    if(!card)return'없음';
    return`${suitText(card.suit,root)}${rankText(card.rank,root)}`;
  }
  function publicIntent(card={},enemy={}){
    return Object.freeze({
      title:card.enemyIntent||enemy.intent||'행동 준비',
      detail:card.enemyIntentDetail||'',
      personality:card.enemyPersonality||enemy.personality||''
    });
  }
  function publicEnemyModel(card,trump,{exact=false,enemy={}}={}){
    if(!card)return Object.freeze({knowledge:'none',strength:'unknown',strengthLabel:'알 수 없음',isTrump:false,intent:publicIntent({},enemy)});
    const base={
      knowledge:exact?'exact':'partial',
      strength:strengthBand(card.rank),
      strengthLabel:strengthLabel(card.rank),
      isTrump:isTrump(card,trump),
      intent:publicIntent(card,enemy)
    };
    if(exact){base.suit=card.suit;base.rank=card.rank}
    return Object.freeze(base);
  }
  function ensureState(battle){
    if(!battle||typeof battle!=='object')throw new TypeError('battle state is required');
    if(!battle[STATE_KEY]||typeof battle[STATE_KEY]!=='object')battle[STATE_KEY]={currentExact:false,currentCard:null};
    const state=battle[STATE_KEY];
    if(!('currentExact'in state))state.currentExact=false;
    if(!('currentCard'in state))state.currentCard=null;
    return state;
  }
  function supportApi(root){return root?.TacticMigrationSupport||null}
  function explicitPreviewReveal(battle,root={}){
    const api=supportApi(root);
    try{return !!(api&&typeof api.isNextEnemyPreviewRevealed==='function'&&api.isNextEnemyPreviewRevealed(battle))}catch{return false}
  }
  function previewKnowledgeLevel(battle,root={}){
    if(!battle?.nextEnemyPreview)return KNOWLEDGE.HIDDEN;
    if(explicitPreviewReveal(battle,root))return KNOWLEDGE.EXACT;
    const level=Math.max(0,Math.min(3,Number(battle.enemyForecast)||0));
    return level;
  }
  function previewText(battle,root={}){
    const card=battle?.nextEnemyPreview;
    if(!card)return'없음';
    const level=previewKnowledgeLevel(battle,root);
    if(level===KNOWLEDGE.HIDDEN)return'???';
    if(level===KNOWLEDGE.PARTIAL)return partialHint(card,battle?.trump);
    if(level===KNOWLEDGE.APPROXIMATE)return`${partialHint(card,battle?.trump)} · ${rankText(card.rank,root)} 근처`;
    return exactText(card,root);
  }
  function revealCurrentEnemyCard(battle){
    const state=ensureState(battle);
    state.currentExact=!!battle?.enemyCard;
    state.currentCard=battle?.enemyCard||null;
    return battle?.enemyCard||null;
  }
  function forgetCurrentEnemyCard(battle){
    const state=ensureState(battle);state.currentExact=false;state.currentCard=battle?.enemyCard||null;return state;
  }
  function currentEnemyExact(battle){
    if(!battle?.enemyCard)return false;
    if(battle.playerStage||battle.phase==='showdown')return true;
    const state=ensureState(battle);
    return state.currentExact===true&&state.currentCard===battle.enemyCard;
  }
  function currentEnemyModel(battle){
    if(!battle)return publicEnemyModel(null,null);
    return publicEnemyModel(battle.enemyCard,battle.trump,{exact:currentEnemyExact(battle),enemy:battle.enemy});
  }
  function currentHint(battle){return partialHint(battle?.enemyCard,battle?.trump)}
  function hiddenStageHtml(battle){
    const hint=currentHint(battle).split(' · ');
    return `<div class="enemyIntelCard" aria-label="적 카드 부분 정보"><div class="enemyIntelBack">?</div><div class="enemyIntelStrength">${hint[0]||'알 수 없음'}</div><div class="enemyIntelTrump">${hint[1]||''}</div></div>`;
  }
  function publicIntentText(battle){
    const intent=publicIntent(battle?.enemyCard||{},battle?.enemy||{});
    return[intent.detail,intent.personality?`성향: ${intent.personality}`:''].filter(Boolean).join(' · ');
  }
  function activeBattle(root){
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch{}
    return null;
  }
  function installStyles(root){
    const doc=root?.document;if(!doc?.createElement||!doc?.head||doc.getElementById?.('enemy-information-style'))return false;
    const style=doc.createElement('style');style.id='enemy-information-style';
    style.textContent='.enemyIntelCard{width:min(92px,100%);aspect-ratio:92/136;border:2px solid #000;background:linear-gradient(180deg,#202b40,#101722);box-shadow:0 0 0 2px #4a5a78 inset,0 6px 0 #0008;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#e8edf7}.enemyIntelBack{width:48px;height:58px;border:2px solid #000;box-shadow:0 0 0 2px #596987 inset;display:grid;place-items:center;font-size:28px;font-weight:900;background:repeating-linear-gradient(45deg,#26344d 0 5px,#182338 5px 10px)}.enemyIntelStrength{font-size:12px;font-weight:900;color:#f4d98f}.enemyIntelTrump{font-size:10px;color:#aebbd1}';
    doc.head.appendChild(style);return true;
  }
  function installForecastAdapter(root){
    if(typeof root?.forecastText!=='function')return false;
    if(root.forecastText.__enemyInformation)return true;
    const legacy=root.forecastText;
    const wrapped=function(target){
      const battle=activeBattle(root);
      if(target==='enemy'&&battle)return previewText(battle,root);
      return legacy.apply(this,arguments);
    };
    wrapped.__enemyInformation=true;wrapped.__legacyForecastText=legacy;root.forecastText=wrapped;return true;
  }
  function installNextEnemyAdapter(root){
    if(typeof root?.nextEnemy!=='function')return false;
    if(root.nextEnemy.__enemyInformation)return true;
    const legacy=root.nextEnemy;
    const wrapped=function(){
      const battle=activeBattle(root);
      if(!battle)return legacy.apply(this,arguments);
      const preview=battle.nextEnemyPreview||null;
      const previewWasExact=!!preview&&previewKnowledgeLevel(battle,root)===KNOWLEDGE.EXACT;
      const result=legacy.apply(this,arguments);
      const state=ensureState(battle);
      state.currentCard=battle.enemyCard||null;
      state.currentExact=!!(previewWasExact&&preview&&battle.enemyCard===preview);
      return result;
    };
    wrapped.__enemyInformation=true;wrapped.__legacyNextEnemy=legacy;root.nextEnemy=wrapped;return true;
  }
  function installInspectAdapter(root){
    if(typeof root?.inspectStageCard!=='function')return true;
    if(root.inspectStageCard.__enemyInformation)return true;
    const legacy=root.inspectStageCard;
    const wrapped=function(side){
      const battle=activeBattle(root);
      if(side==='enemy'&&battle&&!currentEnemyExact(battle))return false;
      return legacy.apply(this,arguments);
    };
    wrapped.__enemyInformation=true;wrapped.__legacyInspectStageCard=legacy;root.inspectStageCard=wrapped;return true;
  }
  function installRenderAdapter(root){
    if(typeof root?.renderBattle!=='function')return false;
    if(root.renderBattle.__enemyInformation)return true;
    const legacy=root.renderBattle;
    const wrapped=function(){
      const result=legacy.apply(this,arguments),battle=activeBattle(root),doc=root?.document;
      if(!battle||!doc?.getElementById)return result;
      installStyles(root);
      const stage=doc.getElementById('enemyStage');
      const intentSub=doc.getElementById('intentSub');
      const forecast=doc.getElementById('enemyForecast');
      const exact=currentEnemyExact(battle);
      if(stage){
        stage.dataset.enemyInformation=exact?'exact':'partial';
        if(!exact){stage.className='stageCard show';stage.innerHTML=hiddenStageHtml(battle);stage.onclick=null;stage.style.cursor='default'}
      }
      if(intentSub)intentSub.textContent=publicIntentText(battle);
      if(forecast)forecast.textContent=previewText(battle,root);
      return result;
    };
    wrapped.__enemyInformation=true;wrapped.__legacyRenderBattle=legacy;root.renderBattle=wrapped;return true;
  }
  function installBrowserRuntime(root){
    const installed=[installForecastAdapter,installNextEnemyAdapter,installInspectAdapter,installRenderAdapter].every(fn=>fn(root));
    if(installed)installStyles(root);
    return installed;
  }
  function installWhenReady(root){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{if(installBrowserRuntime(root))return;attempts++;if(attempts<40)setTimeout(attempt,25);else console.warn('[enemy-information] 적 정보 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);
    return true;
  }
  return{
    STAGE,STATE_KEY,KNOWLEDGE,normalizeRank,strengthBand,strengthLabel,cardSuit,isTrump,trumpLabel,partialHint,rankText,suitText,exactText,
    publicIntent,publicEnemyModel,ensureState,explicitPreviewReveal,previewKnowledgeLevel,previewText,revealCurrentEnemyCard,forgetCurrentEnemyCard,
    currentEnemyExact,currentEnemyModel,currentHint,hiddenStageHtml,publicIntentText,activeBattle,installStyles,installForecastAdapter,installNextEnemyAdapter,
    installInspectAdapter,installRenderAdapter,installBrowserRuntime,installWhenReady
  };
});