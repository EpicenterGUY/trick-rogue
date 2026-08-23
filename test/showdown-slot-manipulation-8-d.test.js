const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const Slots=require('../showdown-slot-manipulation.js');

function card(uid,suit='S',rank=2){return{uid,suit,rank,printedSuit:suit,printedRank:rank}}
function entry(uid,result=0,suit='S',rank=2){return{card:card(uid,suit,rank),result}}
function battle(overrides={}){
  return{setIndex:1,slots:[entry('a',1,'S',2),entry('b',-1,'H',3),entry('c',0,'D',4)],hand:[card('h1','C',8),card('h2','S',9)],discard:[],riverSnapshot:{setIndex:1,candidates:[{rank:5,suit:'H'}]},...overrides};
}
function slotUids(b){return b.slots.map(x=>x.card.uid)}

test('8-D 이동은 두 쇼다운 엔트리를 맞바꾸고 카드에 붙은 결과 메타데이터도 함께 이동한다',()=>{
  const b=battle(),first=b.slots[0],third=b.slots[2];
  const result=Slots.moveShowdownSlots(b,1,3);
  assert.equal(result.ok,true);
  assert.equal(b.slots[0],third);assert.equal(b.slots[2],first);
  assert.deepEqual(slotUids(b),['c','b','a']);
  assert.equal(b.slots[0].result,0);assert.equal(b.slots[2].result,1);
});

test('기본 족쇄는 이동·철회·교체를 막지만 폐기·대체는 기본 금지 목록에 포함하지 않는다',()=>{
  const b=battle();
  const lock=Slots.applyShackle(b,2);
  assert.equal(lock.ok,true);assert.deepEqual(lock.lock.blockedOperations,['move','withdraw','exchange']);
  assert.equal(Slots.moveShowdownSlots(b,1,2).reason,'blocked');
  assert.equal(Slots.withdrawShowdownCard(b,2,{replacementCard:card('r1')}).reason,'blocked');
  assert.equal(Slots.exchangeShowdownCard(b,2,'h1').reason,'blocked');
  const replaced=Slots.discardReplaceShowdownCard(b,2,{replacementUid:'h1'});
  assert.equal(replaced.ok,true);assert.equal(b.slots[1].card.uid,'h1');assert.equal(b.discard.at(-1).uid,'b');
});

test('이동은 출발 카드뿐 아니라 목적 슬롯의 잠긴 카드도 움직이므로 둘 중 하나가 족쇄면 거부한다',()=>{
  const b=battle();Slots.applyShackle(b,3);
  const before=slotUids(b);
  const result=Slots.moveShowdownSlots(b,1,3);
  assert.equal(result.ok,false);assert.equal(result.reason,'blocked');assert.deepEqual(slotUids(b),before);
});

test('철회는 선택 카드를 손으로 되돌리고 교체 카드를 같은 슬롯에 넣어 슬롯 수를 보존한다',()=>{
  const b=battle(),replacement=card('outside','C',11),before=b.slots.length;
  const result=Slots.withdrawShowdownCard(b,1,{replacementCard:replacement});
  assert.equal(result.ok,true);assert.equal(b.slots.length,before);assert.equal(b.slots[0].card,replacement);
  assert.equal(b.hand.at(-1).uid,'a');assert.equal(b.slots[0].result,1);
});

test('교체는 쇼다운 카드와 지정 손패 카드를 원자적으로 맞바꾼다',()=>{
  const b=battle(),handIndex=b.hand.findIndex(c=>c.uid==='h2');
  const result=Slots.exchangeShowdownCard(b,2,'h2');
  assert.equal(result.ok,true);assert.equal(b.slots[1].card.uid,'h2');assert.equal(b.hand[handIndex].uid,'b');
  assert.equal(b.slots.length,3);assert.equal(b.hand.length,2);assert.equal(b.discard.length,0);
});

test('폐기·대체는 기존 쇼다운 카드를 버림 더미로 보내고 손패 대체 카드를 소비한다',()=>{
  const b=battle(),beforeHand=b.hand.length;
  const result=Slots.discardReplaceShowdownCard(b,3,{replacementUid:'h1'});
  assert.equal(result.ok,true);assert.equal(b.slots[2].card.uid,'h1');assert.equal(b.discard.at(-1).uid,'c');assert.equal(b.hand.length,beforeHand-1);
});

