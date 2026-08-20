const test=require('node:test');
const assert=require('node:assert/strict');
const Effects=require('../effects.js');
const Combat=require('../combat-effects.js');

function statuses(){return{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}}}

test('공통 상태 정의는 수치/중첩/발동/감소/지속/해제 정보를 모두 가진다',()=>{
  assert.deepEqual(Combat.validateStatusRegistry(),[]);
  for(const definition of Object.values(Combat.STATUS_DEFINITIONS)){
    assert('maxStacks' in definition);
    assert('trigger' in definition);
    assert('decay' in definition);
    assert('duration' in definition);
    assert('stacking' in definition);
    assert.equal(typeof definition.dispellable,'boolean');
  }
});

test('보호막은 체력보다 먼저 피해를 흡수하고 남은 보호막을 유지한다',()=>{
  const state=statuses();state.player.shield=5;let hp=20;
  const first=Combat.resolveDamageState({statuses:state,target:'player',amount:3,getHp:()=>hp,setHp:value=>{hp=value}});
  assert.deepEqual({blocked:first.blocked,dealt:first.dealt,hp}, {blocked:3,dealt:0,hp:20});
  assert.equal(state.player.shield,2);
  const second=Combat.resolveDamageState({statuses:state,target:'player',amount:7,getHp:()=>hp,setHp:value=>{hp=value}});
  assert.deepEqual({blocked:second.blocked,dealt:second.dealt,hp}, {blocked:2,dealt:5,hp:15});
  assert.equal(state.player.shield,0);
});

test('출혈은 트릭 종료 시 현재 수치만큼 피해 후 1 감소한다',()=>{
  const state=statuses();state.enemy.bleed=3;const calls=[];
  const events=Combat.resolveStatusTrigger({statuses:state,actor:'enemy',trigger:'on_trick_end',damage:(actor,value,meta)=>{calls.push([actor,value,meta]);return value}});
  assert.equal(events.length,1);
  assert.equal(events[0].statusId,'bleed');
  assert.deepEqual(calls[0].slice(0,2),['enemy',3]);
  assert.equal(calls[0][2].source,'status');
  assert.equal(state.enemy.bleed,2);
});

test('중독은 규칙이 확정되지 않아 등록만 되고 자동 발동하지 않는다',()=>{
  const state=statuses();state.player.poison=4;let damage=0;
  assert.equal(Combat.STATUS_DEFINITIONS.poison.implemented,false);
  Combat.resolveStatusTrigger({statuses:state,actor:'player',trigger:'on_trick_end',damage:(_actor,value)=>{damage+=value}});
  assert.equal(damage,0);
  assert.equal(state.player.poison,4);
});

test('상태 추가는 기존 숫자형 런타임 상태와 호환된다',()=>{
  const state=statuses();
  assert.equal(Combat.addStatus(state,'enemy','bleed',2),2);
  assert.equal(Combat.addStatus(state,'enemy','bleed',3),5);
  assert.equal(Combat.statusSnapshot(state,'enemy','bleed').value,5);
});

test('기존 다음 승리 예약은 공통 예약 resolver에서 승리 시 발동한다',()=>{
  const reservations=[{type:'nextWinDamage',value:6,eligibleSet:2,eligibleTrick:1,label:'다음 승리 피해 6'}];const calls=[];
  const before=Effects.resolveReservations(reservations,'on_trick_result',{set:1,trick:5,result:'player'},(...args)=>calls.push(args));
  assert.equal(before.length,1);assert.equal(calls.length,0);
  const after=Effects.resolveReservations(before,'on_trick_result',{set:2,trick:1,result:'player'},(...args)=>calls.push(args));
  assert.deepEqual(after,[]);
  assert.deepEqual(calls[0].slice(0,2),['damage_enemy',6]);
});

test('다음 승리 예약은 해당 트릭에서 패배/무승부여도 소비되고 발동하지 않는다',()=>{
  for(const result of ['enemy','draw']){
    const reservations=[{type:'nextWinDamage',value:6,eligibleSet:1,eligibleTrick:2}];let called=false;
    const remaining=Effects.resolveReservations(reservations,'on_trick_result',{set:1,trick:2,result},()=>{called=true});
    assert.deepEqual(remaining,[]);assert.equal(called,false);
  }
});

test('예약 생성기는 지원하지 않는 시점과 지속 범위를 거부한다',()=>{
  assert.throws(()=>Effects.createReservation({timing:'later',duration:'set'}),/Unknown reservation timing/);
  assert.throws(()=>Effects.createReservation({timing:'on_trick_end',duration:'forever'}),/Unknown reservation duration/);
  const reservation=Effects.createReservation({id:'demo',timing:'on_trick_end',duration:'set',action:'gain_chips',value:1});
  assert.equal(reservation.timing,'on_trick_end');
  assert.equal(reservation.consume,'when_due');
});

test('같은 효과 체인에서는 같은 효과가 기본적으로 한 번만 촉발된다',()=>{
  const calls=[];const chain=Effects.createEffectChain();
  const card={uid:'same-card',cardId:'demo.card',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle'}]};
  const context={effectChain:chain,perform:(...args)=>calls.push(args)};
  Effects.run('before_damage',card,context);
  Effects.run('before_damage',card,context);
  assert.equal(calls.length,1);
  assert.equal(chain.executions,1);
});

test('명시적 반복 허용 효과는 같은 체인에서도 반복할 수 있다',()=>{
  const calls=[];const chain=Effects.createEffectChain();
  const card={uid:'repeat-card',effects:[{trigger:'before_damage',action:'gain_shield',value:1,duration:'battle',allowRepeat:true}]};
  Effects.run('before_damage',card,{effectChain:chain,perform:(...args)=>calls.push(args)});
  Effects.run('before_damage',card,{effectChain:chain,perform:(...args)=>calls.push(args)});
  assert.equal(calls.length,2);
});

test('효과 체인은 최대 실행 횟수를 넘기면 안전하게 중단한다',()=>{
  const chain=Effects.createEffectChain({maxExecutions:2}),calls=[];
  assert.throws(()=>Effects.runEffectList([
    {action:'gain_chips',value:1},{action:'gain_shield',value:1},{action:'heal_player',value:1}
  ],{effectChain:chain,ownerType:'test',ownerId:'overflow',perform:(...args)=>calls.push(args)}),/Effect chain exceeded 2 executions/);
  assert.equal(calls.length,2);
});

test('피해 전후 훅은 동일 체인을 공유하고 피해 context를 전달한다',()=>{
  const seen=[];const chain=Effects.createEffectChain();
  Effects.handlers.capture_damage=context=>seen.push({trigger:context.trigger,damage:context.damage,chain:context.effectChain});
  const card={uid:'guard',effects:[
    {trigger:'before_damage',handler:'capture_damage',duration:'battle'},
    {trigger:'after_damage',handler:'capture_damage',duration:'battle'}
  ]};
  try{
    const before={target:'player',amount:5,requestedAmount:5,cancelled:false};
    Combat.dispatchDamageHooks('before_damage',[card],before,{chain,runEffect:(owner,trigger,extra)=>Effects.run(trigger,owner,extra)});
    const after={...before,blocked:2,dealt:3};
    Combat.dispatchDamageHooks('after_damage',[card],after,{chain,runEffect:(owner,trigger,extra)=>Effects.run(trigger,owner,extra)});
  }finally{delete Effects.handlers.capture_damage}
  assert.equal(seen.length,2);
  assert.strictEqual(seen[0].chain,chain);assert.strictEqual(seen[1].chain,chain);
  assert.equal(seen[0].damage.amount,5);assert.equal(seen[1].damage.dealt,3);
});
