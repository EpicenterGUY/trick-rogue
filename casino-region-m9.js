(function(root,factory){
  const EnemyBehavior=typeof module!=='undefined'?require('./enemy-behavior-core.js'):root.EnemyBehavior;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const ChipEconomy=typeof module!=='undefined'?require('./chip-economy.js'):root.ChipEconomy;
  const RunEvents=typeof module!=='undefined'?require('./run-events.js'):root.RunEvents;
  const api=factory(root,EnemyBehavior,EncounterRules,CardEffects,ChipEconomy,RunEvents);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CasinoRegionM9=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,EnemyBehavior,EncounterRules,CardEffects,ChipEconomy,RunEvents){
  const STAGE='M9-CASINO-1';
  const REGION_ID='region_casino';
  const PENDING_CHIP_CAP=5;

  const CONTENT=Object.freeze({
    casino_lowroller:Object.freeze({
      id:'casino_lowroller',type:'battle',label:'로우 롤러',sprite:'raider',
      summary:'낮은 숫자를 아끼지 않고 던지며 쇼다운 전까지 값의 기준을 흐린다.',
      behavior:Object.freeze({
        id:'casino_lowroller',label:'로우 롤러',personality:Object.freeze({archetype:'로우볼 누적형',summary:'낮은 숫자를 연속으로 내며 무늬와 타이밍 이득을 챙긴다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'lowball_feed',weight:65,minRank:2,maxRank:7,intent:'로우볼 투입',detail:'낮은 숫자를 빠르게 소모해 다음 패의 범위를 숨긴다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:25,reason:'초반에는 낮은 숫자를 먼저 소모'}),Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 로우볼 반복을 조금 줄임'})])}),
          Object.freeze({id:'cheap_contest',weight:35,minRank:5,maxRank:10,intent:'싼 견제',detail:'중간 이하 숫자로 플레이어가 쌓는 무늬만 끊는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:30,reason:'플레이어의 쇼다운 무늬를 싼 패로 견제'}),Object.freeze({when:'late_trick',add:10,reason:'후반에는 최소한의 숫자로 견제를 강화'})])})
        ])
      })
    }),
    casino_bluffer:Object.freeze({
      id:'casino_bluffer',type:'battle',label:'침수 블러퍼',sprite:'raider',
      summary:'낮은 숫자로 허세를 깔다가 후반에 고랭크와 트럼프로 판을 뒤집는다.',
      behavior:Object.freeze({
        id:'casino_bluffer',label:'침수 블러퍼',personality:Object.freeze({archetype:'허세 반전형',summary:'낮은 패와 높은 패의 간격을 크게 벌려 읽기를 어렵게 만든다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'drowned_bluff',weight:55,minRank:2,maxRank:6,intent:'침수 허세',detail:'낮은 패를 일부러 노출해 다음 선택을 오판하게 만든다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:30,reason:'초반이라 허세 패를 먼저 공개'}),Object.freeze({when:'enemy_ahead',add:10,reason:'앞서고 있어 낮은 패로 여유를 부림'})])}),
          Object.freeze({id:'drowned_reveal',weight:45,minRank:10,maxRank:14,intent:'블러프 공개',detail:'후반에는 높은 숫자와 트럼프로 갑자기 승부를 건다.',suitPolicy:'prefer_trump',suitChance:60,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:35,reason:'쇼다운 직전이라 고랭크를 공개'}),Object.freeze({when:'enemy_behind',add:20,reason:'밀리고 있어 허세를 접고 강한 패 사용'})])})
        ])
      })
    }),
    casino_debt_collector:Object.freeze({
      id:'casino_debt_collector',type:'battle',label:'부채 징수원',sprite:'hunter',
      summary:'중고랭크와 트럼프를 아끼지 않고 사용해 작은 손실을 계속 누적시킨다.',
      behavior:Object.freeze({
        id:'casino_debt_collector',label:'부채 징수원',personality:Object.freeze({archetype:'채무 압박형',summary:'트릭을 빼앗는 고랭크 압박과 무늬 봉쇄를 번갈아 사용한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'debt_collection',weight:60,minRank:8,maxRank:14,intent:'부채 징수',detail:'높은 숫자와 트럼프로 트릭 승리를 직접 노린다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:20,reason:'미수금을 회수하려 압박 강화'}),Object.freeze({when:'enemy_lost_last',add:15,reason:'직전 징수 실패에 반응'})])}),
          Object.freeze({id:'account_lock',weight:40,minRank:6,maxRank:11,intent:'계정 동결',detail:'플레이어가 쌓는 무늬를 따라가 쇼다운 계획을 묶는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어가 앞선 무늬를 동결'}),Object.freeze({when:'player_repeated_suit',add:15,reason:'반복 무늬를 확인해 봉쇄 강화'})])})
        ])
      })
    }),
    vault_collector:Object.freeze({
      id:'vault_collector',type:'elite',label:'금고 징수관',sprite:'hunter',
      summary:'세트가 시작될 때 금고를 잠그고 플레이어에게 취약을 걸어 배팅 실수를 크게 만든다.',
      behavior:Object.freeze({
        id:'vault_collector',label:'금고 징수관',personality:Object.freeze({archetype:'금고 압박형',summary:'트럼프 징수와 무늬 봉쇄를 섞어 짧은 실수도 손실로 연결한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'vault_tax',weight:60,minRank:8,maxRank:14,intent:'금고세',detail:'고랭크와 트럼프로 정면 승부를 건다.',suitPolicy:'prefer_trump',suitChance:65,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:20,reason:'후반 트릭에 징수 집중'}),Object.freeze({when:'enemy_behind',add:15,reason:'금고 손실을 만회하려 압박'})])}),
          Object.freeze({id:'vault_lock',weight:40,minRank:6,maxRank:12,intent:'금고 봉쇄',detail:'플레이어의 주력 무늬를 따라붙어 쇼다운 완성을 늦춘다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:30,reason:'주력 무늬를 금고처럼 잠금'}),Object.freeze({when:'repeat_self',multiply:.7,reason:'같은 봉쇄를 연속 반복하지 않음'})])})
        ])
      }),
      rule:Object.freeze({id:'vault_collection',label:'금고 징수',description:'각 세트 시작 시 보호막 2를 얻고 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([
        Object.freeze({id:'vault-collector-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),
        Object.freeze({id:'vault-collector-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})
      ])})
    }),
    drowned_house:Object.freeze({
      id:'drowned_house',type:'boss',label:'가라앉은 하우스',sprite:'boss',
      summary:'침몰 카지노의 지역 보스. 체력이 줄수록 하우스 우위를 강요하며 낮은 패와 고랭크 압박을 동시에 사용한다.',
      behavior:Object.freeze({
        id:'drowned_house',label:'가라앉은 하우스',personality:Object.freeze({archetype:'하우스 우위형',summary:'로우볼로 판을 흐린 뒤 고랭크와 트럼프로 손실을 회수한다.'}),
        patterns:Object.freeze([
          Object.freeze({id:'house_lowball',weight:45,minRank:2,maxRank:7,intent:'하우스 로우볼',detail:'낮은 숫자로 판을 흔들고 플레이어의 무늬 흐름을 끊는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:20,reason:'초반에는 로우볼로 판을 흐림'}),Object.freeze({when:'player_suit_lead',add:20,reason:'플레이어 무늬 우세를 낮은 패로 방해'})])}),
          Object.freeze({id:'house_edge',weight:55,minRank:9,maxRank:14,intent:'하우스 엣지',detail:'고랭크와 트럼프로 하우스 우위를 강제로 회수한다.',suitPolicy:'prefer_trump',suitChance:70,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:30,reason:'쇼다운 직전 하우스 우위를 강제'}),Object.freeze({when:'enemy_behind',add:25,reason:'하우스가 밀려 강한 패를 투입'})])})
        ])
      }),
      phases:Object.freeze([
        Object.freeze({id:'open_tables',label:'오픈 테이블',minHpRatio:.66,rule:Object.freeze({id:'house_open',label:'오픈 테이블',description:'세트 시작 시 보호막 1을 얻는다.',effects:Object.freeze([Object.freeze({id:'house-open-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:1}),duration:'set'})])})}),
        Object.freeze({id:'high_stakes',label:'하이 스테이크',minHpRatio:.33,rule:Object.freeze({id:'house-high',label:'하이 스테이크',description:'세트 시작 시 보호막 2를 얻고 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'house-high-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),Object.freeze({id:'house-high-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})])})}),
        Object.freeze({id:'house_always_wins',label:'하우스는 항상 이긴다',minHpRatio:0,rule:Object.freeze({id:'house-final',label:'하우스 우위',description:'세트 시작 시 보호막 3을 얻고 플레이어에게 출혈 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'house-final-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:3}),duration:'set'}),Object.freeze({id:'house-final-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})])})})
      ])
    })
  });

  const EVENT_DEFINITIONS=Object.freeze({
    sunken_roulette:Object.freeze({id:'sunken_roulette',name:'침수 룰렛',description:'물에 잠긴 룰렛이 아직 돌아간다. 다음 전투의 칩을 걸고 안전과 올인 사이를 고른다.',eventTag:'gambling',choices:Object.freeze([
      Object.freeze({id:'safe',label:'안전 베팅',description:'다음 전투 칩 +1',actions:Object.freeze([Object.freeze({type:'pending_chips',amount:1})])}),
      Object.freeze({id:'all_in',label:'올인',description:'체력 4를 잃고 다음 전투 칩 +3',actions:Object.freeze([Object.freeze({type:'damage_player',amount:4}),Object.freeze({type:'pending_chips',amount:3})])})
    ])}),
    cracked_vault:Object.freeze({id:'cracked_vault',name:'금 간 금고',description:'금고 틈으로 칩과 카드가 보인다. 안전하게 회수하거나 강제로 뜯을 수 있다.',eventTag:'risk',choices:Object.freeze([
      Object.freeze({id:'skim',label:'조금만 회수',description:'골드 +18 · 다음 전투 칩 +1',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:18}),Object.freeze({type:'pending_chips',amount:1})])}),
      Object.freeze({id:'force',label:'금고 강제 개방',description:'체력 2를 잃고 카드 1장 · 다음 전투 칩 +2',actions:Object.freeze([Object.freeze({type:'damage_player',amount:2}),Object.freeze({type:'add_card',mode:'generated'}),Object.freeze({type:'pending_chips',amount:2})])})
    ])}),
    lowball_river:Object.freeze({id:'lowball_river',name:'로우볼 리버',description:'낮은 숫자가 오히려 가치 있는 테이블이다. 낮은 순수 카드를 챙기거나 현금화한다.',eventTag:'river',choices:Object.freeze([
      Object.freeze({id:'take_low',label:'낮은 패를 챙긴다',description:'2~5 순수 카드 1장 · 다음 전투 칩 +1',actions:Object.freeze([Object.freeze({type:'gain_low_card'}),Object.freeze({type:'pending_chips',amount:1})])}),
      Object.freeze({id:'cash_out',label:'현금화',description:'체력 5 회복 · 다음 전투 칩 +1',actions:Object.freeze([Object.freeze({type:'heal',amount:5}),Object.freeze({type:'pending_chips',amount:1})])})
    ])}),
    vip_comp:Object.freeze({id:'vip_comp',name:'VIP 서비스',description:'침수 직전 남은 VIP 서비스가 한 번 더 제공된다.',eventTag:'general',choices:Object.freeze([
      Object.freeze({id:'rest',label:'VIP 라운지에서 쉰다',description:'체력 8 회복',actions:Object.freeze([Object.freeze({type:'heal',amount:8})])}),
      Object.freeze({id:'credit',label:'하우스 크레딧을 받는다',description:'골드 +12 · 다음 전투 칩 +2',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:12}),Object.freeze({type:'pending_chips',amount:2})])})
    ])})
  });

  let combatInstalled=false,eventInstalled=false,presentationInstalled=false;

  function activeRun(runtimeRoot=defaultRoot){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function activeBattle(runtimeRoot=defaultRoot){if(runtimeRoot?.battle)return runtimeRoot.battle;try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return null}
  function isCasinoNode(node,runState=activeRun()){return !!node&&((node?.regionPlan?.regionId||runState?.runFlow?.currentRegionId||runState?.actId)===REGION_ID)}
  function content(id){return CONTENT[id]||null}
  function contentIdForNode(node,runState=activeRun()){
    if(!isCasinoNode(node,runState)||!['battle','elite','boss'].includes(node?.type))return null;
    if(node.type==='elite')return'vault_collector';
    if(node.type==='boss')return'drowned_house';
    const tag=node?.regionPlan?.enemyTag||'standard';
    if(tag==='bluffer'||tag==='reverse')return'casino_bluffer';
    if(tag==='debt_collector')return'casino_debt_collector';
    return'casino_lowroller';
  }
  function prepareNode(node,runState=activeRun()){
    const id=contentIdForNode(node,runState);if(id)node.enemyContentId=id;return id;
  }
  function contentForState(state){return content(state?.node?.enemyContentId)||null}
  function phaseFor(contentDef,stateOrRatio){
    const phases=contentDef?.phases||[];if(!phases.length)return null;
    const ratio=typeof stateOrRatio==='number'?Math.max(0,Math.min(1,stateOrRatio)):(()=>{const hp=Math.max(0,Number(stateOrRatio?.enemy?.hp)||0),max=Math.max(1,Number(stateOrRatio?.enemy?.maxHp)||1);return hp/max})();
    return phases.find(phase=>ratio>=phase.minHpRatio)||phases.at(-1)||null;
  }
  function cloneEffect(effect){return{...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}}
  function makeRuleOwner(rule,contentDef,phase=null){
    if(!rule)return null;return{id:rule.id,label:rule.label,description:rule.description||'',effectOwnerType:'boss_rule',encounterManaged:false,casinoM9Managed:true,enemyContentId:contentDef.id,bossPhaseId:phase?.id||null,effects:(rule.effects||[]).map(cloneEffect),rulesOverride:{}};
  }
  function syncContentEncounter(state){
    const contentDef=contentForState(state);if(!state||!contentDef)return{changed:false,content:null,phase:null};
    const previousPhase=state.bossPhase?.id||null,external=(Array.isArray(state.bossRules)?state.bossRules:[]).filter(rule=>rule?.encounterManaged!==true&&rule?.content9BManaged!==true&&rule?.casinoM9Managed!==true),phase=contentDef.type==='boss'?phaseFor(contentDef,state):null,rule=makeRuleOwner(contentDef.type==='boss'?phase?.rule:contentDef.rule,contentDef,phase);
    state.encounterProfileId=`casino:${contentDef.id}`;state.encounterRules=rule?[rule]:[];state.bossRules=[...external,...(rule?[rule]:[])];state.bossPhase=phase?{id:phase.id,label:phase.label,minHpRatio:phase.minHpRatio}:null;
    state.encounter={...(state.encounter||{}),profileId:state.encounterProfileId,contentId:contentDef.id,contentStage:STAGE,bossPhases:(contentDef.phases||[]).map(item=>({id:item.id,label:item.label,minHpRatio:item.minHpRatio}))};
    state.rulesOverride=EncounterRules?.resolveRulesOverride?EncounterRules.resolveRulesOverride(state):state.rulesOverride||{};state.encounterRulesInitialized=true;
    return{changed:previousPhase!==(state.bossPhase?.id||null),content:contentDef,phase:state.bossPhase,rule};
  }
  function applyBattleContent(state){
    const contentDef=contentForState(state);if(!state||!contentDef)return null;
    if(state.enemy&&typeof state.enemy==='object'){
      state.enemy.contentId=contentDef.id;state.enemy.contentStage=STAGE;state.enemy.name=contentDef.label;state.enemy.sprite=contentDef.sprite;state.enemy.sub=contentDef.summary;
      if(state.enemy.aiMemory&&typeof state.enemy.aiMemory==='object')state.enemy.aiMemory.profileId=contentDef.behavior.id;
    }
    syncContentEncounter(state);return contentDef;
  }
  function validateContent(registry=CONTENT){
    const errors=[],profiles={};
    for(const[id,entry]of Object.entries(registry||{})){
      if(entry?.id!==id)errors.push(`${id}: id mismatch`);if(!['battle','elite','boss'].includes(entry?.type))errors.push(`${id}: invalid type`);if(!entry?.label||!entry?.summary)errors.push(`${id}: missing label/summary`);if(!entry?.behavior)errors.push(`${id}: missing behavior`);else profiles[id]=entry.behavior;
      if(entry?.rule)errors.push(...(CardEffects?.validateEffectList?.(entry.rule.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/rule: ${error}`));
      let previous=Infinity;for(const phase of entry?.phases||[]){if(!phase?.id||!Number.isFinite(phase.minHpRatio)||phase.minHpRatio<0||phase.minHpRatio>1)errors.push(`${id}: invalid phase`);if(Number.isFinite(phase.minHpRatio)&&phase.minHpRatio>previous)errors.push(`${id}: phases must descend`);previous=phase.minHpRatio;errors.push(...(CardEffects?.validateEffectList?.(phase?.rule?.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/${phase?.id}: ${error}`))}if(entry?.phases?.length&&entry.phases.at(-1).minHpRatio!==0)errors.push(`${id}: last phase must start at 0`);
    }
    if(EnemyBehavior?.validateProfiles)errors.push(...EnemyBehavior.validateProfiles(profiles));return errors;
  }
  function buildEnemyCard(contentDef,pattern,context,random=Math.random){
    const normalized=EnemyBehavior.normalizeContext(context),rank=EnemyBehavior.randomInt(pattern.minRank,pattern.maxRank,random),suit=EnemyBehavior.chooseSuit(pattern,normalized,random),reason=EnemyBehavior.explainDecision(contentDef.behavior,pattern,normalized,suit);
    return{suit,rank,enemyBehaviorId:pattern.id,enemyProfileId:contentDef.behavior.id,enemyContentId:contentDef.id,enemyPersonality:contentDef.behavior.personality.archetype,enemyIntent:pattern.intent,enemyIntentDetail:pattern.detail||'',enemyIntentReason:reason,enemyPlannedSet:normalized.setIndex,enemyPlannedTrick:normalized.trick,enemyMemorySnapshot:EnemyBehavior.enemyMemorySnapshot(normalized.enemyMemory)};
  }
  function chooseContentPlay(contentDef,context={},random=Math.random){
    const normalized=EnemyBehavior.normalizeContext(context),pattern=EnemyBehavior.weightedPattern(contentDef.behavior.patterns,random,normalized),card=buildEnemyCard(contentDef,pattern,normalized,random);
    return{contentId:contentDef.id,profileId:contentDef.behavior.id,patternId:pattern.id,card,intent:{title:card.enemyIntent,detail:card.enemyIntentDetail,reason:card.enemyIntentReason,personality:contentDef.behavior.personality.archetype},weights:EnemyBehavior.patternWeightTable(contentDef.behavior.patterns,normalized)};
  }
  function ensureRunState(runState){
    if(!runState||typeof runState!=='object')return null;const current=runState.casinoM9&&typeof runState.casinoM9==='object'?runState.casinoM9:{};runState.casinoM9={...current,version:STAGE,nextBattleChips:Math.max(0,Math.min(PENDING_CHIP_CAP,Math.floor(Number(current.nextBattleChips)||0))),eventHistory:Array.isArray(current.eventHistory)?current.eventHistory:[],activeEvent:current.activeEvent&&typeof current.activeEvent==='object'?current.activeEvent:null};return runState.casinoM9;
  }
  function reserveNextBattleChips(runState,amount){const state=ensureRunState(runState);if(!state)return{ok:false,reason:'no_run'};const before=state.nextBattleChips,requested=Math.max(0,Math.floor(Number(amount)||0));state.nextBattleChips=Math.min(PENDING_CHIP_CAP,before+requested);return{ok:true,before,after:state.nextBattleChips,gained:state.nextBattleChips-before,cap:PENDING_CHIP_CAP}}
  function consumePendingChips(runState,battleState,{chipApi=ChipEconomy}={}){
    const state=ensureRunState(runState);if(!state||!battleState)return{ok:false,reason:'missing_state'};if(battleState.casinoM9ChipsApplied)return{ok:true,duplicate:true,gained:0};const amount=state.nextBattleChips;state.nextBattleChips=0;battleState.casinoM9ChipsApplied=true;if(amount<=0)return{ok:true,gained:0};const result=chipApi?.grantChips?.(battleState,amount,{source:'casino_event'});return{ok:true,gained:Number(result?.gained)||0,result};
  }
  function wrapGenEnemyCard(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.genEnemyCard;if(typeof original!=='function')return false;if(original.__casinoRegionM9)return true;
    function wrapped(...args){const state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(!state||!contentDef)return original.apply(this,args);const planned=original.apply(this,args),base=EnemyBehavior.battleContext(state),context=EnemyBehavior.normalizeContext({...base,setIndex:planned?.enemyPlannedSet??base.setIndex,trick:planned?.enemyPlannedTrick??base.trick,enemyMemory:state.enemy?.aiMemory||base.enemyMemory});return chooseContentPlay(contentDef,context,Math.random).card}
    wrapped.__casinoRegionM9=true;wrapped.__legacyGenEnemyCard=original;runtimeRoot.genEnemyCard=wrapped;return true;
  }
  function wrapStartBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.startBattle;if(typeof original!=='function')return false;if(original.__casinoRegionM9)return true;
    function wrapped(node,...args){
      if(!isCasinoNode(node,activeRun(runtimeRoot)))return original.call(this,node,...args);prepareNode(node,activeRun(runtimeRoot));const previousRunEffects=runtimeRoot.runCardEffects;let primed=false;
      const prime=()=>{const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot);if(state&&!primed){prepareNode(state.node||node,runState);applyBattleContent(state);consumePendingChips(runState,state,{chipApi:runtimeRoot.ChipEconomy||ChipEconomy});primed=true}return state};
      if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=function(...effectArgs){prime();return previousRunEffects.apply(this,effectArgs)};
      const restore=()=>{if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=previousRunEffects};const finalize=result=>{prime();runtimeRoot.renderBattle?.();return result};
      try{const result=original.call(this,node,...args);if(result&&typeof result.then==='function')return result.then(finalize).finally(restore);const final=finalize(result);restore();return final}catch(error){restore();throw error}
    }
    wrapped.__casinoRegionM9=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true;
  }
  function wrapDamageEnemy(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.damageEnemy;if(typeof original!=='function')return false;if(original.__casinoRegionM9)return true;
    function wrapped(...args){const result=original.apply(this,args),state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(state&&contentDef?.type==='boss'){const transition=syncContentEncounter(state);if(transition.changed)runtimeRoot.renderBattle?.()}return result}
    wrapped.__casinoRegionM9=true;wrapped.__legacyDamageEnemy=original;runtimeRoot.damageEnemy=wrapped;return true;
  }
  function eventForNode(node){
    if(!isCasinoNode(node))return null;const tag=node?.regionPlan?.eventTag||'general';return Object.values(EVENT_DEFINITIONS).find(event=>event.eventTag===tag)||EVENT_DEFINITIONS.vip_comp;
  }
  function lowCard(runState,{runtimeRoot=defaultRoot,salt='casino-low'}={}){
    const rng=RunEvents?.deterministicRng?.(runState,salt,runtimeRoot)||Math.random,suits=['S','H','D','C'],suit=suits[Math.floor(rng()*suits.length)],rank=2+Math.floor(rng()*4),uid=`casino-${runState?.runSeed||0}-${suit}${rank}-${ensureRunState(runState).eventHistory.length}`;
    const card=typeof runtimeRoot?.makeCard==='function'?runtimeRoot.makeCard(suit,rank,uid):{suit,rank,printedSuit:suit,printedRank:rank,uid};if(!Array.isArray(runState.deck))runState.deck=[];runState.deck.push(card);return card;
  }
  function applyEventAction(runState,node,event,choice,action,{runtimeRoot=defaultRoot,index=0}={}){
    if(action?.type==='pending_chips')return reserveNextBattleChips(runState,action.amount);
    if(action?.type==='gain_low_card')return{ok:true,type:'gain_low_card',card:lowCard(runState,{runtimeRoot,salt:`${event.id}:${choice.id}:${index}`})};
    return RunEvents?.applyAction?.(runState,action,{runtimeRoot,node,salt:`casino:${event.id}:${choice.id}:${index}`})||{ok:false,reason:'run_events_unavailable'};
  }
  function chooseCasinoEvent(runState,node,choiceId,{runtimeRoot=defaultRoot}={}){
    if(!runState||!node||!isCasinoNode(node,runState))return{ok:false,reason:'not_casino_event'};const state=ensureRunState(runState),event=state.activeEvent?.nodeId===node.id?EVENT_DEFINITIONS[state.activeEvent.eventId]:eventForNode(node),choice=event?.choices?.find(item=>item.id===choiceId);if(!event||!choice)return{ok:false,reason:'invalid_choice'};
    const results=choice.actions.map((action,index)=>applyEventAction(runState,node,event,choice,action,{runtimeRoot,index}));const history={step:state.eventHistory.length+1,eventId:event.id,nodeId:node.id,choiceId:choice.id,results};state.eventHistory.push(history);state.activeEvent=null;runtimeRoot.sfx?.('reward');runtimeRoot.completeNode?.(node);return{ok:true,eventId:event.id,choiceId:choice.id,results};
  }
  function escapeHtml(value){return RunEvents?.escapeHtml?.(value)??String(value??'')}
  function casinoEventHtml(event){return`<h2>이벤트 · ${escapeHtml(event.name)}</h2><p>${escapeHtml(event.description)}</p><div class="choiceList" data-casino-m9-event="${escapeHtml(event.id)}">${event.choices.map(choice=>`<button class="choice" data-casino-choice="${escapeHtml(choice.id)}"><b>${escapeHtml(choice.label)}</b><span>${escapeHtml(choice.description)}</span></button>`).join('')}</div>`}
  function showCasinoEvent(node,runtimeRoot=defaultRoot){
    const runState=activeRun(runtimeRoot),event=eventForNode(node);if(!runState||!event)return false;const state=ensureRunState(runState);state.activeEvent={eventId:event.id,nodeId:node.id};const html=casinoEventHtml(event);if(typeof runtimeRoot?.showModal==='function')runtimeRoot.showModal(html);else if(!RunEvents?.showModal?.(runtimeRoot,html))return false;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);doc?.querySelectorAll?.('[data-casino-choice]')?.forEach(button=>button.onclick=()=>chooseCasinoEvent(runState,node,button.dataset?.casinoChoice||button.getAttribute?.('data-casino-choice'),{runtimeRoot}));return true;
  }
  function wrapShowEvent(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.showEvent;if(typeof original!=='function')return false;if(original.__casinoRegionM9)return true;
    function wrapped(node,...args){if(isCasinoNode(node,activeRun(runtimeRoot)))return showCasinoEvent(node,runtimeRoot);return original.call(this,node,...args)}wrapped.__casinoRegionM9=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true;
  }
  function syncPresentation(runtimeRoot=defaultRoot){const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),screen=doc?.getElementById?.('battleScreen');if(screen?.dataset&&(runState?.runFlow?.currentRegionId===REGION_ID||runState?.actId===REGION_ID))screen.dataset.battleRegion=REGION_ID;return !!screen}
  function wrapPresentation(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__casinoRegionM9Presentation)return true;function wrapped(...args){const result=original.apply(this,args);syncPresentation(runtimeRoot);return result}wrapped.__casinoRegionM9Presentation=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function injectStyle(runtimeRoot=defaultRoot){const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc?.createElement||doc.getElementById?.('trick-casino-m9-style'))return false;const style=doc.createElement('style');style.id='trick-casino-m9-style';style.textContent='#battleScreen[data-battle-region="region_casino"]{--battle-accent:#d6b66b;--battle-accent-soft:#514529;--battle-sky:#1a2027;--battle-floor:#10191b;--battle-glow:#d4b04a30}';(doc.head||doc.documentElement)?.appendChild(style);return true}
  function installBrowserRuntime(runtimeRoot=defaultRoot){if(combatInstalled)return true;const errors=validateContent();if(errors.length){runtimeRoot?.console?.error?.('[M9 casino] 콘텐츠 오류',errors);return false}if(!EnemyBehavior||!EncounterRules||!RunEvents||!wrapGenEnemyCard(runtimeRoot)||!wrapStartBattle(runtimeRoot)||!wrapDamageEnemy(runtimeRoot))return false;injectStyle(runtimeRoot);runtimeRoot.casinoEventPick=(nodeId,choiceId)=>{const runState=activeRun(runtimeRoot),node=(runState?.map||[]).find(item=>item.id===nodeId);return chooseCasinoEvent(runState,node,choiceId,{runtimeRoot})};combatInstalled=true;return true}
  function installLateWrappers(runtimeRoot=defaultRoot){
    if(!eventInstalled&&runtimeRoot?.ContentExpansion9C&&runtimeRoot?.showEvent?.__contentExpansion9C)eventInstalled=wrapShowEvent(runtimeRoot);
    if(!presentationInstalled&&runtimeRoot?.BattleLayout&&typeof runtimeRoot?.renderBattle==='function')presentationInstalled=wrapPresentation(runtimeRoot);
    return eventInstalled&&presentationInstalled;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{installBrowserRuntime(runtimeRoot);installLateWrappers(runtimeRoot);if(combatInstalled&&eventInstalled&&presentationInstalled)return;if(attempts++<120)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[M9 casino] 런타임 연결을 완료하지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function resetForTests(){combatInstalled=false;eventInstalled=false;presentationInstalled=false}

  return{STAGE,REGION_ID,PENDING_CHIP_CAP,CONTENT,EVENT_DEFINITIONS,activeRun,activeBattle,isCasinoNode,content,contentIdForNode,prepareNode,contentForState,phaseFor,cloneEffect,makeRuleOwner,syncContentEncounter,applyBattleContent,validateContent,buildEnemyCard,chooseContentPlay,ensureRunState,reserveNextBattleChips,consumePendingChips,wrapGenEnemyCard,wrapStartBattle,wrapDamageEnemy,eventForNode,lowCard,applyEventAction,chooseCasinoEvent,casinoEventHtml,showCasinoEvent,wrapShowEvent,syncPresentation,wrapPresentation,injectStyle,installBrowserRuntime,installLateWrappers,installWhenReady,resetForTests};
});
