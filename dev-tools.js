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
    return `${p}\n${b.type||'battle'} · 적 ${b.enemy?.hp??'-'}/${b.enemy?.maxHp??'-'} · 칩 ${b.chip??'-'} · 보호막 ${b.statuses?.player?.shield??0}\n세트 ${b.setIndex??'-'} · 트릭 ${b.trick??'-'} · 트럼프 ${suitLabel(b.trump)}`;
  }
  function panelHtml(){return `
    <button type="button" id="trickDevToggle" aria-expanded="false">DEV</button>
    <section id="trickDevPanel" hidden aria-label="트릭로그 개발자 도구">
      <header><b>개발자 테스트</b><button type="button" data-dev-action="close">×</button></header>
      <pre id="trickDevState"></pre>
      <div class="devGroup"><b>빠른 전투</b><div class="devRow"><button data-dev-battle="battle">일반</button><button data-dev-battle="elite">엘리트</button><button data-dev-battle="boss">보스</button></div><div class="devRow"><button data-dev-action="restart">전투 재시작</button><button data-dev-action="map">맵 복귀</button></div></div>
      <div class="devGroup"><b>전투 상태 강제 설정</b><label>플레이어 HP <input id="trickDevPlayerHp" inputmode="numeric" type="number" min="0"></label><label>적 HP <input id="trickDevEnemyHp" inputmode="numeric" type="number" min="0"></label><label>칩 <input id="trickDevChip" inputmode="numeric" type="number" min="0" max="5"></label><label>보호막 <input id="trickDevShield" inputmode="numeric" type="number" min="0" max="99"></label><div class="devRow"><button data-dev-stat="playerHp">HP 적용</button><button data-dev-stat="enemyHp">적 HP</button><button data-dev-stat="chip">칩</button><button data-dev-stat="shield">보호막</button></div></div>
      <div class="devGroup"><b>트럼프</b><div class="devRow"><button data-dev-trump="S">♠</button><button data-dev-trump="H">♥</button><button data-dev-trump="D">♦</button><button data-dev-trump="C">♣</button></div></div>
      <div class="devGroup"><b>카드 검색 / 소환</b><input id="trickDevCardSearch" list="trickDevCardList" placeholder="이름, ID, 순수 ♠A"><datalist id="trickDevCardList"></datalist><div class="devRow"><button data-dev-card="deck">덱에 추가</button><button data-dev-card="hand">손패에 추가</button></div></div>
      <div id="trickDevMessage" role="status"></div>
    </section>`}
  function panelCss(){return `
    #trickDevRoot{position:fixed;z-index:2147483000;right:max(12px,calc((100vw - 460px)/2 + 12px));bottom:calc(12px + env(safe-area-inset-bottom));font:12px/1.35 "Courier New",monospace;color:#f5f0df}
    #trickDevToggle,#trickDevPanel button{border:2px solid #000;background:#243047;color:#f5f0df;box-shadow:0 0 0 2px #64799e inset;padding:8px;min-height:38px;font:inherit;font-weight:700}
    #trickDevToggle{background:#6b2f50;box-shadow:0 0 0 2px #d17aa7 inset;min-width:58px;float:right}
    #trickDevPanel{clear:both;margin-bottom:8px;width:min(360px,calc(100vw - 24px));max-height:min(70vh,620px);overflow:auto;background:#0f1420;border:2px solid #000;box-shadow:0 0 0 2px #586987 inset,4px 4px 0 #0008;padding:10px}
    #trickDevPanel[hidden]{display:none}#trickDevPanel header{display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:8px}#trickDevPanel header button{min-height:30px;padding:2px 10px}
    #trickDevState{white-space:pre-wrap;background:#090d15;border:1px solid #44516a;padding:7px;margin:0 0 8px;color:#9fe0df;font:11px/1.4 "Courier New",monospace}
    .devGroup{border-top:1px solid #354158;padding-top:8px;margin-top:8px}.devGroup>b{display:block;color:#e4bd62;margin-bottom:6px}.devRow{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.devRow button{flex:1;min-width:62px;padding:6px}
    #trickDevPanel label{display:grid;grid-template-columns:1fr 92px;align-items:center;gap:6px;margin:5px 0}#trickDevPanel input{width:100%;min-height:34px;border:1px solid #000;box-shadow:0 0 0 1px #50617d inset;background:#171e2b;color:#fff;padding:6px;font:inherit}
    #trickDevCardSearch{margin-top:2px}#trickDevMessage{min-height:18px;color:#86db98;margin-top:8px;font-size:11px}
    @media(max-width:380px){#trickDevPanel{max-height:67vh}.devRow button{min-width:54px;font-size:11px}}
  `}
  function mount(doc){
    if(!doc?.createElement||doc.getElementById?.('trickDevRoot'))return false;
    const rootEl=doc.createElement('div');rootEl.id='trickDevRoot';rootEl.innerHTML=panelHtml();
    const style=doc.createElement('style');style.dataset.trickDevStyle='true';style.textContent=panelCss();
    (doc.head||doc.documentElement).appendChild(style);(doc.getElementById('app')||doc.body||doc.documentElement).appendChild(rootEl);
    const toggle=rootEl.querySelector('#trickDevToggle'),panel=rootEl.querySelector('#trickDevPanel'),stateEl=rootEl.querySelector('#trickDevState'),message=rootEl.querySelector('#trickDevMessage');
    const refresh=()=>{stateEl.textContent=stateText();const state=safeRuntime();const set=(id,value)=>{const el=rootEl.querySelector(id);if(el&&doc.activeElement!==el)el.value=value??''};set('#trickDevPlayerHp',state.run?.hp);set('#trickDevEnemyHp',state.battle?.enemy?.hp);set('#trickDevChip',state.battle?.chip);set('#trickDevShield',state.battle?.statuses?.player?.shield)};
    const say=text=>{message.textContent=text||'';refresh()};
    const setOpen=open=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)refresh()};
    toggle.addEventListener('click',()=>setOpen(panel.hidden));
    rootEl.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.devAction==='close'){setOpen(false);return}
      if(button.dataset.devAction==='restart'){const result=restartBattle();say(result.message);return}
      if(button.dataset.devAction==='map'){say(backToMap()?'맵으로 복귀':'맵 복귀 실패');return}
      if(button.dataset.devBattle){const result=quickBattle(button.dataset.devBattle);say(result.message);return}
      if(button.dataset.devTrump){say(setTrump(button.dataset.devTrump)?`트럼프 ${suitLabel(button.dataset.devTrump)} 강제 지정`:'전투 중에만 트럼프 지정 가능');return}
      if(button.dataset.devCard){const query=rootEl.querySelector('#trickDevCardSearch').value;const result=addCard(query,button.dataset.devCard);say(result.message);return}
      if(button.dataset.devStat){const map={playerHp:['#trickDevPlayerHp',setPlayerHp],enemyHp:['#trickDevEnemyHp',setEnemyHp],chip:['#trickDevChip',setChip],shield:['#trickDevShield',setShield]};const pair=map[button.dataset.devStat];say(pair?.[1](rootEl.querySelector(pair[0]).value)?'상태 적용 완료':'현재 상태에서는 적용 불가')}
    });
    const list=rootEl.querySelector('#trickDevCardList');cardCandidates().forEach(card=>{const option=doc.createElement('option');option.value=card.label;list.appendChild(option)});
    const timer=setInterval(()=>{if(!rootEl.isConnected){clearInterval(timer);return}if(!panel.hidden)refresh()},500);
    refresh();return true;
  }
  return{BATTLE_TYPES,isDeveloperMode,clampInteger,rankLabel,suitLabel,cardCandidates,findCandidate,stateText,addCard,quickBattle,setPlayerHp,setEnemyHp,setChip,setShield,setTrump,restartBattle,backToMap,panelHtml,panelCss,mount};
});
