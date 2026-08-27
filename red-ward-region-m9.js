(function(root,factory){
  const EnemyBehavior=typeof module!=='undefined'?require('./enemy-behavior-core.js'):root.EnemyBehavior;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const RunEvents=typeof module!=='undefined'?require('./run-events.js'):root.RunEvents;
  const api=factory(root,EnemyBehavior,EncounterRules,CardEffects,RunEvents);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.RedWardRegionM9=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,EnemyBehavior,EncounterRules,CardEffects,RunEvents){
  const STAGE='M9-RED-WARD-1';
  const REGION_ID='region_red_ward';

  const CONTENT=Object.freeze({
    ward_bleeder:Object.freeze({
      id:'ward_bleeder',type:'battle',label:'출혈 환자',sprite:'raider',
      summary:'높은 숫자로 급하게 트릭을 밀어붙이며 세트 시작마다 출혈 압박을 건다.',
      behavior:Object.freeze({id:'ward_bleeder',label:'출혈 환자',personality:Object.freeze({archetype:'출혈 압박형',summary:'고랭크 압박으로 빠르게 트릭을 가져간다.'}),patterns:Object.freeze([
        Object.freeze({id:'hemorrhage_push',weight:65,minRank:8,maxRank:14,intent:'출혈 압박',detail:'높은 숫자로 즉시 승부를 건다.',suitPolicy:'prefer_trump',suitChance:45,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:20,reason:'밀릴수록 출혈 압박을 강화'}),Object.freeze({when:'late_trick',add:15,reason:'후반에 지혈할 틈을 주지 않음'})])}),
        Object.freeze({id:'weak_pulse',weight:35,minRank:3,maxRank:8,intent:'약한 맥박',detail:'낮은 패를 소모하며 다음 압박을 준비한다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:20,reason:'초반에는 낮은 패를 정리'})])})
      ])}),
      rule:Object.freeze({id:'ward_bleed',label:'상처 악화',description:'세트 시작 시 플레이어에게 출혈 1을 부여한다.',effects:Object.freeze([
        Object.freeze({id:'ward-bleeder-status',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})
      ])})
    }),
    ward_orderly:Object.freeze({
      id:'ward_orderly',type:'battle',label:'방호 간병인',sprite:'hunter',
      summary:'보호막을 두르고 중간 숫자로 버티며 플레이어의 자원 소모를 유도한다.',
      behavior:Object.freeze({id:'ward_orderly',label:'방호 간병인',personality:Object.freeze({archetype:'방호 지연형',summary:'중간 숫자와 트럼프로 시간을 끌어 보호막의 효율을 높인다.'}),patterns:Object.freeze([
        Object.freeze({id:'guard_round',weight:60,minRank:6,maxRank:11,intent:'보호 순회',detail:'중간 숫자로 안정적인 승부를 이어간다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:20,reason:'플레이어 주력 무늬를 따라붙음'})])}),
        Object.freeze({id:'emergency_block',weight:40,minRank:9,maxRank:14,intent:'긴급 방호',detail:'밀릴 때 높은 숫자와 트럼프로 흐름을 끊는다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:30,reason:'밀리면 즉시 방호 강화'})])})
      ])}),
      rule:Object.freeze({id:'ward_guard',label:'방호복',description:'세트 시작 시 적이 보호막 2를 얻는다.',effects:Object.freeze([
        Object.freeze({id:'ward-orderly-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'})
      ])})
    }),
    ward_infected:Object.freeze({
      id:'ward_infected',type:'battle',label:'격리 감염자',sprite:'raider',
      summary:'불규칙한 숫자와 취약 상태로 피해 타이밍을 흔든다.',
      behavior:Object.freeze({id:'ward_infected',label:'격리 감염자',personality:Object.freeze({archetype:'감염 변동형',summary:'낮은 패와 높은 패를 섞어 다음 공격 강도를 읽기 어렵게 만든다.'}),patterns:Object.freeze([
        Object.freeze({id:'fever_spike',weight:50,minRank:9,maxRank:14,intent:'고열 급등',detail:'갑자기 높은 숫자로 트릭을 빼앗는다.',suitPolicy:'prefer_trump',suitChance:40,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:20,reason:'후반에 증상이 급격히 악화'})])}),
        Object.freeze({id:'fever_drop',weight:50,minRank:2,maxRank:7,intent:'체온 저하',detail:'낮은 숫자를 버리며 다음 급등을 숨긴다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:15,reason:'초반에는 낮은 패를 노출'})])})
      ])}),
      rule:Object.freeze({id:'ward_infection',label:'격리 노출',description:'세트 시작 시 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([
        Object.freeze({id:'ward-infected-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})
      ])})
    }),
    isolation_keeper:Object.freeze({
      id:'isolation_keeper',type:'elite',label:'격리동 책임자',sprite:'hunter',
      summary:'보호막을 유지하면서 플레이어의 출혈을 누적시키는 엘리트.',
      behavior:Object.freeze({id:'isolation_keeper',label:'격리동 책임자',personality:Object.freeze({archetype:'격리 통제형',summary:'안정적인 중고랭크와 트럼프로 출혈 시간을 번다.'}),patterns:Object.freeze([
        Object.freeze({id:'seal_ward',weight:55,minRank:7,maxRank:12,intent:'병동 봉쇄',detail:'플레이어 무늬를 따라가며 승부를 길게 끈다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'주력 무늬를 봉쇄'})])}),
        Object.freeze({id:'emergency_order',weight:45,minRank:10,maxRank:14,intent:'긴급 명령',detail:'고랭크와 트럼프로 결정적인 트릭을 노린다.',suitPolicy:'prefer_trump',suitChance:65,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:25,reason:'격리선이 무너지면 강제 개입'})])})
      ])}),
      rule:Object.freeze({id:'isolation_protocol',label:'격리 프로토콜',description:'세트 시작 시 적 보호막 2, 플레이어 출혈 1.',effects:Object.freeze([
        Object.freeze({id:'isolation-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),
        Object.freeze({id:'isolation-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})
      ])})
    }),
    red_director:Object.freeze({
      id:'red_director',type:'boss',label:'붉은 병동장',sprite:'boss',
      summary:'회복과 보호막으로 버티는 동안 출혈과 흉터를 단계적으로 강화하는 지역 보스.',
      behavior:Object.freeze({id:'red_director',label:'붉은 병동장',personality:Object.freeze({archetype:'응급 지휘형',summary:'중간 숫자로 시간을 벌다가 후반에 고랭크 압박을 집중한다.'}),patterns:Object.freeze([
        Object.freeze({id:'clinical_hold',weight:45,minRank:6,maxRank:10,intent:'임상 유지',detail:'중간 숫자로 치료 시간을 번다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:20,reason:'초반에는 병동 흐름을 통제'})])}),
        Object.freeze({id:'code_red',weight:55,minRank:10,maxRank:14,intent:'코드 레드',detail:'고랭크와 트럼프로 강제 승부를 건다.',suitPolicy:'prefer_trump',suitChance:70,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:30,reason:'쇼다운 직전 응급 명령'}),Object.freeze({when:'enemy_behind',add:20,reason:'밀리면 코드 레드를 발령'})])})
      ])}),
      phases:Object.freeze([
        Object.freeze({id:'triage',label:'트리아지',minHpRatio:.66,rule:Object.freeze({id:'director-triage',label:'트리아지',description:'세트 시작 시 적에게 재생 1.',effects:Object.freeze([
          Object.freeze({id:'director-regen',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'regen',amount:1}),duration:'set'})
        ])})}),
        Object.freeze({id:'hemorrhage',label:'대량 출혈',minHpRatio:.33,rule:Object.freeze({id:'director-hemorrhage',label:'대량 출혈',description:'세트 시작 시 적 보호막 2, 플레이어 출혈 1.',effects:Object.freeze([
          Object.freeze({id:'director-mid-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),
          Object.freeze({id:'director-mid-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})
        ])})}),
        Object.freeze({id:'red_alert',label:'적색 경보',minHpRatio:0,rule:Object.freeze({id:'director-red-alert',label:'적색 경보',description:'세트 시작 시 플레이어 출혈 2와 흉터 1.',effects:Object.freeze([
          Object.freeze({id:'director-final-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:2}),duration:'set'}),
          Object.freeze({id:'director-final-scar',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'scar',amount:1}),duration:'set'})
        ])})})
      ])
    })
  });

  const EVENT_DEFINITIONS=Object.freeze({
    triage_desk:Object.freeze({id:'triage_desk',name:'트리아지 데스크',description:'남은 의약품을 어디에 쓸지 결정한다.',eventTag:'medical',choices:Object.freeze([
      Object.freeze({id:'stabilize',label:'안정화 처치',description:'체력 7 회복',actions:Object.freeze([Object.freeze({type:'heal',amount:7})])}),
      Object.freeze({id:'transfusion',label:'강행 수혈',description:'체력 3을 잃은 뒤 체력 12 회복',actions:Object.freeze([Object.freeze({type:'damage_player',amount:3}),Object.freeze({type:'heal',amount:12})])})
    ])}),
    blood_donation:Object.freeze({id:'blood_donation',name:'혈액 공여',description:'귀한 혈액을 내어주면 물자를 받을 수 있다.',eventTag:'risk',choices:Object.freeze([
      Object.freeze({id:'donate',label:'헌혈한다',description:'체력 5를 잃고 골드 +25',actions:Object.freeze([Object.freeze({type:'damage_player',amount:5}),Object.freeze({type:'gain_gold',amount:25})])}),
      Object.freeze({id:'decline',label:'거절하고 쉰다',description:'체력 3 회복',actions:Object.freeze([Object.freeze({type:'heal',amount:3})])})
    ])}),
    quarantine_test:Object.freeze({id:'quarantine_test',name:'격리 검사',description:'검사실에 남은 실험 약물을 사용할 수 있다.',eventTag:'status',choices:Object.freeze([
      Object.freeze({id:'serum',label:'실험 혈청',description:'체력 4를 잃고 카드 1장 획득',actions:Object.freeze([Object.freeze({type:'damage_player',amount:4}),Object.freeze({type:'add_card',mode:'generated'})])}),
      Object.freeze({id:'observe',label:'경과 관찰',description:'체력 5 회복',actions:Object.freeze([Object.freeze({type:'heal',amount:5})])})
    ])}),
    sterile_cache:Object.freeze({id:'sterile_cache',name:'멸균 보관함',description:'봉인된 응급 물자가 조금 남아 있다.',eventTag:'general',choices:Object.freeze([
      Object.freeze({id:'medicine',label:'응급약을 쓴다',description:'체력 6 회복',actions:Object.freeze([Object.freeze({type:'heal',amount:6})])}),
      Object.freeze({id:'supplies',label:'물자로 교환한다',description:'골드 +16',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:16})])})
    ])})
  });

  let combatInstalled=false,eventInstalled=false,presentationInstalled=false;
  function activeRun(runtimeRoot=defaultRoot){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function activeBattle(runtimeRoot=defaultRoot){if(runtimeRoot?.battle)return runtimeRoot.battle;try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return null}
  function isRedWardNode(node,runState=activeRun()){return!!node&&((node?.regionPlan?.regionId||runState?.runFlow?.currentRegionId||runState?.actId)===REGION_ID)}
  function content(id){return CONTENT[id]||null}
  function contentIdForNode(node,runState=activeRun()){
    if(!isRedWardNode(node,runState)||!['battle','elite','boss'].includes(node?.type))return null;
    if(node.type==='elite')return'isolation_keeper';if(node.type==='boss')return'red_director';
    const tag=node?.regionPlan?.enemyTag||'standard';if(tag==='bleeder')return'ward_bleeder';if(tag==='armored')return'ward_orderly';if(tag==='infected')return'ward_infected';return'ward_orderly';
  }
  function prepareNode(node,runState=activeRun()){const id=contentIdForNode(node,runState);if(id)node.enemyContentId=id;return id}
  function contentForState(state){return content(state?.node?.enemyContentId)||null}
  function phaseFor(contentDef,stateOrRatio){const phases=contentDef?.phases||[];if(!phases.length)return null;const ratio=typeof stateOrRatio==='number'?Math.max(0,Math.min(1,stateOrRatio)):(()=>{const hp=Math.max(0,Number(stateOrRatio?.enemy?.hp)||0),max=Math.max(1,Number(stateOrRatio?.enemy?.maxHp)||1);return hp/max})();return phases.find(phase=>ratio>=phase.minHpRatio)||phases.at(-1)||null}
  function cloneEffect(effect){return{...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}}
  function makeRuleOwner(rule,contentDef,phase=null){if(!rule)return null;return{id:rule.id,label:rule.label,description:rule.description||'',effectOwnerType:'boss_rule',encounterManaged:false,redWardM9Managed:true,enemyContentId:contentDef.id,bossPhaseId:phase?.id||null,effects:(rule.effects||[]).map(cloneEffect),rulesOverride:{}}}
  function syncContentEncounter(state){
    const contentDef=contentForState(state);if(!state||!contentDef)return{changed:false,content:null,phase:null};
    const previousPhase=state.bossPhase?.id||null,external=(Array.isArray(state.bossRules)?state.bossRules:[]).filter(rule=>rule?.encounterManaged!==true&&rule?.content9BManaged!==true&&rule?.casinoM9Managed!==true&&rule?.redWardM9Managed!==true),phase=contentDef.type==='boss'?phaseFor(contentDef,state):null,rule=makeRuleOwner(contentDef.type==='boss'?phase?.rule:contentDef.rule,contentDef,phase);
    state.encounterProfileId=`red-ward:${contentDef.id}`;state.encounterRules=rule?[rule]:[];state.bossRules=[...external,...(rule?[rule]:[])];state.bossPhase=phase?{id:phase.id,label:phase.label,minHpRatio:phase.minHpRatio}:null;
    state.encounter={...(state.encounter||{}),profileId:state.encounterProfileId,contentId:contentDef.id,contentStage:STAGE,bossPhases:(contentDef.phases||[]).map(item=>({id:item.id,label:item.label,minHpRatio:item.minHpRatio}))};
    state.rulesOverride=EncounterRules?.resolveRulesOverride?EncounterRules.resolveRulesOverride(state):state.rulesOverride||{};state.encounterRulesInitialized=true;
    return{changed:previousPhase!==(state.bossPhase?.id||null),content:contentDef,phase:state.bossPhase,rule};
  }
  function applyBattleContent(state){const contentDef=contentForState(state);if(!state||!contentDef)return null;if(state.enemy&&typeof state.enemy==='object'){state.enemy.contentId=contentDef.id;state.enemy.contentStage=STAGE;state.enemy.name=contentDef.label;state.enemy.sprite=contentDef.sprite;state.enemy.sub=contentDef.summary;if(state.enemy.aiMemory&&typeof state.enemy.aiMemory==='object')state.enemy.aiMemory.profileId=contentDef.behavior.id}syncContentEncounter(state);return contentDef}
  function validateContent(registry=CONTENT){const errors=[],profiles={};for(const[id,entry]of Object.entries(registry||{})){if(entry?.id!==id)errors.push(`${id}: id mismatch`);if(!['battle','elite','boss'].includes(entry?.type))errors.push(`${id}: invalid type`);if(!entry?.behavior)errors.push(`${id}: missing behavior`);else profiles[id]=entry.behavior;if(entry?.rule)errors.push(...(CardEffects?.validateEffectList?.(entry.rule.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/rule: ${error}`));let previous=Infinity;for(const phase of entry?.phases||[]){if(!phase?.id||!Number.isFinite(phase.minHpRatio)||phase.minHpRatio<0||phase.minHpRatio>1)errors.push(`${id}: invalid phase`);if(Number.isFinite(phase.minHpRatio)&&phase.minHpRatio>previous)errors.push(`${id}: phases must descend`);previous=phase.minHpRatio;errors.push(...(CardEffects?.validateEffectList?.(phase?.rule?.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/${phase?.id}: ${error}`))}if(entry?.phases?.length&&entry.phases.at(-1).minHpRatio!==0)errors.push(`${id}: last phase must start at 0`)}if(EnemyBehavior?.validateProfiles)errors.push(...EnemyBehavior.validateProfiles(profiles));return errors}
  function buildEnemyCard(contentDef,pattern,context,random=Math.random){const normalized=EnemyBehavior.normalizeContext(context),rank=EnemyBehavior.randomInt(pattern.minRank,pattern.maxRank,random),suit=EnemyBehavior.chooseSuit(pattern,normalized,random),reason=EnemyBehavior.explainDecision(contentDef.behavior,pattern,normalized,suit);return{suit,rank,enemyBehaviorId:pattern.id,enemyProfileId:contentDef.behavior.id,enemyContentId:contentDef.id,enemyPersonality:contentDef.behavior.personality.archetype,enemyIntent:pattern.intent,enemyIntentDetail:pattern.detail||'',enemyIntentReason:reason,enemyPlannedSet:normalized.setIndex,enemyPlannedTrick:normalized.trick,enemyMemorySnapshot:EnemyBehavior.enemyMemorySnapshot(normalized.enemyMemory)}}
  function chooseContentPlay(contentDef,context={},random=Math.random){const normalized=EnemyBehavior.normalizeContext(context),pattern=EnemyBehavior.weightedPattern(contentDef.behavior.patterns,random,normalized),card=buildEnemyCard(contentDef,pattern,normalized,random);return{contentId:contentDef.id,profileId:contentDef.behavior.id,patternId:pattern.id,card,intent:{title:card.enemyIntent,detail:card.enemyIntentDetail,reason:card.enemyIntentReason,personality:contentDef.behavior.personality.archetype},weights:EnemyBehavior.patternWeightTable(contentDef.behavior.patterns,normalized)}}
  function ensureRunState(runState){if(!runState||typeof runState!=='object')return null;let state=runState.redWardM9;if(!state||typeof state!=='object')state=runState.redWardM9={};state.version=STAGE;if(!Array.isArray(state.eventHistory))state.eventHistory=[];if(!state.activeEvent||typeof state.activeEvent!=='object')state.activeEvent=null;return state}
  function wrapGenEnemyCard(runtimeRoot=defaultRoot){const original=runtimeRoot?.genEnemyCard;if(typeof original!=='function')return false;if(original.__redWardRegionM9)return true;function wrapped(...args){const state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(!state||!contentDef)return original.apply(this,args);const planned=original.apply(this,args),base=EnemyBehavior.battleContext(state),context=EnemyBehavior.normalizeContext({...base,setIndex:planned?.enemyPlannedSet??base.setIndex,trick:planned?.enemyPlannedTrick??base.trick,enemyMemory:state.enemy?.aiMemory||base.enemyMemory});return chooseContentPlay(contentDef,context,Math.random).card}wrapped.__redWardRegionM9=true;wrapped.__legacyGenEnemyCard=original;runtimeRoot.genEnemyCard=wrapped;return true}
  function wrapStartBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.startBattle;if(typeof original!=='function')return false;if(original.__redWardRegionM9)return true;function wrapped(node,...args){if(!isRedWardNode(node,activeRun(runtimeRoot)))return original.call(this,node,...args);prepareNode(node,activeRun(runtimeRoot));const previousRunEffects=runtimeRoot.runCardEffects;let primed=false;const prime=()=>{const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot);if(state&&!primed){prepareNode(state.node||node,runState);applyBattleContent(state);primed=true}return state};if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=function(...effectArgs){prime();return previousRunEffects.apply(this,effectArgs)};const restore=()=>{if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=previousRunEffects};const finalize=result=>{prime();runtimeRoot.renderBattle?.();return result};try{const result=original.call(this,node,...args);if(result&&typeof result.then==='function')return result.then(finalize).finally(restore);const final=finalize(result);restore();return final}catch(error){restore();throw error}}wrapped.__redWardRegionM9=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true}
  function wrapDamageEnemy(runtimeRoot=defaultRoot){const original=runtimeRoot?.damageEnemy;if(typeof original!=='function')return false;if(original.__redWardRegionM9)return true;function wrapped(...args){const result=original.apply(this,args),state=activeBattle(runtimeRoot),contentDef=contentForState(state);if(state&&contentDef?.type==='boss'){const transition=syncContentEncounter(state);if(transition.changed)runtimeRoot.renderBattle?.()}return result}wrapped.__redWardRegionM9=true;wrapped.__legacyDamageEnemy=original;runtimeRoot.damageEnemy=wrapped;return true}
  function eventForNode(node,runState=activeRun()){if(!isRedWardNode(node,runState))return null;const tag=node?.regionPlan?.eventTag||'general';return Object.values(EVENT_DEFINITIONS).find(event=>event.eventTag===tag)||EVENT_DEFINITIONS.sterile_cache}
  function applyEventAction(runState,node,event,choice,action,{runtimeRoot=defaultRoot,index=0}={}){return RunEvents?.applyAction?.(runState,action,{runtimeRoot,node,salt:`red-ward:${event.id}:${choice.id}:${index}`})||{ok:false,reason:'run_events_unavailable'}}
  function chooseRedWardEvent(runState,node,choiceId,{runtimeRoot=defaultRoot}={}){if(!runState||!node||!isRedWardNode(node,runState))return{ok:false,reason:'not_red_ward_event'};const state=ensureRunState(runState),event=state.activeEvent?.nodeId===node.id?EVENT_DEFINITIONS[state.activeEvent.eventId]:eventForNode(node,runState),choice=event?.choices?.find(item=>item.id===choiceId);if(!event||!choice)return{ok:false,reason:'invalid_choice'};const results=choice.actions.map((action,index)=>applyEventAction(runState,node,event,choice,action,{runtimeRoot,index}));const history={step:state.eventHistory.length+1,eventId:event.id,nodeId:node.id,choiceId:choice.id,results};state.eventHistory.push(history);state.activeEvent=null;runtimeRoot.sfx?.('reward');runtimeRoot.completeNode?.(node);return{ok:true,eventId:event.id,choiceId:choice.id,results}}
  function escapeHtml(value){return RunEvents?.escapeHtml?.(value)??String(value??'')}
  function redWardEventHtml(event){return`<h2>이벤트 · ${escapeHtml(event.name)}</h2><p>${escapeHtml(event.description)}</p><div class="choiceList" data-red-ward-m9-event="${escapeHtml(event.id)}">${event.choices.map(choice=>`<button class="choice" data-red-ward-choice="${escapeHtml(choice.id)}"><b>${escapeHtml(choice.label)}</b><span>${escapeHtml(choice.description)}</span></button>`).join('')}</div>`}
  function showRedWardEvent(node,runtimeRoot=defaultRoot){const runState=activeRun(runtimeRoot),event=eventForNode(node,runState);if(!runState||!event)return false;const state=ensureRunState(runState);state.activeEvent={eventId:event.id,nodeId:node.id};const html=redWardEventHtml(event);if(typeof runtimeRoot?.showModal==='function')runtimeRoot.showModal(html);else if(!RunEvents?.showModal?.(runtimeRoot,html))return false;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);doc?.querySelectorAll?.('[data-red-ward-choice]')?.forEach(button=>button.onclick=()=>chooseRedWardEvent(runState,node,button.dataset?.redWardChoice||button.getAttribute?.('data-red-ward-choice'),{runtimeRoot}));return true}
  function wrapShowEvent(runtimeRoot=defaultRoot){const original=runtimeRoot?.showEvent;if(typeof original!=='function')return false;if(original.__redWardRegionM9)return true;function wrapped(node,...args){if(isRedWardNode(node,activeRun(runtimeRoot)))return showRedWardEvent(node,runtimeRoot);return original.call(this,node,...args)}wrapped.__redWardRegionM9=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true}
  function syncPresentation(runtimeRoot=defaultRoot){const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),screen=doc?.getElementById?.('battleScreen');if(screen?.dataset&&(runState?.runFlow?.currentRegionId===REGION_ID||runState?.actId===REGION_ID))screen.dataset.battleRegion=REGION_ID;return!!screen}
  function wrapPresentation(runtimeRoot=defaultRoot){const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__redWardRegionM9Presentation)return true;function wrapped(...args){const result=original.apply(this,args);syncPresentation(runtimeRoot);return result}wrapped.__redWardRegionM9Presentation=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function injectStyle(runtimeRoot=defaultRoot){const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc?.createElement||doc.getElementById?.('trick-red-ward-m9-style'))return false;const style=doc.createElement('style');style.id='trick-red-ward-m9-style';style.textContent='#battleScreen[data-battle-region="region_red_ward"]{--battle-accent:#d96b72;--battle-accent-soft:#572d36;--battle-sky:#24171c;--battle-floor:#161316;--battle-glow:#d94b5a2b}';(doc.head||doc.documentElement)?.appendChild(style);return true}
  function installBrowserRuntime(runtimeRoot=defaultRoot){if(combatInstalled)return true;const errors=validateContent();if(errors.length){runtimeRoot?.console?.error?.('[M9 red ward] 콘텐츠 오류',errors);return false}if(!EnemyBehavior||!EncounterRules||!RunEvents||!wrapGenEnemyCard(runtimeRoot)||!wrapStartBattle(runtimeRoot)||!wrapDamageEnemy(runtimeRoot))return false;injectStyle(runtimeRoot);runtimeRoot.redWardEventPick=(nodeId,choiceId)=>{const runState=activeRun(runtimeRoot),node=(runState?.map||[]).find(item=>item.id===nodeId);return chooseRedWardEvent(runState,node,choiceId,{runtimeRoot})};combatInstalled=true;return true}
  function installLateWrappers(runtimeRoot=defaultRoot){if(!eventInstalled&&runtimeRoot?.CasinoRegionM9&&runtimeRoot?.showEvent?.__casinoRegionM9)eventInstalled=wrapShowEvent(runtimeRoot);if(!presentationInstalled&&runtimeRoot?.BattleLayout&&typeof runtimeRoot?.renderBattle==='function')presentationInstalled=wrapPresentation(runtimeRoot);return eventInstalled&&presentationInstalled}
  function installWhenReady(runtimeRoot=defaultRoot){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{installBrowserRuntime(runtimeRoot);installLateWrappers(runtimeRoot);if(combatInstalled&&eventInstalled&&presentationInstalled)return;if(attempts++<120)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[M9 red ward] 런타임 연결을 완료하지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){combatInstalled=false;eventInstalled=false;presentationInstalled=false}
  return{STAGE,REGION_ID,CONTENT,EVENT_DEFINITIONS,activeRun,activeBattle,isRedWardNode,content,contentIdForNode,prepareNode,contentForState,phaseFor,cloneEffect,makeRuleOwner,syncContentEncounter,applyBattleContent,validateContent,buildEnemyCard,chooseContentPlay,ensureRunState,wrapGenEnemyCard,wrapStartBattle,wrapDamageEnemy,eventForNode,applyEventAction,chooseRedWardEvent,redWardEventHtml,showRedWardEvent,wrapShowEvent,syncPresentation,wrapPresentation,injectStyle,installBrowserRuntime,installLateWrappers,installWhenReady,resetForTests};
});
