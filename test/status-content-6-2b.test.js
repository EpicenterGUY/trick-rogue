const test=require('node:test');
const assert=require('node:assert/strict');
const Combat=require('../combat-effects.js');

function statuses(){
  return{
    player:{shield:0,bleed:0,regen:0,vulnerable:0,poison:0},
    enemy:{shield:0,bleed:0,regen:0,vulnerable:0,poison:0}
  };
}

test('6-2B 재생은 트릭 종료 시 현재 수치만큼 회복하고 1 감소한다',()=>{
  const state=statuses();state.player.regen=3;let hp=10;
  const events=Combat.resolveStatusTrigger({
    statuses:state,actor:'player',trigger:'on_trick_end',
    heal:(_actor,value)=>{const before=hp;hp=Math.min(20,hp+value);return hp-before}
  });
  assert.equal(events.length,1);
  assert.equal(events[0].statusId,'regen');
  assert.equal(events[0].result,3);
  assert.equal(hp,13);
  assert.equal(state.player.regen,2);
});

test('재생은 최대 체력을 넘겨 회복하지 않아도 발동 후 1 감소한다',()=>{
  const state=statuses();state.player.regen=2;let hp=19;
  const events=Combat.resolveStatusTrigger({
    statuses:state,actor:'player',trigger:'on_trick_end',
    heal:(_actor,value)=>{const before=hp;hp=Math.min(20,hp+value);return hp-before}
  });
  assert.equal(events[0].result,1);
  assert.equal(hp,20);
  assert.equal(state.player.regen,1);
});

test('6-2B 취약은 다음 양수 피해를 보호막 계산 전에 증가시키고 모두 소모된다',()=>{
  const state=statuses();state.enemy.vulnerable=2;
  const damage={target:'enemy',amount:5,requestedAmount:5,cancelled:false};
  const events=Combat.resolveStatusTrigger({statuses:state,actor:'enemy',trigger:'before_damage',damageEvent:damage});
  assert.equal(events.length,1);
  assert.equal(events[0].statusId,'vulnerable');
  assert.deepEqual(events[0].result,{before:5,after:7,added:2});
  assert.equal(damage.amount,7);
  assert.equal(state.enemy.vulnerable,0);

  state.enemy.shield=3;let hp=20;
  const resolved=Combat.resolveDamageState({statuses:state,target:'enemy',amount:damage.amount,getHp:()=>hp,setHp:value=>{hp=value}});
  assert.equal(resolved.blocked,3);
  assert.equal(resolved.dealt,4);
  assert.equal(hp,16);
});

test('취약은 취소되거나 0인 피해에는 소모되지 않는다',()=>{
  const state=statuses();state.player.vulnerable=4;
  assert.deepEqual(Combat.resolveStatusTrigger({statuses:state,actor:'player',trigger:'before_damage',damageEvent:{target:'player',amount:0,requestedAmount:0,cancelled:false}}),[]);
  assert.equal(state.player.vulnerable,4);
  assert.deepEqual(Combat.resolveStatusTrigger({statuses:state,actor:'player',trigger:'before_damage',damageEvent:{target:'player',amount:5,requestedAmount:5,cancelled:true}}),[]);
  assert.equal(state.player.vulnerable,4);
});

test('재생과 취약은 해제 가능 상태이고 중독은 계속 미구현 상태다',()=>{
  const state=statuses();
  Combat.addStatus(state,'player','regen',2);
  Combat.addStatus(state,'player','vulnerable',3);
  assert.equal(Combat.removeStatus(state,'player','regen'),true);
  assert.equal(Combat.removeStatus(state,'player','vulnerable'),true);
  assert.equal(Combat.getStatusValue(state,'player','regen'),0);
  assert.equal(Combat.getStatusValue(state,'player','vulnerable'),0);
  assert.equal(Combat.STATUS_DEFINITIONS.poison.implemented,false);
  assert.equal(Combat.STATUS_DEFINITIONS.poison.trigger,null);
});
