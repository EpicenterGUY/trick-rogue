(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.EnemyBehavior=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUITS=Object.freeze(['S','H','D','C']);
  const SUIT_POLICIES=Object.freeze(['random','prefer_trump','trump','contest_player','build_enemy']);
  const WEIGHT_CONDITIONS=Object.freeze(['early_trick','late_trick','enemy_behind','enemy_ahead','player_suit_lead','enemy_suit_lead','has_trump']);
  const PROFILES=Object.freeze({
    battle:Object.freeze({
      id:'raider',
      label:'폐허 약탈자',
      patterns:Object.freeze([
        Object.freeze({
          id:'high_pressure',weight:55,minRank:8,maxRank:14,intent:'고랭크 압박',detail:'높은 숫자를 우선해 정면 승부를 건다.',
          suitPolicy:'prefer_trump',suitChance:35,
          weightAdjustments:Object.freeze([
            Object.freeze({when:'late_trick',add:20}),
            Object.freeze({when:'enemy_behind',add:15})
          ])
        }),
        Object.freeze({
          id:'wild_card',weight:45,minRank:2,maxRank:14,intent:'변칙 투입',detail:'낮은 숫자부터 높은 숫자까지 넓게 섞으며 플레이어의 무늬 쏠림을 견제한다.',
          suitPolicy:'contest_player',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'early_trick',add:10}),
            Object.freeze({when:'player_suit_lead',add:10})
          ])
        })
      ])
    }),
    elite:Object.freeze({
      id:'armored_hunter',
      label:'철갑 사냥꾼',
      patterns:Object.freeze([
        Object.freeze({
          id:'steady_hunt',weight:60,minRank:6,maxRank:14,intent:'정밀 추격',detail:'중간 이상 숫자를 유지하면서 플레이어가 쌓는 무늬를 따라붙는다.',
          suitPolicy:'contest_player',
          weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25})])
        }),
        Object.freeze({
          id:'trump_hunt',weight:40,minRank:6,maxRank:14,intent:'트럼프 압박',detail:'현재 트럼프를 이용해 트릭 주도권을 노린다.',
          suitPolicy:'trump',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'late_trick',add:20}),
            Object.freeze({when:'enemy_behind',add:15})
          ])
        })
      ])
    }),
    boss:Object.freeze({
      id:'tower_watcher',
      label:'탑의 감시자',
      patterns:Object.freeze([
        Object.freeze({
          id:'watcher_pressure',weight:50,minRank:6,maxRank:14,intent:'감시 압박',detail:'현재 트럼프를 의식하면서 중간 이상 숫자로 압박한다.',
          suitPolicy:'prefer_trump',suitChance:65,
          weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:20})])
        }),
        Object.freeze({
          id:'suit_denial',weight:50,minRank:6,maxRank:14,intent:'무늬 차단',detail:'플레이어가 쇼다운용으로 몰아가는 무늬를 따라가 우세 형성을 방해한다.',
          suitPolicy:'contest_player',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'player_suit_lead',add:30}),
            Object.freeze({when:'late_trick',add:15})
          ])
        })
      ])
    })
  });
  let installed=false;
  let originalGenEnemyCard=null;
  let originalNextEnemy=null;
  let generationPlan=null;

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
  function emptySuitCounts(){return Object.fromEntries(SUITS.map(suit=>[suit,0]))}
  function showdownSuit(entry){
    const card=entry?.card||entry;
    return card?.showdownSuit??card?.printedSuit??card?.suit??null;
  }
  function countSuits(entries=[]){
    const counts=emptySuitCounts();
    if(!Array.isArray(entries))return counts;
    for(const entry of entries){const suit=showdownSuit(entry);if(SUITS.includes(suit))counts[suit]++}
    return counts;
  }
  function normalizeSuitCounts(value){
    const counts=emptySuitCounts();
    if(value&&typeof value==='object')for(const suit of SUITS)counts[suit]=Math.max(0,Number(value[suit])||0);
    return counts;
  }
  function normalizedHistory(value={}){
    return{
      wins:Math.max(0,Number(value?.wins)||0),
      losses:Math.max(0,Number(value?.losses)||0),
      draws:Math.max(0,Number(value?.draws)||0),
      lastResult:value?.lastResult||null,
      winStreak:Math.max(0,Number(value?.winStreak)||0),
      lossStreak:Math.max(0,Number(value?.lossStreak)||0)
    };
  }
  function normalizeContext(context={}){
    const trick=Number.isInteger(context.trick)&&context.trick>=1&&context.trick<=5?context.trick:1;
    const setIndex=Number.isInteger(context.setIndex)&&context.setIndex>=1?context.setIndex:1;
    const playerSuitCounts=normalizeSuitCounts(context.playerSuitCounts||countSuits(context.playerSlots));
    const enemySuitCounts=normalizeSuitCounts(context.enemySuitCounts||countSuits(context.enemySlots));
    return{
      ...context,
      setIndex,
      trick,
      trump:SUITS.includes(context.trump)?context.trump:null,
      playerSuitCounts,
      enemySuitCounts,
      setHistory:normalizedHistory(context.setHistory)
    };
  }
  function suitLead(context,side='player'){
    const c=normalizeContext(context),left=side==='enemy'?c.enemySuitCounts:c.playerSuitCounts,right=side==='enemy'?c.playerSuitCounts:c.enemySuitCounts;
    return Math.max(...SUITS.map(suit=>left[suit]-right[suit]));
  }
  function conditionMet(condition,context={}){
    const c=normalizeContext(context),history=c.setHistory;
    if(condition==='early_trick')return c.trick<=2;
    if(condition==='late_trick')return c.trick>=4;
    if(condition==='enemy_behind')return history.wins>history.losses;
    if(condition==='enemy_ahead')return history.losses>history.wins;
    if(condition==='player_suit_lead')return suitLead(c,'player')>=1;
    if(condition==='enemy_suit_lead')return suitLead(c,'enemy')>=1;
    if(condition==='has_trump')return SUITS.includes(c.trump);
    return false;
  }
  function tacticalWeight(pattern,context={}){
    let weight=Math.max(0,Number(pattern?.weight)||0);
    for(const adjustment of pattern?.weightAdjustments||[]){
      if(!conditionMet(adjustment.when,context))continue;
      if(Number.isFinite(Number(adjustment.multiply)))weight*=Number(adjustment.multiply);
      if(Number.isFinite(Number(adjustment.add)))weight+=Number(adjustment.add);
    }
    return Math.max(0,weight);
  }
  function patternWeightTable(patterns,context={}){
    if(!Array.isArray(patterns))return[];
    return patterns.map(pattern=>Object.freeze({id:pattern.id,baseWeight:Number(pattern.weight)||0,effectiveWeight:tacticalWeight(pattern,context)}));
  }
  function weightedPattern(patterns,random=Math.random,context={}){
    if(!Array.isArray(patterns)||!patterns.length)throw new TypeError('enemy profile requires patterns');
    const weights=patterns.map(pattern=>tacticalWeight(pattern,context));
    const total=weights.reduce((sum,weight)=>sum+weight,0);
    if(total<=0)throw new TypeError('enemy pattern weights must total above zero');
    let cursor=randomUnit(random)*total;
    for(let index=0;index<patterns.length;index++){
      cursor-=weights[index];
      if(cursor<0)return patterns[index];
    }
    return patterns[patterns.length-1];
  }
  function leadingSuits(context,side='player'){
    const c=normalizeContext(context),left=side==='enemy'?c.enemySuitCounts:c.playerSuitCounts,right=side==='enemy'?c.playerSuitCounts:c.enemySuitCounts;
    const differences=SUITS.map(suit=>({suit,diff:left[suit]-right[suit]}));
    const max=Math.max(...differences.map(entry=>entry.diff));
    if(max<=0)return[];
    return differences.filter(entry=>entry.diff===max).map(entry=>entry.suit);
  }
  function randomSuit(random=Math.random){return SUITS[randomInt(0,SUITS.length-1,random)]}
  function chooseFromSuits(suits,random=Math.random){return suits.length?suits[randomInt(0,suits.length-1,random)]:randomSuit(random)}
  function chooseSuit(pattern,context={},random=Math.random){
    const c=normalizeContext(context),policy=pattern?.suitPolicy||'random';
    if(policy==='trump')return c.trump||randomSuit(random);
    if(policy==='prefer_trump'){
      const chance=Math.max(0,Math.min(100,Number(pattern?.suitChance)||0));
      if(c.trump&&randomUnit(random)<chance/100)return c.trump;
      return randomSuit(random);
    }
    if(policy==='contest_player'){
      const candidates=leadingSuits(c,'player');
      if(candidates.length)return chooseFromSuits(candidates,random);
      return randomSuit(random);
    }
    if(policy==='build_enemy'){
      const candidates=leadingSuits(c,'enemy');
      if(candidates.length)return chooseFromSuits(candidates,random);
      return randomSuit(random);
    }
    return randomSuit(random);
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
        if(!SUIT_POLICIES.includes(pattern.suitPolicy||'random'))errors.push(`${type}/${pattern.id}: invalid suit policy`);
        if(pattern.suitPolicy==='prefer_trump'&&(!(Number(pattern.suitChance)>=0)||Number(pattern.suitChance)>100))errors.push(`${type}/${pattern.id}: invalid suit chance`);
        for(const adjustment of pattern.weightAdjustments||[]){
          if(!WEIGHT_CONDITIONS.includes(adjustment.when))errors.push(`${type}/${pattern.id}: invalid weight condition ${adjustment.when}`);
          if(!Number.isFinite(Number(adjustment.add))&&!Number.isFinite(Number(adjustment.multiply)))errors.push(`${type}/${pattern.id}: invalid weight adjustment`);
        }
      }
    }
    return errors;
  }
  function contextSnapshot(context={}){
    const c=normalizeContext(context);
    return Object.freeze({
      setIndex:c.setIndex,trick:c.trick,trump:c.trump,
      playerSuitCounts:Object.freeze({...c.playerSuitCounts}),
      enemySuitCounts:Object.freeze({...c.enemySuitCounts}),
      setHistory:Object.freeze({...c.setHistory})
    });
  }
  function chooseEnemyPlay(type,context={},random=Math.random){
    const profile=profileFor(type),normalized=normalizeContext(context),pattern=weightedPattern(profile.patterns,random,normalized);
    const rank=randomInt(pattern.minRank,pattern.maxRank,random);
    const suit=chooseSuit(pattern,normalized,random);
    const weights=patternWeightTable(profile.patterns,normalized);
    const card={
      suit,rank,
      enemyBehaviorId:pattern.id,
      enemyProfileId:profile.id,
      enemyIntent:pattern.intent,
      enemyIntentDetail:pattern.detail||'',
      enemyPlannedSet:normalized.setIndex,
      enemyPlannedTrick:normalized.trick
    };
    return Object.freeze({profileId:profile.id,patternId:pattern.id,card,intent:Object.freeze({title:pattern.intent,detail:pattern.detail||''}),weights:Object.freeze(weights),context:contextSnapshot(normalized)});
  }
  function activeBattle(root){
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return null;
  }
  function battleType(state){return state?.type||state?.node?.type||'battle'}
  function battleContext(state){
    return normalizeContext({
      setIndex:state?.setIndex??1,
      trick:state?.trick??1,
      trump:state?.trump??null,
      playerSlots:state?.slots||[],
      enemySlots:state?.enemySlots||[],
      setHistory:state?.setHistory||{}
    });
  }
  function nextPlanningContext(context){
    const c=normalizeContext(context);
    return normalizeContext({...c,setIndex:c.trick===5?c.setIndex+1:c.setIndex,trick:c.trick===5?1:c.trick+1});
  }
  function applyIntent(state,card){
    if(!state?.enemy||!card)return false;
    if(card.enemyIntent)state.enemy.intent=card.enemyIntent;
    if(card.enemyIntentDetail)state.enemy.sub=card.enemyIntentDetail;
    if(card.enemyBehaviorId)state.enemy.behaviorId=card.enemyBehaviorId;
    return !!card.enemyIntent;
  }
  function plannedContextForGeneration(state){
    const current=battleContext(state);
    if(!generationPlan)return current;
    if(generationPlan.hadPreview)return nextPlanningContext(current);
    const target=generationPlan.calls===0?current:nextPlanningContext(current);
    generationPlan.calls++;
    return target;
  }
  function installBrowserRuntime(root){
    if(installed)return true;
    if(typeof root?.genEnemyCard!=='function'||typeof root?.nextEnemy!=='function')return false;
    originalGenEnemyCard=root.genEnemyCard;
    originalNextEnemy=root.nextEnemy;
    const wrappedGen=function(){
      const state=activeBattle(root);
      if(!state)return originalGenEnemyCard.apply(this,arguments);
      return chooseEnemyPlay(battleType(state),plannedContextForGeneration(state),Math.random).card;
    };
    wrappedGen.__enemyBehaviorAdapter=true;
    wrappedGen.__legacyGenEnemyCard=originalGenEnemyCard;
    root.genEnemyCard=wrappedGen;
    const wrappedNext=function(){
      const state=activeBattle(root);
      if(!state)return originalNextEnemy.apply(this,arguments);
      const previousPlan=generationPlan;
      generationPlan={hadPreview:!!state.nextEnemyPreview,calls:0};
      try{
        const result=originalNextEnemy.apply(this,arguments);
        applyIntent(state,state.enemyCard);
        return result;
      }finally{
        generationPlan=previousPlan;
      }
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
  return{SUITS,SUIT_POLICIES,WEIGHT_CONDITIONS,PROFILES,clampRandom,randomUnit,randomInt,emptySuitCounts,showdownSuit,countSuits,normalizeSuitCounts,normalizedHistory,normalizeContext,suitLead,conditionMet,tacticalWeight,patternWeightTable,weightedPattern,leadingSuits,randomSuit,chooseSuit,profileFor,validateProfiles,contextSnapshot,chooseEnemyPlay,activeBattle,battleType,battleContext,nextPlanningContext,applyIntent,plannedContextForGeneration,installBrowserRuntime,installWhenReady};
});
