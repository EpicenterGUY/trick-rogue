const fs=require('node:fs');

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,text){fs.writeFileSync(path,text)}
function replaceOnce(text,needle,replacement,label){
  const i=text.indexOf(needle);
  if(i<0)throw new Error(`missing ${label||needle.slice(0,60)}`);
  if(text.indexOf(needle,i+needle.length)>=0)throw new Error(`duplicate ${label||needle.slice(0,60)}`);
  return text.slice(0,i)+replacement+text.slice(i+needle.length);
}
function replaceRe(text,re,replacement,label){
  const m=text.match(re);
  if(!m)throw new Error(`missing regex ${label||re}`);
  return text.replace(re,replacement);
}
function update(path,fn){const before=read(path),after=fn(before);if(before===after)throw new Error(`${path}: no changes`);write(path,after)}
function removeFile(path){if(!fs.existsSync(path))throw new Error(`missing file ${path}`);fs.rmSync(path)}
function objectBlock(text,id,fn){
  const safe=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`  \\{\\n    "id": "${safe}",[\\s\\S]*?\\n  \\},`);
  const m=text.match(re);if(!m)throw new Error(`missing card block ${id}`);
  return text.replace(re,fn(m[0]));
}

// Persist the 3-3A named-card redesign in source data instead of a runtime patch.
update('card-packs/pack01.js',text=>{
  text=objectBlock(text,'pack01.golden_hand',block=>{
    block=replaceRe(block,/    "description": ".*",/,`    "description": "발동: 이 카드로 트릭 승리 시 칩 +1. 추가: 다음 트릭의 손패 한도와 보충 드로우 +1.",`,'golden description');
    block=replaceRe(block,/    "terms": \[[\s\S]*?    \],/,`    "terms": [\n      "트릭",\n      "칩",\n      "손패",\n      "드로우"\n    ],`,'golden terms');
    return block;
  });
  text=objectBlock(text,'pack01.recursive_function',block=>{
    block=replaceRe(block,/    "description": ".*",/,`    "description": "발동: 이 카드로 트릭 승리 시 직전에 발동한 다른 네임드 카드의 복사 가능한 수치 효과 하나를 1회 복사. 복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측이며 자기 자신은 복사하지 않는다.",`,'recursive description');
    block=replaceRe(block,/    "terms": \[[\s\S]*?    \],/,`    "terms": [\n      "트릭",\n      "피해",\n      "회복",\n      "칩",\n      "보호막",\n      "출혈",\n      "예측"\n    ],`,'recursive terms');
    return block;
  });
  return text;
});

