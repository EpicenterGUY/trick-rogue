(function(root,factory){
  const EnemyBehavior=typeof module!=='undefined'?require('./enemy-behavior-core.js'):root.EnemyBehavior;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const RunEvents=typeof module!=='undefined'?require('./run-events.js'):root.RunEvents;
  const api=factory(root,EnemyBehavior,EncounterRules,CardEffects,RunEvents);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ScrapMarketRegionM9=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,EnemyBehavior,EncounterRules,CardEffects,RunEvents){
  const STAGE='M9-SCRAP-MARKET-1';
  const REGION_ID='region_scrap_market';

  const CONTENT=Object.freeze({
    scrap_scavenger:Object.freeze({
      id:'scrap_scavenger',type:'battle',label:'부품 scavenger',sprite:'raider',
      summary:'낮은 숫자를 빠르게 해체하듯 소모하고 빈틈이 생기면 높은 숫자로 트릭을 회수한다.',
      behavior:Object.freeze({id:'scrap_scavenger',label:'부품 scavenger',personality:Object.freeze({archetype:'해체 순환형',summary:'낮은 패를 먼저 비우고 후반에 남은 고랭크를 집중한다.'}),patterns:Object.freeze([
        Object.freeze({id:'strip_parts',weight:60,minRank:2,maxRank:7,intent:'부품 해체',detail:'낮은 숫자를 먼저 소모해 손패의 밀도를 바꾼다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:25,reason:'초반에 값싼 부품부터 해체'}),Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 해체를 연속 반복하지 않음'})])}),
        Object.freeze({id:'cash_out',weight:40,minRank:9,maxRank:14,intent:'고철 환전',detail:'정리해 둔 고랭크와 트럼프로 뒤늦게 승부를 건다.',suitPolicy:'prefer_trump',suitChance:45,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:25,reason:'후반에 남은 고가 부품을 투입'}),Object.freeze({when:'enemy_behind',add:20,reason:'밀리면 고랭크를 바로 환전'})])})
      ])}),
      rule:Object.freeze({id:'scrap_scavenging',label:'노출된 부품',description:'세트 시작 시 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([
        Object.freeze({id:'scrap-scavenger-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})
      ])})
    }),
    patchwork_mechanic:Object.freeze({
      id:'patchwork_mechanic',type:'battle',label:'누더기 정비공',sprite:'hunter',
      summary:'중간 숫자를 이어 붙이며 보호막을 두르고 플레이어의 주력 무늬를 맞춰 온다.',
      behavior:Object.freeze({id:'patchwork_mechanic',label:'누더기 정비공',personality:Object.freeze({archetype:'재조립 방어형',summary:'중간 숫자와 무늬 견제로 시간을 벌며 방어 효율을 높인다.'}),patterns:Object.freeze([
        Object.freeze({id:'patch_line',weight:65,minRank:6,maxRank:11,intent:'누더기 조립',detail:'중간 숫자를 이어 붙여 안정적으로 트릭을 견딘다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어 주력 무늬에 맞춰 부품을 재조립'}),Object.freeze({when:'early_trick',add:10,reason:'초반부터 안정적인 조립을 시작'})])}),
        Object.freeze({id:'reinforced_part',weight:35,minRank:10,maxRank:14,intent:'강화 부품',detail:'밀릴 때 높은 숫자와 트럼프로 급히 보강한다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:30,reason:'구조가 무너지면 강화 부품을 투입'}),Object.freeze({when:'late_trick',add:15,reason:'후반 쇼다운 재료를 보호'})])})
      ])}),
      rule:Object.freeze({id:'patchwork_guard',label:'임시 장갑',description:'세트 시작 시 적이 보호막 2를 얻는다.',effects:Object.freeze([
        Object.freeze({id:'patchwork-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'})
      ])})
    }),
    scrap_hoarder:Object.freeze({
      id:'scrap_hoarder',type:'battle',label:'폐품 수집광',sprite:'raider',
      summary:'카드를 버리지 않고 중고랭크를 오래 쥐며 세트마다 조금씩 회복해 장기전을 만든다.',
      behavior:Object.freeze({id:'scrap_hoarder',label:'폐품 수집광',personality:Object.freeze({archetype:'비축 장기전형',summary:'중간 패를 오래 보존하다가 후반에 한꺼번에 꺼낸다.'}),patterns:Object.freeze([
        Object.freeze({id:'hoard_mid',weight:55,minRank:5,maxRank:10,intent:'폐품 비축',detail:'쓸 만한 중간 숫자로 최소한의 승부만 이어간다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:20,reason:'좋은 부품을 아끼며 값싼 패부터 사용'}),Object.freeze({when:'enemy_ahead',add:15,reason:'앞서면 비축을 유지'})])}),
        Object.freeze({id:'dump_stock',weight:45,minRank:9,maxRank:14,intent:'재고 방출',detail:'후반에 비축한 높은 숫자와 트럼프를 한꺼번에 쓴다.',suitPolicy:'prefer_trump',suitChance:50,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:30,reason:'쇼다운 전에 재고를 방출'}),Object.freeze({when:'enemy_behind',add:20,reason:'밀리면 비축을 포기하고 강한 패 사용'})])})
      ])}),
      rule:Object.freeze({id:'scrap_stockpile',label:'쌓아 둔 부품',description:'세트 시작 시 적에게 재생 1을 부여한다.',effects:Object.freeze([
        Object.freeze({id:'scrap-hoarder-regen',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'regen',amount:1}),duration:'set'})
      ])})
    }),
    dismantling_foreman:Object.freeze({
      id:'dismantling_foreman',type:'elite',label:'해체장 감독관',sprite:'hunter',
      summary:'보호막을 두른 채 플레이어를 취약하게 만들어 작은 판단 실수도 큰 손실로 바꾸는 엘리트.',
      behavior:Object.freeze({id:'dismantling_foreman',label:'해체장 감독관',personality:Object.freeze({archetype:'해체 압박형',summary:'무늬 봉쇄와 고랭크 압박을 번갈아 사용해 플레이어의 재료를 쪼갠다.'}),patterns:Object.freeze([
        Object.freeze({id:'foreman_sort',weight:50,minRank:7,maxRank:11,intent:'분류 명령',detail:'플레이어 주력 무늬를 따라가며 쇼다운 재료를 분산시킨다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:30,reason:'주력 무늬를 우선 해체'}),Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 분류를 연속 지시하지 않음'})])}),
        Object.freeze({id:'foreman_press',weight:50,minRank:10,maxRank:14,intent:'압축기 가동',detail:'높은 숫자와 트럼프로 결정적인 트릭을 눌러 버린다.',suitPolicy:'prefer_trump',suitChance:65,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:25,reason:'작업 속도가 밀리면 압축기 가동'}),Object.freeze({when:'late_trick',add:20,reason:'후반에 압축 압력을 높임'})])})
      ])}),
      rule:Object.freeze({id:'foreman_protocol',label:'강제 해체',description:'세트 시작 시 적 보호막 2, 플레이어 취약 1.',effects:Object.freeze([
        Object.freeze({id:'foreman-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),
        Object.freeze({id:'foreman-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})
      ])})
    }),
    junkyard_engine:Object.freeze({
      id:'junkyard_engine',type:'boss',label:'폐품 압축 코어',sprite:'boss',
      summary:'시장 전체의 폐품을 분류·압축·과열시키며 단계가 내려갈수록 방어와 취약 압박을 동시에 강화한다.',
      behavior:Object.freeze({id:'junkyard_engine',label:'폐품 압축 코어',personality:Object.freeze({archetype:'압축 단계형',summary:'중간 숫자로 재료를 분류한 뒤 후반에 고랭크와 트럼프로 압축한다.'}),patterns:Object.freeze([
        Object.freeze({id:'sorting_belt',weight:45,minRank:6,maxRank:10,intent:'분류 벨트',detail:'중간 숫자로 플레이어 무늬를 분류하고 흐름을 끊는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:20,reason:'초반에는 재료 분류부터 시작'}),Object.freeze({when:'player_suit_lead',add:20,reason:'플레이어 주력 무늬를 분류 대상으로 지정'})])}),
        Object.freeze({id:'compression_cycle',weight:55,minRank:10,maxRank:14,intent:'압축 사이클',detail:'고랭크와 트럼프로 압축력을 높여 트릭을 직접 회수한다.',suitPolicy:'prefer_trump',suitChance:70,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:30,reason:'쇼다운 직전 압축 사이클 강화'}),Object.freeze({when:'enemy_behind',add:25,reason:'밀리면 압축력을 즉시 높임'})])})
      ])}),
      phases:Object.freeze([
        Object.freeze({id:'sorting',label:'분류',minHpRatio:.66,rule:Object.freeze({id:'junkyard-sorting',label:'분류 단계',description:'세트 시작 시 적 보호막 1.',effects:Object.freeze([
          Object.freeze({id:'junkyard-sort-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:1}),duration:'set'})
        ])})}),
        Object.freeze({id:'compression',label:'압축',minHpRatio:.33,rule:Object.freeze({id:'junkyard-compression',label:'압축 단계',description:'세트 시작 시 적 보호막 2, 플레이어 취약 1.',effects:Object.freeze([
          Object.freeze({id:'junkyard-compress-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),
          Object.freeze({id:'junkyard-compress-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})
        ])})}),
        Object.freeze({id:'overheat',label:'과열',minHpRatio:0,rule:Object.freeze({id:'junkyard-overheat',label:'과열 단계',description:'세트 시작 시 플레이어 취약 1과 출혈 1.',effects:Object.freeze([
          Object.freeze({id:'junkyard-overheat-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'}),
          Object.freeze({id:'junkyard-overheat-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})
        ])})})
      ])
    })
  });

  const EVENT_DEFINITIONS=Object.freeze({
    salvage_line:Object.freeze({id:'salvage_line',name:'해체 라인',description:'낡은 카드 한 장을 부품으로 돌릴 수 있다. 가장 낮은 숫자를 해체하거나 그냥 쓸 만한 부품만 챙긴다.',eventTag:'salvage',choices:Object.freeze([
      Object.freeze({id:'dismantle',label:'가장 낮은 카드 해체',description:'덱이 2장 이상이면 가장 낮은 숫자 카드 1장 제거 · 골드 +22',actions:Object.freeze([Object.freeze({type:'remove_lowest'}),Object.freeze({type:'gain_gold',amount:22})])}),
      Object.freeze({id:'parts',label:'부품만 챙긴다',description:'골드 +16',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:16})])})
    ])}),
    reassembly_bench:Object.freeze({id:'reassembly_bench',name:'재조립 벤치',description:'마모된 카드의 숫자 부품을 다시 맞춘다. 약한 카드를 강화하거나 새 재료를 가져갈 수 있다.',eventTag:'rebuild',choices:Object.freeze([
      Object.freeze({id:'reinforce',label:'가장 낮은 카드 재조립',description:'가장 낮은 숫자 카드 1장 강화',actions:Object.freeze([Object.freeze({type:'upgrade_lowest'})])}),
      Object.freeze({id:'spare_card',label:'남은 부품으로 카드 제작',description:'카드 1장 획득',actions:Object.freeze([Object.freeze({type:'add_card',mode:'generated'})])})
    ])}),
    unstable_compactor:Object.freeze({id:'unstable_compactor',name:'불안정한 압축기',description:'고철 더미 아래에 값나가는 부품이 보인다. 안전하게 챙기거나 압축기를 억지로 돌릴 수 있다.',eventTag:'risk',choices:Object.freeze([
      Object.freeze({id:'skim',label:'겉의 부품만 챙긴다',description:'골드 +18',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:18})])}),
      Object.freeze({id:'force',label:'압축기를 강제 가동',description:'체력 4를 잃고 가장 낮은 카드 강화 · 골드 +28',actions:Object.freeze([Object.freeze({type:'damage_player',amount:4}),Object.freeze({type:'upgrade_lowest'}),Object.freeze({type:'gain_gold',amount:28})])})
    ])}),
    spare_parts_bin:Object.freeze({id:'spare_parts_bin',name:'예비 부품 상자',description:'분류가 끝난 폐품 중 아직 쓸 수 있는 물건이 남아 있다.',eventTag:'general',choices:Object.freeze([
      Object.freeze({id:'sell',label:'쓸 만한 부품을 판다',description:'골드 +15',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:15})])}),
      Object.freeze({id:'repair',label:'응급 수리에 쓴다',description:'체력 5 회복',actions:Object.freeze([Object.freeze({type:'heal',amount:5})])})
    ])})
  });

  let combatInstalled=false,eventInstalled=false,presentationInstalled=false;
  function activeRun(runtimeRoot=defaultRoot){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function activeBattle(runtimeRoot=defaultRoot){if(runtimeRoot?.battle)return runtimeRoot.battle;try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return null}
  function isScrapMarketNode(node,runState=activeRun()){return!!node&&((node?.regionPlan?.regionId||runState?.runFlow?.currentRegionId||runState?.actId)===REGION_ID)}
  function content(id){return CONTENT[id]||null}
  function contentIdForNode(node,runState=activeRun()){
    if(!isScrapMarketNode(node,runState)||!['battle','elite','boss'].includes(node?.type))return null;
    if(node.type==='elite')return'dismantling_foreman';if(node.type==='boss')return'junkyard_engine';
    const tag=node?.regionPlan?.enemyTag||'standard';if(tag==='salvager')return'scrap_scavenger';if(tag==='modifier')return'patchwork_mechanic';if(tag==='hoarder')return'scrap_hoarder';return'patchwork_mechanic';
  }
  function prepareNode(node,runState=activeRun()){const id=contentIdForNode(node,runState);if(id)node.enemyContentId=id;return id}
  function contentForState(state){return content(state?.node?.enemyContentId)||null}
  function phaseFor(contentDef,stateOrRatio){const phases=contentDef?.phases||[];if(!phases.length)return null;const ratio=typeof stateOrRatio==='number'?Math.max(0,Math.min(1,stateOrRatio)):(()=>{const hp=Math.max(0,Number(stateOrRatio?.enemy?.hp)||0),max=Math.max(1,Number(stateOrRatio?.enemy?.maxHp)||1);return hp/max})();return phases.find(phase=>ratio>=phase.minHpRatio)||phases.at(-1)||null}
  function cloneEffect(effect){return{...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}}
  function makeRuleOwner(rule,contentDef,phase=null){if(!rule)return null;return{id:rule.id,label:rule.label,description:rule.description||'',effectOwnerType:'boss_rule',encounterManaged:false,scrapMarketM9Managed:true,enemyContentId:contentDef.id,bossPhaseId:phase?.id||null,effects:(rule.effects||[]).map(cloneEffect),rulesOverride:{}}}
  function syncContentEncounter(state){
    const contentDef=contentForState(state);if(!state||!contentDef)return{changed:false,content:null,phase:null};
    const previousPhase=state.bossPhase?.id||null,external=(Array.isArray(state.bossRules)?state.bossRules:[]).filter(rule=>rule?.encounterManaged!==true&&rule?.content9BManaged!==true&&rule?.casinoM9Managed!==true&&rule?.redWardM9Managed!==true&&rule?.scrapMarketM9Managed!==true),phase=contentDef.type==='boss'?phaseFor(contentDef,state):null,rule=makeRuleOwner(contentDef.type==='boss'?phase?.rule:contentDef.rule,contentDef,phase);
    state.encounterProfileId=`scrap-market:${contentDef.id}`;state.encounterRules=rule?[rule]:[];state.bossRules=[...external,...(rule?[rule]:[])];state.bossPhase=phase?{id:phase.id,label:phase.label,minHpRatio:phase.minHpRatio}:null;
    state.encounter={...(state.encounter||{}),profileId:state.encounterProfileId,contentId:contentDef.id,contentStage:STAGE,bossPhases:(contentDef.phases||[]).map(item=>({id:item.id,label:item.label,minHpRatio:item.minHpRatio}))};
    state.rulesOverride=EncounterRules?.resolveRulesOverride?EncounterRules.resolveRulesOverride(state):state.rulesOverride||{};state.encounterRulesInitialized=true;
    return{changed:previousPhase!==(state.bossPhase?.id||null),content:contentDef,phase:state.bossPhase,rule};
  }
  function applyBattleContent(state){const contentDef=contentForState(state);if(!state||!contentDef)return null;if(state.enemy&&typeof state.enemy==='object'){state.enemy.contentId=contentDef.id;state.enemy.contentStage=STAGE;state.enemy.name=contentDef.label;state.enemy.sprite=contentDef.sprite;state.enemy.sub=contentDef.summary;if(state.enemy.aiMemory&&typeof state.enemy.aiMemory==='object')state.enemy.aiMemory.profileId=contentDef.behavior.id}syncContentEncounter(state);return contentDef}
  function validateContent(registry=CONTENT){const errors=[],profiles={};for(const[id,entry]of Object.entries(registry||{})){if(entry?.id!==id)errors.push(`${id}: id mismatch`);if(!['battle','elite','boss'].includes(entry?.type))errors.push(`${id}: invalid type`);if(!entry?.behavior)errors.push(`${id}: missing behavior`);else profiles[id]=entry.behavior;if(entry?.rule)errors.push(...(CardEffects?.validateEffectList?.(entry.rule.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/rule: ${error}`));let previous=Infinity;for(const phase of entry?.phases||[]){if(!phase?.id||!Number.isFinite(phase.minHpRatio)||phase.minHpRatio<0||phase.minHpRatio>1)errors.push(`${id}: invalid phase`);if(Number.isFinite(phase.minHpRatio)&&phase.minHpRatio>previous)errors.push(`${id}: phases must descend`);previous=phase.minHpRatio;errors.push(...(CardEffects?.validateEffectList?.(phase?.rule?.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/${phase?.id}: ${error}`))}if(entry?.phases?.length&&entry.phases.at(-1).minHpRatio!==0)errors.push(`${id}: last phase must start at 0`)}if(EnemyBehavior?.validateProfiles)errors.push(...EnemyBehavior.validateProfiles(profiles));return errors}
  function buildEnemyCard(contentDef,pattern,context,random=Math.random){const normalized=EnemyBehavior.normalizeContext(context),rank=EnemyBehavior.randomInt(pattern.minRank,pattern.maxRank,random),suit=EnemyBehavior.chooseSuit(pattern,normalized,random),reason=EnemyBehavior.explainDecision(contentDef.behavior,pattern,normalized,suit);return{suit,rank,enemyBehaviorId:pattern.id,enemyProfileId:contentDef.behavior.id,enemyContentId:contentDef.id,enemyPersonality:contentDef.behavior.personality.archetype,enemyIntent:pattern.intent,enemyIntentDetail:pattern.detail||'',enemyIntentReason:reason,enemyPlannedSet:normalized.setIndex,enemyPlannedTrick:normalized.trick,enemyMemorySnapshot:EnemyBehavior.enemyMemorySnapshot(normalized.enemyMemory)}}
  function chooseContentPlay(contentDef,context={},random=Math.random){const normalized=EnemyBehavior.normalizeContext(context),pattern=EnemyBehavior.weightedPattern(contentDef.behavior.patterns,random,normalized),card=buildEnemyCard(contentDef,pattern,normalized,random);return{contentId:contentDef.id,profileId:contentDef.behavior.id,patternId:pattern.id,card,intent:{title:card.enemyIntent,detail:card.enemyIntentDetail,reason:card.enemyIntentReason,personality:contentDef.behavior.personality.archetype},weights:EnemyBehavior.patternWeightTable(contentDef.behavior.patterns,normalized)}}
  function ensureRunState(runState){if(!runState||typeof runState!=='object')return null;let state=runState.scrapMarketM9;if(!state||typeof state!=='object')state=runState.scrapMarketM9={};state.version=STAGE;if(!Array.isArray(state.eventHistory))state.eventHistory=[];if(!state.activeEvent||typeof state.activeEvent!=='object')state.activeEvent=null;return state}
  function wrapGenEnemyCard(runtimeRoot=defaultRoot){const original=runtimeRoot?.genEnemyCard;if(typeof original!=='function')return false;if(original.__scrapMarketRegionM9)return true;function wrapped(...args){const state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(!state||!contentDef)return original.apply(this,args);const planned=original.apply(this,args),base=EnemyBehavior.battleContext(state),context=EnemyBehavior.normalizeContext({...base,setIndex:planned?.enemyPlannedSet??base.setIndex,trick:planned?.enemyPlannedTrick??base.trick,enemyMemory:state.enemy?.aiMemory||base.enemyMemory});return chooseContentPlay(contentDef,context,Math.random).card}wrapped.__scrapMarketRegionM9=true;wrapped.__legacyGenEnemyCard=original;runtimeRoot.genEnemyCard=wrapped;return true}
  function wrapStartBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.startBattle;if(typeof original!=='function')return false;if(original.__scrapMarketRegionM9)return true;function wrapped(node,...args){if(!isScrapMarketNode(node,activeRun(runtimeRoot)))return original.call(this,node,...args);prepareNode(node,activeRun(runtimeRoot));const previousRunEffects=runtimeRoot.runCardEffects;let primed=false;const prime=()=>{const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot);if(state&&!primed){prepareNode(state.node||node,runState);applyBattleContent(state);primed=true}return state};if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=function(...effectArgs){prime();return previousRunEffects.apply(this,effectArgs)};const restore=()=>{if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=previousRunEffects};const finalize=result=>{prime();runtimeRoot.renderBattle?.();return result};try{const result=original.call(this,node,...args);if(result&&typeof result.then==='function')return result.then(finalize).finally(restore);const final=finalize(result);restore();return final}catch(error){restore();throw error}}wrapped.__scrapMarketRegionM9=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true}
  function wrapDamageEnemy(runtimeRoot=defaultRoot){const original=runtimeRoot?.damageEnemy;if(typeof original!=='function')return false;if(original.__scrapMarketRegionM9)return true;function wrapped(...args){const result=original.apply(this,args),state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(state&&contentDef?.type==='boss'){const transition=syncContentEncounter(state);if(transition.changed)runtimeRoot.renderBattle?.()}return result}wrapped.__scrapMarketRegionM9=true;wrapped.__legacyDamageEnemy=original;runtimeRoot.damageEnemy=wrapped;return true}
  function eventForNode(node,runState=activeRun()){if(!isScrapMarketNode(node,runState))return null;const tag=node?.regionPlan?.eventTag||'general';return Object.values(EVENT_DEFINITIONS).find(event=>event.eventTag===tag)||EVENT_DEFINITIONS.spare_parts_bin}
  function lowestCardIndex(runState){const deck=Array.isArray(runState?.deck)?runState.deck:[];if(!deck.length)return-1;let best=0;for(let i=1;i<deck.length;i++){const rank=Number(deck[i]?.rank)||99,bestRank=Number(deck[best]?.rank)||99;if(rank<bestRank)best=i}return best}
  function applyEventAction(runState,node,event,choice,action,{runtimeRoot=defaultRoot,index=0}={}){
    if(action?.type==='remove_lowest'){if(!Array.isArray(runState?.deck)||runState.deck.length<=1)return{ok:false,type:'remove_lowest',reason:'deck_minimum'};const cardIndex=lowestCardIndex(runState);return RunEvents?.applyAction?.(runState,{type:'remove_card',index:cardIndex},{runtimeRoot,node,salt:`scrap-market:${event.id}:${choice.id}:${index}`})||{ok:false,reason:'run_events_unavailable'}}
    if(action?.type==='upgrade_lowest'){const cardIndex=lowestCardIndex(runState);if(cardIndex<0)return{ok:false,type:'upgrade_lowest',reason:'card_not_found'};return RunEvents?.applyAction?.(runState,{type:'upgrade_card',index:cardIndex},{runtimeRoot,node,salt:`scrap-market:${event.id}:${choice.id}:${index}`})||{ok:false,reason:'run_events_unavailable'}}
    return RunEvents?.applyAction?.(runState,action,{runtimeRoot,node,salt:`scrap-market:${event.id}:${choice.id}:${index}`})||{ok:false,reason:'run_events_unavailable'};
  }
  function chooseScrapMarketEvent(runState,node,choiceId,{runtimeRoot=defaultRoot}={}){if(!runState||!node||!isScrapMarketNode(node,runState))return{ok:false,reason:'not_scrap_market_event'};const state=ensureRunState(runState),event=state.activeEvent?.nodeId===node.id?EVENT_DEFINITIONS[state.activeEvent.eventId]:eventForNode(node,runState),choice=event?.choices?.find(item=>item.id===choiceId);if(!event||!choice)return{ok:false,reason:'invalid_choice'};const results=choice.actions.map((action,index)=>applyEventAction(runState,node,event,choice,action,{runtimeRoot,index}));const history={step:state.eventHistory.length+1,eventId:event.id,nodeId:node.id,choiceId:choice.id,results};state.eventHistory.push(history);state.activeEvent=null;runtimeRoot.sfx?.('reward');runtimeRoot.completeNode?.(node);return{ok:true,eventId:event.id,choiceId:choice.id,results}}
  function escapeHtml(value){return RunEvents?.escapeHtml?.(value)??String(value??'')}
  function scrapMarketEventHtml(event){return`<h2>이벤트 · ${escapeHtml(event.name)}</h2><p>${escapeHtml(event.description)}</p><div class="choiceList" data-scrap-market-m9-event="${escapeHtml(event.id)}">${event.choices.map(choice=>`<button class="choice" data-scrap-market-choice="${escapeHtml(choice.id)}"><b>${escapeHtml(choice.label)}</b><span>${escapeHtml(choice.description)}</span></button>`).join('')}</div>`}
  function showScrapMarketEvent(node,runtimeRoot=defaultRoot){const runState=activeRun(runtimeRoot),event=eventForNode(node,runState);if(!runState||!event)return false;const state=ensureRunState(runState);state.activeEvent={eventId:event.id,nodeId:node.id};const html=scrapMarketEventHtml(event);if(typeof runtimeRoot?.showModal==='function')runtimeRoot.showModal(html);else if(!RunEvents?.showModal?.(runtimeRoot,html))return false;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);doc?.querySelectorAll?.('[data-scrap-market-choice]')?.forEach(button=>button.onclick=()=>chooseScrapMarketEvent(runState,node,button.dataset?.scrapMarketChoice||button.getAttribute?.('data-scrap-market-choice'),{runtimeRoot}));return true}
  function wrapShowEvent(runtimeRoot=defaultRoot){const original=runtimeRoot?.showEvent;if(typeof original!=='function')return false;if(original.__scrapMarketRegionM9)return true;function wrapped(node,...args){if(isScrapMarketNode(node,activeRun(runtimeRoot)))return showScrapMarketEvent(node,runtimeRoot);return original.call(this,node,...args)}wrapped.__scrapMarketRegionM9=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true}
  function syncPresentation(runtimeRoot=defaultRoot){const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),screen=doc?.getElementById?.('battleScreen');if(screen?.dataset&&(runState?.runFlow?.currentRegionId===REGION_ID||runState?.actId===REGION_ID))screen.dataset.battleRegion=REGION_ID;return!!screen}
  function wrapPresentation(runtimeRoot=defaultRoot){const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__scrapMarketRegionM9Presentation)return true;function wrapped(...args){const result=original.apply(this,args);syncPresentation(runtimeRoot);return result}wrapped.__scrapMarketRegionM9Presentation=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function injectStyle(runtimeRoot=defaultRoot){const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc?.createElement||doc.getElementById?.('trick-scrap-market-m9-style'))return false;const style=doc.createElement('style');style.id='trick-scrap-market-m9-style';style.textContent='#battleScreen[data-battle-region="region_scrap_market"]{--battle-accent:#c89a58;--battle-accent-soft:#59452e;--battle-sky:#211d18;--battle-floor:#171511;--battle-glow:#d59b4b2b}';(doc.head||doc.documentElement)?.appendChild(style);return true}
  function installBrowserRuntime(runtimeRoot=defaultRoot){if(combatInstalled)return true;const errors=validateContent();if(errors.length){runtimeRoot?.console?.error?.('[M9 scrap market] 콘텐츠 오류',errors);return false}if(!EnemyBehavior||!EncounterRules||!RunEvents||!wrapGenEnemyCard(runtimeRoot)||!wrapStartBattle(runtimeRoot)||!wrapDamageEnemy(runtimeRoot))return false;injectStyle(runtimeRoot);runtimeRoot.scrapMarketEventPick=(nodeId,choiceId)=>{const runState=activeRun(runtimeRoot),node=(runState?.map||[]).find(item=>item.id===nodeId);return chooseScrapMarketEvent(runState,node,choiceId,{runtimeRoot})};combatInstalled=true;return true}
  function installLateWrappers(runtimeRoot=defaultRoot){if(!eventInstalled&&runtimeRoot?.RedWardRegionM9&&runtimeRoot?.showEvent?.__redWardRegionM9)eventInstalled=wrapShowEvent(runtimeRoot);if(!presentationInstalled&&runtimeRoot?.BattleLayout&&typeof runtimeRoot?.renderBattle==='function')presentationInstalled=wrapPresentation(runtimeRoot);return eventInstalled&&presentationInstalled}
  function installWhenReady(runtimeRoot=defaultRoot){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{installBrowserRuntime(runtimeRoot);installLateWrappers(runtimeRoot);if(combatInstalled&&eventInstalled&&presentationInstalled)return;if(attempts++<120)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[M9 scrap market] 런타임 연결을 완료하지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){combatInstalled=false;eventInstalled=false;presentationInstalled=false}
  return{STAGE,REGION_ID,CONTENT,EVENT_DEFINITIONS,activeRun,activeBattle,isScrapMarketNode,content,contentIdForNode,prepareNode,contentForState,phaseFor,cloneEffect,makeRuleOwner,syncContentEncounter,applyBattleContent,validateContent,buildEnemyCard,chooseContentPlay,ensureRunState,wrapGenEnemyCard,wrapStartBattle,wrapDamageEnemy,eventForNode,lowestCardIndex,applyEventAction,chooseScrapMarketEvent,scrapMarketEventHtml,showScrapMarketEvent,wrapShowEvent,syncPresentation,wrapPresentation,injectStyle,installBrowserRuntime,installLateWrappers,installWhenReady,resetForTests};
});
