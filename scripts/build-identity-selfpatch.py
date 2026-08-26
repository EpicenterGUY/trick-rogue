from pathlib import Path
import re

ROOT=Path('.')

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def sub_once(text,pattern,repl,label,flags=0):
    out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    return out

def replace_once(text,old,new,label):
    if old not in text: raise SystemExit(f'{label}: target missing')
    return text.replace(old,new,1)

# -----------------------------------------------------------------------------
# 1) STARTER DECKS + TRAITS
# -----------------------------------------------------------------------------
p=Path('run-start-v2.js'); s=read(p)
s=replace_once(s,
"""  const COMMON_CARD_POOL_IDS=Object.freeze([
    'core.paint','core.plus2','core.draw','core.scout','core.double','core.barrier',
    'core.burn','core.pureboost','core.clean'
  ]);""",
"""  const COMMON_CARD_POOL_IDS=Object.freeze([
    'core.paint','core.plus2','core.draw','core.scout','core.double','core.barrier',
    'core.burn','core.pureboost','core.clean','core.reverse','core.recolor'
  ]);""",'common card pool')

s=sub_once(s,r"  const STARTERS=Object\.freeze\(\[.*?\n  \]\);\n\n  const ARCHIVED_STARTERS=",'''  const STARTERS=Object.freeze([
    Object.freeze({
      id:COMMON_STARTER_ID,name:'정석',icon:'♠',kind:'balanced',buildTags:Object.freeze(['쇼다운 조작']),
      desc:'무늬와 숫자 분포가 안정적이다. 정찰과 드로우를 통해 족보를 만들며 기본 규칙을 익힌다.',
      pureSlots:COMMON_STARTER_PURE_SLOTS,effectCardIds:COMMON_STARTER_EFFECT_CARD_IDS,exposed:true
    }),
    Object.freeze({
      id:'gambler',name:'승부사',icon:'◆',kind:'trick',buildTags:Object.freeze(['승부 조작','칩 경제']),
      desc:'낮은 숫자와 반전 승부를 이용해 싸게 트릭을 따내고 칩을 굴리는 스타터.',
      pureSlots:Object.freeze(['S2','S6','H6','H9','D3','D5','C4','C7']),
      effectCardIds:Object.freeze(['core.double','core.reverse','core.burn','core.clean']),exposed:true
    }),
    Object.freeze({
      id:'trickster',name:'변칙',icon:'◇',kind:'rule',buildTags:Object.freeze(['승부 조작','쇼다운 조작']),
      desc:'트럼프와 쇼다운 무늬를 서로 다르게 다루며 카드 한 장의 두 얼굴을 활용한다.',
      pureSlots:Object.freeze(['S4','S8','H5','H10','D2','D7','C4','C11']),
      effectCardIds:Object.freeze(['core.paint','core.recolor','core.reverse','core.scout']),exposed:true
    }),
    Object.freeze({
      id:'survivor',name:'생존자',icon:'♥',kind:'survival',buildTags:Object.freeze(['패배 활용','손패 조작']),
      desc:'패배를 받아내고 손패를 갈아내며 다음 트릭과 쇼다운까지 버티는 스타터.',
      pureSlots:Object.freeze(['S2','S9','H4','H8','D3','D10','C5','C10']),
      effectCardIds:Object.freeze(['core.barrier','core.burn','core.draw','core.pureboost']),exposed:true
    })
  ]);

  const ARCHIVED_STARTERS=''', 'starter registry', flags=re.S)

