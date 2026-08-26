const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const RunStart=require('../run-start-v2.js');
const EncounterRules=require('../encounter-rules.js');
const RunFields=require('../run-fields.js');
const BuildTags=require('../card-build-tags.js');
const CompendiumBridge=require('../compendium-8-h-runtime-bridge.js');

function logContext(extra={}){const calls=[];return{calls,context:{history:Effects.newHistory(),setHistory:{wins:0,losses:0,draws:0},perform:(action,value)=>calls.push([action,value]),...extra}}}

test('빌드 아이덴티티는 스타터 4종과 노출 특성 8종을 제공한다',()=>{
  assert.deepEqual(RunStart.STARTERS.map(row=>row.id),['common','gambler','trickster','survivor']);
  assert.deepEqual(RunStart.STARTERS.map(row=>row.name),['정석','승부사','변칙','생존자']);
  assert.equal(RunStart.RUN_TRAITS.length,8);
  assert.equal(new Set(RunStart.RUN_TRAITS.map(row=>row.id)).size,8);
  assert.deepEqual(RunStart.validateStarterRegistry(Cards),[]);
  for(const starter of RunStart.STARTERS){
    const deck=RunStart.buildStarterDeck(starter.id,Cards,{});
    assert.equal(deck.length,12,starter.id);
    assert.equal(deck.filter(Cards.isPureCard).length,8,starter.id);
  }
});

test('구버전 수치 특성은 저장 호환용으로 남고 새 특성 후보에는 나오지 않는다',()=>{
  assert.deepEqual(RunStart.ARCHIVED_TRAITS.map(row=>row.id),['extra_gold','durable','pocket_chip']);
  assert(RunStart.ARCHIVED_TRAITS.every(row=>row.hidden&&row.archived));
  assert.equal(RunStart.RUN_TRAITS.some(row=>row.id==='extra_gold'),false);
  assert.equal(RunStart.traitDefinition('durable').id,'durable');
});

test('효과형 특성은 런 캐릭터의 passive 소유자로 연결된다',()=>{
  const run={hp:1,maxHp:1,gold:1,deck:[]};
  RunStart.applyIdentityToRun(run,{starterId:'gambler',traitId:'stubborn_loss'},Cards,{});
  assert.equal(run.starterId,'gambler');assert.equal(run.traitId,'stubborn_loss');
  assert.equal(run.char.passives.length,1);assert.equal(run.char.passives[0].effectOwnerType,'passive');
  assert.equal(run.char.passives[0].effects[0].trigger,'on_trick_loss');
});

test('빌드 특성 조건은 패배·빈 칩·4무늬·하이카드를 실제 효과 조건으로 판정한다',()=>{
  const loss=RunStart.traitDefinition('stubborn_loss'),lossLog=logContext({battle:{chip:2}});Effects.runOwner('on_trick_loss',loss,lossLog.context);assert.deepEqual(lossLog.calls,[['gain_chips',1]]);
  const empty=RunStart.traitDefinition('empty_pocket');let log=logContext({battle:{chip:0,slots:[]},score:{value:0}});Effects.runOwner('on_showdown_score',empty,log.context);assert.deepEqual(log.calls,[['showdown_power',7]]);
  log=logContext({battle:{chip:1,slots:[]},score:{value:0}});Effects.runOwner('on_showdown_score',empty,log.context);assert.deepEqual(log.calls,[]);
  const suits=RunStart.traitDefinition('suit_collector'),slots=['S','H','D','C','S'].map((suit,i)=>({card:{suit,rank:i+2}}));log=logContext({battle:{chip:1,slots},slots,score:{value:0}});Effects.runOwner('on_showdown_score',suits,log.context);assert.deepEqual(log.calls,[['showdown_power',8]]);
  const high=RunStart.traitDefinition('imperfect'),highSlots=[['S',2],['H',4],['D',7],['C',9],['S',12]].map(([suit,rank])=>({card:{suit,rank}}));log=logContext({battle:{chip:1,slots:highSlots},slots:highSlots,score:{value:0}});Effects.runOwner('on_showdown_score',high,log.context);assert.deepEqual(log.calls,[['showdown_power',10]]);
});