update('cards.js',text=>{
  text=replaceRe(text,/  if\(typeof document!==\'undefined\'&&!document\.querySelector\(\'script\[data-migrated-tactic-card-runtime\]\'\)\)\{\n    const script=document\.createElement\(\'script\'\);script\.src=\'migrated-tactic-runtime\.js\';script\.async=false;script\.dataset\.migratedTacticCardRuntime=\'true\';document\.head\.appendChild\(script\);\n  \}\n/,'','migrated runtime loader');
  text=replaceOnce(text,"  'pack01.golden_hand': [{trigger:'on_trick_win',action:'gain_chips',value:1,condition:'chips_spent',duration:'trick'},{trigger:'on_trick_win',action:'draw_tactic',value:1,condition:'chips_spent',duration:'trick'}],","  'pack01.golden_hand': [{trigger:'on_trick_win',action:'gain_chips',value:1,duration:'trick'},{trigger:'on_trick_win',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}],",'golden effects');
  text=replaceOnce(text,"increase_enemy_forecast:'적 카드 예측 단계 증가',draw_tactic:'전술 카드 드로우',increase_effective_rank", "increase_enemy_forecast:'적 카드 예측 단계 증가',increase_effective_rank",'draw_tactic player label');
  text=replaceOnce(text,"  'pack01.golden_hand':{activation:'이 카드로 트릭 승리 시',condition:'이번 트릭에 칩을 1 이상 소비.',effect:'칩 +1, 전술 카드 1장 드로우.',terms:['트릭','칩','전술 카드','드로우']},","  'pack01.golden_hand':{activation:'이 카드로 트릭 승리 시',effect:'칩 +1. 다음 트릭의 손패 한도와 보충 드로우 +1.',extra:'추가 손패는 다음 트릭에만 적용되고 이후 기본 손패 한도로 돌아온다.',terms:['트릭','칩','손패','드로우']},",'golden detail');
  text=replaceOnce(text,"  'pack01.recursive_function':{activation:'이 카드로 트릭 승리 시',effect:'직전에 발동한 다른 네임드 카드의 수치 효과 하나를 1회 복사.',extra:'복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측, 전술 카드 드로우이며 자기 자신은 복사하지 않는다.',terms:['트릭','피해','회복','칩','보호막','출혈','예측','전술 카드']},","  'pack01.recursive_function':{activation:'이 카드로 트릭 승리 시',effect:'직전에 발동한 다른 네임드 카드의 복사 가능한 수치 효과 하나를 1회 복사.',extra:'복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측이며 자기 자신은 복사하지 않는다.',terms:['트릭','피해','회복','칩','보호막','출혈','예측']},",'recursive detail');
  return text;
});

update('effects.js',text=>{
  text=replaceOnce(text,"if(typeof document!=='undefined'){api.loadLegacyTacticRuntime();api.loadTextCardRuntime();api.loadCombatEffectsRuntime();api.loadBattleEventsRuntime();api.loadTacticMigrationSupportRuntime()}","if(typeof document!=='undefined'){api.loadTextCardRuntime();api.loadCombatEffectsRuntime();api.loadBattleEventsRuntime();api.loadTacticMigrationSupportRuntime()}",'startup legacy loader');
  text=replaceOnce(text,"'increase_enemy_forecast','draw_tactic','increase_effective_rank'","'increase_enemy_forecast','increase_effective_rank'",'draw_tactic action');
  text=replaceOnce(text,"'apply_enemy_bleed','increase_enemy_forecast','draw_tactic'","'apply_enemy_bleed','increase_enemy_forecast'",'draw_tactic copyable');
  text=text.replace("    no_tactic_modifier:c=>!c.mods.paint&&!c.mods.plus&&!c.mods.reverse&&!c.mods.double,\n",'');
  text=replaceOnce(text,"function newHistory(){return{effectsUsed:false,effectUseCount:0,tacticsUsed:false,tacticUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}","function newHistory(){return{effectsUsed:false,effectUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}",'history tactic counters');
  text=replaceRe(text,/  function loadLegacyTacticRuntime\(\)\{[\s\S]*?\n  \}\n  function loadTextCardRuntime\(\)/,'  function loadTextCardRuntime()','legacy tactic loader function');
  text=replaceOnce(text,',newHistory,loadLegacyTacticRuntime,loadTextCardRuntime,',',newHistory,loadTextCardRuntime,','legacy loader export');
  return text;
});

update('battle-events.js',text=>{
  text=replaceRe(text,/      if\(action==='draw_tactic'\)\{\n        if\(typeof root\.drawT==='function'\)root\.drawT\(Number\(value\)\|\|0\);return;\n      \}\n/,'','battle event draw_tactic branch');
  return text;
});

update('card-text-mode.js',text=>{
  text=text.replace("    draw_tactic:'전술 드로우',",'');
  text=text.replace("  let originalTacticView=null;\n  let originalTacticIcon=null;\n",'');
  text=replaceRe(text,/  function lookupTactic\(id\)\{[\s\S]*?\n  function injectStyles\(\)\{/,'  function injectStyles(){','tactic text renderer functions');
  text=replaceRe(text,/\n      \.tacticTextOnlyFace[\s\S]*?\n      @container cardface/,'\n      @container cardface','tactic css block');
  text=text.replace(/\n      @container tacticface[^\n]*/g,'');
  text=replaceRe(text,/    if\(typeof root\.tacticView==='function'\)\{[\s\S]*?\n    \}\n    if\(typeof root\.tacticIcon==='function'\)\{[\s\S]*?\n    \}\n/,'','tactic install hooks');
  text=replaceOnce(text,'textCardFace,tacticTextFace,tacticIconFace,tacticViewText,renderCardFace','textCardFace,renderCardFace','tactic exports');
  return text;
});

update('index.html',text=>{
  // CSS: remove the tactic drawer and all tactic-only selectors while leaving card layout untouched.
  text=replaceOnce(text,'#handPanel,#tacticPanel{padding:8px;overflow:visible}','#handPanel{padding:8px;overflow:visible}','base panel css');
  text=replaceOnce(text,'#handRow,#tacticRow{display:flex;gap:6px;overflow-x:auto;overflow-y:visible;align-items:flex-start;padding:4px 2px 10px}','#handRow{display:flex;gap:6px;overflow-x:auto;overflow-y:visible;align-items:flex-start;padding:4px 2px 10px}','base row css');
  text=replaceRe(text,/\.tactic\{min-width:86px[\s\S]*?\.tacticDetail \.pixelBtn\{padding:7px 10px\}\n/,'','tactic base css');
  text=text.replace('.cardArt svg,.tacticArt svg,.slotArt svg,.stageCard svg,.poolCard .cardArt svg,.miniCard svg','.cardArt svg,.slotArt svg,.stageCard svg,.poolCard .cardArt svg,.miniCard svg');
  text=text.replace('.tacticArt svg{filter:drop-shadow(0 3px 0 #0006)}\n','');
  text=text.replace('.card{min-width:86px;width:86px;height:132px}.cardArt{height:100%}.tactic{min-width:88px;width:88px}.node','.card{min-width:86px;width:86px;height:132px}.cardArt{height:100%}.node');
  text=replaceOnce(text,'grid-template-areas:"status status" "arena hand" "arena tactic" "arena inspect";grid-template-rows:auto auto auto minmax(104px,1fr);','grid-template-areas:"status status" "arena hand" "arena inspect";grid-template-rows:auto auto minmax(104px,1fr);','desktop battle grid');
  text=replaceOnce(text,'#handPanel{grid-area:hand}#tacticPanel{grid-area:tactic}#inspect{grid-area:inspect}','#handPanel{grid-area:hand}#inspect{grid-area:inspect}','desktop areas');
  text=text.replace('#handPanel,#tacticPanel{padding:10px;min-width:0;overflow:hidden}','#handPanel{padding:10px;min-width:0;overflow:hidden}');
  text=text.replace(/#handRow,#tacticRow\{/g,'#handRow{');
  text=text.replace(/\.card,\.tactic\{/g,'.card{');
  text=text.replace('.card,.tactic,.slot,.pixelBtn,.choice,.termBtn,.effectLabel,.rewardBtns button,.poolCard{','.card,.slot,.pixelBtn,.choice,.termBtn,.effectLabel,.rewardBtns button,.poolCard{');
  text=text.replace('  .tactic:hover{transform:translateY(-3px) scale(1.03);filter:brightness(1.04)}\n','');
  text=text.replace('.card:active,.tactic:active,.slot.fill:active','.card:active,.slot.fill:active');
  text=replaceRe(text,/  #tacticPanel\{position:static[\s\S]*?  #tacticPanel:not\(\.open\) #tacticRow,#tacticPanel:not\(\.open\) \.tacticDetail\{display:none\}\n/,'','mobile tactic drawer css');

  // Markup: the separate drawer no longer exists.
  text=replaceRe(text,/      <div id="tacticPanel" class="pixel">[\s\S]*?      <\/div>\n      <div id="inspect" class="pixel">/,'      <div id="inspect" class="pixel">','tactic panel markup');

  // Terminology: tactics are no longer a current gameplay system.
  text=text.replace(" '더블다운':'호환용 전술 자리표시자. 현재는 효과가 없으며 우세 판정에 영향을 주지 않는다.',"," '더블다운':'쇼다운에서 내 우세 무늬가 2개 이상이면 쇼다운 위력 +6을 주는 일반 효과 카드.',");
  text=text.replace(" '칩':'전술 카드를 사용하는 데 쓰는 전투 자원.',"," '칩':'카드 효과로 획득하거나 소비하는 전투 자원.',");
  text=text.replace(" '순수':'네임드 효과가 없는 기본 트럼프 카드.',"," '순수':'효과가 없는 일반 트럼프 카드를 가리키는 설명 표현. 별도 카드 타입은 아니다.',");
  text=text.replace(" '전술':'칩을 소비해 카드나 전투 규칙을 바꾸는 레거시 보조 시스템. 일반 카드 통합 전까지 유지한다.',\n",'');
  text=text.replace(" '전술 카드':'칩을 소비하는 기존 별도 카드. 최신 설계에서는 일반 카드 효과로 통합할 예정인 레거시 시스템이다.',\n",'');
  text=text.replace(" '전술 패':'현재 손에 있어 사용할 수 있는 전술 카드.',\n",'');
  text=text.replace(" '조건':'효과가 켜지기 위해 먼저 만족해야 하는 전제. 예: 트릭 숫자 5 이하, 전술 사용 후 승리.',"," '조건':'효과가 켜지기 위해 먼저 만족해야 하는 전제. 예: 트릭 숫자 5 이하, 우세 무늬 2개 이상.',");

  // Data: delete legacy tactic metadata and make starting packages general-card lists.
  text=replaceRe(text,/\nconst TACTICS=\[[\s\S]*?\n\];\nconst CHARACTERS=/,'\nconst CHARACTERS=','TACTICS block');
  text=replaceRe(text,/const PACKS=\[[\s\S]*?\n\];\nconst ENEMIES=/,`const PACKS=[\n {id:'steady',name:'정석',desc:'숫자 조작과 드로우 효과 카드를 더 많이 포함한다.',cardIds:['core.plus2','core.plus2','core.paint','core.draw','core.draw','core.scout','core.double','core.barrier','core.burn','core.reverse']},\n {id:'future',name:'예측',desc:'정찰과 다음 트릭 준비 효과 카드 중심.',cardIds:['core.scout','core.scout','core.draw','core.draw','core.paint','core.plus2','core.double','core.barrier','core.burn','core.reverse']},\n {id:'rush',name:'난전',desc:'더블다운과 저랭크 효과 카드 중심.',cardIds:['core.double','core.double','core.plus2','core.draw','core.draw','core.paint','core.barrier','core.burn','core.reverse','core.scout']}\n];\nconst ENEMIES=`,'PACKS block');

  // Card creation now preserves the general effect-card record directly.
  text=replaceOnce(text,"function makeCard(s,r,cardId=null){ const named=cardId?cardDefinition(cardId):null; return {uid:Math.random().toString(36).slice(2),suit:s,rank:r,named,cardId:named?named.id:null}; }\nfunction makeNamed(ref){ const named=cardDefinition(ref); return makeCard(named.suit,named.rank,named.id); }",`function newUid(){return Math.random().toString(36).slice(2)}\nfunction makeCard(s,r,cardId=null){ const named=cardId?cardDefinition(cardId):null; return {uid:newUid(),suit:s,rank:r,named,cardId:named?named.id:null}; }\nfunction makeNamed(ref){ const named=cardDefinition(ref); return makeCard(named.suit,named.rank,named.id); }\nfunction makeGeneral(ref){return createDefinitionCard(ref,{uid:newUid()})}\nfunction cloneDeckCard(card){return {...card,uid:newUid(),effects:Array.isArray(card.effects)?card.effects.map(effect=>({...effect})):[]}}\nfunction isPlainCard(card){return !!card&&!card.named&&!card.definition&&!card.cardId&&(!Array.isArray(card.effects)||card.effects.length===0)}\nfunction applyStartingPackage(deck,pack){let replaced=0;for(const cardId of pack.cardIds||[]){const i=deck.findIndex(isPlainCard);if(i<0)break;deck.splice(i,1,makeGeneral(cardId));replaced++}return replaced}`,'card helpers');
  text=replaceOnce(text,"function shortFrontLabel(c){ return c.named ? c.named.name : '순수 카드'; }\nfunction baseDeck(){return createBaseCardSlots().map(card=>makeCard(card.suit,card.rank))}","function shortFrontLabel(c){ const def=c.named||c.definition; return def?.name||`${suitObj(c.suit).sym}${rankLabel(c.rank)}`; }\nfunction baseDeck(){return createBaseCardSlots().map(cloneDeckCard)}",'base deck');
  text=replaceOnce(text,"function currentBuild(){ if(!run) return '-'; let tags={}; run.deck.filter(c=>c.named).forEach(c=>(c.named.terms||[]).forEach(t=>tags[t]=(tags[t]||0)+1)); let top=Object.entries(tags).sort((a,b)=>b[1]-a[1])[0]; return top?top[0]:'혼합'; }","function currentBuild(){ if(!run) return '-'; let tags={}; run.deck.map(c=>c.named||c.definition).filter(Boolean).forEach(def=>(def.terms||[]).forEach(t=>tags[t]=(tags[t]||0)+1)); let top=Object.entries(tags).sort((a,b)=>b[1]-a[1])[0]; return top?top[0]:'혼합'; }",'current build');
  text=replaceRe(text,/function beginRun\(\)\{[\s\S]*?\nfunction showScreen/,`function beginRun(){ sfx('reward'); const ch=CHARACTERS.find(c=>c.id===selectedChar), pk=PACKS.find(p=>p.id===selectedPack); let deck=baseDeck(); for(const id of ch.named){ const named=cardDefinition(id); let i=deck.findIndex(c=>c.suit===named.suit&&c.rank===named.rank); if(i>=0) deck[i]=makeNamed(id) } for(let i=0;i<ch.remove;i++){ let plainIdx=deck.findIndex(isPlainCard); if(plainIdx>=0) deck.splice(plainIdx,1) } applyStartingPackage(deck,pk); run={char:ch,pack:pk,...createRunPackState(selectedCardPacks),hp:ch.hp,maxHp:ch.hp,gold:60,deck,map:makeMap(),available:new Set(['n0']),completed:new Set()}; showScreen('mapScreen'); renderMap() }\nfunction showScreen`,'beginRun');

  // Pool: only normal cards + named packs.
  text=replaceRe(text,/function poolItemFromCard\(c\)\{[\s\S]*?\n\}\nfunction poolItemFromTactic\(t\)\{[^\n]*\}\n/,`function poolItemFromCard(c){\n const def=c.named||c.definition;\n return {type:'card',card:c,html:artHtml(c),title:\`${'${'}def?def.name+' ':''}${'${'}suitObj(c.suit).sym}${'${'}rankLabel(c.rank)}\`,desc:def?cardDetailHtml(def):'효과 없음. 족보 구성과 쇼다운 재료로 사용된다.',meta:def?termExplainHtml(cardTerms(def)):'일반 카드 · 족보 재료'};\n}\n`,'pool item');
  text=replaceRe(text,/function showPool\(activePackId='all'\)\{[^\n]*\}/,`function showPool(activePackId='all'){ const definitions=activePackId==='all'?CARD_DEFINITIONS:CARD_PACKS[activePackId].cards; const extras=activePackId==='all'?createBaseCardSlots().map(cloneDeckCard).map(poolItemFromCard):[]; const items=[...definitions.map(d=>poolItemFromCard(makeNamed(d.id))),...extras]; const title=activePackId==='all'?\`전체 카드풀 · 일반 카드 52장 + 네임드 ${'${'}definitions.length}장\`:\`${'${'}CARD_PACKS[activePackId].name} 카드풀 · ${'${'}definitions.length}장\`; poolView={mode:'all',activePackId,title,items,selected:0}; renderPoolModal(); }`,'showPool');

  // Battle state: no separate tactic deck/hand/discard or selection state.
  text=replaceRe(text,/function startBattle\(node\)\{[^\n]*\}/,`function startBattle(node){ const e=ENEMIES[node.type]; battle={node,type:node.type,enemy:{...e,hp:e.hp,maxHp:e.hp},deck:shuffle(run.deck.map(cloneDeckCard)),discard:[],hand:[],exhausted:[],maxHandSize:BattleCore.DEFAULT_MAX_HAND_SIZE,trick:1,setIndex:1,phase:'trick',setHistory:BattleCore.createSetHistory(),advantage:null,encounter:{setCount:e.setCount,bossPhases:e.bossPhases},effects:[],trumpBag:newTrumpBag(),trump:null,maxChip:3,chip:3,mods:{paint:false,plus:0,reverse:false,double:false},myForecast:0,enemyForecast:0,slots:[],enemySlots:[],statuses:{player:{shield: run.char.id==='keeper'?2:0,bleed:0,poison:0,seal:0},enemy:{shield:0,bleed:0,poison:0}},reservations:[],lastNamed:null,slotBonus:0,history:CardEffects.newHistory(),selected:null,inspectSlot:null,inspectStage:null,animating:false,ended:false}; battle.trump=drawSetTrump(battle);dealOpeningHand(); battle.hand.forEach(card=>runCardEffects('on_set_start',card,{trump:battle.trump,setIndex:battle.setIndex})); if(run.char.id==='scout') {battle.myForecast=1;battle.enemyForecast=1} nextEnemy(); showScreen('battleScreen'); renderBattle() }`,'startBattle');
  text=replaceRe(text,/function recycleT\(\)\{[^\n]*\} function drawT\(n=1\)\{[^\n]*\}\n/,'','tactic draw functions');

  // Remove tactic visual and interaction functions.
  text=replaceRe(text,/const TACTIC_ICON=[\s\S]*?\nfunction inspectStageCard/,'function inspectStageCard','tactic icon/view block');
  text=text.replace(/ battle\.selectedTactic=null;/g,'');
  text=replaceRe(text,/\nfunction toggleTactics\(force\)\{[^\n]*\}/,'','toggle tactics');
  text=replaceOnce(text,"function useSelectedAction(){ if(battle.animating)return; if(battle.selectedTactic){ useTactic(battle.selectedTactic); return } playSelected() }","function useSelectedAction(){ if(battle.animating)return; playSelected() }",'use selected action');
  text=replaceRe(text,/function shortEffect\(c\)\{[^\n]*\}/,`function shortEffect(c){ const def=c.named||c.definition; if(!def) return '효과 없음 · 족보 재료'; if(c.cardId==='pack01.black_bullet')return '승리: 피해 3 · 쇼다운 +4'; if(c.cardId==='pack01.phoenix')return '승리: 체력 +4'; if(c.cardId==='pack01.golden_hand')return '승리: 칩 +1 · 다음 트릭 손패 +1'; if(c.cardId==='pack01.dirty_gambler')return '트릭 숫자 5↓ 승리: 칩 +2'; if(c.cardId==='pack01.recursive_function')return '승리: 직전 수치효과 복사'; if(c.cardId==='pack01.scheduled_delivery')return '다음 트릭 승리: 피해 6 예약'; if(c.cardId==='pack01.emergency_guard')return '낼 때: 보호막 +5'; if(c.cardId==='pack01.sharp_glass')return '승리: 적 출혈 +2'; if(c.cardId==='pack01.ambush_observer')return '3번 슬롯: 적 예측 +2'; if(c.cardId==='pack01.battery_1pct')return '손에서 20% 소진 · 쇼다운 +15'; return (def.description||def.text||'효과 카드').slice(0,40); }`,'shortEffect');
  text=text.replace(" const selectedUid=battle.selected&&!battle.selectedTactic?battle.selected:null,fragment=document.createDocumentFragment();"," const selectedUid=battle.selected||null,fragment=document.createDocumentFragment();");

  // Render path stripped of tactic drawer branches.
  text=replaceRe(text,/function renderBattle\(\)\{[\s\S]*?\nfunction advantageText/,`function renderBattle(){ battleTitle.textContent=battle.type==='battle'?'일반 전투':battle.type==='elite'?'엘리트 전투':'보스 전투'; battleSub.textContent=\`세트 ${'${'}battle.setIndex} · 5트릭 후 쇼다운\`; pName.textContent=run.char.name; eName.textContent=battle.enemy.name; pHpText.textContent=\`${'${'}run.hp}/${'${'}run.maxHp}\`; eHpText.textContent=\`${'${'}battle.enemy.hp}/${'${'}battle.enemy.maxHp}\`; pHpFill.style.width=(run.hp/run.maxHp*100)+'%'; eHpFill.style.width=(battle.enemy.hp/battle.enemy.maxHp*100)+'%'; edgeText.textContent=battle.phase==='showdown'&&battle.advantage&&battle.showdownVisualStage!=='scan'?advantageText(battle.advantage):'쇼다운에서 판정'; trickText.textContent=\`${'${'}battle.trick}/5\`; trumpText.textContent=suitObj(battle.trump).sym; trumpText.className=suitObj(battle.trump).red?'red':''; chipText.textContent=\`${'${'}battle.chip}/${'${'}battle.maxChip}\`; intentMain.textContent=battle.enemy.intent; intentSub.textContent=battle.enemy.sub; enemyPortrait.innerHTML=charSprite(battle.enemy.sprite); myForecast.textContent=forecastText('me'); enemyForecast.textContent=forecastText('enemy'); enemyStage.className='stageCard show'; enemyStage.innerHTML=stageHtml(battle.enemyCard,'적 카드'); enemyStage.onclick=()=>inspectStageCard('enemy'); enemyStage.style.cursor='pointer'; if(battle.playerStage){ playerStage.className='stageCard show'; playerStage.innerHTML=stageHtml(battle.playerStage,'내 카드'); playerStage.onclick=()=>inspectStageCard('player'); playerStage.style.cursor='pointer'; } else { playerStage.className='stageCard'; playerStage.innerHTML=''; playerStage.onclick=null; playerStage.style.cursor='default'; } slotRow.innerHTML=Array.from({length:5},(_,i)=>{ let s=battle.slots[i]; return s?\`<button id="showdown-slot-${'${'}i}" class="slot fill ${'${'}battle.inspectSlot===i?'inspecting':''}" onclick="inspectPlaced(${'${'}i})"><div class="slotArt">${'${'}artHtml(s.card)}</div><small>${'${'}i+1}번 슬롯</small></button>\`:\`<div id="showdown-slot-${'${'}i}" class="slot"><div>${'${'}i+1}</div></div>\` }).join(''); statuses.innerHTML=statusList(); renderHand(); drawInfo.textContent=\`덱 ${'${'}battle.deck.length} · 버림 ${'${'}battle.discard.length}\`; if(battle.selected){ const c=battle.hand.find(x=>x.uid===battle.selected); if(c) inspectCard(c); else battle.selected=null; } else if(battle.inspectSlot!==null && battle.slots[battle.inspectSlot]){ inspectCard(battle.slots[battle.inspectSlot].card,true,battle.inspectSlot); } else if(battle.inspectStage==='player' && battle.playerStage){ inspectCard(battle.playerStage,true,null); } else if(battle.inspectStage==='enemy' && battle.enemyCard){ inspectCard(battle.enemyCard,true,null); } else { inspect.classList.add('collapsed'); inspectTitle.textContent='카드를 선택'; inspectDesc.textContent='손패, 전장 카드, 쇼다운 슬롯 카드를 누르면 아래에 설명이 뜬다.'; inspectApply.textContent=''; systemLegend.innerHTML=''; termRow.innerHTML=''; playBtn.textContent='내기'; playBtn.disabled=true; } }\nfunction advantageText`,'renderBattle');
  text=replaceOnce(text,"function clearInspect(){ battle.selected=null; battle.inspectSlot=null; battle.inspectStage=null; renderBattle() }","function clearInspect(){ battle.selected=null; battle.inspectSlot=null; battle.inspectStage=null; renderBattle() }",'clearInspect normalized');
  // Above line may already be identical after generic selectedTactic deletion; tolerate that case.
  text=text.replace("function selectCard(uid){ if(battle.animating)return; if(battle.selected===uid&&!battle.selectedTactic&&battle.inspectSlot===null){battle.selected=null;sfx('cardSelect');renderBattle();return} battle.selected=uid; battle.inspectSlot=null; battle.inspectStage=null; sfx('cardSelect'); renderBattle(); document.getElementById('inspect').scrollIntoView({behavior:'smooth',block:'nearest'}); }","function selectCard(uid){ if(battle.animating)return; if(battle.selected===uid&&battle.inspectSlot===null){battle.selected=null;sfx('cardSelect');renderBattle();return} battle.selected=uid; battle.inspectSlot=null; battle.inspectStage=null; sfx('cardSelect'); renderBattle(); document.getElementById('inspect').scrollIntoView({behavior:'smooth',block:'nearest'}); }");
  text=replaceRe(text,/\nfunction selectTactic\(uid\)\{[^\n]*\}/,'','selectTactic');
  text=text.replace("function inspectPlaced(i){ const item=battle.slots[i]; if(!item)return; if(battle.inspectSlot===i&&!battle.selected&&!battle.selectedTactic){battle.inspectSlot=null;sfx('click');renderBattle();return} battle.inspectSlot=i; battle.selected=null; battle.inspectStage=null; sfx('click'); renderBattle(); document.getElementById('inspect').scrollIntoView({behavior:'smooth',block:'nearest'}); }","function inspectPlaced(i){ const item=battle.slots[i]; if(!item)return; if(battle.inspectSlot===i&&!battle.selected){battle.inspectSlot=null;sfx('click');renderBattle();return} battle.inspectSlot=i; battle.selected=null; battle.inspectStage=null; sfx('click'); renderBattle(); document.getElementById('inspect').scrollIntoView({behavior:'smooth',block:'nearest'}); }");
  text=replaceRe(text,/function inspectCard\(c,placed=false,slotIndex=null\)\{[^\n]*\}/,`function inspectCard(c,placed=false,slotIndex=null){ if(!c)return; inspect.classList.remove('collapsed'); playBtn.textContent='내기'; const def=c.named||c.definition,eff=effective(c),result=compare(c,battle.enemyCard),label=result>0?'예상 승리':result<0?'예상 패배':'예상 동점'; const slotLabel=(slotIndex!==null&&slotIndex!==undefined)?\` · ${'${'}slotIndex+1}번 슬롯\`:''; inspectTitle.textContent=\`${'${'}def?def.name+' ':''}${'${'}suitObj(c.suit).sym}${'${'}rankLabel(c.rank)}${'${'}placed?slotLabel:''}\`; inspectDesc.innerHTML=def?cardDetailHtml(def):'효과 없음. 일반 카드는 족보 구성과 쇼다운 재료로 사용된다.'; inspectApply.textContent=placed?\`전장/쇼다운 카드 · 인쇄값 ${'${'}suitObj(BattleCore.printedValue(c,'Suit')).sym}${'${'}rankLabel(BattleCore.printedValue(c,'Rank'))} · 쇼다운값 ${'${'}suitObj(BattleCore.showdownValue(c,'Suit')).sym}${'${'}rankLabel(BattleCore.showdownValue(c,'Rank'))}\`:\`인쇄 ${'${'}suitObj(BattleCore.printedValue(c,'Suit')).sym}${'${'}rankLabel(BattleCore.printedValue(c,'Rank'))} → 트릭 ${'${'}suitObj(eff.trickSuit).sym}${'${'}rankLabel(eff.trickRank)}${'${'}BattleCore.isTrumpCard(eff,battle.trump)?' · 트럼프':''} · ${'${'}label}\`; systemLegend.innerHTML=''; const terms=[...new Set([...(def?cardTerms(def):[]),'인쇄값','트릭값','쇼다운값'])]; termRow.innerHTML=terms.map(t=>\`<button class="termBtn" onclick="showTerm('${'${'}t}')">${'${'}t}</button>\`).join(''); playBtn.disabled=placed }`,'inspectCard');
  text=replaceRe(text,/\nfunction useTactic\(uid\)\{[^\n]*\}/,'','useTactic');

  // Direct action bridge replaces migrated-tactic-runtime.js.
  text=text.replace(" if(action==='increase_enemy_forecast'){battle.enemyForecast=Math.min(3,battle.enemyForecast+value);floatText(arena,`예측 +${value}`,'violet')}\n if(action==='draw_tactic'){drawT(value);floatText(arena,`전술 +${value}`,'cyan')}\n if(action==='increase_effective_rank')card.effectiveRankBonus=(card.effectiveRankBonus||0)+value", " if(action==='increase_enemy_forecast'){battle.enemyForecast=Math.min(3,battle.enemyForecast+value);floatText(arena,`예측 +${value}`,'violet')}\n if(action==='set_next_trick_suit_to_trump')battle.mods.paint=true\n if(action==='increase_next_trick_rank')battle.mods.plus+=(value||0)\n if(action==='set_reverse_compare')battle.mods.reverse=true\n if(action==='set_last_showdown_suit_to_trump'){const slot=battle.slots[battle.slots.length-1];if(slot)slot.card.showdownSuit=battle.trump}\n if(action==='increase_last_showdown_rank'){const slot=battle.slots[battle.slots.length-1];if(slot)slot.card.showdownRank=Math.min(14,BattleCore.showdownValue(slot.card,'Rank')+(value||0))}\n if(action==='increase_effective_rank')card.effectiveRankBonus=(card.effectiveRankBonus||0)+value");
  text=text.replace('drawP(battle.maxHandSize);drawT(1);battle.trick++;','drawP(battle.maxHandSize);battle.trick++;');

  // Shop/camp/run summary no longer use tactic state.
  text=text.replace("<b>정리</b><span>순수 카드 1장 제거 (최소 36장)</span>","<b>정리</b><span>효과 없는 일반 카드 1장 제거 (최소 36장)</span>");
  text=text.replace("let i=run.deck.findIndex(c=>!c.named); if(i>=0)run.deck.splice(i,1)","let i=run.deck.findIndex(isPlainCard); if(i>=0)run.deck.splice(i,1)");
  text=text.replace("<b>카드 제거 · 45G</b><span>순수 카드 1장 제거</span>","<b>카드 제거 · 45G</b><span>효과 없는 일반 카드 1장 제거</span>");
  text=text.replace("<b>정찰 구매 · 35G</b><span>전술 카드 정찰 추가</span>","<b>정찰 카드 · 35G</b><span>일반 효과 카드 정찰 추가</span>");
  text=replaceRe(text,/function shopPick\(id,type,cost\)\{[^\n]*\}/,`function shopPick(id,type,cost){ if(run.gold<cost){ sfx('lose'); return } run.gold-=cost; if(type==='remove'&&run.deck.length>36){ let i=run.deck.findIndex(isPlainCard); if(i>=0)run.deck.splice(i,1) } if(type==='scout')run.deck.push(makeGeneral('core.scout')); if(type==='heal')run.hp=Math.min(run.maxHp,run.hp+14); showShop(run.map.find(n=>n.id===id)) }`,'shopPick');
  text=replaceRe(text,/function finishRun\(\)\{[^\n]*\}/,`function finishRun(){ const effectCount=run.deck.filter(card=>(card.effects||card.definition?.effects||card.named?.effects||[]).length>0).length; showModal(\`<h2 class="cyan">액트 1 클리어</h2><p>이번 리워크 프로토타입의 끝이다.<br>덱 ${'${'}run.deck.length}장 / 네임드 ${'${'}run.deck.filter(c=>c.named).length}장 / 효과 카드 ${'${'}effectCount}장</p><div class="choiceList"><button class="choice" onclick="location.reload()"><b>새 런</b></button></div>\`) }`,'finishRun');

  return text;
});

// Tests: retire legacy-specific assertions and add direct-runtime cleanup coverage.
update('test/effects.test.js',text=>{
  text=replaceRe(text,/test\('황금손은[\s\S]*?\n\}\);\ntest\('비열한 승부사는/,`test('황금손은 트릭 승리 시 칩과 다음 트릭 손패를 준다',()=>{\n  assert.deepEqual(execute('pack01.golden_hand','on_trick_win').map(call=>call.slice(0,2)),[['gain_chips',1],['grant_next_trick_hand_capacity',1]]);\n});\ntest('비열한 승부사는`,'golden effect test');
  return text;
});

update('test/unified-card-effects.test.js',text=>{
  text=text.replace("const TacticEffects=require('../tactic-effects.js');\n",'');
  text=replaceRe(text,/test\('공통 history는[\s\S]*?\n\}\);\n\ntest\('3-3A에서[\s\S]*?\n\}\);\n?$/,`test('공통 history는 일반 효과 통계만 유지한다',()=>{\n  const history=Effects.newHistory();\n  assert.equal(history.effectsUsed,false);\n  assert.equal(history.effectUseCount,0);\n  assert.equal('tacticsUsed' in history,false);\n  assert.equal('tacticUseCount' in history,false);\n});\n\ntest('3-3B에서 레거시 전술 effect action은 공통 registry에서 제거된다',()=>{\n  assert.equal(Effects.ACTIONS.includes('draw_tactic'),false);\n  assert.equal(Effects.COPYABLE_NUMERIC_ACTIONS.includes('draw_tactic'),false);\n});\n`,'unified legacy tail');
  return text;
});

update('test/tactic-card-migration.test.js',text=>{
  text=text.replace("const TacticEffects=require('../tactic-effects.js');\n","const Migrated=require('../migrated-tactic-cards.js');\n");
  text=text.replace("  const legacy=Object.keys(TacticEffects.TACTIC_EFFECTS).sort();\n  assert.deepEqual(planned,legacy);","  const migrated=Migrated.ACTIVE_CARD_DEFINITIONS.map(card=>card.legacyTacticId).sort();\n  assert.deepEqual(planned,migrated);");
  return text;
});

update('test/migrated-tactic-cards.test.js',text=>{
  text=text.replace("const Runtime=require('../migrated-tactic-runtime.js');\n",'');
  text=replaceRe(text,/\ntest\('런 시작용 임시 named alias[\s\S]*$/,'\n','migrated runtime tests');
  return text;
});

update('test/card-text-mode.test.js',text=>{
  text=replaceRe(text,/\ntest\('전술 카드도 아이콘 없이[\s\S]*?\n\}\);\n/,'\n','tactic card text test');
  text=text.replace("test('카드 문자열은 HTML을 이스케이프한다'", "test('텍스트 카드 모드는 레거시 전술 렌더러를 노출하지 않는다',()=>{\n  assert.equal('tacticTextFace' in CardTextMode,false);\n  assert.equal(CardTextMode.ACTION_LABELS.draw_tactic,undefined);\n});\n\ntest('카드 문자열은 HTML을 이스케이프한다'");
  return text;
});

update('test/battle-layout.test.js',text=>{
  text=replaceRe(text,/\ntest\('모바일 손패는 document flow의 3열이고 전술은 bottom sheet carousel이다'[\s\S]*$/,'\n','legacy layout tests');
  text+=`\ntest('모바일 손패는 전술 드로어 없이 document flow 3열을 유지한다', () => {\n  assert.match(html, /#handPanel\\{position:static/);\n  assert.match(html, /#handRow\\{display:grid;grid-template-columns:repeat\\(3,minmax\\(0,92px\\)\\)/);\n  assert.doesNotMatch(html, /id="tacticPanel"/);\n  assert.doesNotMatch(html, /#tacticPanel/);\n});\n\ntest('레거시 전술 실행 코드와 전술 전투 상태가 index에서 제거됐다', () => {\n  for(const token of ['const TACTICS=','function useTactic(','function drawT(','tdeck:','thand:','tdisc:','selectedTactic','tacticsOpen','tacticUsing'])assert.equal(html.includes(token),false,token);\n  assert.doesNotMatch(html, /grid-area:tactic/);\n});\n`;
  return text;
});

write('test/tactic-retirement-cleanup.test.js',`const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst Cards=require('../cards.js');\nconst Effects=require('../effects.js');\n\nconst root=path.join(__dirname,'..');\nconst index=fs.readFileSync(path.join(root,'index.html'),'utf8');\n\ntest('3-3B는 별도 전술 런타임 소스를 물리적으로 제거한다',()=>{\n  for(const file of ['tactic-effects.js','legacy-tactic-retirement.js','migrated-tactic-runtime.js'])assert.equal(fs.existsSync(path.join(root,file)),false,file);\n  assert.equal(Effects.ACTIONS.includes('draw_tactic'),false);\n  assert.doesNotMatch(fs.readFileSync(path.join(root,'effects.js'),'utf8'),/loadLegacyTacticRuntime/);\n});\n\ntest('스타팅 패키지는 일반 효과 카드 ID 10장만 사용한다',()=>{\n  const block=index.match(/const PACKS=\\[([\\s\\S]*?)\\n\\];/)[1];\n  assert.doesNotMatch(block,/\\bt:/);\n  const ids=[...block.matchAll(/'core\\.[^']+'/g)].map(match=>match[0].slice(1,-1));\n  assert.equal(ids.length,30);\n  assert(ids.every(id=>Cards.CARD_DEFINITION_BY_ID[id]?.category==='general'));\n});\n\ntest('기본 덱 생성은 12개 일반 효과 카드 정의와 effects를 보존한다',()=>{\n  assert.match(index,/function baseDeck\\(\\)\\{return createBaseCardSlots\\(\\)\\.map\\(cloneDeckCard\\)\\}/);\n  const base=Cards.createBaseCardSlots();\n  assert.equal(base.filter(card=>card.definition?.category==='general').length,12);\n});\n\ntest('황금손과 재귀 함수는 전술 카드 의존 문구와 액션이 없다',()=>{\n  const golden=Cards.CARD_DEFINITION_BY_ID['pack01.golden_hand'];\n  assert.deepEqual(golden.effects.map(effect=>effect.action),['gain_chips','grant_next_trick_hand_capacity']);\n  assert.equal(golden.effects.some(effect=>effect.condition==='chips_spent'),false);\n  assert.doesNotMatch(golden.description,/전술/);\n  assert.doesNotMatch(Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'].description,/전술/);\n});\n\ntest('상점 정찰은 전술 목록이 아니라 core.scout 일반 카드를 덱에 추가한다',()=>{\n  assert.match(index,/run\\.deck\\.push\\(makeGeneral\\('core\\.scout'\\)\\)/);\n  assert.doesNotMatch(index,/run\\.tactics/);\n});\n`);

removeFile('test/tactic-effects.test.js');
removeFile('test/legacy-tactic-retirement.test.js');
removeFile('tactic-effects.js');
removeFile('legacy-tactic-retirement.js');
removeFile('migrated-tactic-runtime.js');

// Final safety assertions: no live separate-tactic identifiers survive outside historical migration metadata/file names.
const forbidden=[
  ['index.html',/\bTACTICS\b|\btdeck\b|\bthand\b|\btdisc\b|useTactic\(|tacticPanel|selectedTactic|tacticsOpen|tacticUsing/],
  ['effects.js',/draw_tactic|loadLegacyTacticRuntime/],
  ['battle-events.js',/draw_tactic|drawT\(/],
  ['cards.js',/draw_tactic|migrated-tactic-runtime\.js/],
  ['card-text-mode.js',/tacticTextFace|tacticIconFace|tacticViewText|root\.tacticView|root\.tacticIcon/]
];
for(const [file,re] of forbidden){const source=read(file);if(re.test(source))throw new Error(`${file}: forbidden legacy tactic token remains: ${source.match(re)[0]}`)}
console.log('3-3B migration applied');