s=sub_once(s,r"  const RUN_TRAITS=Object\.freeze\(\[.*?\n  \]\);\n\n  let installed=false;",'''  const RUN_TRAITS=Object.freeze([
    Object.freeze({id:'foresight',name:'선행 관측',icon:'◎',desc:'매 전투 시작 시 적 카드 예측 단계 +1.',battle:Object.freeze({forecast:1}),buildTags:Object.freeze(['손패 조작'])}),
    Object.freeze({id:'stubborn_loss',name:'악착같은 패배',icon:'↯',desc:'트릭 패배 시 칩 +1. 패배를 다음 선택의 자원으로 바꾼다.',buildTags:Object.freeze(['패배 활용','칩 경제']),effects:Object.freeze([{trigger:'on_trick_loss',action:'gain_chips',value:1,duration:'battle'}])}),
    Object.freeze({id:'suit_collector',name:'수트 수집가',icon:'♣',desc:'쇼다운에 서로 다른 무늬 4종이 모두 있으면 쇼다운 위력 +8.',buildTags:Object.freeze(['쇼다운 조작']),effects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:8,condition:'showdown_distinct_suits_at_least',conditionValue:4,duration:'set'}])}),
    Object.freeze({id:'empty_pocket',name:'빈손주의',icon:'0',desc:'쇼다운 순간 칩이 정확히 0이면 쇼다운 위력 +7.',buildTags:Object.freeze(['칩 경제','쇼다운 조작']),effects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:7,condition:'chips_empty',duration:'set'}])}),
    Object.freeze({id:'imperfect',name:'불완전주의',icon:'?',desc:'완성 족보가 하이카드라면 쇼다운 위력 +10. 족보를 일부러 망치는 선택도 빌드가 된다.',buildTags:Object.freeze(['쇼다운 조작']),effects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:10,condition:'showdown_high_card',duration:'set'}])}),
    Object.freeze({id:'comeback',name:'역경 축적',icon:'↺',desc:'한 세트에서 트릭을 2번 이상 졌다면 쇼다운 위력 +7.',buildTags:Object.freeze(['패배 활용','쇼다운 조작']),effects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:7,condition:'set_losses_at_least',conditionValue:2,duration:'set'}])}),
    Object.freeze({id:'advantage_hunter',name:'우세 추종자',icon:'▲',desc:'쇼다운에서 명시적 우세가 활성화되어 있으면 쇼다운 위력 +5.',buildTags:Object.freeze(['쇼다운 조작']),effects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:5,condition:'player_has_advantage',duration:'set'}])}),
    Object.freeze({id:'pure_mind',name:'순수주의',icon:'□',desc:'쇼다운에 순수 카드가 3장 이상이면 쇼다운 위력 +6.',buildTags:Object.freeze(['쇼다운 조작']),effects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:6,condition:'pure_cards_at_least',conditionValue:3,duration:'set'}])})
  ]);
  const ARCHIVED_TRAITS=Object.freeze([
    Object.freeze({id:'extra_gold',name:'여유 자금',hidden:true,archived:true,desc:'구버전 시작 특성. 시작 골드 +20.',run:Object.freeze({gold:20})}),
    Object.freeze({id:'durable',name:'튼튼한 몸',hidden:true,archived:true,desc:'구버전 시작 특성. 최대 체력과 현재 체력 +6.',run:Object.freeze({maxHp:6,hp:6})}),
    Object.freeze({id:'pocket_chip',name:'비상용 칩',hidden:true,archived:true,desc:'구버전 시작 특성. 전투 시작 칩 +1.',battle:Object.freeze({chips:1})})
  ]);

  let installed=false;''','trait registry',flags=re.S)

s=replace_once(s,"function traitDefinition(id){return RUN_TRAITS.find(trait=>trait.id===id)||null}","function traitDefinition(id){return[...RUN_TRAITS,...ARCHIVED_TRAITS].find(trait=>trait.id===id)||null}",'trait lookup')

old="""    runState.traitId=trait.id;runState.trait=trait;
    return runState;"""
new="""    runState.traitId=trait.id;runState.trait=trait;
    if(runState.char&&typeof runState.char==='object'){
      runState.char.passives=Array.isArray(trait.effects)&&trait.effects.length?[{
        id:`trait.${trait.id}`,name:trait.name,description:trait.desc||'',effectOwnerType:'passive',buildTags:[...(trait.buildTags||[])],effects:trait.effects.map(effect=>({...effect}))
      }]:[];
    }
    return runState;"""
