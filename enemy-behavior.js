(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.EnemyBehavior=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUITS=Object.freeze(['S','H','D','C']);
  const SUIT_POLICIES=Object.freeze(['random','prefer_trump','trump','contest_player','build_enemy']);
  const WEIGHT_CONDITIONS=Object.freeze([
    'early_trick','late_trick','enemy_behind','enemy_ahead','player_suit_lead','enemy_suit_lead','has_trump',
    'enemy_lost_last','enemy_won_last','player_repeated_suit','repeat_self'
  ]);
  const PROFILES=Object.freeze({
    battle:Object.freeze({
      id:'raider',
      label:'폐허 약탈자',
      personality:Object.freeze({
        archetype:'트릭 집착형',
        summary:'직전 패배와 후반 트릭에 민감하게 반응해 높은 숫자 압박을 강화한다.'
      }),
      patterns:Object.freeze([
        Object.freeze({
          id:'high_pressure',weight:55,minRank:8,maxRank:14,intent:'고랭크 압박',detail:'높은 숫자를 우선해 정면 승부를 건다.',
          suitPolicy:'prefer_trump',suitChance:35,
          weightAdjustments:Object.freeze([
            Object.freeze({when:'late_trick',add:20,reason:'후반 트릭이라 숫자 압박을 높임'}),
            Object.freeze({when:'enemy_behind',add:15,reason:'이번 세트에서 밀리고 있어 정면 승부를 강화'}),
            Object.freeze({when:'enemy_lost_last',add:15,reason:'직전 트릭 패배에 반응해 압박을 강화'}),
            Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 압박 반복은 조금 피함'})
          ])
        }),
        Object.freeze({
          id:'wild_card',weight:45,minRank:2,maxRank:14,intent:'변칙 투입',detail:'낮은 숫자부터 높은 숫자까지 넓게 섞으며 플레이어의 무늬 쏠림을 견제한다.',
          suitPolicy:'contest_player',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'early_trick',add:10,reason:'초반에는 패턴을 읽히지 않도록 변칙을 섞음'}),
            Object.freeze({when:'player_suit_lead',add:10,reason:'플레이어의 쇼다운 무늬 쏠림을 견제'}),
            Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 변칙의 연속 사용을 줄임'})
          ])
        })
      ])
    }),
    elite:Object.freeze({
      id:'armored_hunter',
      label:'철갑 사냥꾼',
      personality:Object.freeze({
        archetype:'트럼프 사냥형',
        summary:'트럼프를 적극적으로 잡고 플레이어가 반복하는 쇼다운 무늬를 집요하게 따라붙는다.'
      }),
      patterns:Object.freeze([
        Object.freeze({
          id:'steady_hunt',weight:60,minRank:6,maxRank:14,intent:'정밀 추격',detail:'중간 이상 숫자를 유지하면서 플레이어가 쌓는 무늬를 따라붙는다.',
          suitPolicy:'contest_player',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어가 앞선 무늬를 직접 따라붙음'}),
            Object.freeze({when:'player_repeated_suit',add:15,reason:'플레이어가 같은 쇼다운 무늬를 반복해 추격을 강화'})
          ])
        }),
        Object.freeze({
          id:'trump_hunt',weight:40,minRank:6,maxRank:14,intent:'트럼프 압박',detail:'현재 트럼프를 이용해 트릭 주도권을 노린다.',
          suitPolicy:'trump',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'late_trick',add:20,reason:'후반 트릭의 주도권을 트럼프로 확보'}),
            Object.freeze({when:'enemy_behind',add:15,reason:'이번 세트 열세를 트럼프로 뒤집으려 함'}),
            Object.freeze({when:'enemy_lost_last',add:20,reason:'직전 트릭 패배 뒤 트럼프 사냥을 강화'})
          ])
        })
      ])
    }),
    boss:Object.freeze({
      id:'tower_watcher',
      label:'탑의 감시자',
      personality:Object.freeze({
        archetype:'쇼다운 차단형',
        summary:'플레이어가 쌓는 무늬를 기억하고 쇼다운 우세가 완성되기 전에 차단하는 데 집중한다.'
      }),
      patterns:Object.freeze([
        Object.freeze({
          id:'watcher_pressure',weight:50,minRank:6,maxRank:14,intent:'감시 압박',detail:'현재 트럼프를 의식하면서 중간 이상 숫자로 압박한다.',
          suitPolicy:'prefer_trump',suitChance:65,
          weightAdjustments:Object.freeze([
            Object.freeze({when:'enemy_behind',add:20,reason:'세트 열세라 직접 압박을 강화'}),
            Object.freeze({when:'enemy_won_last',add:10,reason:'직전 트릭 승리 흐름을 이어 압박'})
          ])
        }),
        Object.freeze({
          id:'suit_denial',weight:50,minRank:6,maxRank:14,intent:'무늬 차단',detail:'플레이어가 쇼다운용으로 몰아가는 무늬를 따라가 우세 형성을 방해한다.',
          suitPolicy:'contest_player',
          weightAdjustments:Object.freeze([
            Object.freeze({when:'player_suit_lead',add:30,reason:'플레이어가 앞선 쇼다운 무늬를 차단'}),
            Object.freeze({when:'late_trick',add:15,reason:'쇼다운 직전이라 무늬 차단을 우선'}),
            Object.freeze({when:'player_repeated_suit',add:25,reason:'플레이어가 같은 무늬를 반복해 차단 우선도를 높임'})
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
  function createEnemyMemory(profileId=null){
    return{
      profileId:profileId||null,
      seenTricks:0,
      lastSet:1,
      lastTrick:0,
      lastResult:null,
      lastPlayerSuit:null,
      playerSuitRun:0,
      lastBehaviorId:null,
      behaviorRepeat:0,
      patternCounts:{},
      results:{player:0,enemy:0,draw:0}
    };
  }
  function normalizeEnemyMemory(value={}){
    const patternCounts={};
    if(value?.patternCounts&&typeof value.patternCounts==='object')for(const [id,count] of Object.entries(value.patternCounts))patternCounts[id]=Math.max(0,Number(count)||0);
    return{
      profileId:value?.profileId||null,
      seenTricks:Math.max(0,Number(value?.seenTricks)||0),
      lastSet:Number.isInteger(value?.lastSet)&&value.lastSet>=1?value.lastSet:1,
      lastTrick:Number.isInteger(value?.lastTrick)&&value.lastTrick>=0&&value.lastTrick<=5?value.lastTrick:0,
      lastResult:['player','enemy','draw'].includes(value?.lastResult)?value.lastResult:null,
      lastPlayerSuit:SUITS.includes(value?.lastPlayerSuit)?value.lastPlayerSuit:null,
      playerSuitRun:Math.max(0,Number(value?.playerSuitRun)||0),
      lastBehaviorId:value?.lastBehaviorId||null,
      behaviorRepeat:Math.max(0,Number(value?.behaviorRepeat)||0),
      patternCounts,
      results:{
        player:Math.max(0,Number(value?.results?.player)||0),
        enemy:Math.max(0,Number(value?.results?.enemy)||0),
        draw:Math.max(0,Number(value?.results?.draw)||0)
      }
    };
  }
  function enemyMemorySnapshot(value={}){
    const memory=normalizeEnemyMemory(value);
    return Object.freeze({...memory,patternCounts:Object.freeze({...memory.patternCounts}),results:Object.freeze({...memory.results})});
  }
  function ensureEnemyMemory(state,profileId=null){
    if(!state?.enemy||typeof state.enemy!=='object')return null;
    if(!state.enemy.aiMemory||typeof state.enemy.aiMemory!=='object')state.enemy.aiMemory=createEnemyMemory(profileId);
    if(profileId&&!state.enemy.aiMemory.profileId)state.enemy.aiMemory.profileId=profileId;
    return state.enemy.aiMemory;
  }
  function normalizeResult(result){
    if(result===1||result==='player')return'player';
    if(result===-1||result==='enemy')return'enemy';
    if(result===0||result==='draw')return'draw';
    return null;
  }
  function recordBattleMemory(state,result){
    const normalized=normalizeResult(result);
    if(!state?.enemy||!normalized)return null;
    const profile=profileFor(state?.type||state?.node?.type||'battle');
    const memory=ensureEnemyMemory(state,profile.id);
    if(!memory)return null;
    const playerEntry=Array.isArray(state.slots)&&state.slots.length?state.slots[state.slots.length-1]:null;
    const playerSuit=showdownSuit(playerEntry);
    if(SUITS.includes(playerSuit)){
      memory.playerSuitRun=memory.lastPlayerSuit===playerSuit?Math.max(1,Number(memory.playerSuitRun)||0)+1:1;
      memory.lastPlayerSuit=playerSuit;
    }else{
      memory.playerSuitRun=0;
      memory.lastPlayerSuit=null;
    }
    const behaviorId=state?.enemyCard?.enemyBehaviorId||null;
    if(behaviorId){
      memory.behaviorRepeat=memory.lastBehaviorId===behaviorId?Math.max(1,Number(memory.behaviorRepeat)||0)+1:1;
      memory.lastBehaviorId=behaviorId;
      memory.patternCounts[behaviorId]=(Number(memory.patternCounts[behaviorId])||0)+1;
    }else{
      memory.behaviorRepeat=0;
      memory.lastBehaviorId=null;
    }
    memory.lastResult=normalized;
    memory.results[normalized]=(Number(memory.results[normalized])||0)+1;
    memory.seenTricks=(Number(memory.seenTricks)||0)+1;
    memory.lastSet=Number.isInteger(state.setIndex)?state.setIndex:memory.lastSet;
    memory.lastTrick=Number.isInteger(state.trick)?state.trick:memory.lastTrick;
    return enemyMemorySnapshot(memory);
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
      setHistory:normalizedHistory(context.setHistory),
      enemyMemory:normalizeEnemyMemory(context.enemyMemory)
    };
  }
  function suitLead(context,side='player'){
    const c=normalizeContext(context),left=side==='enemy'?c.enemySuitCounts:c.playerSuitCounts,right=side==='enemy'?c.playerSuitCounts:c.enemySuitCounts;
    return Math.max(...SUITS.map(suit=>left[suit]-right[suit]));
  }
  function conditionMet(condition,context={},pattern=null){
    const c=normalizeContext(context),history=c.setHistory,memory=c.enemyMemory;
    if(condition==='early_trick')return c.trick<=2;
    if(condition==='late_trick')return c.trick>=4;
    if(condition==='enemy_behind')return history.wins>history.losses;
    if(condition==='enemy_ahead')return history.losses>history.wins;
    if(condition==='player_suit_lead')return suitLead(c,'player')>=1;
    if(condition==='enemy_suit_lead')return suitLead(c,'enemy')>=1;
    if(condition==='has_trump')return SUITS.includes(c.trump);
    if(condition==='enemy_lost_last')return memory.lastResult==='player';
    if(condition==='enemy_won_last')return memory.lastResult==='enemy';
    if(condition==='player_repeated_suit')return memory.playerSuitRun>=2;
    if(condition==='repeat_self')return !!pattern?.id&&memory.lastBehaviorId===pattern.id&&memory.behaviorRepeat>=2;
    return false;
  }
  function tacticalWeight(pattern,context={}){
    let weight=Math.max(0,Number(pattern?.weight)||0);
    for(const adjustment of pattern?.weightAdjustments||[]){
      if(!conditionMet(adjustment.when,context,pattern))continue;
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
      if(!profile?.personality?.archetype)errors.push(`${type}: missing personality archetype`);
      if(!profile?.personality?.summary)errors.push(`${type}: missing personality summary`);
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
          if(adjustment.reason!==undefined&&typeof adjustment.reason!=='string')errors.push(`${type}/${pattern.id}: invalid adjustment reason`);
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
      setHistory:Object.freeze({...c.setHistory}),
      enemyMemory:enemyMemorySnapshot(c.enemyMemory)
    });
  }
  function activeAdjustmentReasons(pattern,context={}){
    const reasons=[];
    for(const adjustment of pattern?.weightAdjustments||[]){
      if(conditionMet(adjustment.when,context,pattern)&&adjustment.reason)reasons.push(adjustment.reason);
    }
    return reasons;
  }
  function suitDecisionReason(pattern,context={},suit=null){
    const c=normalizeContext(context),policy=pattern?.suitPolicy||'random';
    if(policy==='trump'&&c.trump&&suit===c.trump)return`현재 트럼프 ${suit}를 직접 선택`;
    if(policy==='prefer_trump'&&c.trump&&suit===c.trump)return`현재 트럼프 ${suit}를 우선 선택`;
    if(policy==='contest_player'&&suit&&leadingSuits(c,'player').includes(suit))return`플레이어가 쌓는 ${suit} 무늬를 견제`;
    if(policy==='build_enemy'&&suit&&leadingSuits(c,'enemy').includes(suit))return`자신이 앞선 ${suit} 무늬를 더 강화`;
    return'';
  }
  function explainDecision(profile,pattern,context={},suit=null){
    const reasons=[...activeAdjustmentReasons(pattern,context)];
    const suitReason=suitDecisionReason(pattern,context,suit);
    if(suitReason)reasons.push(suitReason);
    const unique=[...new Set(reasons.filter(Boolean))];
    if(unique.length)return unique.slice(0,2).join(' · ');
    return profile?.personality?.summary||pattern?.detail||'';
  }
  function chooseEnemyPlay(type,context={},random=Math.random){
    const profile=profileFor(type),normalized=normalizeContext(context),pattern=weightedPattern(profile.patterns,random,normalized);
    const rank=randomInt(pattern.minRank,pattern.maxRank,random);
    const suit=chooseSuit(pattern,normalized,random);
    const weights=patternWeightTable(profile.patterns,normalized);
    const reason=explainDecision(profile,pattern,normalized,suit);
    const card={
      suit,rank,
      enemyBehaviorId:pattern.id,
      enemyProfileId:profile.id,
      enemyPersonality:profile.personality.archetype,
      enemyIntent:pattern.intent,
      enemyIntentDetail:pattern.detail||'',
      enemyIntentReason:reason,
      enemyPlannedSet:normalized.setIndex,
      enemyPlannedTrick:normalized.trick,
      enemyMemorySnapshot:enemyMemorySnapshot(normalized.enemyMemory)
    };
    return Object.freeze({
      profileId:profile.id,
      personality:Object.freeze({...profile.personality}),
      patternId:pattern.id,
      card,
      intent:Object.freeze({title:pattern.intent,detail:pattern.detail||'',reason,personality:profile.personality.archetype}),
      weights:Object.freeze(weights),
      context:contextSnapshot(normalized)
    });
  }
  function activeBattle(root){
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return null;
  }
  function battleType(state){return state?.type||state?.node?.type||'battle'}
  function battleContext(state){
    const profile=profileFor(battleType(state));
    return normalizeContext({
      setIndex:state?.setIndex??1,
      trick:state?.trick??1,
      trump:state?.trump??null,
      playerSlots:state?.slots||[],
      enemySlots:state?.enemySlots||[],
      setHistory:state?.setHistory||{},
      enemyMemory:state?.enemy?.aiMemory||createEnemyMemory(profile.id)
    });
  }
  function nextPlanningContext(context){
    const c=normalizeContext(context);
    return normalizeContext({...c,setIndex:c.trick===5?c.setIndex+1:c.setIndex,trick:c.trick===5?1:c.trick+1});
  }
  function applyIntent(state,card){
    if(!state?.enemy||!card)return false;
    if(card.enemyIntent)state.enemy.intent=card.enemyIntent;
    if(card.enemyIntentDetail||card.enemyIntentReason)state.enemy.sub=[card.enemyIntentDetail,card.enemyIntentReason?`판단: ${card.enemyIntentReason}`:''].filter(Boolean).join(' · ');
    if(card.enemyBehaviorId)state.enemy.behaviorId=card.enemyBehaviorId;
    if(card.enemyPersonality)state.enemy.personality=card.enemyPersonality;
    if(card.enemyIntentReason)state.enemy.intentReason=card.enemyIntentReason;
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
  function installResultMemoryAdapter(root){
    const core=root?.BattleCore;
    if(!core||typeof core.recordTrickResult!=='function')return false;
    if(core.recordTrickResult.__enemyBehaviorMemoryAdapter)return true;
    const legacy=core.recordTrickResult;
    const wrapped=function(context,result){
      const normalized=legacy.apply(this,arguments);
      const state=context?.enemy?context:activeBattle(root);
      if(state)recordBattleMemory(state,normalized);
      return normalized;
    };
    wrapped.__enemyBehaviorMemoryAdapter=true;
    wrapped.__legacyRecordTrickResult=legacy;
    core.recordTrickResult=wrapped;
    return true;
  }
  function installBrowserRuntime(root){
    if(installed)return true;
    if(typeof root?.genEnemyCard!=='function'||typeof root?.nextEnemy!=='function')return false;
    originalGenEnemyCard=root.genEnemyCard;
    originalNextEnemy=root.nextEnemy;
    installResultMemoryAdapter(root);
    const wrappedGen=function(){
      const state=activeBattle(root);
      if(!state)return originalGenEnemyCard.apply(this,arguments);
      const profile=profileFor(battleType(state));
      ensureEnemyMemory(state,profile.id);
      return chooseEnemyPlay(battleType(state),plannedContextForGeneration(state),Math.random).card;
    };
    wrappedGen.__enemyBehaviorAdapter=true;
    wrappedGen.__legacyGenEnemyCard=originalGenEnemyCard;
    root.genEnemyCard=wrappedGen;
    const wrappedNext=function(){
      const state=activeBattle(root);
      if(!state)return originalNextEnemy.apply(this,arguments);
      const profile=profileFor(battleType(state));
      ensureEnemyMemory(state,profile.id);
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
  return{
    SUITS,SUIT_POLICIES,WEIGHT_CONDITIONS,PROFILES,
    clampRandom,randomUnit,randomInt,emptySuitCounts,showdownSuit,countSuits,normalizeSuitCounts,normalizedHistory,
    createEnemyMemory,normalizeEnemyMemory,enemyMemorySnapshot,ensureEnemyMemory,normalizeResult,recordBattleMemory,
    normalizeContext,suitLead,conditionMet,tacticalWeight,patternWeightTable,weightedPattern,leadingSuits,randomSuit,chooseSuit,
    profileFor,validateProfiles,contextSnapshot,activeAdjustmentReasons,suitDecisionReason,explainDecision,chooseEnemyPlay,
    activeBattle,battleType,battleContext,nextPlanningContext,applyIntent,plannedContextForGeneration,installResultMemoryAdapter,installBrowserRuntime,installWhenReady
  };
});
