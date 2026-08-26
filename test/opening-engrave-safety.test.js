const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');

function makeRuntime(deck){
  const calls={closed:0,completed:0,html:''};
  let uid=0;
  const run={actId:'common',deck:[...deck],map:[{id:'c0'}]};
  const runtime={
    run,
    CARD_DEFINITION_BY_ID:Cards.CARD_DEFINITION_BY_ID,
    GENERAL_EFFECT_CARD_DEFINITIONS:Cards.GENERAL_EFFECT_CARD_DEFINITIONS,
    createDefinitionCard:Cards.createDefinitionCard,
    createCardRecord:Cards.createCardRecord,
    createBaseCardSlots:Cards.createBaseCardSlots,
    makeGeneral(id){uid+=1;return Cards.createDefinitionCard(id,{uid:`reward-${uid}`})},
    closeOverlay(){calls.closed+=1},
    completeNode(node){calls.completed+=1;calls.nodeId=node?.id||null},
    showModal(html){calls.html=html},
    artHtml(){return''},
    Math:{random:()=>0}
  };
  return{run,runtime,calls};
}

function namedLike(def){
  return{
    uid:'named-protected',
    suit:def.suit,
    rank:def.rank,
    printedSuit:def.suit,
    printedRank:def.rank,
    cardId:'test.named-protected',
    definition:{id:'test.named-protected'},
    named:{id:'test.named-protected'},
    effects:[{trigger:'on_play',action:'gain_chips',value:1}]
  };
}

test('공통지역 각인은 같은 슬롯의 효과/네임드 카드를 자동으로 덮어쓰지 않는다',()=>{
  const cardId='core.plus2',def=Cards.CARD_DEFINITION_BY_ID[cardId];
  const effectCard=Cards.createDefinitionCard(cardId,{uid:'effect-protected'});
  const namedCard=namedLike(def);
  const {run,runtime,calls}=makeRuntime([effectCard,namedCard]);

  const result=RunStart.takeOpeningReward(cardId,'engrave','c0',runtime);

  assert.equal(result.ok,false);
  assert.equal(result.reason,'no_pure_target');
  assert.equal(result.replacedIndex,-1);
  assert.equal(run.deck.length,2);
  assert.strictEqual(run.deck[0],effectCard);
  assert.strictEqual(run.deck[1],namedCard);
  assert.equal(calls.closed,0);
  assert.equal(calls.completed,0);
});

test('같은 슬롯에 효과 카드와 순수 카드가 함께 있으면 순수 카드만 각인한다',()=>{
  const cardId='core.plus2',def=Cards.CARD_DEFINITION_BY_ID[cardId];
  const effectCard=Cards.createDefinitionCard(cardId,{uid:'effect-protected'});
  const pureCard=Cards.createCardRecord({suit:def.suit,rank:def.rank,metadata:{uid:'pure-target'}});
  const {run,runtime,calls}=makeRuntime([effectCard,pureCard]);

  assert.equal(RunStart.openingEngraveTargetIndex(run,def),1);
  const result=RunStart.takeOpeningReward(cardId,'engrave','c0',runtime);

  assert.equal(result.ok,true);
  assert.equal(result.replacedIndex,1);
  assert.equal(result.deckSize,2);
  assert.strictEqual(run.deck[0],effectCard);
  assert.notStrictEqual(run.deck[1],pureCard);
  assert.equal(run.deck[1].cardId,cardId);
  assert.equal(calls.closed,1);
  assert.equal(calls.completed,1);
  assert.equal(calls.nodeId,'c0');
});

test('각인 가능한 순수 카드가 없으면 보상 UI에서 각인 버튼을 비활성화한다',()=>{
  const {runtime,calls}=makeRuntime([]);
  const shown=RunStart.showOpeningReward(runtime,{id:'c0'});

  assert.equal(shown,true);
  assert.match(calls.html,/같은 숫자·무늬의 <b>순수 카드<\/b>만 바꾸고/);
  assert.equal((calls.html.match(/각인 불가/g)||[]).length,3);
  assert.equal((calls.html.match(/disabled aria-disabled="true"/g)||[]).length,3);
});

test('추가 보상은 순수 각인 대상 유무와 관계없이 기존 카드를 보존하고 새 카드를 더한다',()=>{
  const cardId='core.plus2';
  const protectedCard=Cards.createDefinitionCard(cardId,{uid:'protected'});
  const {run,runtime,calls}=makeRuntime([protectedCard]);

  const result=RunStart.takeOpeningReward(cardId,'add','c0',runtime);

  assert.equal(result.ok,true);
  assert.equal(result.mode,'add');
  assert.equal(result.replacedIndex,-1);
  assert.equal(run.deck.length,2);
  assert.strictEqual(run.deck[0],protectedCard);
  assert.equal(run.deck[1].cardId,cardId);
  assert.equal(calls.closed,1);
  assert.equal(calls.completed,1);
});