s=replace_once(s,old,new,'trait passive bridge')
s=replace_once(s,"runState.pack={id:'starter_v2',name:'공용 시작 덱',desc:starter.name,compatibilityOnly:true};","runState.pack={id:'starter_v3',name:'스타터 덱',desc:starter.name,compatibilityOnly:true};",'starter pack identity')
s=replace_once(s,"if(titles[0])titles[0].textContent='공용 시작 덱';if(titles[1])titles[1].textContent='시작 특성';","if(titles[0])titles[0].textContent='스타터 덱';if(titles[1])titles[1].textContent='특성 선택';",'start section labels')
s=replace_once(s,"<div class=\"optionSprite\" style=\"font-size:26px\">✦</div><h3>${item.name}</h3>","<div class=\"optionSprite\" style=\"font-size:26px\">${item.icon||'✦'}</div><h3>${item.name}</h3>",'trait icons')
s=replace_once(s,"if(heroText)heroText.textContent=`${starter.name} + ${trait.name} 특성으로 시작한다. 초반 공통지역은 같은 공용 카드풀을 사용하고 이후 지역에서 빌드 방향을 정한다.`;","if(heroText)heroText.textContent=`${starter.name} 스타터 + ${trait.name}. 스타터는 출발점일 뿐이며 이후 보상으로 다른 빌드 계열을 자유롭게 섞을 수 있다.`;",'hero identity copy')
s=replace_once(s,"badge.title='공용 시작 덱 · 시작 특성'","badge.title='스타터 덱 · 특성'",'identity badge title')
s=replace_once(s,"ARCHIVED_STARTERS,LEGACY_STARTER_ALIASES,RUN_TRAITS,normalizeStarterId","ARCHIVED_STARTERS,LEGACY_STARTER_ALIASES,RUN_TRAITS,ARCHIVED_TRAITS,normalizeStarterId",'exports archived traits')
write(p,s)

# -----------------------------------------------------------------------------
# 2) EFFECT CONDITIONS FOR BUILD TRAITS / CARDS
# -----------------------------------------------------------------------------
p=Path('effects.js'); s=read(p)
needle="""  function zoneCards(context,key){const direct=context?.[key];if(Array.isArray(direct))return direct;const battle=context?.battle?.[key];return Array.isArray(battle)?battle:[]}
  const conditions={"""
insert="""  function zoneCards(context,key){const direct=context?.[key];if(Array.isArray(direct))return direct;const battle=context?.battle?.[key];return Array.isArray(battle)?battle:[]}
  function showdownRankOf(entry){const card=entry?.card||entry;return Number(card?.showdownRank??card?.printedRank??card?.rank)}
  function showdownSuitOf(entry){const card=entry?.card||entry;return card?.showdownSuit??card?.printedSuit??card?.suit??null}
  function showdownIsHighCard(context){
    const slots=zoneCards(context,'slots');if(slots.length!==5)return false;
    const ranks=slots.map(showdownRankOf);if(ranks.some(rank=>!Number.isFinite(rank)))return false;
    const suits=slots.map(showdownSuitOf),counts=new Map();ranks.forEach(rank=>counts.set(rank,(counts.get(rank)||0)+1));if([...counts.values()].some(count=>count>1))return false;
    const unique=[...new Set(ranks)].sort((a,b)=>a-b),flush=new Set(suits).size===1,straight=(unique.length===5&&unique[4]-unique[0]===4)||JSON.stringify(unique)===JSON.stringify([2,3,4,5,14]);
    return!flush&&!straight;
  }
  const conditions={"""
s=replace_once(s,needle,insert,'showdown helpers')
s=replace_once(s,"""    pure_card_in_showdown:c=>zoneCards(c,'slots').some(isPureCard),
    printed_equals_trick:c=>printedEqualsTrick(c),
    unmodified_trick_value:c=>printedEqualsTrick(c)
  };""","""    pure_card_in_showdown:c=>zoneCards(c,'slots').some(isPureCard),
    pure_cards_at_least:(c,e)=>zoneCards(c,'slots').filter(isPureCard).length>=(Number(e.conditionValue)||1),
    chips_empty:c=>(Number(c?.battle?.chip??c?.chip??0)||0)===0,
    set_losses_at_least:(c,e)=>(Number(setHistory(c).losses)||0)>=(Number(e.conditionValue)||1),
    showdown_distinct_suits_at_least:(c,e)=>new Set(zoneCards(c,'slots').map(showdownSuitOf).filter(Boolean)).size>=(Number(e.conditionValue)||1),
    showdown_high_card:c=>showdownIsHighCard(c),
    printed_equals_trick:c=>printedEqualsTrick(c),
    unmodified_trick_value:c=>printedEqualsTrick(c)
  };""",'build conditions')
write(p,s)

