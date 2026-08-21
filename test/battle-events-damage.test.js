const test=require('node:test');
const assert=require('node:assert/strict');
const Effects=require('../effects.js');
const Events=require('../battle-events.js');

test('피해 trigger는 CombatEffects 전용 경로를 위해 전역 dispatcher를 중복 실행하지 않는다',()=>{
  assert.deepEqual(Events.DAMAGE_TRIGGERS,['before_damage','after_damage']);
  const state={setIndex:1,trick:1,hand:[],slots:[],field:{id:'field.guard',effectOwnerType:'field',effects:[{trigger:'before_damage',action:'gain_chips',value:1,duration:'battle'}]},statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}},reservations:[],history:Effects.newHistory(),enemy:{hp:10}};
  const calls=[];
  const chain=Effects.createEffectChain({id:'damage-1'});
  const result=Events.dispatchBattleEvent('before_damage',{state,runState:{},primaryCard:{uid:'card'},extra:{effectChain:chain},primaryRunner:()=>calls.push('card'),perform:()=>calls.push('global')});
  assert.deepEqual(calls,['card']);
  assert.equal(result.globalExecuted,0);
  assert.equal(result.token,'damage:damage-1:before_damage');
});
