const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const TacticEffects=require('../tactic-effects.js');

const EXPECTED_IDS=['paint','plus2','draw','scout','double','barrier','burn','reverse','pureboost','clean','recolor','fakeid'];

function mockContext(overrides={}){
  const calls=[];
  return Object.assign({
    selectedCard:null,
    perform(action,value,effect){calls.push({action,value,effect})},
    calls
  },overrides);
}

test('레거시 전술 12종이 모두 공통 effect/action 정의를 가진다',()=>{
  assert.deepEqual(Object.keys(TacticEffects.TACTIC_EFFECTS),EXPECTED_IDS);
  assert.deepEqual(TacticEffects.validateDefinitions(),[]);
  for(const [id,definition] of Object.entries(TacticEffects.TACTIC_EFFECTS)){
    assert.ok(Array.isArray(definition.effects),`${id} effects`);
    for(const effect of definition.effects){
      assert.equal(typeof effect.action,'string',`${id} action`);
      assert.ok(CardEffects.ACTIONS.includes(effect.action),`${id} action registry: ${effect.action}`);
    }
  }
});

test('index의 전술 메타데이터와 공통 전술 효과 registry의 ID가 일치한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const start=source.indexOf('const TACTICS=['),end=source.indexOf('];\nconst CHARACTERS=',start);
  assert.ok(start>=0&&end>start,'TACTICS block');
  const ids=[...source.slice(start,end).matchAll(/\{id:'([^']+)'/g)].map(match=>match[1]);
  assert.deepEqual(ids,EXPECTED_IDS);
});

test('공통 runEffectList가 전술의 연속 action을 데이터 순서대로 실행한다',()=>{
  const context=mockContext({selectedCard:{uid:'card-1'}});
  const result=TacticEffects.runTactic('burn',context);
  assert.equal(result.ok,true);
  assert.deepEqual(context.calls.map(call=>[call.action,call.value]),[
    ['discard_selected_card',undefined],
    ['gain_chips',1],
    ['draw_cards',1]
  ]);
});

test('번은 선택 카드가 없으면 비용 처리 전에 공통 requirement에서 차단된다',()=>{
  const context=mockContext();
  const result=TacticEffects.runTactic('burn',context);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'먼저 카드 선택');
  assert.equal(context.calls.length,0);
});

test('페인트/숫자+2/정찰/리버스는 전용 ID 분기 대신 공통 action으로 표현된다',()=>{
  const expected={
    paint:'set_next_trick_suit_to_trump',
    plus2:'increase_next_trick_rank',
    scout:'increase_forecast',
    reverse:'set_reverse_compare'
  };
  for(const [id,action] of Object.entries(expected)){
    const context=mockContext();
    const result=TacticEffects.runTactic(id,context);
    assert.equal(result.ok,true,id);
    assert.equal(context.calls[0].action,action,id);
  }
});

test('쇼다운 변경 전술은 인쇄값 mutation이 아닌 전용 showdown action을 사용한다',()=>{
  assert.equal(TacticEffects.definition('recolor').effects[0].action,'set_last_showdown_suit_to_trump');
  assert.equal(TacticEffects.definition('fakeid').effects[0].action,'increase_last_showdown_rank');
});

test('폐지 예정 순수 전술은 현재 동작을 유지하되 마이그레이션 대상으로 명시한다',()=>{
  assert.equal(TacticEffects.definition('pureboost').needsRework,'pure-unification');
  assert.equal(TacticEffects.definition('clean').needsRework,'pure-unification');
  assert.equal(TacticEffects.definition('double').needsRework,'advantage-v2');
});

test('effects.js는 일반 카드와 전술이 공유하는 effect list 실행기를 제공한다',()=>{
  const calls=[];
  const count=CardEffects.runEffectList([{action:'gain_chips',value:2},{action:'draw_cards',value:1}],{
    perform(action,value){calls.push([action,value])}
  });
  assert.equal(count,2);
  assert.deepEqual(calls,[['gain_chips',2],['draw_cards',1]]);
});
