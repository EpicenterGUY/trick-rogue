(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.TrickDevTools=api;
  if(typeof document!=='undefined'&&api.isDeveloperMode(root.location?.search||'')){
    const start=()=>api.mount(document);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUIT_SYMBOLS=Object.freeze({S:'♠',H:'♥',D:'♦',C:'♣'});
  const RANK_LABELS=Object.freeze({11:'J',12:'Q',13:'K',14:'A'});
  const BATTLE_TYPES=Object.freeze(['battle','elite','boss']);
  const SHOWDOWN_SLOT_COUNT=5;
  const STATUS_IDS=Object.freeze(['shield','bleed','regen','vulnerable','scar','mark','poison']);
  const SET_RESULT_SYMBOLS=Object.freeze({W:'player',L:'enemy',D:'draw','승':'player','패':'enemy','무':'draw'});

  function isDeveloperMode(search=''){
    try{return new URLSearchParams(String(search||'')).get('dev')==='1'}catch(_){return false}
  }
  function clampInteger(value,min,max,fallback=min){
    const n=Number(value);
    if(!Number.isFinite(n))return fallback;
    return Math.max(min,Math.min(max,Math.round(n)));
  }
  function rankLabel(rank){return RANK_LABELS[rank]||String(rank)}
  function suitLabel(suit){return SUIT_SYMBOLS[suit]||String(suit||'?')}
  function safeRuntime(){
    let currentRun=null,currentBattle=null;
    try{currentRun=typeof run==='undefined'?null:run}catch(_){currentRun=null}
    try{currentBattle=typeof battle==='undefined'?null:battle}catch(_){currentBattle=null}
    return{run:currentRun,battle:currentBattle};
  }
  function battleCoreApi(){try{return typeof BattleCore==='undefined'?null:BattleCore}catch(_){return null}}
  function combatEffectsApi(){try{return typeof CombatEffects==='undefined'?null:CombatEffects}catch(_){return null}}
  function cardEffectsApi(){try{return typeof CardEffects==='undefined'?null:CardEffects}catch(_){return null}}
  function showdownAdvantageApi(){try{return typeof ShowdownAdvantage==='undefined'?null:ShowdownAdvantage}catch(_){return null}}
  function showdownResolutionApi(){try{return typeof ShowdownResolution==='undefined'?null:ShowdownResolution}catch(_){return null}}
  function callIfPresent(name,...args){
    try{
      if(name==='beginRun'&&typeof beginRun==='function')return beginRun(...args);
      if(name==='startBattle'&&typeof startBattle==='function')return startBattle(...args);
      if(name==='renderBattle'&&typeof renderBattle==='function')return renderBattle(...args);
      if(name==='renderMap'&&typeof renderMap==='function')return renderMap(...args);
      if(name==='showScreen'&&typeof showScreen==='function')return showScreen(...args);
      if(name==='makeCard'&&typeof makeCard==='function')return makeCard(...args);
      if(name==='makeNamed'&&typeof makeNamed==='function')return makeNamed(...args);
      if(name==='makeGeneral'&&typeof makeGeneral==='function')return makeGeneral(...args);
      if(name==='showdown'&&typeof showdown==='function')return showdown(...args);
    }catch(error){console.warn('[DEV]',name,error)}
    return undefined;
  }
  function ensureRun(){
    let state=safeRuntime();
    if(state.run)return state.run;
    callIfPresent('beginRun');
    state=safeRuntime();
    return state.run;
  }
  function renderCurrent(){
    const state=safeRuntime();
    if(state.battle)callIfPresent('renderBattle');
    else if(state.run)callIfPresent('renderMap');
  }
  function definitionArrays(){
    const arrays=[];
    try{if(Array.isArray(GENERAL_EFFECT_CARD_DEFINITIONS))arrays.push(GENERAL_EFFECT_CARD_DEFINITIONS)}catch(_){}
    try{if(Array.isArray(CARD_DEFINITIONS))arrays.push(CARD_DEFINITIONS)}catch(_){}
    return arrays;
  }
  function cardCandidates(){
    const result=[];
    const keys=new Set();
    try{
      if(typeof createBaseCardSlots==='function'){
        createBaseCardSlots().forEach(card=>{
          const key=`pure:${card.suit}:${card.rank}`;
          if(keys.has(key))return;
          keys.add(key);
          result.push({key,kind:'pure',suit:card.suit,rank:card.rank,label:`순수 ${suitLabel(card.suit)}${rankLabel(card.rank)}`});
        });
      }
    }catch(error){console.warn('[DEV] 순수 카드 목록',error)}
    definitionArrays().flat().forEach(def=>{
      if(!def?.id||keys.has(def.id))return;
      keys.add(def.id);
      result.push({key:def.id,kind:'effect',id:def.id,suit:def.suit,rank:def.rank,label:`${def.name||def.id} · ${suitLabel(def.suit)}${rankLabel(def.rank)} · ${def.id}`});
    });
    return result;
  }
  function findCandidate(query){
    const text=String(query||'').trim().toLowerCase();
    if(!text)return null;
    const cards=cardCandidates();
    return cards.find(card=>card.key.toLowerCase()===text)||cards.find(card=>card.id?.toLowerCase()===text)||cards.find(card=>card.label.toLowerCase()===text)||cards.find(card=>card.label.toLowerCase().includes(text));
  }
  function createCard(candidate){
    if(!candidate)return null;
    if(candidate.kind==='pure')return callIfPresent('makeCard',candidate.suit,candidate.rank,null)||null;
    if(String(candidate.id).startsWith('core.'))return callIfPresent('makeGeneral',candidate.id)||null;
    return callIfPresent('makeNamed',candidate.id)||null;
  }
  function addCard(query,target='deck'){
    const candidate=findCandidate(query);
    if(!candidate)return{ok:false,message:'카드를 찾지 못함'};
    const currentRun=ensureRun();
    if(!currentRun)return{ok:false,message:'런을 만들 수 없음'};
    const card=createCard(candidate);
    if(!card)return{ok:false,message:'카드 생성 실패'};
    if(target==='hand'){
      const state=safeRuntime();
      if(!state.battle)return{ok:false,message:'손패 추가는 전투 중에만 가능'};
      state.battle.hand.push(card);
    }else currentRun.deck.push(card);
    renderCurrent();
    return{ok:true,message:`${candidate.label} → ${target==='hand'?'손패':'덱'}`};
  }

  function parseSetResults(value){
    const raw=String(value||'').trim();
    if(!raw)return{ok:true,results:[]};
    const chars=[...raw.toUpperCase()].filter(char=>!/[\s,\/|>\-]/.test(char));
    if(chars.length>SHOWDOWN_SLOT_COUNT)return{ok:false,message:'세트 전적은 최대 5트릭까지 입력 가능',results:[]};
    const results=[];
    for(const char of chars){
      const result=SET_RESULT_SYMBOLS[char];
      if(!result)return{ok:false,message:`알 수 없는 전적 기호: ${char}`,results:[]};
      results.push(result);
    }
    return{ok:true,results};
  }
  function createSetHistoryFromResults(results=[]){
    const history={trickResults:[],wins:0,losses:0,draws:0,lastResult:null,winStreak:0,lossStreak:0};
    for(const result of results){
      if(!['player','enemy','draw'].includes(result))continue;
      history.trickResults.push(result);history.lastResult=result;
      if(result==='player'){history.wins++;history.winStreak++;history.lossStreak=0}
      else if(result==='enemy'){history.losses++;history.lossStreak++;history.winStreak=0}
      else{history.draws++;history.winStreak=0;history.lossStreak=0}
    }
    return history;
  }
  function applySetResults(value){
    const state=safeRuntime();if(!state.battle)return{ok:false,message:'전투 중에만 세트 전적을 바꿀 수 있음'};
    const parsed=parseSetResults(value);if(!parsed.ok)return parsed;
    state.battle.setHistory=createSetHistoryFromResults(parsed.results);
    renderCurrent();
    const h=state.battle.setHistory;
    return{ok:true,message:`세트 전적 적용 · 승 ${h.wins} / 패 ${h.losses} / 무 ${h.draws}`};
  }
  function setStatus(actor,id,value){
    const state=safeRuntime(),side=actor==='enemy'?'enemy':'player',statusId=String(id||'');
    if(!state.battle?.statuses||!STATUS_IDS.includes(statusId))return{ok:false,message:'상태 적용 불가'};
    const amount=clampInteger(value,0,99,0),api=combatEffectsApi();
    try{
      if(api?.setStatusValue)api.setStatusValue(state.battle.statuses,side,statusId,amount);
      else{if(!state.battle.statuses[side])state.battle.statuses[side]={};state.battle.statuses[side][statusId]=amount}
    }catch(error){console.warn('[DEV] 상태 강제',error);return{ok:false,message:'상태 적용 실패'}}
    renderCurrent();return{ok:true,message:`${side==='player'?'나':'적'} ${statusId} ${amount} 적용`};
  }
  function clearStatuses(){
    const state=safeRuntime(),api=combatEffectsApi();if(!state.battle?.statuses)return false;
    for(const side of ['player','enemy'])for(const id of STATUS_IDS){
      try{if(api?.setStatusValue)api.setStatusValue(state.battle.statuses,side,id,0);else{if(!state.battle.statuses[side])state.battle.statuses[side]={};state.battle.statuses[side][id]=0}}catch(error){console.warn('[DEV] 상태 제거',side,id,error)}
    }
    renderCurrent();return true;
  }
  function statusSummary(statuses,side){
    const source=statuses?.[side]||{},parts=[];
    for(const id of STATUS_IDS){const raw=source[id],value=raw&&typeof raw==='object'?raw.value:raw;if(Number(value)>0)parts.push(`${id}${Number(value)}`)}
    return parts.length?parts.join(' '):'없음';
  }
  function setAdvantage(mode='none'){
    const state=safeRuntime(),current=state.battle;if(!current)return{ok:false,message:'전투 중에만 우세를 바꿀 수 있음'};
    if(!['none','player','enemy','both'].includes(mode))return{ok:false,message:'알 수 없는 우세 모드'};
    const api=showdownAdvantageApi();
    try{
      if(api?.consumeAdvantage)api.consumeAdvantage(current);
      else current.advantageState={player:false,enemy:false,playerSource:null,enemySource:null,grantedSet:null};
      if(mode==='player'||mode==='both')api?.grantAdvantage?api.grantAdvantage(current,'player',{source:'dev'}):(current.advantageState.player=true,current.advantageState.playerSource='dev');
      if(mode==='enemy'||mode==='both')api?.grantAdvantage?api.grantAdvantage(current,'enemy',{source:'dev'}):(current.advantageState.enemy=true,current.advantageState.enemySource='dev');
    }catch(error){console.warn('[DEV] 우세 강제',error);return{ok:false,message:'우세 적용 실패'}}
    renderCurrent();return{ok:true,message:`우세 ${mode==='none'?'없음':mode==='player'?'나':mode==='enemy'?'적':'양쪽'} 적용`};
  }
  function currentAdvantageText(state=safeRuntime().battle){
    const a=state?.advantageState;if(!a)return'없음';
    if(a.player&&a.enemy)return'양쪽';if(a.player)return'나';if(a.enemy)return'적';return'없음';
  }
  function showdownResolver(){const core=battleCoreApi();return(card,key)=>core?.showdownValue?core.showdownValue(card,key):(card?.[`showdown${key}`]??card?.[`printed${key}`]??card?.[key.toLowerCase()])}
  function setRiverMode(mode='auto',{render=true}={}){
    const state=safeRuntime(),current=state.battle,api=showdownResolutionApi();
    if(!current)return{ok:false,message:'전투 중에만 리버를 바꿀 수 있음'};
    if(mode==='none'){current.riverSnapshot=null;current.riverHit=null;if(render)renderCurrent();return{ok:true,message:'리버 스냅샷 제거'}}
    if(!api||!Array.isArray(current.slots)||current.slots.length!==SHOWDOWN_SLOT_COUNT)return{ok:false,message:'쇼다운 5슬롯 적용 후 리버를 설정할 수 있음'};
    const resolver=showdownResolver();
    try{
      if(mode==='auto')current.riverSnapshot=api.createRiverSnapshot(current.slots.slice(0,4),{valueResolver:resolver,setIndex:current.setIndex});
      else if(mode==='force'){
        const firstFour=current.slots.slice(0,4),fifth=api.standardCardSpec(current.slots[4]?.card,resolver),sourceCards=firstFour.map(slot=>api.standardCardSpec(slot?.card,resolver));
        if(!fifth||sourceCards.some(spec=>!spec))return{ok:false,message:'표준 52장 값이 있는 카드만 강제 리버 가능'};
        const target=api.handSummary(api.evaluatePoker(current.slots,{valueResolver:resolver}));
        const baseline=api.handSummary(api.evaluateFourCardState(firstFour,{valueResolver:resolver}));
        current.riverSnapshot={stage:api.RIVER_STAGE,id:`dev:set:${current.setIndex}:${fifth.key}`,setIndex:current.setIndex,capturedAfterTrick:4,slotCount:4,frozen:true,sourceCards:sourceCards.map(spec=>({rank:spec.rank,suit:spec.suit,key:spec.key})),baseline,candidates:[{rank:fifth.rank,suit:fifth.suit,key:fifth.key,target:{...target}}],candidateKeys:[fifth.key],groups:[],candidateCount:1,active:true,lines:['DEV 강제 리버 적중']};
      }else return{ok:false,message:'알 수 없는 리버 모드'};
      current.riverHit=null;if(render)renderCurrent();return{ok:true,message:mode==='force'?'리버 적중 강제':'리버 후보 자동 계산'};
    }catch(error){console.warn('[DEV] 리버 강제',error);return{ok:false,message:'리버 설정 실패'}}
  }
  function riverModeText(state=safeRuntime().battle){const snapshot=state?.riverSnapshot;if(!snapshot)return'없음';return String(snapshot.id||'').startsWith('dev:')?'강제':'자동'}
  function addNextWinReservation(value){
    const state=safeRuntime(),current=state.battle;if(!current)return{ok:false,message:'전투 중에만 예약 효과를 추가할 수 있음'};
    const amount=clampInteger(value,0,99,0);if(amount<=0)return{ok:false,message:'예약 피해는 1 이상이어야 함'};
    if(!Array.isArray(current.reservations))current.reservations=[];
    const setIndex=current.setIndex||1,trick=current.trick||1,spec={type:'nextWinDamage',value:amount,eligibleSet:trick===5?setIndex+1:setIndex,eligibleTrick:trick===5?1:trick+1,ownerType:'dev',ownerId:'dev.nextWinDamage',label:`DEV 다음 승리 피해 ${amount}`},api=cardEffectsApi();
    try{current.reservations.push(api?.createReservation?api.createReservation(spec):{...spec,timing:'on_trick_result',duration:'battle',consume:'when_due',action:'damage_enemy',condition:'player_win'})}
    catch(error){console.warn('[DEV] 예약 강제',error);return{ok:false,message:'예약 효과 추가 실패'}}
    renderCurrent();return{ok:true,message:`다음 승리 피해 ${amount} 예약 추가`};
  }
  function clearReservations(){const state=safeRuntime();if(!state.battle)return false;state.battle.reservations=[];renderCurrent();return true}
  function buildShowdownSlots(queries){
    if(!Array.isArray(queries)||queries.length!==SHOWDOWN_SLOT_COUNT)return{ok:false,message:`쇼다운 슬롯은 ${SHOWDOWN_SLOT_COUNT}장이 필요함`,slots:[]};
    const slots=[];
    for(let i=0;i<queries.length;i++){
      const query=String(queries[i]||'').trim();
      if(!query)return{ok:false,message:`${i+1}번 슬롯이 비어 있음`,slots:[]};
      const candidate=findCandidate(query);
      if(!candidate)return{ok:false,message:`${i+1}번 슬롯 카드를 찾지 못함`,slots:[]};
      const card=createCard(candidate);
      if(!card)return{ok:false,message:`${i+1}번 슬롯 카드 생성 실패`,slots:[]};
      slots.push({card,result:null});
    }
    return{ok:true,message:'쇼다운 슬롯 구성 완료',slots};
  }
  function showdownReady(battleLike){
    return Boolean(battleLike&&!battleLike.ended&&Array.isArray(battleLike.slots)&&Array.isArray(battleLike.enemySlots)&&battleLike.slots.length===SHOWDOWN_SLOT_COUNT&&battleLike.enemySlots.length===SHOWDOWN_SLOT_COUNT&&battleLike.slots.every(slot=>slot?.card)&&battleLike.enemySlots.every(slot=>slot?.card));
  }
  function applyShowdownSlots(playerQueries,enemyQueries){
    const state=safeRuntime(),current=state.battle;
    if(!current)return{ok:false,message:'전투 중에만 쇼다운 슬롯을 구성할 수 있음'};
    if(current.animating)return{ok:false,message:'전투 연출 중에는 슬롯을 바꿀 수 없음'};
    if(current.ended)return{ok:false,message:'종료된 전투에서는 슬롯을 바꿀 수 없음'};
    const player=buildShowdownSlots(playerQueries);if(!player.ok)return{ok:false,message:`내 슬롯 · ${player.message}`};
    const enemy=buildShowdownSlots(enemyQueries);if(!enemy.ok)return{ok:false,message:`적 슬롯 · ${enemy.message}`};
    current.slots=player.slots;
    current.enemySlots=enemy.slots;
    current.trick=SHOWDOWN_SLOT_COUNT;
    current.phase='trick';
    current.advantage=null;
    current.showdownVisualStage=null;
    current.showdownTrace=[];
    current.slotBonus=0;
    current.selected=null;
    current.inspectSlot=null;
    current.inspectStage=null;
    current.playerStage=null;
    const river=setRiverMode('auto',{render:false});
    renderCurrent();
    return{ok:true,message:`내/적 쇼다운 5슬롯 적용 완료 · 트릭 중 효과는 생략됨${river.ok?' · 리버 자동 계산':''}`};
  }
  async function runShowdownNow(){
    const state=safeRuntime(),current=state.battle;
    if(!current)return{ok:false,message:'전투 중에만 쇼다운을 실행할 수 있음'};
    if(current.animating)return{ok:false,message:'전투 연출 중에는 쇼다운을 실행할 수 없음'};
    if(current.ended)return{ok:false,message:'종료된 전투에서는 쇼다운을 실행할 수 없음'};
    if(!showdownReady(current))return{ok:false,message:'내/적 쇼다운 슬롯을 각각 5장 채워야 함'};
    current.trick=SHOWDOWN_SLOT_COUNT;
    current.showdownTrace=[];
    current.animating=true;
    try{
      const result=callIfPresent('showdown');
      if(!result||typeof result.then!=='function')return{ok:false,message:'쇼다운 실행 함수를 찾지 못함'};
      await result;
      return{ok:true,message:'즉시 쇼다운 실행 완료'};
    }catch(error){console.warn('[DEV] 즉시 쇼다운',error);return{ok:false,message:'즉시 쇼다운 실행 실패'}}
    finally{current.animating=false;renderCurrent()}
  }
  function showdownBreakdownDetails(battleLike=safeRuntime().battle){
    const model=battleLike?.lastShowdownBreakdown||battleLike?.showdownBreakdown;if(!model)return[];const lines=[];
    for(const entry of model.player?.additives||[])lines.push(`덧셈 · ${entry.label||entry.id}: ${Number(entry.value)>=0?'+':''}${Number(entry.value)||0}`);
    for(const entry of model.player?.multipliers||[])lines.push(`배율 · ${entry.label||entry.id}: ${Number(entry.bonus)>=0?'+':''}${Math.round((Number(entry.bonus)||0)*100)}%`);
    if(model.riverHit?.active)lines.push(`리버 · 적중: ${model.riverHit.target?.name||'후보'} +25%`);
    return lines;
  }
  function showdownTraceText(battleLike=safeRuntime().battle){
    const trace=Array.isArray(battleLike?.showdownTrace)&&battleLike.showdownTrace.length?battleLike.showdownTrace:[];
    const details=showdownBreakdownDetails(battleLike);
    if(!trace.length&&!details.length)return'아직 쇼다운 계산 로그 없음';
    return [...trace,...(details.length?['--- 상세 ---',...details]:[])].join('\n');
  }
  function quickBattle(type){
    if(!BATTLE_TYPES.includes(type))return{ok:false,message:'지원하지 않는 전투 종류'};
    if(!ensureRun())return{ok:false,message:'런을 만들 수 없음'};
    const node={id:`dev-${type}`,type,next:[],dev:true};
    callIfPresent('startBattle',node);
    return safeRuntime().battle?{ok:true,message:`${type==='battle'?'일반전':type==='elite'?'엘리트':'보스'} 시작`}:{ok:false,message:'전투 시작 실패'};
  }
  function setPlayerHp(value){
    const currentRun=ensureRun();
    if(!currentRun)return false;
    currentRun.hp=clampInteger(value,0,Math.max(1,Number(currentRun.maxHp)||60),currentRun.hp||0);
    renderCurrent();return true;
  }
  function setEnemyHp(value){
    const state=safeRuntime();
    if(!state.battle?.enemy)return false;
    state.battle.enemy.hp=clampInteger(value,0,Math.max(1,Number(state.battle.enemy.maxHp)||999),state.battle.enemy.hp||0);
    renderCurrent();return true;
  }
  function setChip(value){
    const state=safeRuntime();
    if(!state.battle)return false;
    state.battle.chip=clampInteger(value,0,5,state.battle.chip||0);
    renderCurrent();return true;
  }
  function setShield(value){
    const state=safeRuntime();
    if(!state.battle?.statuses?.player)return false;
    state.battle.statuses.player.shield=clampInteger(value,0,99,state.battle.statuses.player.shield||0);
    renderCurrent();return true;
  }
  function setTrump(value){
    const suit=String(value||'').toUpperCase();
    const state=safeRuntime();
    if(!state.battle||!SUIT_SYMBOLS[suit])return false;
    state.battle.trump=suit;
    renderCurrent();return true;
  }
  function restartBattle(){
    const state=safeRuntime();
    return quickBattle(BATTLE_TYPES.includes(state.battle?.type)?state.battle.type:'battle');
  }
  function backToMap(){
    if(!ensureRun())return false;
    try{if(typeof closeOverlay==='function')closeOverlay()}catch(_){}
    callIfPresent('showScreen','mapScreen');callIfPresent('renderMap');return true;
  }
  function stateText(){
    const state=safeRuntime();
    if(!state.run)return'런 없음 · 전투 버튼을 누르면 기본 런 자동 생성';
    const p=`HP ${state.run.hp}/${state.run.maxHp} · 덱 ${state.run.deck?.length||0}`;
    if(!state.battle)return`${p} · 맵`;
    const b=state.battle;
    const h=b.setHistory||{};
    return `${p}\n${b.type||'battle'} · 적 ${b.enemy?.hp??'-'}/${b.enemy?.maxHp??'-'} · 칩 ${b.chip??'-'} · 보호막 ${b.statuses?.player?.shield??0}\n세트 ${b.setIndex??'-'} · 트릭 ${b.trick??'-'} · 전적 ${h.wins||0}-${h.losses||0}-${h.draws||0} · 트럼프 ${suitLabel(b.trump)}\n슬롯 ${b.slots?.length||0}/${SHOWDOWN_SLOT_COUNT} · 우세 ${currentAdvantageText(b)} · 리버 ${riverModeText(b)} · 예약 ${b.reservations?.length||0}\n상태 나 ${statusSummary(b.statuses,'player')} / 적 ${statusSummary(b.statuses,'enemy')}`;
  }
  function showdownRowsHtml(){return Array.from({length:SHOWDOWN_SLOT_COUNT},(_,i)=>`<div class="devShowdownRow"><span>${i+1}</span><input id="trickDevPlayerSlot${i+1}" list="trickDevCardList" placeholder="내 카드"><input id="trickDevEnemySlot${i+1}" list="trickDevCardList" placeholder="적 카드"></div>`).join('')}
  function panelHtml(){return `
    <button type="button" id="trickDevToggle" aria-expanded="false">DEV</button>
    <section id="trickDevPanel" hidden aria-label="트릭로그 개발자 도구">
      <header><b>개발자 테스트</b><button type="button" data-dev-action="close">×</button></header>
      <pre id="trickDevState"></pre>
      <div class="devGroup"><b>빠른 전투</b><div class="devRow"><button data-dev-battle="battle">일반</button><button data-dev-battle="elite">엘리트</button><button data-dev-battle="boss">보스</button></div><div class="devRow"><button data-dev-action="restart">전투 재시작</button><button data-dev-action="map">맵 복귀</button></div></div>
      <div class="devGroup"><b>전투 상태 강제 설정</b><label>플레이어 HP <input id="trickDevPlayerHp" inputmode="numeric" type="number" min="0"></label><label>적 HP <input id="trickDevEnemyHp" inputmode="numeric" type="number" min="0"></label><label>칩 <input id="trickDevChip" inputmode="numeric" type="number" min="0" max="5"></label><label>보호막 <input id="trickDevShield" inputmode="numeric" type="number" min="0" max="99"></label><div class="devRow"><button data-dev-stat="playerHp">HP 적용</button><button data-dev-stat="enemyHp">적 HP</button><button data-dev-stat="chip">칩</button><button data-dev-stat="shield">보호막</button></div></div>
      <div class="devGroup"><b>트럼프</b><div class="devRow"><button data-dev-trump="S">♠</button><button data-dev-trump="H">♥</button><button data-dev-trump="D">♦</button><button data-dev-trump="C">♣</button></div></div>
      <div class="devGroup"><b>세트 전적</b><div class="devHint">W=승, L=패, D=무승부 · 순서까지 그대로 기록</div><div class="devInline"><input id="trickDevSetResults" maxlength="9" placeholder="예: WWLDD"><button data-dev-action="setResults">적용</button></div></div>
      <div class="devGroup"><b>상태</b><div class="devInline"><select id="trickDevStatusActor"><option value="player">나</option><option value="enemy">적</option></select><select id="trickDevStatusId">${STATUS_IDS.map(id=>`<option value="${id}">${id}</option>`).join('')}</select><input id="trickDevStatusValue" type="number" inputmode="numeric" min="0" max="99" value="1"></div><div class="devRow"><button data-dev-action="setStatus">상태 적용</button><button data-dev-action="clearStatuses">상태 전체 제거</button></div></div>
      <div class="devGroup"><b>우세</b><div class="devRow"><button data-dev-advantage="none">없음</button><button data-dev-advantage="player">나</button><button data-dev-advantage="enemy">적</button><button data-dev-advantage="both">양쪽</button></div></div>
      <div class="devGroup"><b>쇼다운 직접 구성</b><div class="devHint">5장을 모두 입력한 뒤 한 번에 적용한다. 트릭 중 발동 효과는 생략한다.</div><div class="devShowdownHead"><span>#</span><span>나</span><span>적</span></div>${showdownRowsHtml()}<div class="devRow"><button data-dev-action="applyShowdownSlots">5슬롯 적용</button><button data-dev-action="showdownNow">즉시 쇼다운</button></div><div class="devHint">리버는 슬롯 적용 시 자동 계산된다. 필요하면 아래에서 강제한다.</div><div class="devRow"><button data-dev-river="auto">리버 자동</button><button data-dev-river="force">적중 강제</button><button data-dev-river="none">리버 없음</button></div></div>
      <div class="devGroup"><b>예약 효과</b><div class="devInline"><input id="trickDevReservationValue" type="number" inputmode="numeric" min="1" max="99" value="6"><button data-dev-action="addReservation">다음 승리 피해</button></div><div class="devRow"><button data-dev-action="clearReservations">예약 전체 제거</button></div></div>
      <div class="devGroup"><b>쇼다운 계산 로그</b><pre id="trickDevShowdownLog"></pre></div>
      <div class="devGroup"><b>카드 검색 / 소환</b><input id="trickDevCardSearch" list="trickDevCardList" placeholder="이름, ID, 순수 ♠A"><datalist id="trickDevCardList"></datalist><div class="devRow"><button data-dev-card="deck">덱에 추가</button><button data-dev-card="hand">손패에 추가</button></div></div>
      <div id="trickDevMessage" role="status"></div>
    </section>`}
  function panelCss(){return `
    #trickDevRoot{position:fixed;z-index:2147483000;right:max(12px,calc((100vw - 460px)/2 + 12px));bottom:calc(12px + env(safe-area-inset-bottom));font:12px/1.35 "Courier New",monospace;color:#f5f0df}
    #trickDevToggle,#trickDevPanel button{border:2px solid #000;background:#243047;color:#f5f0df;box-shadow:0 0 0 2px #64799e inset;padding:8px;min-height:38px;font:inherit;font-weight:700}
    #trickDevToggle{background:#6b2f50;box-shadow:0 0 0 2px #d17aa7 inset;min-width:58px;float:right}
    #trickDevPanel{clear:both;margin-bottom:8px;width:min(360px,calc(100vw - 24px));max-height:min(70vh,620px);overflow:auto;background:#0f1420;border:2px solid #000;box-shadow:0 0 0 2px #586987 inset,4px 4px 0 #0008;padding:10px}
    #trickDevPanel[hidden]{display:none}#trickDevPanel header{display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:8px}#trickDevPanel header button{min-height:30px;padding:2px 10px}
    #trickDevState,#trickDevShowdownLog{white-space:pre-wrap;background:#090d15;border:1px solid #44516a;padding:7px;margin:0 0 8px;color:#9fe0df;font:11px/1.4 "Courier New",monospace}
    #trickDevShowdownLog{max-height:132px;overflow:auto;margin-bottom:0;color:#d8c889}
    .devGroup{border-top:1px solid #354158;padding-top:8px;margin-top:8px}.devGroup>b{display:block;color:#e4bd62;margin-bottom:6px}.devRow{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.devRow button{flex:1;min-width:62px;padding:6px}
    .devHint{color:#96a4bd;font-size:10px;line-height:1.4;margin-bottom:6px}.devShowdownHead,.devShowdownRow{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,1fr);gap:5px;align-items:center}.devShowdownHead{color:#9aa9c1;font-size:10px;text-align:center;margin-bottom:3px}.devShowdownRow{margin:4px 0}.devShowdownRow>span{text-align:center;color:#d8c889}.devShowdownRow input{min-width:0;font-size:10px}.devInline{display:flex;gap:5px;align-items:center}.devInline>*{min-width:0}.devInline input{flex:1}.devInline button{flex:0 0 auto}
    #trickDevPanel label{display:grid;grid-template-columns:1fr 92px;align-items:center;gap:6px;margin:5px 0}#trickDevPanel input,#trickDevPanel select{width:100%;min-height:34px;border:1px solid #000;box-shadow:0 0 0 1px #50617d inset;background:#171e2b;color:#fff;padding:6px;font:inherit}#trickDevPanel select{appearance:auto}
    #trickDevCardSearch{margin-top:2px}#trickDevMessage{min-height:18px;color:#86db98;margin-top:8px;font-size:11px}
    @media(max-width:380px){#trickDevPanel{max-height:67vh}.devRow button{min-width:54px;font-size:11px}.devShowdownRow input{font-size:9px;padding:5px}}
  `}
  function mount(doc){
    if(!doc?.createElement||doc.getElementById?.('trickDevRoot'))return false;
    const rootEl=doc.createElement('div');rootEl.id='trickDevRoot';rootEl.innerHTML=panelHtml();
    const style=doc.createElement('style');style.dataset.trickDevStyle='true';style.textContent=panelCss();
    (doc.head||doc.documentElement).appendChild(style);(doc.getElementById('app')||doc.body||doc.documentElement).appendChild(rootEl);
    const toggle=rootEl.querySelector('#trickDevToggle'),panel=rootEl.querySelector('#trickDevPanel'),stateEl=rootEl.querySelector('#trickDevState'),logEl=rootEl.querySelector('#trickDevShowdownLog'),message=rootEl.querySelector('#trickDevMessage');
    const refresh=()=>{stateEl.textContent=stateText();logEl.textContent=showdownTraceText();const state=safeRuntime();const set=(id,value)=>{const el=rootEl.querySelector(id);if(el&&doc.activeElement!==el)el.value=value??''};set('#trickDevPlayerHp',state.run?.hp);set('#trickDevEnemyHp',state.battle?.enemy?.hp);set('#trickDevChip',state.battle?.chip);set('#trickDevShield',state.battle?.statuses?.player?.shield)};
    const say=text=>{message.textContent=text||'';refresh()};
    const setOpen=open=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)refresh()};
    const slotQueries=side=>Array.from({length:SHOWDOWN_SLOT_COUNT},(_,i)=>rootEl.querySelector(`#trickDev${side}Slot${i+1}`).value);
    toggle.addEventListener('click',()=>setOpen(panel.hidden));
    rootEl.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.devAction==='close'){setOpen(false);return}
      if(button.dataset.devAction==='restart'){const result=restartBattle();say(result.message);return}
      if(button.dataset.devAction==='map'){say(backToMap()?'맵으로 복귀':'맵 복귀 실패');return}
      if(button.dataset.devAction==='applyShowdownSlots'){const result=applyShowdownSlots(slotQueries('Player'),slotQueries('Enemy'));say(result.message);return}
      if(button.dataset.devAction==='showdownNow'){message.textContent='쇼다운 실행 중…';const result=await runShowdownNow();say(result.message);return}
      if(button.dataset.devAction==='setResults'){const result=applySetResults(rootEl.querySelector('#trickDevSetResults').value);say(result.message);return}
      if(button.dataset.devAction==='setStatus'){const result=setStatus(rootEl.querySelector('#trickDevStatusActor').value,rootEl.querySelector('#trickDevStatusId').value,rootEl.querySelector('#trickDevStatusValue').value);say(result.message);return}
      if(button.dataset.devAction==='clearStatuses'){say(clearStatuses()?'상태 전체 제거':'상태 제거 실패');return}
      if(button.dataset.devAction==='addReservation'){const result=addNextWinReservation(rootEl.querySelector('#trickDevReservationValue').value);say(result.message);return}
      if(button.dataset.devAction==='clearReservations'){say(clearReservations()?'예약 전체 제거':'예약 제거 실패');return}
      if(button.dataset.devAdvantage){const result=setAdvantage(button.dataset.devAdvantage);say(result.message);return}
      if(button.dataset.devRiver){const result=setRiverMode(button.dataset.devRiver);say(result.message);return}
      if(button.dataset.devBattle){const result=quickBattle(button.dataset.devBattle);say(result.message);return}
      if(button.dataset.devTrump){say(setTrump(button.dataset.devTrump)?`트럼프 ${suitLabel(button.dataset.devTrump)} 강제 지정`:'전투 중에만 트럼프 지정 가능');return}
      if(button.dataset.devCard){const query=rootEl.querySelector('#trickDevCardSearch').value;const result=addCard(query,button.dataset.devCard);say(result.message);return}
      if(button.dataset.devStat){const map={playerHp:['#trickDevPlayerHp',setPlayerHp],enemyHp:['#trickDevEnemyHp',setEnemyHp],chip:['#trickDevChip',setChip],shield:['#trickDevShield',setShield]};const pair=map[button.dataset.devStat];say(pair?.[1](rootEl.querySelector(pair[0]).value)?'상태 적용 완료':'현재 상태에서는 적용 불가')}
    });
    const list=rootEl.querySelector('#trickDevCardList');cardCandidates().forEach(card=>{const option=doc.createElement('option');option.value=card.label;list.appendChild(option)});
    const timer=setInterval(()=>{if(!rootEl.isConnected){clearInterval(timer);return}if(!panel.hidden)refresh()},500);
    refresh();return true;
  }
  return{BATTLE_TYPES,SHOWDOWN_SLOT_COUNT,STATUS_IDS,SET_RESULT_SYMBOLS,isDeveloperMode,clampInteger,rankLabel,suitLabel,cardCandidates,findCandidate,stateText,addCard,parseSetResults,createSetHistoryFromResults,applySetResults,setStatus,clearStatuses,statusSummary,setAdvantage,currentAdvantageText,setRiverMode,riverModeText,addNextWinReservation,clearReservations,buildShowdownSlots,showdownReady,applyShowdownSlots,runShowdownNow,showdownBreakdownDetails,showdownTraceText,quickBattle,setPlayerHp,setEnemyHp,setChip,setShield,setTrump,restartBattle,backToMap,showdownRowsHtml,panelHtml,panelCss,mount};
});
