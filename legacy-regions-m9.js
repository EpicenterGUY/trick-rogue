(function(root,factory){
  const EnemyBehavior=typeof module!=='undefined'?require('./enemy-behavior-core.js'):root.EnemyBehavior;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const RunEvents=typeof module!=='undefined'?require('./run-events.js'):root.RunEvents;
  const RunFields=typeof module!=='undefined'?require('./run-fields.js'):root.RunFields;
  const api=factory(root,EnemyBehavior,EncounterRules,CardEffects,RunEvents,RunFields);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.LegacyRegionsM9=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,EnemyBehavior,EncounterRules,CardEffects,RunEvents,RunFields){
  const STAGE='M9-LEGACY-REGIONS-1';
  const REGION_IDS=Object.freeze(['region_theater','region_observatory','region_frontier']);

  const CONTENT=Object.freeze({
    theater_stagehand:Object.freeze({
      id:'theater_stagehand',type:'battle',label:'무대 진행요원',sprite:'raider',summary:'중간 숫자로 공연 흐름을 정리하고 자신의 무늬를 이어 붙여 쇼다운 재료를 만든다.',
      behavior:Object.freeze({id:'theater_stagehand',label:'무대 진행요원',personality:Object.freeze({archetype:'공연 정리형',summary:'중간 숫자와 반복 무늬로 안정적인 공연 흐름을 만든다.'}),patterns:Object.freeze([
        Object.freeze({id:'cue_cards',weight:60,minRank:5,maxRank:10,intent:'큐 카드 정리',detail:'중간 숫자로 트릭을 정리하며 같은 무늬의 흐름을 이어간다.',suitPolicy:'build_enemy',weightAdjustments:Object.freeze([Object.freeze({when:'enemy_suit_lead',add:20,reason:'이미 쌓인 공연 무늬를 이어감'}),Object.freeze({when:'repeat_self',multiply:.8,reason:'같은 큐를 과하게 반복하지 않음'})])}),
        Object.freeze({id:'scene_change',weight:40,minRank:7,maxRank:12,intent:'장면 전환',detail:'플레이어가 앞선 무늬를 따라가 장면 흐름을 끊는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어의 주력 무늬를 장면 전환으로 끊음'}),Object.freeze({when:'late_trick',add:10,reason:'후반 쇼다운 구성을 방해'})])})
      ])}),
      rule:Object.freeze({id:'stagehand_setup',label:'무대 준비',description:'세트 시작 시 적이 보호막 1을 얻는다.',effects:Object.freeze([Object.freeze({id:'stagehand-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:1}),duration:'set'})])})
    }),
    theater_spotlight_duelist:Object.freeze({
      id:'theater_spotlight_duelist',type:'battle',label:'스포트라이트 승부사',sprite:'hunter',summary:'후반 트릭에 높은 숫자를 집중하고 플레이어의 주력 무늬를 조명처럼 집요하게 따라붙는다.',
      behavior:Object.freeze({id:'theater_spotlight_duelist',label:'스포트라이트 승부사',personality:Object.freeze({archetype:'후반 주연형',summary:'후반 트릭과 플레이어의 반복 무늬에 강하게 반응한다.'}),patterns:Object.freeze([
        Object.freeze({id:'spotlight_chase',weight:55,minRank:7,maxRank:12,intent:'스포트라이트 추적',detail:'플레이어가 드러낸 무늬를 따라가 주도권을 뺏는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_repeated_suit',add:30,reason:'반복된 무늬에 조명을 고정'}),Object.freeze({when:'player_suit_lead',add:15,reason:'앞선 무늬를 직접 견제'})])}),
        Object.freeze({id:'finale_push',weight:45,minRank:10,maxRank:14,intent:'피날레 강행',detail:'후반에는 높은 숫자와 트럼프로 공연을 끝내려 한다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:30,reason:'피날레 구간이라 고랭크를 집중'}),Object.freeze({when:'enemy_behind',add:20,reason:'밀리면 주연 카드를 앞당겨 사용'})])})
      ])}),
      rule:Object.freeze({id:'spotlight_pressure',label:'집중 조명',description:'세트 시작 시 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'spotlight-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})])})
    }),
    theater_backstage_director:Object.freeze({
      id:'theater_backstage_director',type:'elite',label:'백스테이지 연출가',sprite:'hunter',summary:'공연 순서를 통제하며 무늬 견제와 고랭크 피날레를 번갈아 사용하는 유랑극장 전용 엘리트.',
      behavior:Object.freeze({id:'theater_backstage_director',label:'백스테이지 연출가',personality:Object.freeze({archetype:'연출 통제형',summary:'무늬를 통제하다가 불리해지면 고랭크 피날레로 전환한다.'}),patterns:Object.freeze([
        Object.freeze({id:'director_blocking',weight:58,minRank:7,maxRank:12,intent:'동선 통제',detail:'플레이어의 주력 무늬에 맞춰 쇼다운 동선을 막는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:30,reason:'무대 동선을 플레이어 무늬에 맞춰 통제'}),Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 연출을 연속 반복하지 않음'})])}),
        Object.freeze({id:'director_finale',weight:42,minRank:10,maxRank:14,intent:'강제 피날레',detail:'밀리거나 후반이면 높은 숫자와 트럼프로 공연을 강제 종료한다.',suitPolicy:'prefer_trump',suitChance:65,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:30,reason:'공연이 밀려 피날레를 앞당김'}),Object.freeze({when:'late_trick',add:20,reason:'후반 트릭에 피날레 압박 강화'})])})
      ])}),
      rule:Object.freeze({id:'director_house_rules',label:'연출 지시',description:'세트 시작 시 적은 보호막 2를 얻고 플레이어는 취약 1을 얻는다.',effects:Object.freeze([Object.freeze({id:'director-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),Object.freeze({id:'director-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})])})
    }),
    observatory_signal_keeper:Object.freeze({
      id:'observatory_signal_keeper',type:'battle',label:'신호 보관원',sprite:'raider',summary:'자신이 이미 쌓은 무늬를 유지하며 공개된 정보를 바탕으로 안정적으로 중간 숫자를 배치한다.',
      behavior:Object.freeze({id:'observatory_signal_keeper',label:'신호 보관원',personality:Object.freeze({archetype:'신호 축적형',summary:'자신의 무늬 흐름을 유지하며 정보 우위를 쌓는다.'}),patterns:Object.freeze([
        Object.freeze({id:'signal_hold',weight:62,minRank:5,maxRank:10,intent:'신호 유지',detail:'자신이 앞선 무늬를 계속 이어 관측 기록을 안정화한다.',suitPolicy:'build_enemy',weightAdjustments:Object.freeze([Object.freeze({when:'enemy_suit_lead',add:25,reason:'이미 확보한 신호 무늬를 유지'}),Object.freeze({when:'enemy_won_last',add:10,reason:'직전 성공한 관측 흐름을 유지'})])}),
        Object.freeze({id:'signal_compare',weight:38,minRank:7,maxRank:12,intent:'신호 대조',detail:'플레이어의 공개 무늬와 대조해 같은 채널로 맞춰 온다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어의 강한 채널을 대조 관측'}),Object.freeze({when:'repeat_self',multiply:.8,reason:'같은 관측만 반복하지 않음'})])})
      ])}),
      rule:Object.freeze({id:'signal_archive',label:'보존 신호',description:'세트 시작 시 적이 보호막 1을 얻는다.',effects:Object.freeze([Object.freeze({id:'signal-keeper-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:1}),duration:'set'})])})
    }),
    observatory_jammer:Object.freeze({
      id:'observatory_jammer',type:'battle',label:'안개 교란자',sprite:'hunter',summary:'반복되는 플레이어 무늬를 읽고 따라붙다가 후반에는 트럼프로 관측 계획을 끊는다.',
      behavior:Object.freeze({id:'observatory_jammer',label:'안개 교란자',personality:Object.freeze({archetype:'정보 교란형',summary:'반복 무늬와 후반 트릭을 노려 공개 정보의 가치를 낮춘다.'}),patterns:Object.freeze([
        Object.freeze({id:'jam_trace',weight:60,minRank:6,maxRank:11,intent:'관측 방해',detail:'반복된 플레이어 무늬를 따라가 예상 경로를 흐린다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_repeated_suit',add:30,reason:'반복 신호를 포착해 방해 강화'}),Object.freeze({when:'player_suit_lead',add:15,reason:'가장 강한 공개 신호를 우선 교란'})])}),
        Object.freeze({id:'jam_blackout',weight:40,minRank:9,maxRank:14,intent:'신호 차단',detail:'후반에는 높은 숫자와 트럼프로 관측 자체를 끊는다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:25,reason:'쇼다운 직전 신호를 차단'}),Object.freeze({when:'enemy_behind',add:20,reason:'불리한 기록을 강제로 끊음'})])})
      ])}),
      rule:Object.freeze({id:'jammer_noise',label:'신호 잡음',description:'세트 시작 시 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'jammer-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})])})
    }),
    observatory_lens_warden:Object.freeze({
      id:'observatory_lens_warden',type:'elite',label:'렌즈 감시관',sprite:'hunter',summary:'플레이어의 반복 무늬를 봉쇄하고 불리한 기록은 고랭크로 지워 버리는 안개 관측소 전용 엘리트.',
      behavior:Object.freeze({id:'observatory_lens_warden',label:'렌즈 감시관',personality:Object.freeze({archetype:'관측 봉쇄형',summary:'공개된 패턴을 읽어 견제하고 불리할 때 기록을 강제로 덮는다.'}),patterns:Object.freeze([
        Object.freeze({id:'warden_focus',weight:60,minRank:7,maxRank:12,intent:'초점 고정',detail:'플레이어의 반복 무늬에 초점을 맞춰 같은 채널을 봉쇄한다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_repeated_suit',add:30,reason:'반복 신호에 초점을 고정'}),Object.freeze({when:'player_suit_lead',add:20,reason:'가장 강한 공개 무늬를 감시'})])}),
        Object.freeze({id:'warden_redact',weight:40,minRank:10,maxRank:14,intent:'관측 기록 말소',detail:'후반과 열세 상황에서 높은 숫자로 불리한 기록을 덮는다.',suitPolicy:'prefer_trump',suitChance:60,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:30,reason:'불리한 기록을 즉시 말소'}),Object.freeze({when:'late_trick',add:15,reason:'쇼다운 전 기록을 정리'})])})
      ])}),
      rule:Object.freeze({id:'warden_lens_lock',label:'렌즈 봉쇄',description:'세트 시작 시 적은 보호막 2를 얻고 플레이어는 출혈 1을 얻는다.',effects:Object.freeze([Object.freeze({id:'warden-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'}),Object.freeze({id:'warden-bleed',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'bleed',amount:1}),duration:'set'})])})
    }),
    frontier_scout:Object.freeze({
      id:'frontier_scout',type:'battle',label:'전선 정찰병',sprite:'raider',summary:'값싼 패로 전황을 살핀 뒤 후반에 남은 중고랭크를 투입하는 황야 전선의 기본 적.',
      behavior:Object.freeze({id:'frontier_scout',label:'전선 정찰병',personality:Object.freeze({archetype:'정찰 전환형',summary:'초반 저비용 정찰에서 후반 압박으로 전환한다.'}),patterns:Object.freeze([
        Object.freeze({id:'scout_probe',weight:62,minRank:2,maxRank:8,intent:'전선 정찰',detail:'낮은 숫자로 초반 전황을 확인한다.',suitPolicy:'random',weightAdjustments:Object.freeze([Object.freeze({when:'early_trick',add:25,reason:'초반에 값싼 정찰 패를 먼저 사용'}),Object.freeze({when:'repeat_self',multiply:.75,reason:'같은 정찰 경로를 반복하지 않음'})])}),
        Object.freeze({id:'scout_commit',weight:38,minRank:8,maxRank:13,intent:'정찰대 돌입',detail:'후반에는 남은 중고랭크와 트럼프로 승부를 건다.',suitPolicy:'prefer_trump',suitChance:45,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:25,reason:'후반에 정찰 정보를 바탕으로 돌입'}),Object.freeze({when:'enemy_behind',add:15,reason:'밀리면 정찰을 끝내고 공격'})])})
      ])})
    }),
    frontier_raider:Object.freeze({
      id:'frontier_raider',type:'battle',label:'황야 돌격병',sprite:'hunter',summary:'높은 숫자와 트럼프로 빠르게 트릭을 회수해 체력 소모를 강요하는 공세형 적.',
      behavior:Object.freeze({id:'frontier_raider',label:'황야 돌격병',personality:Object.freeze({archetype:'직선 공세형',summary:'고랭크와 트럼프를 빠르게 사용해 세트를 짧게 가져간다.'}),patterns:Object.freeze([
        Object.freeze({id:'raider_charge',weight:65,minRank:8,maxRank:14,intent:'정면 돌격',detail:'높은 숫자로 트릭을 직접 회수한다.',suitPolicy:'prefer_trump',suitChance:55,weightAdjustments:Object.freeze([Object.freeze({when:'enemy_behind',add:25,reason:'밀리면 돌격 강도를 높임'}),Object.freeze({when:'late_trick',add:15,reason:'후반 승부를 빠르게 끝내려 함'})])}),
        Object.freeze({id:'raider_flank',weight:35,minRank:6,maxRank:11,intent:'측면 압박',detail:'플레이어의 주력 무늬를 따라가 퇴로를 끊는다.',suitPolicy:'contest_player',weightAdjustments:Object.freeze([Object.freeze({when:'player_suit_lead',add:25,reason:'플레이어 주력 무늬의 측면을 압박'}),Object.freeze({when:'repeat_self',multiply:.7,reason:'같은 돌격로를 반복하지 않음'})])})
      ])}),
      rule:Object.freeze({id:'raider_pressure',label:'공세 개시',description:'세트 시작 시 플레이어에게 취약 1을 부여한다.',effects:Object.freeze([Object.freeze({id:'frontier-raider-vulnerable',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'vulnerable',amount:1}),duration:'set'})])})
    }),
    frontier_bulwark:Object.freeze({
      id:'frontier_bulwark',type:'battle',label:'철갑 보급병',sprite:'hunter',summary:'중간 숫자를 아끼며 보호막으로 버틴 뒤 후반에 고랭크를 투입하는 중장형 적.',
      behavior:Object.freeze({id:'frontier_bulwark',label:'철갑 보급병',personality:Object.freeze({archetype:'중장 지연형',summary:'보호막으로 시간을 벌고 후반에 저장한 고랭크를 투입한다.'}),patterns:Object.freeze([
        Object.freeze({id:'bulwark_hold',weight:60,minRank:5,maxRank:10,intent:'진지 유지',detail:'중간 숫자로 손실을 줄이며 시간을 번다.',suitPolicy:'build_enemy',weightAdjustments:Object.freeze([Object.freeze({when:'enemy_suit_lead',add:20,reason:'이미 구축한 진지 무늬를 유지'}),Object.freeze({when:'enemy_ahead',add:15,reason:'앞서면 방어적인 패턴을 유지'})])}),
        Object.freeze({id:'bulwark_counter',weight:40,minRank:9,maxRank:14,intent:'중장 반격',detail:'후반이나 열세 상황에서 높은 숫자와 트럼프를 꺼낸다.',suitPolicy:'prefer_trump',suitChance:50,weightAdjustments:Object.freeze([Object.freeze({when:'late_trick',add:25,reason:'후반에 비축한 고랭크를 투입'}),Object.freeze({when:'enemy_behind',add:20,reason:'진지가 무너지면 즉시 반격'})])})
      ])}),
      rule:Object.freeze({id:'bulwark_armor',label:'철갑 보급',description:'세트 시작 시 적이 보호막 2를 얻는다.',effects:Object.freeze([Object.freeze({id:'frontier-bulwark-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'})])})
    })
  });

  const EVENT_DEFINITIONS=Object.freeze({
    backstage_barter:Object.freeze({id:'backstage_barter',regionId:'region_theater',eventTag:'general',name:'백스테이지 거래',description:'공연 뒤 남은 소품과 휴식 시간을 어떻게 쓸지 정한다.',choices:Object.freeze([
      Object.freeze({id:'sell_props',label:'남은 소품을 판다',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:25})])}),
      Object.freeze({id:'take_break',label:'분장실에서 쉰다',actions:Object.freeze([Object.freeze({type:'heal',amount:9})])})
    ])}),
    field_rental:Object.freeze({id:'field_rental',regionId:'region_theater',eventTag:'field',name:'무대 장치 대여소',description:'이번 공연에 쓸 필드 장치를 빌리거나 현금 정산을 받는다.',choices:Object.freeze([
      Object.freeze({id:'rent_field',label:'무대 장치를 빌린다',actions:Object.freeze([Object.freeze({type:'gain_field'})])}),
      Object.freeze({id:'cash_out',label:'대여권을 현금으로 바꾼다',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:18})])})
    ])}),
    star_chart:Object.freeze({id:'star_chart',regionId:'region_observatory',eventTag:'general',name:'별자리 기록표',description:'앞길의 정보를 하나 읽고 작은 보조 보상을 고른다.',choices:Object.freeze([
      Object.freeze({id:'route',label:'다음 노드를 읽는다',actions:Object.freeze([Object.freeze({type:'reveal_route',kind:'next_node'}),Object.freeze({type:'gain_gold',amount:10})])}),
      Object.freeze({id:'event',label:'다음 이벤트를 읽는다',actions:Object.freeze([Object.freeze({type:'reveal_route',kind:'next_event'}),Object.freeze({type:'heal',amount:5})])})
    ])}),
    false_signal:Object.freeze({id:'false_signal',regionId:'region_observatory',eventTag:'field',name:'거짓 신호',description:'불안정한 신호를 끝까지 해독해 보상을 얻거나 연결을 끊고 정비한다.',choices:Object.freeze([
      Object.freeze({id:'decode',label:'끝까지 해독한다',actions:Object.freeze([Object.freeze({type:'damage_player',amount:5}),Object.freeze({type:'gain_gold',amount:35})])}),
      Object.freeze({id:'disconnect',label:'연결을 끊고 정비한다',actions:Object.freeze([Object.freeze({type:'heal',amount:8})])})
    ])}),
    supply_cache:Object.freeze({id:'supply_cache',regionId:'region_frontier',eventTag:'general',name:'버려진 보급 상자',description:'남은 보급품을 칩으로 환전하거나 즉시 치료에 쓴다.',choices:Object.freeze([
      Object.freeze({id:'salvage',label:'보급품을 환전한다',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:28})])}),
      Object.freeze({id:'medkit',label:'응급 키트를 사용한다',actions:Object.freeze([Object.freeze({type:'heal',amount:9})])})
    ])}),
    no_mans_land:Object.freeze({id:'no_mans_land',regionId:'region_frontier',eventTag:'risk',name:'무인지대 횡단',description:'위험한 지름길을 강행해 큰 보급을 챙기거나 안전하게 우회한다.',choices:Object.freeze([
      Object.freeze({id:'charge',label:'무인지대를 돌파한다',actions:Object.freeze([Object.freeze({type:'damage_player',amount:6}),Object.freeze({type:'gain_gold',amount:44})])}),
      Object.freeze({id:'detour',label:'우회하며 상처를 정리한다',actions:Object.freeze([Object.freeze({type:'heal',amount:6})])})
    ])})
  });

  const BASE_REGION_EVENT_IDS=Object.freeze({
    region_theater:Object.freeze(['stage_layout','magic_box']),
    region_observatory:Object.freeze(['observation_exam','signal_scan']),
    region_frontier:Object.freeze(['supply_heist','shooting_range'])
  });

  let combatInstalled=false,eventInstalled=false,presentationInstalled=false;
  function activeRun(runtimeRoot=defaultRoot){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function activeBattle(runtimeRoot=defaultRoot){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function regionIdForNode(node,runState=activeRun()){return node?.regionPlan?.regionId||runState?.runFlow?.currentRegionId||runState?.actId||null}
  function isLegacyRegionNode(node,runState=activeRun()){return REGION_IDS.includes(regionIdForNode(node,runState))}
  function content(id){return CONTENT[id]||null}
  function contentIdForNode(node,runState=activeRun()){
    if(!node||!['battle','elite'].includes(node.type))return null;
    const regionId=regionIdForNode(node,runState),tag=node?.regionPlan?.enemyTag||'standard';
    if(regionId==='region_theater'){
      if(node.type==='elite')return'theater_backstage_director';
      if(tag==='standard')return'theater_stagehand';if(tag==='pressure')return'theater_spotlight_duelist';return null;
    }
    if(regionId==='region_observatory'){
      if(node.type==='elite')return'observatory_lens_warden';
      if(tag==='standard')return'observatory_signal_keeper';if(tag==='disruptor')return'observatory_jammer';return null;
    }
    if(regionId==='region_frontier'){
      if(node.type==='elite')return null;
      if(tag==='standard')return'frontier_scout';if(tag==='aggressive')return'frontier_raider';if(tag==='armored')return'frontier_bulwark';return null;
    }
    return null;
  }
  function prepareNode(node,runState=activeRun()){const id=contentIdForNode(node,runState);if(id)node.enemyContentId=id;return id}
  function contentForState(state,runState=activeRun()){const id=contentIdForNode(state?.node,runState)||state?.node?.enemyContentId;return content(id)}
  function cloneEffect(effect){return{...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}}
  function makeRuleOwner(rule,contentDef){if(!rule)return null;return{id:rule.id,label:rule.label,description:rule.description||'',effectOwnerType:'boss_rule',encounterManaged:false,legacyRegionsM9Managed:true,enemyContentId:contentDef.id,effects:(rule.effects||[]).map(cloneEffect),rulesOverride:{}}}
  function syncContentEncounter(state,runState=activeRun()){
    const contentDef=contentForState(state,runState);if(!state||!contentDef)return{changed:false,content:null,rule:null};
    const external=(Array.isArray(state.bossRules)?state.bossRules:[]).filter(rule=>rule?.encounterManaged!==true&&rule?.content9BManaged!==true&&rule?.legacyRegionsM9Managed!==true);
    const rule=makeRuleOwner(contentDef.rule,contentDef);state.encounterProfileId=`legacy-m9:${contentDef.id}`;state.encounterRules=rule?[rule]:[];state.bossRules=[...external,...(rule?[rule]:[])];state.bossPhase=null;
    state.encounter={...(state.encounter||{}),profileId:state.encounterProfileId,contentId:contentDef.id,contentStage:STAGE};state.rulesOverride=EncounterRules?.resolveRulesOverride?EncounterRules.resolveRulesOverride(state):state.rulesOverride||{};state.encounterRulesInitialized=true;
    return{changed:true,content:contentDef,rule};
  }
  function applyBattleContent(state,runState=activeRun()){
    const contentDef=contentForState(state,runState);if(!state||!contentDef)return null;
    if(state.enemy&&typeof state.enemy==='object'){state.enemy.contentId=contentDef.id;state.enemy.contentStage=STAGE;state.enemy.name=contentDef.label;state.enemy.sprite=contentDef.sprite;state.enemy.sub=contentDef.summary;if(state.enemy.aiMemory&&typeof state.enemy.aiMemory==='object')state.enemy.aiMemory.profileId=contentDef.behavior.id}
    syncContentEncounter(state,runState);return contentDef;
  }
  function validateContent(registry=CONTENT){
    const errors=[],profiles={};for(const[id,entry]of Object.entries(registry||{})){if(entry?.id!==id)errors.push(`${id}: id mismatch`);if(!['battle','elite'].includes(entry?.type))errors.push(`${id}: invalid type`);if(!entry?.label||!entry?.summary)errors.push(`${id}: missing label/summary`);if(!entry?.behavior)errors.push(`${id}: missing behavior`);else profiles[id]=entry.behavior;if(entry?.rule)errors.push(...(CardEffects?.validateEffectList?.(entry.rule.effects||[],{requireTrigger:true,requireDuration:true})||[]).map(error=>`${id}/rule: ${error}`))}if(EnemyBehavior?.validateProfiles)errors.push(...EnemyBehavior.validateProfiles(profiles));return errors;
  }
  function buildEnemyCard(contentDef,pattern,context,random=Math.random){const normalized=EnemyBehavior.normalizeContext(context),rank=EnemyBehavior.randomInt(pattern.minRank,pattern.maxRank,random),suit=EnemyBehavior.chooseSuit(pattern,normalized,random),reason=EnemyBehavior.explainDecision(contentDef.behavior,pattern,normalized,suit);return{suit,rank,enemyBehaviorId:pattern.id,enemyProfileId:contentDef.behavior.id,enemyContentId:contentDef.id,enemyPersonality:contentDef.behavior.personality.archetype,enemyIntent:pattern.intent,enemyIntentDetail:pattern.detail||'',enemyIntentReason:reason,enemyPlannedSet:normalized.setIndex,enemyPlannedTrick:normalized.trick,enemyMemorySnapshot:EnemyBehavior.enemyMemorySnapshot(normalized.enemyMemory)}}
  function chooseContentPlay(contentDef,context={},random=Math.random){const normalized=EnemyBehavior.normalizeContext(context),pattern=EnemyBehavior.weightedPattern(contentDef.behavior.patterns,random,normalized),card=buildEnemyCard(contentDef,pattern,normalized,random);return{contentId:contentDef.id,profileId:contentDef.behavior.id,patternId:pattern.id,card,intent:{title:card.enemyIntent,detail:card.enemyIntentDetail,reason:card.enemyIntentReason,personality:contentDef.behavior.personality.archetype},weights:EnemyBehavior.patternWeightTable(contentDef.behavior.patterns,normalized)}}
  function wrapGenEnemyCard(runtimeRoot=defaultRoot){const original=runtimeRoot?.genEnemyCard;if(typeof original!=='function')return false;if(original.__legacyRegionsM9)return true;function wrapped(...args){const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot),contentDef=contentForState(state,runState);if(!state||!contentDef)return original.apply(this,args);const planned=original.apply(this,args),base=EnemyBehavior.battleContext(state),context=EnemyBehavior.normalizeContext({...base,setIndex:planned?.enemyPlannedSet??base.setIndex,trick:planned?.enemyPlannedTrick??base.trick,enemyMemory:state.enemy?.aiMemory||base.enemyMemory});const card=chooseContentPlay(contentDef,context,Math.random).card;card.enemyPlannedSet=planned?.enemyPlannedSet??card.enemyPlannedSet;card.enemyPlannedTrick=planned?.enemyPlannedTrick??card.enemyPlannedTrick;return card}wrapped.__legacyRegionsM9=true;wrapped.__legacyGenEnemyCard=original;runtimeRoot.genEnemyCard=wrapped;return true}
  function wrapStartBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.startBattle;if(typeof original!=='function')return false;if(original.__legacyRegionsM9)return true;function wrapped(node,...args){const runState=activeRun(runtimeRoot),id=contentIdForNode(node,runState);if(!id)return original.call(this,node,...args);prepareNode(node,runState);const previousRunEffects=runtimeRoot.runCardEffects;let primed=false;const prime=()=>{const state=activeBattle(runtimeRoot);if(state&&!primed){prepareNode(state.node||node,runState);applyBattleContent(state,runState);primed=true}return state};if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=function(...effectArgs){prime();return previousRunEffects.apply(this,effectArgs)};const restore=()=>{if(typeof previousRunEffects==='function')runtimeRoot.runCardEffects=previousRunEffects};const finalize=result=>{prime();syncPresentation(runtimeRoot);runtimeRoot.renderBattle?.();return result};try{const result=original.call(this,node,...args);if(result&&typeof result.then==='function')return result.then(finalize).finally(restore);const final=finalize(result);restore();return final}catch(error){restore();throw error}}wrapped.__legacyRegionsM9=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true}

  function ensureRunState(runState){if(!runState||typeof runState!=='object')return null;let state=runState.legacyRegionsM9;if(!state||typeof state!=='object')state=runState.legacyRegionsM9={};state.version=STAGE;if(!Array.isArray(state.eventHistory))state.eventHistory=[];if(!state.activeEvent||typeof state.activeEvent!=='object')state.activeEvent=null;return state}
  function combinedEventIds(regionId){const base=(BASE_REGION_EVENT_IDS[regionId]||[]).filter(id=>RunEvents?.EVENT_DEFINITIONS?.[id]);const extra=Object.values(EVENT_DEFINITIONS).filter(event=>event.regionId===regionId).map(event=>event.id);return[...base,...extra]}
  function eventForNode(node,runState=activeRun()){
    const regionId=regionIdForNode(node,runState);if(node?.type!=='event'||!REGION_IDS.includes(regionId))return null;const tag=node?.regionPlan?.eventTag||'general';return Object.values(EVENT_DEFINITIONS).find(event=>event.regionId===regionId&&event.eventTag===tag)||null;
  }
  function applyEventAction(runState,node,event,choice,action,{runtimeRoot=defaultRoot,index=0}={}){
    if(action?.type==='gain_field'){const fieldId=RunFields?.fieldOfferIdForNode?.(node,'event');if(!fieldId||!RunFields?.acquireField)return{ok:false,type:'gain_field',reason:'run_fields_unavailable'};const result=RunFields.acquireField(runState,fieldId,{activate:true,source:`event:${event.id}`});return{ok:true,type:'gain_field',fieldId,result}}
    return RunEvents?.applyAction?.(runState,action,{runtimeRoot,node,salt:`legacy-m9:${event.id}:${choice.id}:${index}`})||{ok:false,reason:'run_events_unavailable'};
  }
  function chooseLegacyEvent(runState,node,choiceId,{runtimeRoot=defaultRoot}={}){
    const state=ensureRunState(runState),eventId=state?.activeEvent?.nodeId===node?.id?state.activeEvent.eventId:null,event=EVENT_DEFINITIONS[eventId]||eventForNode(node,runState);if(!event)return{ok:false,reason:'no_event'};const choice=event.choices.find(item=>item.id===choiceId);if(!choice)return{ok:false,reason:'invalid_choice'};
    const results=choice.actions.map((action,index)=>applyEventAction(runState,node,event,choice,action,{runtimeRoot,index}));state.eventHistory.push({step:state.eventHistory.length+1,eventId:event.id,nodeId:node.id,regionId:event.regionId,choiceId:choice.id,results});state.activeEvent=null;runtimeRoot.sfx?.('reward');runtimeRoot.completeNode?.(node);return{ok:true,eventId:event.id,choiceId:choice.id,results};
  }
  function eventHtml(event){return`<div data-legacy-m9-event="${event.id}"><h2>${event.name}</h2><p>${event.description}</p><div class="choiceList">${event.choices.map(choice=>`<button class="choice" data-legacy-m9-choice="${choice.id}"><b>${choice.label}</b></button>`).join('')}</div></div>`}
  function showLegacyEvent(runtimeRoot=defaultRoot,node,event=eventForNode(node,activeRun(runtimeRoot))){const runState=activeRun(runtimeRoot);if(!runState||!event)return false;ensureRunState(runState).activeEvent={eventId:event.id,nodeId:node.id,regionId:event.regionId};const html=eventHtml(event);if(typeof runtimeRoot.showModal==='function')runtimeRoot.showModal(html);else{const doc=runtimeRoot.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show')}const doc=runtimeRoot.document||(typeof document!=='undefined'?document:null);doc?.querySelectorAll?.('[data-legacy-m9-choice]')?.forEach(button=>{button.onclick=()=>chooseLegacyEvent(runState,node,button.dataset.legacyM9Choice||button.getAttribute('data-legacy-m9-choice'),{runtimeRoot})});return true}
  function wrapShowEvent(runtimeRoot=defaultRoot){const original=runtimeRoot?.showEvent;if(typeof original!=='function')return false;if(original.__legacyRegionsM9)return true;function wrapped(node,...args){const event=eventForNode(node,activeRun(runtimeRoot));if(event)return showLegacyEvent(runtimeRoot,node,event);return original.call(this,node,...args)}wrapped.__legacyRegionsM9=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true}

  function syncPresentation(runtimeRoot=defaultRoot){const state=activeBattle(runtimeRoot),regionId=regionIdForNode(state?.node,activeRun(runtimeRoot)),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),screen=doc?.getElementById?.('battleScreen');if(!screen||!REGION_IDS.includes(regionId))return false;screen.dataset.legacyRegionM9=regionId;screen.dataset.battleRegion=regionId;presentationInstalled=true;return true}
  function installBrowserRuntime(runtimeRoot=defaultRoot){const errors=validateContent();if(errors.length){runtimeRoot?.console?.error?.('[M9 legacy regions] 콘텐츠 정의 오류',errors);return false}let changed=false;if(!combatInstalled&&typeof runtimeRoot?.startBattle==='function'&&typeof runtimeRoot?.genEnemyCard==='function'){wrapStartBattle(runtimeRoot);wrapGenEnemyCard(runtimeRoot);combatInstalled=true;changed=true}if(!eventInstalled&&typeof runtimeRoot?.showEvent==='function'){wrapShowEvent(runtimeRoot);eventInstalled=true;changed=true}syncPresentation(runtimeRoot);return combatInstalled&&eventInstalled||changed}
  function installLateWrappers(runtimeRoot=defaultRoot){wrapStartBattle(runtimeRoot);wrapGenEnemyCard(runtimeRoot);wrapShowEvent(runtimeRoot);combatInstalled=true;eventInstalled=true;return true}
  function installWhenReady(runtimeRoot=defaultRoot){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{installBrowserRuntime(runtimeRoot);if(combatInstalled&&eventInstalled)return;if(attempts++<80)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[M9 legacy regions] 런타임 래퍼를 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){combatInstalled=false;eventInstalled=false;presentationInstalled=false}
  return{STAGE,REGION_IDS,CONTENT,EVENT_DEFINITIONS,BASE_REGION_EVENT_IDS,activeRun,activeBattle,regionIdForNode,isLegacyRegionNode,content,contentIdForNode,prepareNode,contentForState,cloneEffect,makeRuleOwner,syncContentEncounter,applyBattleContent,validateContent,buildEnemyCard,chooseContentPlay,wrapGenEnemyCard,wrapStartBattle,ensureRunState,combinedEventIds,eventForNode,applyEventAction,chooseLegacyEvent,eventHtml,showLegacyEvent,wrapShowEvent,syncPresentation,installBrowserRuntime,installLateWrappers,installWhenReady,resetForTests};
});
