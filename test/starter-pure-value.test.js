const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');
const PureSynergy=require('../pure-synergies-9-d.js');

test('공용 스타터의 순수 8/12는 70% 시너지를 시작부터 공짜로 켜지 않는다',()=>{
  const deck=RunStart.buildStarterDeck('common',Cards,{});
  const stats=PureSynergy.pureDeckStats({deck});
  assert.equal(stats.size,12);
  assert.equal(stats.pure,8);
  assert.equal(stats.ratio,8/12);
  assert.deepEqual(PureSynergy.activeSynergyIds({deck}),[]);
});

test('공용 스타터에서 순수 카드 2장을 더 고르면 10/14로 정석 편성과 무첨가 승부가 자연스럽게 열린다',()=>{
  const deck=RunStart.buildStarterDeck('common',Cards,{});
  deck.push(Cards.createCardRecord({suit:'S',rank:10,metadata:{uid:'pure-reward-1'}}));
  deck.push(Cards.createCardRecord({suit:'H',rank:10,metadata:{uid:'pure-reward-2'}}));
  const stats=PureSynergy.pureDeckStats({deck});
  assert.equal(stats.size,14);
  assert.equal(stats.pure,10);
  assert.ok(stats.ratio>=.70);
  assert.deepEqual(PureSynergy.activeSynergyIds({deck}),['classic_line','clean_showdown']);
});

test('기본에 충실과 무첨가는 스타터 지급이 아니라 공통지역 보상에서 발견하는 순수 빌드 연결 카드다',()=>{
  const starterIds=new Set(RunStart.COMMON_STARTER_EFFECT_CARD_IDS);
  const openingIds=new Set(RunStart.COMMON_CARD_POOL_IDS);
  for(const id of ['core.pureboost','core.clean']){
    assert.equal(starterIds.has(id),false,id);
    assert.equal(openingIds.has(id),true,id);
  }
});
