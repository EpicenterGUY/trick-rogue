(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.EnemyBehavior=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUITS=Object.freeze(['S','H','D','C']);
  const PROFILES=Object.freeze({
    battle:Object.freeze({
      id:'raider',
      label:'폐허 약탈자',
      patterns:Object.freeze([
        Object.freeze({id:'high_pressure',weight:55,minRank:8,maxRank:14,intent:'고랭크 압박',detail:'높은 숫자를 우선해 정면 승부를 건다.'}),
        Object.freeze({id:'wild_card',weight:45,minRank:2,maxRank:14,intent:'변칙 투입',detail:'낮은 숫자부터 높은 숫자까지 넓게 섞는다.'})
      ])
    }),
    elite:Object.freeze({
      id:'armored_hunter',
      label:'철갑 사냥꾼',
      patterns:Object.freeze([
        Object.freeze({id:'steady_hunt',weight:100,minRank:6,maxRank:14,intent:'정밀 추격',detail:'중간 이상 숫자를 안정적으로 이어 낸다.'})
      ])
    }),
    boss:Object.freeze({
      id:'tower_watcher',
      label:'탑의 감시자',
      patterns:Object.freeze([
        Object.freeze({id:'watcher_pressure',weight:100,minRank:6,maxRank:14,intent:'감시 압박',detail:'중간 이상 숫자로 꾸준히 압박한다.'})
      ])
    })
  });
  let installed=false;
  let originalGenEnemyCard=null;
  let originalNextEnemy=null;

  function clampRandom(value){
    const number=Number(value);
    if(!Number.isFinite(number))return 0;
    return Math.max(0,Math.min(0.999999999999,number));
  }
  function randomUnit(random=Math.random){return clampRandom(random())}
  function randomInt(min,max,random=Math.random){
    if(!Number.isInteger(min)||!Number.isInteger(max)||min>max)throw new TypeError('invalid integer range');
    return min+Math.floor(randomUnit(random)*(max-min+1));
  }
  function weightedPattern(patterns,random=Math.random){
    if(!Array.isArray(patterns)||!patterns.length)throw new TypeError('enemy profile requires patterns');
    const total=patterns.reduce((sum,pattern)=>sum+Math.max(0,Number(pattern.weight)||0),0);
    if(total<=0)throw new TypeError('enemy pattern weights must total above zero');
    let cursor=randomUnit(random)*total;
    for(const pattern of patterns){
      cursor-=Math.max(0,Number(pattern.weight)||0);
      if(cursor<0)return pattern;
    }
    return patterns[patterns.length-1];
  }
  function profileFor(type){return PROFILES[type]||PROFILES.battle}
  function validateProfiles(profiles=PROFILES){
    const errors=[];
    for(const [type,profile] of Object.entries(profiles)){
      if(!profile?.id)errors.push(`${type}: missing id`);
      if(!Array.isArray(profile?.patterns)||!profile.patterns.length){errors.push(`${type}: missing patterns`);continue}
      for(const pattern of profile.patterns){
        if(!pattern.id)errors.push(`${type}: pattern missing id`);
        if(!(Number(pattern.weight)>0))errors.push(`${type}/${pattern.id}: invalid weight`);
        if(!Number.isInteger(pattern.minRank)||!Number.isInteger(pattern.maxRank)||pattern.minRank<2||pattern.maxRank>14||pattern.minRank>pattern.maxRank)errors.push(`${type}/${pattern.id}: invalid rank range`);
        if(!pattern.intent)errors.push(`${type}/${pattern.id}: missing intent`);
      }
    }
    return errors;
  }
  function chooseEnemyPlay(type,context={},random=Math.random){
    const profile=profileFor(type),pattern=weightedPattern(profile.patterns,random);
    const rank=randomInt(pattern.minRank,pattern.maxRank,random);
    const suit=SUITS[randomInt(0,SUITS.length-1,random)];
    const card={suit,rank,enemyBehaviorId:pattern.id,enemyProfileId:profile.id,enemyIntent:pattern.intent,enemyIntentDetail:pattern.detail||''};
    return Object.freeze({profileId:profile.id,patternId:pattern.id,card,intent:Object.freeze({title:pattern.intent,detail:pattern.detail||''}),context:Object.freeze({...context})});
  }
  function activeBattle(root){
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return null;
  }
  function battleType(state){return state?.type||state?.node?.type||'battle'}
  function battleContext(state){return{setIndex:state?.setIndex??1,trick:state?.trick??1,trump:state?.trump??null}}
  function applyIntent(state,card){
    if(!state?.enemy||!card)return false;
    if(card.enemyIntent)state.enemy.intent=card.enemyIntent;
    if(card.enemyIntentDetail)state.enemy.sub=card.enemyIntentDetail;
    return !!card.enemyIntent;
  }
  function installBrowserRuntime(root){
    if(installed)return true;
    if(typeof root?.genEnemyCard!=='function'||typeof root?.nextEnemy!=='function')return false;
    originalGenEnemyCard=root.genEnemyCard;
    originalNextEnemy=root.nextEnemy;
    const wrappedGen=function(){
      const state=activeBattle(root);
      if(!state)return originalGenEnemyCard.apply(this,arguments);
      return chooseEnemyPlay(battleType(state),battleContext(state),Math.random).card;
    };
    wrappedGen.__enemyBehaviorAdapter=true;
    wrappedGen.__legacyGenEnemyCard=originalGenEnemyCard;
    root.genEnemyCard=wrappedGen;
    const wrappedNext=function(){
      const result=originalNextEnemy.apply(this,arguments);
      const state=activeBattle(root);
      if(state)applyIntent(state,state.enemyCard);
      return result;
    };
    wrappedNext.__enemyBehaviorAdapter=true;
    wrappedNext.__legacyNextEnemy=originalNextEnemy;
    root.nextEnemy=wrappedNext;
    installed=true;
    return true;
  }
  function installWhenReady(root){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{
      if(installBrowserRuntime(root))return;
      attempts++;
      if(attempts<40)setTimeout(attempt,25);else console.warn('[enemy-behavior] 적 전투 런타임을 찾지 못했습니다.');
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);
    return true;
  }
  return{SUITS,PROFILES,clampRandom,randomUnit,randomInt,weightedPattern,profileFor,validateProfiles,chooseEnemyPlay,activeBattle,battleType,battleContext,applyIntent,installBrowserRuntime,installWhenReady};
});