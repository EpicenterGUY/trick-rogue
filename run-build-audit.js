(function(root,factory){
  const hasModule=typeof module==='object'&&module.exports;
  const CardSystemTags=hasModule?require('./card-system-tags.js'):root.CardSystemTags;
  const api=factory(root,CardSystemTags);
  if(hasModule)module.exports=api;
  else{
    root.RunBuildAudit=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,CardSystemTags){
  const STAGE='M10-1';
  const VERSION='M10-1';
  const REGION_CATALOG=Object.freeze([
    Object.freeze({id:'region_theater',name:'유랑극장'}),
    Object.freeze({id:'region_observatory',name:'안개 관측소'}),
    Object.freeze({id:'region_frontier',name:'황야 전선'}),
    Object.freeze({id:'region_casino',name:'침몰 카지노'}),
    Object.freeze({id:'region_red_ward',name:'붉은 병동'}),
    Object.freeze({id:'region_scrap_market',name:'폐품 시장'})
  ]);
  const PLAYTEST_PRESETS=Object.freeze([
    Object.freeze({id:'m10-01',label:'표본 1 · 정석',starterId:'common',traitId:'foresight',targetRegionIds:Object.freeze(['region_theater','region_observatory']),targetRegionNames:Object.freeze(['유랑극장','안개 관측소'])}),
    Object.freeze({id:'m10-02',label:'표본 2 · 승부사',starterId:'gambler',traitId:'empty_pocket',targetRegionIds:Object.freeze(['region_frontier','region_casino']),targetRegionNames:Object.freeze(['황야 전선','침몰 카지노'])}),
    Object.freeze({id:'m10-03',label:'표본 3 · 생존자',starterId:'survivor',traitId:'comeback',targetRegionIds:Object.freeze(['region_red_ward','region_scrap_market']),targetRegionNames:Object.freeze(['붉은 병동','폐품 시장'])}),
    Object.freeze({id:'m10-04',label:'표본 4 · 변칙',starterId:'trickster',traitId:'suit_collector',targetRegionIds:Object.freeze(['region_theater','region_casino']),targetRegionNames:Object.freeze(['유랑극장','침몰 카지노'])}),
    Object.freeze({id:'m10-05',label:'표본 5 · 정석',starterId:'common',traitId:'pure_mind',targetRegionIds:Object.freeze(['region_observatory','region_scrap_market']),targetRegionNames:Object.freeze(['안개 관측소','폐품 시장'])})
  ]);
  const PLAYTEST_IDENTITIES=Object.freeze(PLAYTEST_PRESETS.map(preset=>Object.freeze({starterId:preset.starterId,traitId:preset.traitId})));
  const REGION_PAIR_TARGETS=Object.freeze((()=>{const rows=[];let index=0;for(let a=0;a<REGION_CATALOG.length;a+=1){for(let b=a+1;b<REGION_CATALOG.length;b+=1){const first=REGION_CATALOG[a],second=REGION_CATALOG[b],identity=PLAYTEST_IDENTITIES[index%PLAYTEST_IDENTITIES.length];rows.push(Object.freeze({id:`m10-pair-${String(index+1).padStart(2,'0')}`,label:`조합 ${index+1}/15`,pairKey:[first.id,second.id].sort().join('+'),starterId:identity.starterId,traitId:identity.traitId,targetRegionIds:Object.freeze([first.id,second.id]),targetRegionNames:Object.freeze([first.name,second.name])}));index+=1}}return rows})());
  const FEEL_NOTE_TYPES=Object.freeze([
    Object.freeze({id:'no_choice',label:'고를 카드 없음'}),
    Object.freeze({id:'auto_pick',label:'자동 선택'}),
    Object.freeze({id:'build_pivot',label:'빌드 전환'}),
    Object.freeze({id:'pure_card',label:'순수 카드 체감'}),
    Object.freeze({id:'field_impact',label:'필드 체감'}),
    Object.freeze({id:'memo',label:'자유 메모'})
  ]);
  const FEEL_NOTE_LIMIT=40;
  const FEEL_NOTE_TEXT_LIMIT=180;
  const COVERAGE_VERSION=1;
  const COVERAGE_STORAGE_KEY='tricklog:m10-playtest-coverage:v1';
  let browserInstalled=false;

  function activeRun(runtimeRoot=defaultRoot){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function isDeveloperMode(runtimeRoot=defaultRoot){
    const search=String(runtimeRoot?.location?.search||'');
    try{return new URLSearchParams(search).get('dev')==='1'}catch(_error){return/(?:^|[?&])dev=1(?:&|$)/.test(search)}
  }
  function playtestPreset(id){return PLAYTEST_PRESETS.find(preset=>preset.id===id)||REGION_PAIR_TARGETS.find(preset=>preset.id===id)||null}
  function feelNoteType(id){return FEEL_NOTE_TYPES.find(type=>type.id===id)||null}
  function normalizeFeelNoteText(text){return String(text??'').trim().replace(/\s+/g,' ').slice(0,FEEL_NOTE_TEXT_LIMIT)}
  function feelNoteCounts(notes){const counts={};for(const note of notes||[]){const key=note?.type||'memo';counts[key]=(counts[key]||0)+1}return counts}
  function playtestFeelNotes(runState){
    const notes=Array.isArray(runState?.m10Playtest?.feelNotes)?runState.m10Playtest.feelNotes:[];
    return notes.map(note=>({...note,visitedRegionIds:[...(note?.visitedRegionIds||[])]}));
  }
  function playtestSummary(runState){
    const state=runState?.m10Playtest;if(!state||typeof state!=='object')return null;
    const feelNotes=playtestFeelNotes(runState);
    return{presetId:state.presetId||null,label:state.label||null,starterId:state.starterId||null,traitId:state.traitId||null,targetRegionIds:[...(state.targetRegionIds||[])],targetRegionNames:[...(state.targetRegionNames||[])],feelNotes,feelCounts:feelNoteCounts(feelNotes)};
  }
  function pairKeyForRegionIds(ids){return Array.isArray(ids)&&ids.length>=2?[...ids.slice(0,2)].sort().join('+'):null}
  function comparePlaytestTarget(playtest,regions){
    if(!playtest)return null;const targetPairKey=pairKeyForRegionIds(playtest.targetRegionIds),actualPairKey=regions?.pairKey||null,completedIds=regions?.completedRegionIds||[],matchedTargetRegions=actualPairKey&&targetPairKey?actualPairKey===targetPairKey:null;
    const completedTargetRegions=matchedTargetRegions===true?(playtest.targetRegionIds||[]).every(id=>completedIds.includes(id)):false;
    return{...playtest,targetPairKey,actualPairKey,matchedTargetRegions,completedTargetRegions};
  }
  function addPlaytestFeelNote(runState,typeId,noteText='',runtimeRoot=defaultRoot){
    const state=runState?.m10Playtest;if(!state||typeof state!=='object')return{ok:false,reason:'no_playtest'};
    const type=feelNoteType(typeId);if(!type)return{ok:false,reason:'unknown_type'};
    const note=normalizeFeelNoteText(noteText);if(type.id==='memo'&&!note)return{ok:false,reason:'empty_note'};
    if(!Array.isArray(state.feelNotes))state.feelNotes=[];if(state.feelNotes.length>=FEEL_NOTE_LIMIT)return{ok:false,reason:'note_limit'};
    const visitedRegionIds=Array.isArray(runState?.runFlow?.visitedRegionIds)?[...runState.runFlow.visitedRegionIds]:[];
    const phase=runState?.runFlow?.phase||runState?.actId||null;
    const entry={type:type.id,label:type.label,note,visitedRegionIds,deckSize:Array.isArray(runState?.deck)?runState.deck.length:0,phase};
    state.feelNotes.push(entry);runtimeRoot?.console?.info?.('[M10 feel note]',entry);return{ok:true,index:state.feelNotes.length-1,entry:{...entry,visitedRegionIds:[...visitedRegionIds]}};
  }
  function emptyCoverage(){return{version:COVERAGE_VERSION,pairs:{}}}
  function normalizeCoverage(input){
    let source=input;if(typeof input==='string'){try{source=JSON.parse(input)}catch(_error){return emptyCoverage()}}const pairs={};
    for(const target of REGION_PAIR_TARGETS){const raw=source?.pairs?.[target.pairKey];if(!raw||typeof raw!=='object')continue;const runs=Math.max(0,Math.floor(Number(raw.runs)||0));if(!runs)continue;pairs[target.pairKey]={runs,wins:Math.max(0,Math.floor(Number(raw.wins)||0)),losses:Math.max(0,Math.floor(Number(raw.losses)||0)),totalFeelNotes:Math.max(0,Math.floor(Number(raw.totalFeelNotes)||0)),lastFeelCount:Math.max(0,Math.floor(Number(raw.lastFeelCount)||0)),lastOutcome:raw.lastOutcome||null,lastStarterId:raw.lastStarterId||null,lastTraitId:raw.lastTraitId||null,lastPresetId:raw.lastPresetId||null}}
    return{version:COVERAGE_VERSION,pairs};
  }
  function loadCoverage(runtimeRoot=defaultRoot){try{return normalizeCoverage(runtimeRoot?.localStorage?.getItem?.(COVERAGE_STORAGE_KEY)||null)}catch(_error){return emptyCoverage()}}
  function saveCoverage(runtimeRoot=defaultRoot,coverage){const normalized=normalizeCoverage(coverage);try{runtimeRoot?.localStorage?.setItem?.(COVERAGE_STORAGE_KEY,JSON.stringify(normalized));return true}catch(_error){return false}}
  function coverageSummary(coverage){const normalized=normalizeCoverage(coverage),rows=REGION_PAIR_TARGETS.map(target=>{const entry=normalized.pairs[target.pairKey]||null;return{...target,completed:!!entry,runs:entry?.runs||0,wins:entry?.wins||0,losses:entry?.losses||0,totalFeelNotes:entry?.totalFeelNotes||0,lastFeelCount:entry?.lastFeelCount||0,lastOutcome:entry?.lastOutcome||null}}),completed=rows.filter(row=>row.completed).length;return{version:COVERAGE_VERSION,total:rows.length,completed,remaining:rows.length-completed,rows,pairs:normalized.pairs}}
  function coverageStatusText(coverage){const summary=coverageSummary(coverage);return`M10 조합 커버리지 ${summary.completed}/${summary.total} · 남음 ${summary.remaining}`}
  function coverageDetailHtml(coverage){return coverageSummary(coverage).rows.map(row=>row.completed?`<div data-m10-coverage-pair="${row.pairKey}">✓ ${row.targetRegionNames.join(' + ')} · ${row.runs}회 · ${row.wins}승/${row.losses}패 · 체감 ${row.totalFeelNotes} · 최근 ${row.lastOutcome||'완주'}</div>`:`<div data-m10-coverage-pair="${row.pairKey}">○ ${row.targetRegionNames.join(' + ')} · 미검증</div>`).join('')}
  function resultOutcome(result){if(result?.victory===true||result?.kind==='win'||result?.result==='win')return'승리';if(result?.victory===false||result?.kind==='lose'||result?.result==='lose')return'패배';return'완주'}
  function recordCoverage(runtimeRoot=defaultRoot,runState,summary,result){
    const playtest=summary?.playtest;if(!playtest)return{ok:false,reason:'no_playtest'};if(playtest.matchedTargetRegions!==true)return{ok:false,reason:'target_mismatch'};if(playtest.completedTargetRegions!==true)return{ok:false,reason:'target_incomplete'};const pairKey=playtest.actualPairKey;if(!REGION_PAIR_TARGETS.some(target=>target.pairKey===pairKey))return{ok:false,reason:'unknown_pair'};
    const state=runState?.m10Playtest;if(state?.coverageRecordedPairKey===pairKey)return{ok:false,reason:'already_recorded'};const coverage=loadCoverage(runtimeRoot),previous=coverage.pairs[pairKey]||{runs:0,wins:0,losses:0,totalFeelNotes:0},outcome=resultOutcome(result),feelCount=playtest.feelNotes?.length||0;
    coverage.pairs[pairKey]={runs:previous.runs+1,wins:(previous.wins||0)+(outcome==='승리'?1:0),losses:(previous.losses||0)+(outcome==='패배'?1:0),totalFeelNotes:(previous.totalFeelNotes||0)+feelCount,lastFeelCount:feelCount,lastOutcome:outcome,lastStarterId:playtest.starterId||null,lastTraitId:playtest.traitId||null,lastPresetId:playtest.presetId||null};
    saveCoverage(runtimeRoot,coverage);if(state)state.coverageRecordedPairKey=pairKey;const progress=coverageSummary(coverage);playtest.coverage={recorded:true,pairKey,completed:progress.completed,total:progress.total};return{ok:true,pairKey,coverage:progress};
  }
  function cardId(card){return card?.cardId||card?.definitionId||card?.definition?.id||card?.named?.id||null}
  function cardDefinition(card,runtimeRoot=defaultRoot){
    if(card?.definition&&typeof card.definition==='object')return card.definition;
    if(card?.named&&typeof card.named==='object')return card.named;
    const id=cardId(card);return id?runtimeRoot?.CARD_DEFINITION_BY_ID?.[id]||null:null;
  }
  function cardEffects(card,runtimeRoot=defaultRoot){const definition=cardDefinition(card,runtimeRoot);return definition?.effects||card?.effects||[]}
  function isEffectCard(card,runtimeRoot=defaultRoot){
    if(typeof runtimeRoot?.isPureCard==='function'){
      try{if(runtimeRoot.isPureCard(card))return false}catch(_error){}
    }
    return!!cardId(card)||(Array.isArray(cardEffects(card,runtimeRoot))&&cardEffects(card,runtimeRoot).length>0);
  }
  function tagsForCard(card,runtimeRoot=defaultRoot){
    if(!isEffectCard(card,runtimeRoot))return[];
    const definition=cardDefinition(card,runtimeRoot)||card;
    if(Array.isArray(definition?.systemTags)&&definition.systemTags.length)return[...definition.systemTags];
    return typeof CardSystemTags?.tagsForDefinition==='function'?CardSystemTags.tagsForDefinition(definition):[];
  }
  function deckSummary(runState,runtimeRoot=defaultRoot){
    const deck=Array.isArray(runState?.deck)?runState.deck:[],systemTagCounts={},cardCounts={};let pure=0,effect=0,untaggedEffect=0;
    for(const card of deck){
      const id=cardId(card)||`${card?.suit||'?'}${card?.rank||'?'}`;cardCounts[id]=(cardCounts[id]||0)+1;
      if(!isEffectCard(card,runtimeRoot)){pure+=1;continue}
      effect+=1;const tags=tagsForCard(card,runtimeRoot);if(!tags.length)untaggedEffect+=1;for(const tag of tags)systemTagCounts[tag]=(systemTagCounts[tag]||0)+1;
    }
    const topSystemTags=Object.entries(systemTagCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([tag,count])=>({tag,count}));
    return{total:deck.length,pure,effect,untaggedEffect,systemTagCounts,topSystemTags,cardCounts};
  }
  function regionSummary(runState,runtimeRoot=defaultRoot){
    const flow=runState?.runFlow||{},profiles=runtimeRoot?.RunFlowV2?.REGION_PROFILES||{};
    const visitedRegionIds=Array.isArray(flow.visitedRegionIds)?[...flow.visitedRegionIds]:[],completedRegionIds=Array.isArray(flow.completedRegionIds)?[...flow.completedRegionIds]:[];
    const visitedRegionBranches=Array.isArray(flow.visitedRegionBranches)?flow.visitedRegionBranches.map(entry=>({...entry,tags:[...(entry?.tags||[])]})):[];
    const regionNames=visitedRegionIds.map(id=>profiles?.[id]?.name||id),pairKey=pairKeyForRegionIds(visitedRegionIds);
    return{visitedRegionIds,completedRegionIds,visitedRegionBranches,regionNames,pairKey};
  }
  function fieldSummary(runState){
    const state=runState?.fieldLoadout&&typeof runState.fieldLoadout==='object'?runState.fieldLoadout:{},history=Array.isArray(state.history)?state.history:[];
    const usedFieldIds=[];for(const entry of history){if(entry?.action==='consume'&&entry?.from&&!usedFieldIds.includes(entry.from))usedFieldIds.push(entry.from)}
    return{ownedFieldIds:Array.isArray(state.owned)?[...state.owned]:[],queuedFieldId:state.queuedFieldId||null,usedFieldIds};
  }
  function identitySummary(runState){return{starterId:runState?.starterId||runState?.identity?.starterId||null,starterName:runState?.starter?.name||runState?.char?.name||null,traitId:runState?.traitId||runState?.identity?.traitId||null,traitName:runState?.trait?.name||null}}
  function buildRunAudit(runState,runtimeRoot=defaultRoot){const regions=regionSummary(runState,runtimeRoot),playtest=comparePlaytestTarget(playtestSummary(runState),regions);return{version:VERSION,identity:identitySummary(runState),fields:fieldSummary(runState),regions,deck:deckSummary(runState,runtimeRoot),playtest}}
  function auditRows(summary){
    const identity=summary?.identity||{},fields=summary?.fields||{},regions=summary?.regions||{},deck=summary?.deck||{},playtest=summary?.playtest||null,top=(deck.topSystemTags||[]).slice(0,5).map(entry=>`${entry.tag} ${entry.count}`).join(' · ')||'없음';
    const branches=(regions.visitedRegionBranches||[]).map(entry=>entry.branchLabel||entry.branchId).join(' → ')||'미선택',usedFields=(fields.usedFieldIds||[]).join(', ')||'없음',target=playtest?.targetRegionNames?.length?` · 목표 ${playtest.targetRegionNames.join(' → ')}`:'',match=playtest?.matchedTargetRegions===true?' · 목표 일치':playtest?.matchedTargetRegions===false?' · 목표 불일치':'';
    const rows=[
      `M10 정체성 · ${identity.starterName||identity.starterId||'미상'} / ${identity.traitName||identity.traitId||'미상'} · 사용 필드 ${usedFields}`,
      `M10 지역 · ${(regions.regionNames||regions.visitedRegionIds||[]).join(' → ')||'미방문'}${target}${match} · 분기 ${branches}`,
      `M10 덱 · ${deck.total||0}장 · 순수 ${deck.pure||0} / 효과 ${deck.effect||0} · 주요 태그 ${top}`
    ];
    const notes=playtest?.feelNotes||[];if(notes.length){const counts=playtest?.feelCounts||feelNoteCounts(notes),summaryText=FEEL_NOTE_TYPES.filter(type=>counts[type.id]).map(type=>`${type.label} ${counts[type.id]}`).join(' · ');rows.push(`M10 체감 · ${notes.length}건 · ${summaryText||'분류 없음'}`)}
    if(playtest?.coverage?.recorded)rows.push(`M10 커버리지 · ${playtest.coverage.completed}/${playtest.coverage.total} · ${playtest.coverage.pairKey}`);
    return rows;
  }
  function enrichResult(runState,result,runtimeRoot=defaultRoot){
    const summary=buildRunAudit(runState,runtimeRoot);if(result&&typeof result==='object')result.buildAudit=summary;if(runState?.runResult&&typeof runState.runResult==='object')runState.runResult.buildAudit=summary;return summary;
  }
  function renderAuditRows(runtimeRoot=defaultRoot,summary){
    const doc=runtimeRoot?.document;if(!doc?.querySelector)return false;const list=doc.querySelector('#modal .choiceList');if(!list)return false;
    list.querySelectorAll?.('[data-m10-build-audit]')?.forEach?.(node=>node.remove?.());const buttons=list.querySelectorAll?[...list.querySelectorAll('button')]:[],before=buttons.find(button=>(button.textContent||'').includes('새 런'))||null;
    for(const text of auditRows(summary)){const row=doc.createElement('div');row.className='choice';row.setAttribute('data-m10-build-audit','true');const bold=doc.createElement('b');bold.textContent=text;row.appendChild(bold);list.insertBefore(row,before)}return true;
  }
  function startPlaytestPreset(runtimeRoot=defaultRoot,presetId){
    const preset=playtestPreset(presetId);if(!preset)return{ok:false,reason:'unknown_preset'};
    const api=runtimeRoot?.RunStartV2;if(typeof runtimeRoot?.beginRun!=='function'||typeof api?.applyIdentityToRun!=='function')return{ok:false,reason:'runtime_not_ready'};
    runtimeRoot.beginRun();const runState=activeRun(runtimeRoot);if(!runState)return{ok:false,reason:'run_not_created'};
    const cardsApi=typeof api.cardsApiFor==='function'?api.cardsApiFor(runtimeRoot):runtimeRoot;
    try{api.applyIdentityToRun(runState,{starterId:preset.starterId,traitId:preset.traitId},cardsApi,runtimeRoot)}catch(error){runtimeRoot?.console?.warn?.('[m10] 표본 런 시작 실패',error);return{ok:false,reason:'identity_apply_failed'}}
    runState.m10Playtest={presetId:preset.id,label:preset.label,starterId:preset.starterId,traitId:preset.traitId,targetRegionIds:[...preset.targetRegionIds],targetRegionNames:[...preset.targetRegionNames],feelNotes:[]};
    try{runtimeRoot?.showScreen?.('mapScreen');runtimeRoot?.renderMap?.()}catch(_error){}
    return{ok:true,presetId:preset.id,label:preset.label,targetRegionIds:[...preset.targetRegionIds],targetRegionNames:[...preset.targetRegionNames]};
  }
  function playtestStatusText(runState){
    const state=playtestSummary(runState);if(!state)return'M10 표본 미선택';
    const visited=Array.isArray(runState?.runFlow?.visitedRegionIds)?runState.runFlow.visitedRegionIds:[],target=(state.targetRegionNames||state.targetRegionIds||[]).join(' → ')||'미지정',actualPairKey=pairKeyForRegionIds(visited),targetPairKey=pairKeyForRegionIds(state.targetRegionIds),match=actualPairKey?(actualPairKey===targetPairKey?' · 목표 일치':' · 목표 불일치'):'';
    return`${state.label||state.presetId||'M10 표본'} · 목표 ${target} · 방문 ${visited.length}/2${match}`;
  }
  function feelStatusText(runState){
    const state=playtestSummary(runState);if(!state)return'체감 기록 · 표본 런을 먼저 시작';const counts=state.feelCounts||{},parts=FEEL_NOTE_TYPES.filter(type=>counts[type.id]).map(type=>`${type.label} ${counts[type.id]}`);return`체감 기록 ${state.feelNotes.length}/${FEEL_NOTE_LIMIT}${parts.length?` · ${parts.join(' · ')}`:''}`;
  }
  function playtestLauncherHtml(coverage=emptyCoverage()){
    const buttons=PLAYTEST_PRESETS.map(preset=>`<button type="button" data-m10-playtest-preset="${preset.id}">${preset.label}<br><span>${preset.targetRegionNames.join(' + ')}</span></button>`).join('');
    const pairButtons=REGION_PAIR_TARGETS.map(target=>`<button type="button" data-m10-playtest-preset="${target.id}">${target.label}<br><span>${target.targetRegionNames.join(' + ')}</span></button>`).join('');
    const feelButtons=FEEL_NOTE_TYPES.filter(type=>type.id!=='memo').map(type=>`<button type="button" data-m10-feel-type="${type.id}">${type.label}</button>`).join('');
    return`<b>M10 대표 5런</b><div class="devHint">스타터·특성만 고정합니다. 지역 선택은 직접 진행해 체감 판정을 보존합니다.</div><div class="devRow">${buttons}</div><div class="devHint" data-m10-playtest-status>M10 표본 미선택</div><b style="display:block;margin-top:8px">15조합 커버리지</b><div class="devHint" data-m10-coverage-status>${coverageStatusText(coverage)}</div><details><summary>전체 15조합 시작</summary><div class="devRow">${pairButtons}</div></details><div class="devHint" data-m10-coverage-list>${coverageDetailHtml(coverage)}</div><b style="display:block;margin-top:8px">M10 체감 기록</b><div class="devHint">짧은 상황 메모를 적고 분류 버튼을 누르세요. 빈칸이면 분류만 기록합니다.</div><div class="devRow">${feelButtons}</div><div class="devInline"><input type="text" maxlength="${FEEL_NOTE_TEXT_LIMIT}" data-m10-feel-note placeholder="예: 두 번째 보상에서 전부 무늬 카드"><button type="button" data-m10-feel-type="memo">메모 추가</button></div><div class="devHint" data-m10-feel-status>체감 기록 · 표본 런을 먼저 시작</div>`;
  }
  function refreshCoverageLauncher(runtimeRoot=defaultRoot,group){const coverage=loadCoverage(runtimeRoot),status=group?.querySelector?.('[data-m10-coverage-status]'),list=group?.querySelector?.('[data-m10-coverage-list]');if(status)status.textContent=coverageStatusText(coverage);if(list)list.innerHTML=coverageDetailHtml(coverage);return coverageSummary(coverage)}
  function renderPlaytestLauncher(runtimeRoot=defaultRoot){
    if(!isDeveloperMode(runtimeRoot))return false;const doc=runtimeRoot?.document,panel=doc?.querySelector?.('#trickDevPanel');if(!panel)return false;
    let group=panel.querySelector?.('[data-m10-playtest-launcher]');if(!group){group=doc.createElement('div');group.className='devGroup';group.setAttribute('data-m10-playtest-launcher','true');group.innerHTML=playtestLauncherHtml(loadCoverage(runtimeRoot));const message=panel.querySelector?.('#trickDevMessage');panel.insertBefore(group,message||null);group.addEventListener?.('click',event=>{
      const presetButton=event.target?.closest?.('[data-m10-playtest-preset]');if(presetButton){const result=startPlaytestPreset(runtimeRoot,presetButton.dataset.m10PlaytestPreset);const messageNode=panel.querySelector?.('#trickDevMessage');if(messageNode)messageNode.textContent=result.ok?`${result.label} 시작 · 지역은 직접 선택`:`M10 표본 시작 실패 · ${result.reason}`;const status=group.querySelector?.('[data-m10-playtest-status]');if(status)status.textContent=playtestStatusText(activeRun(runtimeRoot));const feelStatus=group.querySelector?.('[data-m10-feel-status]');if(feelStatus)feelStatus.textContent=feelStatusText(activeRun(runtimeRoot));return}
      const feelButton=event.target?.closest?.('[data-m10-feel-type]');if(!feelButton)return;const input=group.querySelector?.('[data-m10-feel-note]'),result=addPlaytestFeelNote(activeRun(runtimeRoot),feelButton.dataset.m10FeelType,input?.value||'',runtimeRoot),messageNode=panel.querySelector?.('#trickDevMessage');if(messageNode)messageNode.textContent=result.ok?`체감 기록 · ${result.entry.label}${result.entry.note?` · ${result.entry.note}`:''}`:`체감 기록 실패 · ${result.reason}`;if(result.ok&&input)input.value='';const feelStatus=group.querySelector?.('[data-m10-feel-status]');if(feelStatus)feelStatus.textContent=feelStatusText(activeRun(runtimeRoot))
    })}
    const status=group.querySelector?.('[data-m10-playtest-status]');if(status)status.textContent=playtestStatusText(activeRun(runtimeRoot));const feelStatus=group.querySelector?.('[data-m10-feel-status]');if(feelStatus)feelStatus.textContent=feelStatusText(activeRun(runtimeRoot));refreshCoverageLauncher(runtimeRoot,group);return true;
  }
  function installPlaytestLauncherWhenReady(runtimeRoot=defaultRoot){
    if(!isDeveloperMode(runtimeRoot))return false;let attempts=0;const attempt=()=>{if(renderPlaytestLauncher(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25)};attempt();return true;
  }
  function finalizeRunResult(runtimeRoot,result){const runState=activeRun(runtimeRoot);if(!runState)return result;const summary=enrichResult(runState,result,runtimeRoot);recordCoverage(runtimeRoot,runState,summary,result);renderAuditRows(runtimeRoot,summary);const group=runtimeRoot?.document?.querySelector?.('[data-m10-playtest-launcher]');if(group)refreshCoverageLauncher(runtimeRoot,group);runtimeRoot?.console?.info?.('[M10 build audit]',summary);return result}
  function wrapFinishRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.finishRun;if(typeof original!=='function'||original.__m10BuildAudit)return false;function wrapped(){const result=original.apply(this,arguments);if(result&&typeof result.then==='function')return result.then(value=>finalizeRunResult(runtimeRoot,value));return finalizeRunResult(runtimeRoot,result)}wrapped.__m10BuildAudit=true;wrapped.__original=original;runtimeRoot.finishRun=wrapped;return true}
  function wrapLoseRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.loseRun;if(typeof original!=='function'||original.__m10BuildAudit)return false;function wrapped(){const result=original.apply(this,arguments);if(result&&typeof result.then==='function')return result.then(value=>finalizeRunResult(runtimeRoot,value));return finalizeRunResult(runtimeRoot,result)}wrapped.__m10BuildAudit=true;wrapped.__original=original;runtimeRoot.loseRun=wrapped;return true}
  function installBrowser(runtimeRoot=defaultRoot){if(browserInstalled){installPlaytestLauncherWhenReady(runtimeRoot);return true}if(!runtimeRoot?.RunFlowV2||!runtimeRoot?.RunBalanceTelemetry||!runtimeRoot?.CardSystemTags)return false;if(typeof runtimeRoot.finishRun!=='function'||typeof runtimeRoot.loseRun!=='function')return false;wrapFinishRun(runtimeRoot);wrapLoseRun(runtimeRoot);browserInstalled=true;installPlaytestLauncherWhenReady(runtimeRoot);return true}
  function installWhenReady(runtimeRoot=defaultRoot){let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<120)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[m10] 빌드 감사 설치 실패')};if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true}
  function resetBrowserInstallForTests(){browserInstalled=false}

  return{STAGE,VERSION,REGION_CATALOG,PLAYTEST_PRESETS,REGION_PAIR_TARGETS,FEEL_NOTE_TYPES,FEEL_NOTE_LIMIT,FEEL_NOTE_TEXT_LIMIT,COVERAGE_VERSION,COVERAGE_STORAGE_KEY,activeRun,isDeveloperMode,playtestPreset,feelNoteType,normalizeFeelNoteText,feelNoteCounts,playtestFeelNotes,playtestSummary,pairKeyForRegionIds,comparePlaytestTarget,addPlaytestFeelNote,emptyCoverage,normalizeCoverage,loadCoverage,saveCoverage,coverageSummary,coverageStatusText,coverageDetailHtml,resultOutcome,recordCoverage,cardId,cardDefinition,cardEffects,isEffectCard,tagsForCard,deckSummary,regionSummary,fieldSummary,identitySummary,buildRunAudit,auditRows,enrichResult,renderAuditRows,startPlaytestPreset,playtestStatusText,feelStatusText,playtestLauncherHtml,refreshCoverageLauncher,renderPlaytestLauncher,installPlaytestLauncherWhenReady,finalizeRunResult,wrapFinishRun,wrapLoseRun,installBrowser,installWhenReady,resetBrowserInstallForTests};
});