test('필드는 8종이며 이벤트/상점 노드가 서로 다른 필드를 순환 제공한다',()=>{
  assert.equal(Object.keys(EncounterRules.FIELD_DEFINITIONS).length,8);
  assert.deepEqual(RunFields.EVENT_FIELD_IDS.map(id=>EncounterRules.FIELD_DEFINITIONS[id].label),['뒤집힌 세계','감쇠 지대','넓은 테이블','과열 테이블']);
  assert.deepEqual(RunFields.SHOP_FIELD_IDS.map(id=>EncounterRules.FIELD_DEFINITIONS[id].label),['과충전 구역','무법지대','좁은 테이블','왕실 중계소']);
  assert.deepEqual([1,2,3,4].map(n=>RunFields.fieldOfferIdForNode({id:`n${n}`} ,'event')),RunFields.EVENT_FIELD_IDS);
  assert.deepEqual([4,5,6,7].map(n=>RunFields.fieldOfferIdForNode({id:`n${n}`} ,'shop')),RunFields.SHOP_FIELD_IDS);
});

test('신규 네임드 12장은 공용 효과 카탈로그에 들어가고 공용 카드 인쇄 슬롯과 충돌하지 않는다',()=>{
  const defs=Cards.CARD_DEFINITIONS.filter(card=>card.packId==='pack04');
  assert.equal(defs.length,12);assert.equal(new Set(defs.map(card=>card.id)).size,12);
  const commonSlots=new Set(Cards.GENERAL_EFFECT_CARD_DEFINITIONS.map(card=>`${card.suit}${card.rank}`));
  for(const card of defs){assert.equal(commonSlots.has(`${card.suit}${card.rank}`),false,card.id);assert.ok(Array.isArray(card.buildTags)&&card.buildTags.length>0,card.id)}
});

test('카피캣·예약석·패자의 왕관·영점 통장의 규칙 조작이 실제 효과 엔진에서 동작한다',()=>{
  const copycat=Cards.createDefinitionCard('pack04.copycat',{uid:'copycat'}),battleA={mods:{plus:0},enemyCard:{suit:'H',rank:9},chip:2};Effects.run('before_compare',copycat,{card:copycat,battle:battleA,enemyCard:battleA.enemyCard,perform(){}});assert.equal(battleA.mods.plus,-5,'A(14)를 적 9에 맞추면 -5');
  const seat=Cards.createDefinitionCard('pack04.reserved_seat',{uid:'seat'});Effects.run('on_play',seat,{card:seat,battle:{},slotIndex:4,slots:[{}, {}, {}, {}, {card:seat}],perform(){}});assert.equal(seat.showdownRank,14);
  const crown=Cards.createDefinitionCard('pack04.loser_crown',{uid:'crown'});Effects.run('after_compare',crown,{card:crown,battle:{},result:-1,perform(){}});assert.equal(crown.showdownRank,14);
  const zero=Cards.createDefinitionCard('pack04.zero_account',{uid:'zero'});let log=logContext({card:zero,battle:{chip:0},score:{value:0}});Effects.run('on_showdown_score',zero,log.context);assert.deepEqual(log.calls,[['showdown_power',10]]);
});

test('기존 카드도 6개 빌드 계열로 자동 분류되고 도감에서 계열 필터를 사용할 수 있다',()=>{
  assert(BuildTags.tagsForDefinition(Cards.CARD_DEFINITION_BY_ID['core.reverse']).includes('승부 조작'));
  assert(BuildTags.tagsForDefinition(Cards.CARD_DEFINITION_BY_ID['core.burn']).includes('손패 조작'));
  assert(BuildTags.tagsForDefinition(Cards.CARD_DEFINITION_BY_ID['pack01.scheduled_delivery']).includes('예약·연쇄'));
  assert(BuildTags.tagsForDefinition(Cards.CARD_DEFINITION_BY_ID['pack02.consolation_prize']).includes('패배 활용'));
  assert(CompendiumBridge.CARD_FILTERS.includes('trick'));assert(CompendiumBridge.CARD_FILTERS.includes('chip'));
  const trick=CompendiumBridge.filteredCatalog('cards',{cardFilter:'trick',runState:{deck:[]}});assert(trick.some(card=>card.id==='core.reverse'));
});