# Human-readable labels used by card detail / text face.
p=Path('cards.js'); s=read(p)
s=replace_once(s,"""    pure_card_in_hand:'손패에 순수 카드가 있음',pure_card_in_showdown:'쇼다운에 순수 카드가 있음',printed_equals_trick:'인쇄값과 트릭값이 같음',unmodified_trick_value:'최종 트릭값이 인쇄값 그대로',""","""    pure_card_in_hand:'손패에 순수 카드가 있음',pure_card_in_showdown:'쇼다운에 순수 카드가 있음',pure_cards_at_least:'쇼다운 순수 카드가 지정 장수 이상',chips_empty:'현재 칩이 0',set_losses_at_least:'이번 세트 패배가 지정 횟수 이상',showdown_distinct_suits_at_least:'쇼다운의 서로 다른 무늬가 지정 수 이상',showdown_high_card:'쇼다운 족보가 하이카드',printed_equals_trick:'인쇄값과 트릭값이 같음',unmodified_trick_value:'최종 트릭값이 인쇄값 그대로',""",'cards condition labels')
write(p,s)

p=Path('card-text-mode.js'); s=read(p)
s=replace_once(s,"""    if(condition==='pure_cards_at_least')return`순수 ${value}장+면`;
    if(condition==='in_hand')return'손패에 있으면';""","""    if(condition==='pure_cards_at_least')return`순수 ${value}장+면`;
    if(condition==='chips_empty')return'칩 0이면';
    if(condition==='set_losses_at_least')return`${value}패+면`;
    if(condition==='showdown_distinct_suits_at_least')return`서로 다른 무늬 ${value}종+면`;
    if(condition==='showdown_high_card')return'하이카드면';
    if(condition==='in_hand')return'손패에 있으면';""",'card text conditions')
write(p,s)

# -----------------------------------------------------------------------------
# 3) FIELD REGISTRY: 5 -> 8, AND ROTATING EVENT/SHOP OFFERS
# -----------------------------------------------------------------------------
p=Path('encounter-rules.js'); s=read(p)
s=replace_once(s,"""    narrow_table:Object.freeze({id:'narrow_table',label:'좁은 테이블',description:'기본 최대 손패가 1 감소한다.',rulesOverride:Object.freeze({maxHandModifier:-1}),effects:Object.freeze([])}),
    inversion_zone:Object.freeze({id:'inversion_zone',label:'뒤집힌 세계',description:'모든 보정을 끝낸 최종 적용 숫자가 낮은 쪽이 트릭에서 승리한다.',rulesOverride:Object.freeze({lowFinalValueWins:true}),effects:Object.freeze([])})""","""    narrow_table:Object.freeze({id:'narrow_table',label:'좁은 테이블',description:'기본 최대 손패가 1 감소한다.',rulesOverride:Object.freeze({maxHandModifier:-1}),effects:Object.freeze([])}),
    inversion_zone:Object.freeze({id:'inversion_zone',label:'뒤집힌 세계',description:'모든 보정을 끝낸 최종 적용 숫자가 낮은 쪽이 트릭에서 승리한다.',rulesOverride:Object.freeze({lowFinalValueWins:true}),effects:Object.freeze([])}),
    wide_table:Object.freeze({id:'wide_table',label:'넓은 테이블',description:'기본 최대 손패가 1 증가한다. 더 많은 선택지를 얻지만 덱 순환이 빨라진다.',rulesOverride:Object.freeze({maxHandModifier:1}),effects:Object.freeze([])}),
    royal_signal:Object.freeze({id:'royal_signal',label:'왕실 중계소',description:'트럼프 카드의 트릭 적용 숫자 보너스가 +3 대신 +6이 된다.',rulesOverride:Object.freeze({trumpBonus:6}),effects:Object.freeze([])}),
    crooked_table:Object.freeze({id:'crooked_table',label:'삐뚤어진 테이블',description:'낮은 최종 적용 숫자가 이기며 기본 최대 손패가 1 감소한다.',rulesOverride:Object.freeze({lowFinalValueWins:true,maxHandModifier:-1}),effects:Object.freeze([])})""",'field definitions')
write(p,s)

p=Path('run-fields.js'); s=read(p)
s=replace_once(s,"""  const EVENT_FIELD_ID='inversion_zone';
  const SHOP_FIELD_ID='resonance_floor';
  const SHOP_FIELD_COST=45;""","""  const EVENT_FIELD_ID='inversion_zone';
  const SHOP_FIELD_ID='resonance_floor';
  const EVENT_FIELD_IDS=Object.freeze(['inversion_zone','thin_signal','wide_table','crooked_table']);
  const SHOP_FIELD_IDS=Object.freeze(['resonance_floor','outlaw_zone','narrow_table','royal_signal']);
  const SHOP_FIELD_COST=45;""",'field offer pools')
