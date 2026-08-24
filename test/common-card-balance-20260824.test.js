const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const RunStart=require('../run-start-v2.js');

function run(id,slots=[]){
  const card=Cards.createDefinitionCard(id,{uid:`test-${id}`});
  const calls=[];
  const count=Effects.run('on_play',card,{card,slots,history:Effects.newHistory(),perform:(action,value)=>calls.push([action,value])});
  return{card,count,calls};
}

test('공통지역 초반 효과 풀 9장은 그대로 유지한다',()=>{
  assert.deepEqual(RunStart.COMMON_CARD_POOL_IDS,[
    'core.paint','core.plus2','core.draw','core.scout','core.double','core.barrier','core.burn','core.pureboost','core.clean'
  ]);
});

test('숫자 +2는 무조건 +2, 기본에 충실은 선행 순수 슬롯이 있을 때만 +3으로 역할이 갈린다',()=>{
  const plus=run('core.plus2');
  assert.deepEqual(plus.calls,[['increase_next_trick_rank',2]]);

  const noSetup=run('core.pureboost');
  assert.equal(noSetup.count,0);
  assert.deepEqual(noSetup.calls,[]);

  const effectSlot=Cards.createDefinitionCard('core.scout',{uid:'effect-slot'});
  assert.deepEqual(run('core.pureboost',[effectSlot]).calls,[],'효과 카드는 순수 준비물로 세지 않는다');

  const pure=Cards.createCardRecord({suit:'C',rank:10,metadata:{uid:'pure-slot'}});
  assert.equal(Cards.isPureCard(pure),true);
  const setup=run('core.pureboost',[pure]);
  assert.deepEqual(setup.calls,[['increase_next_trick_rank',3]]);
});

test('기본에 충실 정의와 설명은 손패가 아니라 이미 쌓인 쇼다운 순수 카드를 참조한다',()=>{
  const card=Cards.CARD_DEFINITION_BY_ID['core.pureboost'];
  assert.equal(card.suit,'D');
  assert.equal(card.rank,5);
  assert.deepEqual(card.effects,[{trigger:'on_play',action:'increase_next_trick_rank',value:3,condition:'pure_card_in_showdown',duration:'trick'}]);
  assert.match(card.description,/쇼다운 슬롯에 순수 카드가 1장 이상/);
  assert.ok(card.terms.includes('쇼다운'));
  assert.equal(card.terms.includes('손패'),false);
});

test('브라우저는 cards.js보다 먼저 마이그레이션 원본 정의를 부트스트랩한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-packs','index.js'),'utf8');
  const migration=source.indexOf('tactic-card-migration.js');
  const definitions=source.indexOf('migrated-tactic-cards.js');
  assert.ok(migration>=0);
  assert.ok(definitions>migration);
  assert.match(source,/data-trick-common-card-bootstrap/);
});
