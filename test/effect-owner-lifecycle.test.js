const test=require('node:test');
const assert=require('node:assert/strict');
const Effects=require('../effects.js');
const Combat=require('../combat-effects.js');

function statuses(){return{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}}}

test('효과 소유자 타입은 카드 외 필드/보스 규칙/유물/패시브를 포함한다',()=>{
  for(const type of ['card','status','reservation','field','boss_rule','relic','passive'])assert(Effects.EFFECT_OWNER_TYPES.includes(type));
});

test('카드가 아닌 효과 소유자도 공통 runOwner를 사용할 수 있다',()=>{
  const calls=[];
  const field={id:'field.rain',effectOwnerType:'field',effects:[{trigger:'on_trick_end',action:'gain_chips',value:2,duration:'battle'}]};
  const relic={id:'relic.demo',effectOwnerType:'relic',effects:[{trigger:'on_trick_end',action:'heal_player',value:1,duration:'run'}]};
  const chain=Effects.createEffectChain();
  const perform=(...args)=>calls.push(args);
  assert.equal(Effects.runOwner('on_trick_end',field,{effectChain:chain,perform}),1);
  assert.equal(Effects.runOwner('on_trick_end',relic,{effectChain:chain,perform}),1);
  assert.deepEqual(calls.map(call=>call.slice(0,2)),[['gain_chips',2],['heal_player',1]]);
});

test('서로 다른 효과 소유자는 같은 체인에서도 중복 방지 키가 충돌하지 않는다',()=>{
  const calls=[];const chain=Effects.createEffectChain();
  const a={id:'a',effectOwnerType:'field',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle'}]};
  const b={id:'b',effectOwnerType:'relic',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'run'}]};
  Effects.dispatchOwners('before_damage',[a,b],{effectChain:chain,perform:(...args)=>calls.push(args)});
  Effects.dispatchOwners('before_damage',[a,b],{effectChain:chain,perform:(...args)=>calls.push(args)});
  assert.equal(calls.length,2);
});

test('apply_status 범용 action은 대상과 상태 ID를 데이터로 받아 적용한다',()=>{
  const state=statuses();
  Effects.runEffectList([{action:'apply_status',value:{target:'enemy',statusId:'bleed',amount:3}}],{statuses:state,ownerType:'field',ownerId:'field.test'});
  assert.equal(state.enemy.bleed,3);
});

test('remove_status는 해제 불가 상태를 기본 보호하고 force일 때만 제거한다',()=>{
  const state=statuses();state.player.shield=5;
  Effects.runEffectList([{action:'remove_status',value:{target:'player',statusId:'shield'}}],{statuses:state,ownerType:'relic',ownerId:'relic.test'});
  assert.equal(state.player.shield,5);
  Effects.runEffectList([{action:'remove_status',value:{target:'player',statusId:'shield',force:true}}],{statuses:state,ownerType:'relic',ownerId:'relic.test.2'});
  assert.equal(state.player.shield,0);
});

test('add_reservation 범용 action은 소유자 정보와 지속 범위를 보존한다',()=>{
  const reservations=[];
  Effects.runEffectList([{action:'add_reservation',value:{id:'future-chip',timing:'on_trick_end',duration:'set',action:'gain_chips',value:2}}],{reservations,ownerType:'field',ownerId:'field.casino'});
  assert.equal(reservations.length,1);
  assert.equal(reservations[0].timing,'on_trick_end');
  assert.equal(reservations[0].duration,'set');
  assert.equal(reservations[0].ownerType,'field');
  assert.equal(reservations[0].ownerId,'field.casino');
});

test('예약 lifecycle은 duration 단위로 만료시킬 수 있다',()=>{
  const reservations=[
    Effects.createReservation({id:'set-one',timing:'on_trick_end',duration:'set',action:'gain_chips',value:1}),
    Effects.createReservation({id:'battle-one',timing:'on_trick_end',duration:'battle',action:'gain_chips',value:1})
  ];
  const next=Effects.expireReservations(reservations,'set');
  assert.equal(next.length,1);
  assert.equal(next[0].id,'battle-one');
});

test('activeEffectOwners는 현재 카드와 선택적 필드/보스/유물/패시브를 함께 수집한다',()=>{
  const card={uid:'card-1',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle'}]};
  const state={hand:[card],slots:[],field:{id:'field-1',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle'}]},bossRule:{id:'boss-1',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle'}]}};
  const runState={relics:[{id:'relic-1',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'run'}]}],char:{passive:{id:'passive-1',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'run'}]}}};
  const owners=Combat.activeEffectOwners(state,runState);
  assert.deepEqual(new Set(owners.map(owner=>owner.ownerType)),new Set(['card','field','boss_rule','relic','passive']));
  assert.equal(owners.length,5);
});

test('damage hook dispatcher는 카드 외 효과 소유자도 같은 체인에서 실행한다',()=>{
  const calls=[];const chain=Effects.createEffectChain();
  const owners=[
    {source:{id:'field-1',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle'}]},ownerType:'field',ownerId:'field-1'},
    {source:{id:'relic-1',effects:[{trigger:'before_damage',action:'gain_shield',value:2,duration:'run'}]},ownerType:'relic',ownerId:'relic-1'}
  ];
  Combat.dispatchDamageHooks('before_damage',owners,{target:'player',amount:5},{chain,runEffect:(source,trigger,extra)=>Effects.runOwner(trigger,source,{...extra,perform:(...args)=>calls.push(args)})});
  assert.deepEqual(calls.map(call=>call.slice(0,2)),[['gain_shield',1],['gain_shield',2]]);
});

test('전투 lifecycle 정리는 battle 범위 상태와 예약/지속효과만 제거한다',()=>{
  const state={
    statuses:statuses(),
    reservations:[
      Effects.createReservation({id:'set-r',timing:'on_trick_end',duration:'set',action:'gain_chips',value:1}),
      Effects.createReservation({id:'battle-r',timing:'on_trick_end',duration:'battle',action:'gain_chips',value:1})
    ],
    effects:[{id:'set-e',duration:'set'},{id:'battle-e',duration:'battle'}]
  };
  state.statuses.player.shield=4;state.statuses.enemy.bleed=3;
  Combat.expireCombatDuration({state,duration:'battle'});
  assert.equal(state.statuses.player.shield,0);
  assert.equal(state.statuses.enemy.bleed,0);
  assert.deepEqual(state.reservations.map(r=>r.id),['set-r']);
  assert.deepEqual(state.effects.map(e=>e.id),['set-e']);
});