needle="""  function fieldDefinition(id){return EncounterRules?.fieldDefinition?EncounterRules.fieldDefinition(id):fieldRegistry()[id]||null}
  function activeRun"""
insert="""  function fieldDefinition(id){return EncounterRules?.fieldDefinition?EncounterRules.fieldDefinition(id):fieldRegistry()[id]||null}
  function fieldOfferIdForNode(node,kind='event'){
    const ids=kind==='shop'?SHOP_FIELD_IDS:EVENT_FIELD_IDS,text=String(node?.id??node??''),match=text.match(/(\\d+)(?!.*\\d)/);let seed;
    if(match)seed=Number(match[1]);else seed=[...text].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    const index=kind==='shop'?Math.abs(seed)%ids.length:Math.abs(seed-1)%ids.length;return ids[index];
  }
  function activeRun"""
s=replace_once(s,needle,insert,'field offer selector')
s=replace_once(s,"const definition=fieldDefinition(EVENT_FIELD_ID),runState=activeRun(runtimeRoot);","const definition=fieldDefinition(fieldOfferIdForNode(node,'event')),runState=activeRun(runtimeRoot);",'event rotating field')
s=replace_once(s,"const definition=fieldDefinition(SHOP_FIELD_ID),runState=activeRun(runtimeRoot);","const definition=fieldDefinition(fieldOfferIdForNode(node,'shop')),runState=activeRun(runtimeRoot);",'shop rotating field')
s=replace_once(s,"RUN_FIELD_STATE_VERSION,EVENT_FIELD_ID,SHOP_FIELD_ID,SHOP_FIELD_COST,fieldRegistry,fieldDefinition,activeRun","RUN_FIELD_STATE_VERSION,EVENT_FIELD_ID,SHOP_FIELD_ID,EVENT_FIELD_IDS,SHOP_FIELD_IDS,SHOP_FIELD_COST,fieldRegistry,fieldDefinition,fieldOfferIdForNode,activeRun",'run field exports')
write(p,s)

# -----------------------------------------------------------------------------
# 4) COMPENDIUM: BUILD TAG FILTERS + BADGES
# -----------------------------------------------------------------------------
p=Path('compendium-8-h-runtime-bridge.js'); s=read(p)
s=replace_once(s,"""(function(root,factory){
  const api=factory(root,typeof module!=='undefined'?require('./compendium-8-h.js'):root.Compendium8H);""","""(function(root,factory){
  const api=factory(root,typeof module!=='undefined'?require('./compendium-8-h.js'):root.Compendium8H,typeof module!=='undefined'?require('./card-build-tags.js'):root.CardBuildTags);""",'compendium imports')
s=replace_once(s,"})(typeof globalThis!=='undefined'?globalThis:this,function(root,Compendium){","})(typeof globalThis!=='undefined'?globalThis:this,function(root,Compendium,CardBuildTags){",'compendium factory signature')
s=replace_once(s,"""  const CARD_FILTERS=Object.freeze(['all','pure','effect','signature','owned','locked']);
  const CARD_FILTER_LABELS=Object.freeze({all:'전체',pure:'순수',effect:'효과',signature:'보스 시그니처',owned:'이번 런 보유',locked:'잠김'});""","""  const CARD_FILTERS=Object.freeze(['all','pure','effect','signature','trick','showdown','loss','chip','hand','chain','owned','locked']);
  const CARD_FILTER_LABELS=Object.freeze({all:'전체',pure:'순수',effect:'효과',signature:'보스 시그니처',trick:'승부 조작',showdown:'쇼다운 조작',loss:'패배 활용',chip:'칩 경제',hand:'손패 조작',chain:'예약·연쇄',owned:'이번 런 보유',locked:'잠김'});
  const BUILD_FILTER_TAG=Object.freeze({trick:'승부 조작',showdown:'쇼다운 조작',loss:'패배 활용',chip:'칩 경제',hand:'손패 조작',chain:'예약·연쇄'});""",'compendium filters')
