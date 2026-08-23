(function(root,factory){
  const EnemyBehavior=typeof module!=='undefined'?require('./enemy-behavior-core.js'):root.EnemyBehavior;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const api=factory(root,EnemyBehavior,EncounterRules,CardEffects);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.EnemyContent9B=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,EnemyBehavior,EncounterRules,CardEffects){
  const STAGE='9-B';
  const CUSTOM_PROFILE_PREFIX='content9b:';

  const CONTENT=Object.freeze({
    masked_croupier:Object.freeze({
      id:'masked_croupier',type:'battle',label:'가면 딜러',sprite:'raider',
      summary:'초반에는 낮은 패를 섞어 읽기를 흐리고 후반에는 높은 숫자와 트럼프로 급격히 압박한다.',
      behavior:Object.freeze({
        id:'masked_croupier',label:'가면 딜러',personality:Object.freeze({archetype:'허세 전환형',summary:'초반의 낮은 패와 후반의 고랭크 압박을 번갈아 사용한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'masked_feint',weight:55,minRank:2,maxRank:8,intent:'낮은 패 위장',detail:'낮고 중간 숫자를 섞어 다음 선택을 읽기 어렵게 만든다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:25,reason:'초반이라 낮은 패 위장을 강화'}),Object.freeze({when:'repeat_self',multiply:.65,reason:'같은 위장을 연속으로 반복하지 않음'})])}),
          Object.freeze({id:'masked_reveal',weight:45,minRank:9,maxRank:14,intent:'가면 해제',detail:'후반에는 높은 숫자와 트럼프를 앞세워 정면 승부로 전환한다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:35,reason:'쇼다운 직전이라 고랭크 압박으로 전환'}),Object.freeze({when:'enemy_behind',add:15,reason:'세트에서 밀려 강한 패를 꺼냄'})])})
        ])
      })
    }),
    fog_archivist:Object.freeze({
      id:'fog_archivist',type:'battle',label:'안개 기록관',sprite:'hunter',
      summary:'플레이어가 쇼다운에 쌓는 무늬를 기록해 따라붙거나 자신의 무늬 흐름을 이어간다.',
      behavior:Object.freeze({
        id:'fog_archivist',label:'안개 기록관',personality:Object.freeze({archetype:'기록 추적형',summary:'공개된 쇼다운 무늬와 자신의 누적 무늬를 이용해 다음 패턴을 정한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'fog_trace',weight:60,minRank:6,maxRank:11,intent:'무늬 추적',detail:'플레이어가 쌓는 쇼다운 무늬를 따라가며 선택지를 압박한다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어가 앞선 무늬를 기록해 추적'}),Object.freeze({when:'player_repeated_suit',add:20,reason:'같은 무늬 반복을 확인해 추적을 강화'})])}),
          Object.freeze({id:'fog_archive',weight:40,minRank:8,maxRank:13,intent:'기록 고정',detail:'자신이 쌓아 둔 쇼다운 무늬를 유지하면서 중고랭크로 버틴다.',suitPolicy:'build_enemy',weightAdjustments:Object.freeze([Object.freeze({when:'enemy_suit_lead',add:25,reason:'자신이 앞선 무늬를 계속 축적'}),Object.freeze({when:'enemy_won_last',add:10,reason:'직전 승리 흐름을 기록해 유지'})])})
        ])
      })
    }),
    frontier_bailiff:Object.freeze({
      id:'frontier_bailiff',type:'elite',label:'전선 집행관',sprite:'hunter',
      summary:'높은 숫자로 트릭을 징수하고 매 세트 시작 플레이어에게 취약을 걸어 장기전을 압박한다.',
      behavior:Object.freeze({
        id:'frontier_bailiff',label:'전선 집행관',personality:Object.freeze({archetype:'징수 압박형',summary:'트럼프 압박과 무늬 봉쇄를 오가며 세트 초반부터 체력 손실을 강요한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'bailiff_charge',weight:55,minRank:9,maxRank:14,intent:'강제 징수',detail:'높은 숫자와 트럼프를 우선해 트릭 승리를 강하게 노린다.',suitPolicy:'prefer_trump',suitChance:60,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:20,reason:'징수 실패를 만회하기 위해 압박 강화'}),Object.freeze({when:'late_trick',add:15,reason:'후반 트릭이라 고랭크를 더 강하게 사용'})])}),
          Object.freeze({id:'bailiff_lockstep',weight:45,minRank:7,maxRank:12,intent:'진로 봉쇄',detail:'플레이어가 쌓는 무늬를 따라가 쇼다운 계획을 방해한다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어 쇼다운 무늬를 직접 봉쇄'}),Object.freeze({when:'repeat_self',multiply:.7,reason:'같은 봉쇄 반복을 줄임'})])})
        ])
      }),
      rule:Object.freeze({
        id:'bailiff_collection',label:'징수 개시',description:'각 세트 시작 시 전선 집행관은 보호막 2를 얻고 플레이어에게 취약 1을 부여한다.',
        effects:Object.freeze([
          Object.freeze({id:'bailiff-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),
          Object.freeze({id:'bailiff-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})
        ])
      })
    }),
    three_face_dealer:Object.freeze({
      id:'three_face_dealer',type:'boss',label:'삼면 딜러',sprite:'boss',
      summary:'체력 구간마다 세트 시작 압박이 강해지는 지역 보스. 최종 보스 탑의 감시자는 별도로 유지한다.',
      behavior:Object.freeze({
        id:'three_face_dealer',label:'삼면 딜러',personality:Object.freeze({archetype:'국면 누적형',summary:'고랭크 압박과 무늬 견제를 오가며 체력이 낮아질수록 세트 시작 압박을 강화한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'dealer_pressure',weight:55,minRank:8,maxRank:14,intent:'하우스 압박',detail:'중고랭크와 트럼프를 이용해 정면 승부를 건다.',suitPolicy:'prefer_trump',suitChance:60,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:20,reason:'하우스가 세트에서 밀려 압박 강화'}),Object.freeze({when:'late_trick',add:15,reason:'쇼다운 직전이라 강한 패를 우선'})])}),
          Object.freeze({id:'dealer_read',weight:45,minRank:6,maxRank:12,intent:'테이블 읽기',detail:'플레이어의 쇼다운 무늬를 따라가 완성 계획을 흔든다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:30,reason:'플레이어가 앞선 무늬를 읽고 따라감'}),Object.freeze({when:'player_repeated_suit',add:20,reason:'반복 무늬를 확인해 견제 강화'})])})
        ])
      }),
      phases:Object.freeze([
        Object.freeze({id:'face_1',label:'첫 번째 얼굴',minHpRatio:.66,rule:Object.freeze({id:'dealer_face_1',label:'첫 판',description:'세트 시작 시 보호막 1을 얻는다.',effects:Object.freeze([Object.freeze({id:'dealer-face1-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:1}),duration:'set'})])})}),
        Object.freeze({id:'face_2',label:'두 번째 얼굴',minHpRatio:.33,rule:Object.freeze({id:'dealer_face_2',label:'두 번째 판',description:'세트 시작 시 보호막 3을 얻고 플레이어에게 출혈 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'dealer-face2-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:3}),duration:'set'}),Object.freeze({id:'dealer-face2-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})])})}),
        Object.freeze({id:'face_3',label:'세 번째 얼굴',minHpRatio:0,rule:Object.freeze({id:'dealer_face_3',label:'마지막 판',description:'세트 시작 시 보호막 4를 얻고 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'dealer-face3-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:4}),duration:'set'}),Object.freeze({id:'dealer-face3-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})])})})
      ])
    })
  });

  let installed=false;
  let originalStartBattle=null;
  let originalGenEnemyCard=null;
  let originalDamageEnemy=null;

  function activeRun(runtimeRoot=defaultRoot){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function activeBattle(runtimeRoot=defaultRoot){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function content(id){return CONTENT[id]||null}
  function isRegionActId(id){return typeof id==='string'&&id.startsWith('region_')}
  function contentIdForNode(node,runState=activeRun()){
    if(!node||!['battle','elite','boss'].includes(node.type))return null;
    const regionId=node?.regionPlan?.regionId||runState?.runFlow?.currentRegionId||runState?.actId||null;
    const tag=node?.regionPlan?.enemyTag||null;
    if(node.type==='battle'){
      if(tag==='trickster')return'masked_croupier';
      if(tag==='observer'||tag==='disruptor')return'fog_archivist';
      return null;
    }
    if(node.type==='elite'&&isRegionActId(regionId))return'frontier_bailiff';
    if(node.type==='boss'&&isRegionActId(regionId))return'three_face_dealer';
    return null;
  }
  function prepareNode(node,runState=activeRun()){
    if(!node||typeof node!=='object')return null;
    const id=contentIdForNode(node,runState);
    if(id)node.enemyContentId=id;else delete node.enemyContentId;
    return id;
  }
  function contentForState(state){return content(state?.node?.enemyContentId)||null}
  function phaseFor(contentDef,stateOrRatio){
    const phases=contentDef?.phases||[];if(!phases.length)return null;
    const ratio=typeof stateOrRatio==='number'?Math.max(0,Math.min(1,stateOrRatio)):(()=>{const hp=Math.max(0,Number(stateOrRatio?.enemy?.hp)||0),max=Math.max(1,Number(stateOrRatio?.enemy?.maxHp)||1);return hp/max})();
    return phases.find(phase=>ratio>=phase.minHpRatio)||phases[phases.length-1]||null;
  }
  function cloneEffect(effect){return{...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}}
  function makeRuleOwner(rule,contentDef,phase=null){
    if(!rule)return null;
    return{id:rule.id,label:rule.label,description:rule.description||'',effectOwnerType:'boss_rule',encounterManaged:false,content9BManaged:true,enemyContentId:contentDef.id,bossPhaseId:phase?.id||null,effects:(rule.effects||[]).map(cloneEffect),rulesOverride:{}};
  }
  function customProfileId(contentDef){return`${CUSTOM_PROFILE_PREFIX}${contentDef.id}`}
  function syncContentEncounter(state){
    const contentDef=contentForState(state);if(!state||!contentDef)return{changed:false,content:null,phase:null};
    const previousPhase=state.bossPhase?.id||null;
    const external=(Array.isArray(state.bossRules)?state.bossRules:[]).filter(rule=>rule?.encounterManaged!==true&&rule?.content9BManaged!==true);
    const phase=contentDef.type==='boss'?phaseFor(contentDef,state):null;
    const rule=makeRuleOwner(contentDef.type==='boss'?phase?.rule:contentDef.rule,contentDef,phase);
    state.encounterProfileId=customProfileId(contentDef);
    state.encounterRules=rule?[rule]:[];
    state.bossRules=[...external,...(rule?[rule]:[])];
    state.bossPhase=phase?{id:phase.id,label:phase.label,minHpRatio:phase.minHpRatio}:null;
    state.encounter={...(state.encounter||{}),profileId:state.encounterProfileId,contentId:contentDef.id,contentStage:STAGE,bossPhases:(contentDef.phases||[]).map(item=>({id:item.id,label:item.label,minHpRatio:item.minHpRatio}))};
    state.rulesOverride=EncounterRules?.resolveRulesOverride?EncounterRules.resolveRulesOverride(state):state.rulesOverride||{};
    state.encounterRulesInitialized=true;
    return{changed:previousPhase!==(state.bossPhase?.id||null),content:contentDef,phase:state.bossPhase,rule};
  }
  function applyBattleContent(state){
    const contentDef=contentForState(state);if(!state||!contentDef)return null;
    if(state.enemy&&typeof state.enemy==='object'){
      state.enemy.contentId=contentDef.id;state.enemy.contentStage=STAGE;state.enemy.name=contentDef.label;state.enemy.sprite=contentDef.sprite;state.enemy.sub=contentDef.summary;
      if(state.enemy.aiMemory&&typeof state.enemy.aiMemory==='object')state.enemy.aiMemory.profileId=contentDef.behavior.id;
    }
    syncContentEncounter(state);
    return contentDef;
  }
  function validateContent(registry=CONTENT){
    const errors=[];const behaviorProfiles={};
    for(const [id,entry] of Object.entries(registry||{})){
      if(entry?.id!==id)errors.push(`${id}: id mismatch`);
      if(!['battle','elite','boss'].includes(entry?.type))errors.push(`${id}: invalid type`);
      if(!entry?.label||!entry?.summary)errors.push(`${id}: missing label/summary`);
      if(!entry?.behavior)errors.push(`${id}: missing behavior`);else behaviorProfiles[id]=entry.behavior;
      if(entry?.rule)errors.push(...(CardEffects?.validateEffectList?.(entry.rule.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/rule: ${error}`));
      const phases=entry?.phases||[];let previous=Infinity;
      for(const phase of phases){if(!phase?.id||!Number.isFinite(phase.minHpRatio)||phase.minHpRatio<0||phase.minHpRatio>1)errors.push(`${id}: invalid phase`);if(Number.isFinite(phase.minHpRatio)&&phase.minHpRatio>previous)errors.push(`${id}: phases must descend`);previous=Number.isFinite(phase.minHpRatio)?phase.minHpRatio:previous;errors.push(...(CardEffects?.validateEffectList?.(phase?.rule?.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/${phase?.id}: ${error}`))}
      if(phases.length&&phases[phases.length-1].minHpRatio!==0)errors.push(`${id}: last phase must start at 0`);
    }
    if(EnemyBehavior?.validateProfiles)errors.push(...EnemyBehavior.validateProfiles(behaviorProfiles));
    return errors;
  }
  function chooseContentPlay(contentDef,context={},random=Math.random){
    if(!contentDef?.behavior)throw new TypeError('enemy content behavior is required');
    const profile=contentDef.behavior,normalized=EnemyBehavior.normalizeContext(context),pattern=EnemyBehavior.weightedPattern(profile.patterns,random,normalized);
    const rank=EnemyBehavior.randomInt(pattern.minRank,pattern.maxRank,random),suit=EnemyBehavior.chooseSuit(pattern,normalized,random),reason=EnemyBehavior.explainDecision(profile,pattern,normalized,suit);
    const card={suit,rank,enemyBehaviorId:pattern.id,enemyProfileId:profile.id,enemyContentId:contentDef.id,enemyPersonality:profile.personality.archetype,enemyIntent:pattern.intent,enemyIntentDetail:pattern.detail||'',enemyIntentReason:reason,enemyPlannedSet:normalized.setIndex,enemyPlannedTrick:normalized.trick,enemyMemorySnapshot:EnemyBehavior.enemyMemorySnapshot(normalized.enemyMemory)};
    return Object.freeze({contentId:contentDef.id,profileId:profile.id,patternId:pattern.id,card,intent:Object.freeze({title:pattern.intent,detail:pattern.detail||'',reason,personality:profile.personality.archetype}),weights:Object.freeze(EnemyBehavior.patternWeightTable(profile.patterns,normalized))});
  }
  function wrapGenEnemyCard(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.genEnemyCard;if(typeof original!=='function')return false;if(original.__enemyContent9B)return true;originalGenEnemyCard=original;
    const wrapped=function(...args){
      const state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(!state||!contentDef)return original.apply(this,args);
      if(state.enemy?.aiMemory)state.enemy.aiMemory.profileId=contentDef.behavior.id;
      const planned=original.apply(this,args),base=EnemyBehavior.battleContext(state),context=EnemyBehavior.normalizeContext({...base,setIndex:planned?.enemyPlannedSet??base.setIndex,trick:planned?.enemyPlannedTrick??base.trick,enemyMemory:state.enemy?.aiMemory||base.enemyMemory});
      return chooseContentPlay(contentDef,context,Math.random).card;
    };
    wrapped.__enemyContent9B=true;wrapped.__legacyGenEnemyCard=original;runtimeRoot.genEnemyCard=wrapped;return true;
  }
  function wrapStartBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.startBattle;if(typeof original!=='function')return false;if(original.__enemyContent9B)return true;originalStartBattle=original;
    const wrapped=function(node,...args){
      prepareNode(node,activeRun(runtimeRoot));
      const previousRunEffects=runtimeRoot.runCardEffects;let primed=false;
      const prime=()=>{const state=activeBattle(runtimeRoot);if(state&&!primed){applyBattleContent(state);primed=true}return state};
      if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=function(...effectArgs){prime();return previousRunEffects.apply(this,effectArgs)};
      const restore=()=>{if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=previousRunEffects};
      const finalize=result=>{prime();runtimeRoot.renderBattle?.();return result};
      try{
        const result=original.call(this,node,...args);
        if(result&&typeof result.then==='function')return result.then(finalize).finally(restore);
        const final=finalize(result);restore();return final;
      }catch(error){restore();throw error}
    };
    wrapped.__enemyContent9B=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true;
  }
  function wrapDamageEnemy(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.damageEnemy;if(typeof original!=='function')return false;if(original.__enemyContent9B)return true;originalDamageEnemy=original;
    const wrapped=function(...args){const result=original.apply(this,args),state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(state&&contentDef?.type==='boss'){const transition=syncContentEncounter(state);if(transition.changed)runtimeRoot.renderBattle?.()}return result};
    wrapped.__enemyContent9B=true;wrapped.__legacyDamageEnemy=original;runtimeRoot.damageEnemy=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=defaultRoot){
    if(installed)return true;const errors=validateContent();if(errors.length){runtimeRoot?.console?.error?.('[enemy-content-9-b] 콘텐츠 오류',errors);return false}
    if(!EnemyBehavior||!EncounterRules||!wrapGenEnemyCard(runtimeRoot)||!wrapStartBattle(runtimeRoot)||!wrapDamageEnemy(runtimeRoot))return false;
    installed=true;return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<60)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[enemy-content-9-b] 전투 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true;
  }

  return{STAGE,CUSTOM_PROFILE_PREFIX,CONTENT,activeRun,activeBattle,content,isRegionActId,contentIdForNode,prepareNode,contentForState,phaseFor,cloneEffect,makeRuleOwner,customProfileId,syncContentEncounter,applyBattleContent,validateContent,chooseContentPlay,wrapGenEnemyCard,wrapStartBattle,wrapDamageEnemy,installBrowserRuntime,installWhenReady};
});
