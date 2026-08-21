const test=require('node:test');
const assert=require('node:assert/strict');
const Effects=require('../effects.js');
const Combat=require('../combat-effects.js');
const Events=require('../battle-events.js');

function baseState(){
  return{
    setIndex:1,trick:1,phase:'trick',trump:'H',enemyCard:{suit:'S',rank:9},
    hand:[],slots:[],statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}},
    reservations:[],effects:[],history:Effects.newHistory(),field:null,enemy:{hp:20,maxHp:20}
  };
}

test('on_trick_start가 정식 전투 trigger에 포함된다',()=>{
  assert(Effects.TRIGGERS.includes('on_trick_start'));
  assert(Events.LIFECYCLE_ORDER.indexOf('on_set_start')<Events.LIFECYCLE_ORDER.indexOf('on_trick_start'));
  assert(Events.LIFECYCLE_ORDER.indexOf('on_trick_start')<Events.LIFECYCLE_ORDER.indexOf('on_play'));
});

test('전투 이벤트 context는 세트/트릭/트럼프/상태/예약을 공통으로 제공한다',()=>{
  const state=baseState();state.advantage={playerAdvantages:['H']};
  const context=Events.createBattleEventContext('before_compare',state,{id:'run'},{result:1});
  assert.equal(context.setIndex,1);
  assert.equal(context.trick,1);
  assert.equal(context.currentTrump,'H');
  assert.strictEqual(context.statuses,state.statuses);
  assert.strictEqual(context.reservations,state.reservations);
  assert.strictEqual(context.advantage,state.advantage);
  assert.strictEqual(context.enemyCard,state.enemyCard);
});

test('같은 논리 이벤트에서 카드별 호출은 유지하고 비카드 소유자는 한 번만 실행한다',()=>{
  const state=baseState(),runState={relics:[]};
  state.field={id:'field.demo',effectOwnerType:'field',effects:[{trigger:'on_play',action:'gain_chips',value:1,duration:'battle'}]};
  const primary=[],global=[];
  const first=Events.dispatchBattleEvent('on_play',{
    state,runState,primaryCard:{uid:'a'},primaryRunner:(_trigger,card)=>primary.push(card.uid),
    perform:(action,value)=>global.push([action,value])
  });
  const second=Events.dispatchBattleEvent('on_play',{
    state,runState,primaryCard:{uid:'b'},primaryRunner:(_trigger,card)=>primary.push(card.uid),
    perform:(action,value)=>global.push([action,value])
  });
  assert.deepEqual(primary,['a','b']);
  assert.deepEqual(global,[['gain_chips',1]]);
  assert.equal(first.token,second.token);
  assert.strictEqual(first.chain,second.chain);
});

test('다음 트릭에서는 같은 비카드 trigger가 다시 실행된다',()=>{
  const state=baseState();
  state.field={id:'field.demo',effectOwnerType:'field',effects:[{trigger:'on_trick_end',action:'gain_chips',value:1,duration:'battle'}]};
  const calls=[];
  Events.dispatchBattleEvent('on_trick_end',{state,runState:{},perform:(a,v)=>calls.push([a,v])});
  Events.dispatchBattleEvent('on_trick_end',{state,runState:{},perform:(a,v)=>calls.push([a,v])});
  state.trick=2;
  Events.dispatchBattleEvent('on_trick_end',{state,runState:{},perform:(a,v)=>calls.push([a,v])});
  assert.deepEqual(calls,[['gain_chips',1],['gain_chips',1]]);
});

test('쇼다운 루프의 여러 카드 호출도 비카드 소유자는 단계당 한 번만 실행한다',()=>{
  const state=baseState();state.phase='showdown';
  state.field={id:'field.score',effectOwnerType:'field',effects:[{trigger:'on_showdown_score',action:'showdown_power',value:2,duration:'battle'}]};
  const score={value:10};
  for(let i=0;i<5;i++)Events.dispatchBattleEvent('on_showdown_score',{
    state,runState:{},primaryCard:{uid:`slot-${i}`},extra:{slotIndex:i,score},primaryRunner:()=>{},
    perform:(action,value)=>{if(action==='showdown_power')score.value+=value}
  });
  assert.equal(score.value,12);
});