s=replace_once(s,"  function cardDefinition(item){return item?.source?.definition||item?.source?.named||null}\n","  function cardDefinition(item){return item?.source?.definition||item?.source?.named||null}\n  function cardBuildTags(item){const def=cardDefinition(item);return CardBuildTags?.tagsForDefinition?.(def)||def?.buildTags||[]}\n",'compendium build tags')
s=replace_once(s,"return{...item,uiCategory:category,owned,unlocked,rewardEligible,signatureBossLabel:category==='signature'?signatureBossLabel(item):'',legacyPackId:item.packId||null};","return{...item,uiCategory:category,owned,unlocked,rewardEligible,buildTags:cardBuildTags(item),signatureBossLabel:category==='signature'?signatureBossLabel(item):'',legacyPackId:item.packId||null};",'decorate tags')
s=replace_once(s,"""    if(filter==='signature')return item.uiCategory==='signature';
    if(filter==='owned')return !!item.owned;""","""    if(filter==='signature')return item.uiCategory==='signature';
    if(BUILD_FILTER_TAG[filter])return Array.isArray(item.buildTags)&&item.buildTags.includes(BUILD_FILTER_TAG[filter]);
    if(filter==='owned')return !!item.owned;""",'tag filter match')
s=replace_once(s,"parts.push(CARD_FILTER_LABELS[item.uiCategory],item.owned?'보유':'미보유'","parts.push(CARD_FILTER_LABELS[item.uiCategory],...(item.buildTags||[]),item.owned?'보유':'미보유'",'tag search')
s=replace_once(s,"""    const badges=[item.uiCategory==='pure'?'순수 카드':item.uiCategory==='signature'?'보스 시그니처':'효과 카드'];
    if(item.owned)badges.push('이번 런 보유');""","""    const badges=[item.uiCategory==='pure'?'순수 카드':item.uiCategory==='signature'?'보스 시그니처':'효과 카드'];
    if(item.uiCategory!=='pure')badges.push(...(item.buildTags||[]));
    if(item.owned)badges.push('이번 런 보유');""",'tag badges')
s=replace_once(s,"""    if(item?.kind==='card')return item.uiCategory==='pure'?'표준 52장':'공용 효과 풀';""","""    if(item?.kind==='card')return item.uiCategory==='pure'?'표준 52장':`공용 효과 풀${item.buildTags?.length?` · ${item.buildTags.join(' · ')}`:''}`;""",'tag metadata')
write(p,s)

# -----------------------------------------------------------------------------
# 5) TEST MIGRATIONS
# -----------------------------------------------------------------------------
p=Path('test/run-start-v2.test.js'); s=read(p)
s=replace_once(s,"test('8-A 새 런은 특정 카드군 대신 공용 스타터 1종만 노출하고 12장 · 순수 6~8 · 공용 효과 4~6 규칙을 지킨다',()=>{\n  assert.equal(RunStart.STARTERS.length,1);\n  assert.equal(RunStart.STARTERS[0].id,'common');","test('빌드 아이덴티티 스타터 4종은 모두 12장 · 순수 6~8 · 공용 효과 4~6 규칙을 지킨다',()=>{\n  assert.equal(RunStart.STARTERS.length,4);\n  assert.deepEqual(RunStart.STARTERS.map(starter=>starter.id),['common','gambler','trickster','survivor']);",'starter count test')
s=replace_once(s,"  const starter=RunStart.STARTERS[0];\n  assert.equal(RunStart.starterCardCount(starter),12);\n  assert.ok(starter.pureSlots.length>=6&&starter.pureSlots.length<=8);\n  assert.ok(starter.effectCardIds.length>=4&&starter.effectCardIds.length<=6);\n  const commonPool=new Set(RunStart.commonCardPoolIds(Cards));\n  assert.ok(starter.effectCardIds.every(id=>commonPool.has(id)));","  const commonPool=new Set(RunStart.commonCardPoolIds(Cards));\n  for(const starter of RunStart.STARTERS){\n    assert.equal(RunStart.starterCardCount(starter),12);\n    assert.ok(starter.pureSlots.length>=6&&starter.pureSlots.length<=8);\n    assert.ok(starter.effectCardIds.length>=4&&starter.effectCardIds.length<=6);\n    assert.ok(starter.effectCardIds.every(id=>commonPool.has(id)));\n  }",'starter loop test')
s=replace_once(s,"assert.equal(run.pack.name,'공용 시작 덱');","assert.equal(run.pack.name,'스타터 덱');",'starter pack name test')
write(p,s)

