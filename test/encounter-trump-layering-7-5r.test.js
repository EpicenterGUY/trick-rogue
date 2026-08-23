const test=require('node:test');
const assert=require('node:assert/strict');
const EncounterRules=require('../encounter-rules.js');

function battle(){
  const state={type:'battle',setIndex:1,trick:1,phase:'trick',enemy:{hp:30,maxHp:30},hand:[],slots:[],bossRules:[],field:null,statuses:{player:{},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}};
  EncounterRules.initializeBattle(state);
  EncounterRules.setField(state,'inversion_zone');
  return state;
}

test('7.5-R EncounterRules 단독 어댑터는 뒤집힌 세계의 최종 비교를 한 번 뒤집는다',()=>{
  const root={battle:battle(),BattleCore:{compareTrick(){return-1}}};
  EncounterRules.wrapBattleCore(root);
  assert.equal(root.BattleCore.compareTrick({},{} ,'S'),1);
});

test('7.5-R TrumpFields가 올라온 브라우저에서는 EncounterRules가 비교 반전을 중복 적용하지 않는다',()=>{
  const root={battle:battle(),TrumpFields:{stage:'7.5-O'},BattleCore:{compareTrick(){return-1}}};
  EncounterRules.wrapBattleCore(root);
  assert.equal(root.BattleCore.compareTrick({},{} ,'S'),-1);
});