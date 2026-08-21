const test=require('node:test');
const assert=require('node:assert/strict');
const Effects=require('../effects.js');
const Cards=require('../cards.js');
const TacticEffects=require('../tactic-effects.js');

function run(card,trigger,overrides={}){
  const calls=[];
  const context={
    card,
    enemyCard:{suit:'H',rank:8},
    history:Effects.newHistory(),
    mods:{paint:false,plus:0,reverse:false,double:false},
    effectiveRank:card.rank,
    slotIndex:0,
    perform:(...args)=>calls.push(args),
    ...overrides
  };
  const executed=Effects.run(trigger,card,context);
  return{calls,executed};
}

test('네임드 분류 없이도 일반 카드가 직접 effects를 가지면 공통 엔진에서 실행된다',()=>{
  const card=Cards.createCardRecord({
    suit:'H',rank:4,cardId:'custom.guard',
    effects:[{trigger:'on_play',action:'gain_shield',value:2,duration:'trick'}],
    metadata:{uid:'card-guard'}
  });
  assert.equal(card.named,null);
  assert.equal(card.definition,null);
  assert.equal(Effects.cardEffectList(card),card.effects);
  const result=run(card,'on_play');
  assert.equal(result.executed,1);
  assert.deepEqual(result.calls[0].slice(0,2),['gain_shield',2]);
});

test('직접 effects는 레거시 named 효과보다 우선하는 정규 효과 소스다',()=>{
  const card={
    uid:'direct-first',suit:'S',rank:7,
    effects:[{trigger:'on_play',action:'heal_player',value:1,duration:'trick'}],
    named:{id:'legacy.test',effects:[{trigger:'on_play',action:'damage_enemy',value:99,duration:'trick'}]}
  };
  const result=run(card,'on_play');
  assert.deepEqual(result.calls.map(call=>call.slice(0,2)),[['heal_player',1]]);
});

test('기존 네임드 카드는 일반 카드 레코드로 생성해도 효과와 렌더 호환 alias를 유지한다',()=>{
  const card=Cards.createDefinitionCard('pack01.phoenix',{uid:'phoenix-instance'});
  assert.equal(card.cardId,'pack01.phoenix');
  assert.equal(card.definition.id,'pack01.phoenix');
  assert.equal(card.named.id,'pack01.phoenix');
  assert.notStrictEqual(card.effects,card.definition.effects);
  const result=run(card,'on_trick_win');
  assert.equal(result.executed,1);
  assert.deepEqual(result.calls[0].slice(0,2),['heal_player',4]);
});

test('레거시 named 전용 카드도 마이그레이션 동안 계속 동작한다',()=>{
  const card={suit:'S',rank:7,named:{id:'legacy.card',effects:[{trigger:'on_play',action:'gain_chips',value:1,duration:'trick'}]}};
  const result=run(card,'on_play');
  assert.equal(result.executed,1);
  assert.deepEqual(result.calls[0].slice(0,2),['gain_chips',1]);
});

test('attachEffects는 원본 카드와 인쇄값을 mutate하지 않는다',()=>{
  const original={uid:'base-1',suit:'D',rank:8,printedSuit:'D',printedRank:8};
  const attached=Effects.attachEffects(original,[{trigger:'on_play',action:'gain_chips',value:2,duration:'trick'}],{cardId:'custom.coin'});
  assert.equal(original.effects,undefined);
  assert.equal(original.cardId,undefined);
  assert.equal(attached.cardId,'custom.coin');
  assert.equal(attached.printedSuit,'D');
  assert.equal(attached.printedRank,8);
  attached.effects[0].value=9;
  assert.equal(Effects.attachEffects(original,[{trigger:'on_play',action:'gain_chips',value:2,duration:'trick'}]).effects[0].value,2);
});

test('효과 context는 카드 종류와 무관하게 owner id와 instance id를 제공한다',()=>{
  let owner;
  Effects.handlers.capture_owner=context=>{owner=context.owner};
  const card=Cards.createCardRecord({
    suit:'C',rank:6,cardId:'custom.capture',
    effects:[{trigger:'on_play',handler:'capture_owner',duration:'trick'}],
    metadata:{uid:'instance-42'}
  });
  try{Effects.run('on_play',card,{perform:()=>{}})}finally{delete Effects.handlers.capture_owner}
  assert.deepEqual(owner,{type:'card',id:'custom.capture',instanceId:'instance-42'});
});

test('효과 정의 검증은 잘못된 trigger/action/condition/duration을 조기에 찾는다',()=>{
  const errors=Effects.validateEffectList([
    {trigger:'not_a_trigger',action:'not_an_action',condition:'not_a_condition',duration:'forever'},
    {trigger:'on_play',duration:'trick'}
  ],{requireTrigger:true,requireDuration:true});
  assert(errors.some(error=>error.includes('unknown trigger')));
  assert(errors.some(error=>error.includes('unknown action')));
  assert(errors.some(error=>error.includes('unknown condition')));
  assert(errors.some(error=>error.includes('unknown duration')));
  assert(errors.some(error=>error.includes('missing action or handler')));
});

test('52장 기본 카드 슬롯은 유지하면서 3-1 효과 카드 6장만 일반 카드 정의를 가진다',()=>{
  const cards=Cards.createBaseCardSlots();
  assert.equal(cards.length,52);
  const migrated=cards.filter(card=>card.definition?.migrationStage==='3-1');
  const plain=cards.filter(card=>!card.definition);
  assert.equal(migrated.length,6);
  assert.equal(plain.length,46);
  assert(migrated.every(card=>card.named===null&&card.cardId?.startsWith('core.')&&card.effects.length>0));
  assert(plain.every(card=>card.named===null&&card.cardId===null&&card.effects.length===0));
  assert(cards.every(card=>card.printedSuit===card.suit&&card.printedRank===card.rank));
});

test('공통 history는 일반 효과 통계를 추가하면서 레거시 전술 통계를 유지한다',()=>{
  const history=Effects.newHistory();
  assert.equal(history.effectsUsed,false);
  assert.equal(history.effectUseCount,0);
  assert.equal(history.tacticsUsed,false);
  assert.equal(history.tacticUseCount,0);
});

test('전술 시스템 완전 제거는 카드 숫자/무늬와 의존 카드 재설계 전까지 차단 상태로 명시된다',()=>{
  const status=TacticEffects.migrationStatus();
  assert.equal(status.ready,false);
  assert.equal(status.tacticIds.length,12);
  assert(status.blockers.missingCardIdentity);
  assert(status.blockers.startingPackages);
  assert(status.blockers.namedDependencies);
  assert.deepEqual(status.dependentCardIds,['pack01.golden_hand','pack01.recursive_function']);
});