p=Path('test/effect-card-catalog.test.js'); s=read(p)
s=s.replace('효과 카드 38장은 하나의 공용 카탈로그로 평탄화된다','효과 카드 50장은 하나의 공용 카탈로그로 평탄화된다',1)
s=s.replace('assert.equal(Catalog.EFFECT_CARD_DEFINITIONS.length,38);assert.equal(new Set(Catalog.EFFECT_CARD_IDS).size,38);assert.equal(Cards.CARD_DEFINITIONS.length,38);','assert.equal(Catalog.EFFECT_CARD_DEFINITIONS.length,50);assert.equal(new Set(Catalog.EFFECT_CARD_IDS).size,50);assert.equal(Cards.CARD_DEFINITIONS.length,50);',1)
s=s.replace("assert.equal(Cards.CARD_PACKS['all-effects'].cards.length,38);","assert.equal(Cards.CARD_PACKS['all-effects'].cards.length,50);",1)
s=s.replace("test('효과 카드 38장은 표준 52장 숫자와 무늬를 사용하고 ID가 중복되지 않는다'","test('효과 카드 50장은 표준 52장 숫자와 무늬를 사용하고 ID가 중복되지 않는다'",1)
s=s.replace("assert.equal(all.length,38);", "assert.equal(all.length,50);",1)
s=s.replace("assert.deepEqual(Cards.rewardCardIds(['pack01','pack02','pack03']),all);", "assert.deepEqual(Cards.rewardCardIds(['pack01','pack02','pack03']),all);assert.deepEqual(Cards.rewardCardIds(['pack04']),all);",1)
s=s.replace("const sources=['pack02.js','pack03.js']", "const sources=['pack02.js','pack03.js','pack04.js']",1)
write(p,s)

p=Path('test/encounter-rules.test.js'); s=read(p)
s=replace_once(s,"""  assert.equal(EncounterRules.FIELD_DEFINITIONS.inversion_zone.rulesOverride.lowFinalValueWins,true);
  assert(EncounterRules.validateRulesOverride({advantageMargin:2}).some(error=>error.includes('unsupported rule override')));""","""  assert.equal(EncounterRules.FIELD_DEFINITIONS.inversion_zone.rulesOverride.lowFinalValueWins,true);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.wide_table.rulesOverride.maxHandModifier,1);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.royal_signal.rulesOverride.trumpBonus,6);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.crooked_table.rulesOverride.lowFinalValueWins,true);
  assert.equal(Object.keys(EncounterRules.FIELD_DEFINITIONS).length,8);
  assert(EncounterRules.validateRulesOverride({advantageMargin:2}).some(error=>error.includes('unsupported rule override')));""",'field count regression')
write(p,s)

p=Path('test/compendium-complete.test.js'); s=read(p)
s=replace_once(s,"assert.deepEqual(Bridge.CARD_FILTERS,['all','pure','effect','signature','owned','locked']);","assert.deepEqual(Bridge.CARD_FILTERS,['all','pure','effect','signature','trick','showdown','loss','chip','hand','chain','owned','locked']);",'compendium filter expectation')
s=s.replace("assert.deepEqual(Bridge.itemBadges(locked),['보스 시그니처','잠김','보상 제외']);","assert.ok(Bridge.itemBadges(locked).includes('보스 시그니처'));assert.ok(Bridge.itemBadges(locked).includes('잠김'));assert.ok(Bridge.itemBadges(locked).includes('보상 제외'));",1)
s=s.replace("assert.deepEqual(Bridge.itemBadges(unlocked),['보스 시그니처','해금됨','보상 후보']);","assert.ok(Bridge.itemBadges(unlocked).includes('보스 시그니처'));assert.ok(Bridge.itemBadges(unlocked).includes('해금됨'));assert.ok(Bridge.itemBadges(unlocked).includes('보상 후보'));",1)
write(p,s)

p=Path('test/browser-smoke-v1.test.js'); s=read(p)
s=replace_once(s,"assert.equal(await evaluate(cdp,\"document.querySelector('#startScreen .sectionTitle')?.textContent\"),'공용 시작 덱');","assert.equal(await evaluate(cdp,\"document.querySelector('#startScreen .sectionTitle')?.textContent\"),'스타터 덱');",'browser starter heading')
write(p,s)

print('build identity selfpatch complete')