test('대체 카드가 없거나 이미 쇼다운에 있으면 어떤 영역도 변경하지 않는다',()=>{
  const b=battle(),before={slots:slotUids(b),hand:b.hand.map(c=>c.uid),discard:b.discard.length};
  assert.equal(Slots.withdrawShowdownCard(b,1,{}).reason,'missing_replacement');
  assert.equal(Slots.discardReplaceShowdownCard(b,1,{replacementCard:b.slots[1].card}).reason,'replacement_already_slotted');
  assert.deepEqual(slotUids(b),before.slots);assert.deepEqual(b.hand.map(c=>c.uid),before.hand);assert.equal(b.discard.length,before.discard);
});

test('족쇄는 슬롯 번호가 아니라 카드 UID에 붙고 커스텀 제한에서 이동을 허용하면 이동 후에도 같은 카드를 추적한다',()=>{
  const b=battle();Slots.applyShackle(b,1,{blockedOperations:['exchange']});
  assert.equal(Slots.moveShowdownSlots(b,1,3).ok,true);
  assert.equal(Slots.findSlotByUid(b,'a'),3);assert.equal(Slots.isShackled(b,3),true);assert.equal(Slots.isShackled(b,1),false);
  assert.equal(Slots.exchangeShowdownCard(b,3,'h1').reason,'blocked');
});

test('세트가 바뀌면 족쇄는 자동 해제되지만 슬롯 조작 이력은 전투 기록으로 남는다',()=>{
  const b=battle();Slots.applyShackle(b,1);const historyBefore=Slots.ensureState(b).history.length;
  b.setIndex=2;const state=Slots.ensureState(b);
  assert.equal(state.setIndex,2);assert.equal(state.locks.length,0);assert.equal(state.history.length,historyBefore);
  assert.equal(Slots.moveShowdownSlots(b,1,2).ok,true);
});

test('4트릭에서 고정된 리버 스냅샷은 이후 슬롯 조작으로 재계산하거나 변형하지 않는다',()=>{
  const b=battle(),snapshot=JSON.parse(JSON.stringify(b.riverSnapshot));
  Slots.moveShowdownSlots(b,1,2);
  Slots.exchangeShowdownCard(b,3,'h1');
  assert.deepEqual(b.riverSnapshot,snapshot);
});

test('슬롯 조작 5종은 CardEffects 공통 액션으로 등록되고 validator가 정식 액션으로 인정한다',()=>{
  const root={CardEffects,renderBattle(){}};
  assert.equal(Slots.installEffectActions(root),true);
  for(const action of Object.values(Slots.EFFECT_ACTIONS))assert.ok(CardEffects.ACTIONS.includes(action));
  const errors=CardEffects.validateEffectList([
    {trigger:'on_play',duration:'set',action:Slots.EFFECT_ACTIONS.move,fromSlot:1,toSlot:2},
    {trigger:'on_play',duration:'set',action:Slots.EFFECT_ACTIONS.shackle,slot:1}
  ],{requireTrigger:true,requireDuration:true});
  assert.deepEqual(errors,[]);
});

test('CardEffects 이동 액션은 공용 버튼 없이 effect context의 battle과 슬롯 번호만으로 공통 API를 호출한다',()=>{
  const b=battle(),root={CardEffects,battle:b,renderBattle(){}};Slots.installEffectActions(root);
  const effect={trigger:'on_play',duration:'set',action:Slots.EFFECT_ACTIONS.move,fromSlot:1,toSlot:2};
  CardEffects.runEffectList([effect],{battle:b,card:b.slots[2].card,slotIndex:2,ownerType:'card',ownerId:'test.card'});
  assert.deepEqual(slotUids(b),['b','a','c']);
});

test('8-D는 8-C 경제 뒤, 최종 전투 레이아웃 전에 로드되고 index에 공용 슬롯 조작 버튼을 직접 추가하지 않는다',()=>{
  const loader=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const economy=loader.indexOf("run-economy-v2.js"),slots=loader.indexOf("showdown-slot-manipulation.js"),layout=loader.indexOf("battle-layout.js");
  assert.ok(economy>=0&&slots>economy&&layout>slots);
  assert.match(loader,/if\(root\.ShowdownSlotManipulation\)\{finishShowdownSlotManipulation\(\);return;\}/);
  assert.doesNotMatch(index,/onclick=["'][^"']*(moveShowdownSlots|withdrawShowdownCard|exchangeShowdownCard|discardReplaceShowdownCard)/);
});
