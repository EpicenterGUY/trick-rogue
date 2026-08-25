const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const RunStart=require('../run-start-v2.js');

function run(id,{slots=[],trigger='on_play',...context}={}){
  const card=Cards.createDefinitionCard(id,{uid:`test-${id}`});
  const calls=[];
  const next={card,slots,history:Effects.newHistory(),setHistory:{wins:0,losses:0,draws:0},printedRank:card.rank,printedSuit:card.suit,perform:(action,value)=>calls.push([action,value]),...context};
  const count=Effects.run(trigger,card,next);
  return{card,count,calls,context:next};
}

test('공통지역 초반 효과 풀 9장은 그대로 유지한다',()=>{
  assert.deepEqual(RunStart.COMMON_CARD_POOL_IDS,['core.paint','core.plus2','core.draw','core.scout','core.double','core.barrier','core.burn','core.pureboost','core.clean']);
});

test('일반 효과 카드 표시명과 인쇄값은 현재 main 기준을 유지한다',()=>{
  const expected={
    'core.paint':['트럼프 페인트','D',4],'core.plus2':['랭크 부스트','S',3],'core.draw':['드로우','C',6],'core.scout':['정찰','D',9],
    'core.double':['더블다운','H',2],'core.barrier':['세이프가드','S',6],'core.burn':['패갈이','C',2],'core.reverse':['리버스','H',3],
    'core.pureboost':['정공법','D',5],'core.clean':['무첨가','S',4],'core.recolor':['재도색','C',9],'core.fakeid':['가짜 신분증','H',10]
  };
  for(const[id,[name,suit,rank]]of Object.entries(expected)){const card=Cards.CARD_DEFINITION_BY_ID[id];assert.equal(card.name,name,id);assert.equal(card.suit,suit,id);assert.equal(card.rank,rank,id)}
});

test('트럼프 페인트는 비트럼프면 무늬만 덧칠하고 원래 트럼프면 대신 숫자 +4다',()=>{
  const nonTrump=run('core.paint',{currentTrump:'H'});
  assert.deepEqual(nonTrump.calls,[['set_next_trick_suit_to_trump',undefined]]);
  const alreadyTrump=run('core.paint',{currentTrump:'D'});
  assert.deepEqual(alreadyTrump.calls,[['increase_next_trick_rank',4]]);
});

test('랭크 부스트는 단순 기준 카드로 적용 숫자 +3만 준다',()=>{
  assert.deepEqual(run('core.plus2').calls,[['increase_next_trick_rank',3]]);
});

test('정공법은 바로 이전 슬롯이 순수 카드일 때만 +4이고 1번 슬롯은 발동하지 않는다',()=>{
  const pure=Cards.createCardRecord({suit:'C',rank:10,metadata:{uid:'pure-slot'}});
  const effect=Cards.createDefinitionCard('core.scout',{uid:'effect-slot'});
  assert.deepEqual(run('core.pureboost',{slots:[{card:pure}],slotIndex:1}).calls,[['increase_next_trick_rank',4]]);
  assert.deepEqual(run('core.pureboost',{slots:[{card:effect}],slotIndex:1}).calls,[]);
  assert.deepEqual(run('core.pureboost',{slots:[],slotIndex:0}).calls,[]);
});

test('가짜 신분증은 이전 슬롯의 쇼다운 숫자만 복사하고 1번 슬롯에서는 무효다',()=>{
  const previous=Cards.createCardRecord({suit:'C',rank:8,metadata:{uid:'previous'}});previous.showdownRank=6;
  const copied=run('core.fakeid',{slots:[{card:previous}],slotIndex:1});
  assert.equal(copied.card.showdownRank,6);
  assert.equal(copied.card.suit,'H');
  const first=run('core.fakeid',{slots:[],slotIndex:0});
  assert.equal(first.card.showdownRank,undefined);
  assert.equal(first.count,0);
});

test('더블다운은 칩 1을 실제 소비한 경우에만 +5와 승리 칩 +2가 열린다',()=>{
  const card=Cards.createDefinitionCard('core.double',{uid:'double'});
  const battle={setIndex:1,trick:2,chip:2,history:Effects.newHistory(),chipEconomy:{balance:2,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}};
  const calls=[];const context={card,battle,history:battle.history,setHistory:{wins:0},printedRank:2,printedSuit:'H',perform:(action,value)=>calls.push([action,value])};
  assert.equal(Effects.run('on_play',card,context),2);
  assert.equal(battle.chip,1);assert.equal(battle.chipEconomy.balance,1);assert.equal(battle.history.chipsSpent,1);
  assert.deepEqual(calls,[['increase_next_trick_rank',5]]);
  calls.length=0;assert.equal(Effects.run('on_trick_win',card,context),1);assert.deepEqual(calls,[['gain_chips',2]]);

  const empty=Cards.createDefinitionCard('core.double',{uid:'double-empty'});const noChip={setIndex:1,trick:2,chip:0,history:Effects.newHistory(),chipEconomy:{balance:0,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}};
  const none=[];const blocked={card:empty,battle:noChip,history:noChip.history,setHistory:{wins:0},perform:(a,v)=>none.push([a,v])};
  assert.equal(Effects.run('on_play',empty,blocked),0);assert.equal(Effects.run('on_trick_win',empty,blocked),0);assert.deepEqual(none,[]);
});

test('세이프가드는 즉시 보호막 3, 패배하면 보호막 3을 추가로 준다',()=>{
  assert.deepEqual(run('core.barrier').calls,[['gain_shield',3]]);
  assert.deepEqual(run('core.barrier',{trigger:'on_trick_loss'}).calls,[['gain_shield',3]]);
  assert.equal(run('core.barrier',{trigger:'on_trick_win'}).calls.length,0);
});

test('정공법 정의와 설명은 직전 쇼다운 슬롯 관계를 명시한다',()=>{
  const card=Cards.CARD_DEFINITION_BY_ID['core.pureboost'];
  assert.deepEqual(card.effects,[{trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'previous_showdown_slot_is_pure',duration:'trick'}]);
  assert.match(card.description,/바로 이전 쇼다운 슬롯/);assert.match(card.description,/\+4/);
});

test('브라우저는 cards.js보다 먼저 마이그레이션 원본 정의를 부트스트랩한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-packs','index.js'),'utf8');
  const migration=source.indexOf('tactic-card-migration.js'),definitions=source.indexOf('migrated-tactic-cards.js');
  assert.ok(migration>=0);assert.ok(definitions>migration);assert.match(source,/data-trick-common-card-bootstrap/);
});