test('트릭 시작 dispatcher는 적 공개 전에 손패와 전역 소유자를 호출한다',()=>{
  const state=baseState();
  state.hand=[{uid:'h1'},{uid:'h2'}];
  state.field={id:'field.start',effectOwnerType:'field',effects:[{trigger:'on_trick_start',action:'gain_chips',value:1,duration:'battle'}]};
  const cards=[],global=[];
  const result=Events.dispatchTrickStart({state,runState:{},primaryRunner:(trigger,card,extra)=>cards.push([trigger,card.uid,extra.enemyRevealed,extra.enemyCard]),perform:(a,v)=>global.push([a,v])});
  assert.deepEqual(cards,[['on_trick_start','h1',false,null],['on_trick_start','h2',false,null]]);
  assert.deepEqual(global,[['gain_chips',1]]);
  assert(result.chain);
});

test('트릭 lifecycle은 다음 트릭 시작 전에 trick 범위 효과와 예약을 만료한다',()=>{
  const state=baseState();
  state.effects=[{id:'short',duration:'trick'},{id:'long',duration:'battle'}];
  state.reservations=[
    Effects.createReservation({id:'short-r',timing:'on_trick_end',duration:'trick',action:'gain_chips',value:1}),
    Effects.createReservation({id:'long-r',timing:'on_trick_end',duration:'battle',action:'gain_chips',value:1})
  ];
  Events.beginTrickLifecycle(state);
  state.trick=2;Events.beginTrickLifecycle(state);
  assert.deepEqual(state.effects.map(x=>x.id),['long']);
  assert.deepEqual(state.reservations.map(x=>x.id),['long-r']);
});

test('세트 lifecycle은 새 세트 시작 전에 set 범위 효과와 예약을 만료한다',()=>{
  const state=baseState();
  state.effects=[{id:'set-e',duration:'set'},{id:'battle-e',duration:'battle'}];
  state.reservations=[
    Effects.createReservation({id:'set-r',timing:'on_trick_end',duration:'set',action:'gain_chips',value:1}),
    Effects.createReservation({id:'battle-r',timing:'on_trick_end',duration:'battle',action:'gain_chips',value:1})
  ];
  Events.beginSetLifecycle(state);
  state.setIndex=2;Events.beginSetLifecycle(state);
  assert.deepEqual(state.effects.map(x=>x.id),['battle-e']);
  assert.deepEqual(state.reservations.map(x=>x.id),['battle-r']);
});

test('전투 종료 lifecycle은 trick/set/battle만 정리하고 run 범위는 남긴다',()=>{
  const state=baseState();
  state.effects=[{id:'t',duration:'trick'},{id:'s',duration:'set'},{id:'b',duration:'battle'},{id:'r',duration:'run'}];
  state.statuses.player.shield=5;state.statuses.enemy.bleed=3;
  state.reservations=[
    Effects.createReservation({id:'b-r',timing:'on_trick_end',duration:'battle',action:'gain_chips',value:1}),
    Effects.createReservation({id:'r-r',timing:'on_trick_end',duration:'run',action:'gain_chips',value:1})
  ];
  Events.expireBattleLifecycle(state);
  assert.deepEqual(state.effects.map(x=>x.id),['r']);
  assert.deepEqual(state.reservations.map(x=>x.id),['r-r']);
  assert.equal(Combat.getStatusValue(state.statuses,'player','shield'),0);
  assert.equal(Combat.getStatusValue(state.statuses,'enemy','bleed'),0);
});

test('전투 이벤트 토큰은 같은 트릭에서는 안정적이고 세트/트릭이 바뀌면 달라진다',()=>{
  const state=baseState();
  const a=Events.eventScopeToken('on_trick_end',state,{});
  const b=Events.eventScopeToken('on_trick_end',state,{slotIndex:3});
  state.trick=2;const c=Events.eventScopeToken('on_trick_end',state,{});
  state.setIndex=2;const d=Events.eventScopeToken('on_set_end',state,{});
  assert.equal(a,b);assert.notEqual(a,c);assert.equal(d,'set:2:on_set_end');
});
