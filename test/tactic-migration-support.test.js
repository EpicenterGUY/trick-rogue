const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Support=require('../tactic-migration-support.js');
const Effects=require('../effects.js');
const Migration=require('../tactic-card-migration.js');
const Cards=require('../cards.js');

function battleState(overrides={}){
  return{setIndex:1,trick:1,maxHandSize:3,hand:[],deck:[],discard:[],slots:[],nextEnemyPreview:null,...overrides};
}

test('3-2A 턴 계산은 5번째 트릭 다음을 다음 세트 1트릭으로 넘긴다',()=>{
  assert.deepEqual(Support.nextTurn({set:1,trick:1}),{set:1,trick:2});
  assert.deepEqual(Support.nextTurn({set:3,trick:5}),{set:4,trick:1});
  assert.equal(Support.turnKey({set:4,trick:1}),'4:1');
});

test('다음 트릭 한정 손패 한도와 보충 후 추가 드로우 예약은 같은 턴을 가리킨다',()=>{
  const battle=battleState();
  const reservation=Support.grantNextTrickHandCapacity(battle,1);
  assert.deepEqual(reservation,{amount:1,targetSet:1,targetTrick:2});
  assert.equal(Support.effectiveHandCapacity(battle,{set:1,trick:1}),3);
  assert.equal(Support.effectiveHandCapacity(battle,{set:1,trick:2}),4);
  assert.equal(Support.queuedPostRefillDraw(battle,{set:1,trick:2}),1);
  assert.equal(Support.consumePostRefillDraw(battle,{set:1,trick:2}),1);
  assert.equal(Support.queuedPostRefillDraw(battle,{set:1,trick:2}),0);
});

test('다음 트릭 손패 보정은 여러 효과가 겹치면 합산하고 지나간 턴을 정리한다',()=>{
  const battle=battleState({setIndex:2,trick:4});
  Support.grantNextTrickHandCapacity(battle,1);
  Support.grantNextTrickHandCapacity(battle,2);
  assert.equal(Support.effectiveHandCapacity(battle,{set:2,trick:5}),6);
  battle.trick=5;
  Support.pruneTurnSupport(battle,{set:3,trick:1});
  assert.equal(Support.ensureState(battle).handCapacity.length,0);
});

test('2차 손패 대상은 사용 카드 자신과 손패 밖 카드를 거부하고 한 장만 보존한다',()=>{
  const source={uid:'source',definition:{targeting:{zone:'hand',count:1,excludeSelf:true}}};
  const target={uid:'target'},battle=battleState({hand:[source,target]});
  const req=Support.secondaryTargetRequirement(source);
  assert.deepEqual(req,{zone:'hand',count:1,excludeSelf:true});
  Support.beginSecondaryHandTarget(battle,source,req);
  assert.throws(()=>Support.selectSecondaryHandTarget(battle,'source'),/cannot target itself/);
  assert.throws(()=>Support.selectSecondaryHandTarget(battle,'missing'),/must be in hand/);
  assert.strictEqual(Support.selectSecondaryHandTarget(battle,'target'),target);
  assert.strictEqual(Support.secondaryTargetCard(battle),target);
  assert.strictEqual(Support.consumeSecondaryHandTarget(battle),target);
  assert.equal(Support.ensureState(battle).secondaryTarget,null);
});

test('다음 적 카드 선공개 플래그는 현재 미리보기 한 번만 소비한다',()=>{
  const preview={suit:'H',rank:11},battle=battleState({nextEnemyPreview:preview});
  assert.equal(Support.isNextEnemyPreviewRevealed(battle),false);
  assert.strictEqual(Support.revealNextEnemyPreview(battle),preview);
  assert.equal(Support.isNextEnemyPreviewRevealed(battle),true);
  assert.equal(Support.consumeNextEnemyPreviewReveal(battle),true);
  assert.equal(Support.isNextEnemyPreviewRevealed(battle),false);
});

test('우세 개수 조건은 복수 우세를 숫자로 검사하고 상대 우세도 선택할 수 있다',()=>{
  const calls=[];
  const card={uid:'double-test',effects:[{trigger:'on_showdown_score',condition:'advantage_count_at_least',conditionValue:2,action:'showdown_power',value:6}]};
  assert.equal(Effects.run('on_showdown_score',card,{playerAdvantageCount:1,perform:(...args)=>calls.push(args)}),0);
  assert.equal(Effects.run('on_showdown_score',card,{playerAdvantageCount:2,perform:(...args)=>calls.push(args)}),1);
  assert.deepEqual(calls[0].slice(0,2),['showdown_power',6]);
  assert.equal(Effects.conditions.advantage_count_at_least({enemyAdvantages:['S','H']},{conditionValue:2,conditionSide:'enemy'}),true);
});

test('순수 카드 타입 없이 인쇄값과 트릭값 동일 여부를 공통 조건으로 검사한다',()=>{
  const equal={printedRank:5,printedSuit:'D',trickRank:5,trickSuit:'D'};
  const rankChanged={...equal,trickRank:7};
  const suitChanged={...equal,trickSuit:'S'};
  assert.equal(Effects.conditions.printed_equals_trick(equal),true);
  assert.equal(Effects.conditions.unmodified_trick_value(equal),true);
  assert.equal(Effects.conditions.printed_equals_trick(rankChanged),false);
  assert.equal(Effects.conditions.unmodified_trick_value(suitChanged),false);
});

test('3-2A 신규 action과 condition은 공통 효과 validator에서 정식 지원된다',()=>{
  const effects=[
    {trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'},
    {trigger:'on_play',action:'discard_secondary_target',duration:'trick'},
    {trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'},
    {trigger:'on_showdown_score',condition:'advantage_count_at_least',conditionValue:2,action:'showdown_power',value:6,duration:'set'},
    {trigger:'on_trick_win',condition:'printed_equals_trick',action:'gain_chips',value:2,duration:'trick'}
  ];
  assert.deepEqual(Effects.validateEffectList(effects,{requireTrigger:true,requireDuration:true}),[]);
});

test('draw 어댑터는 기존 최대 손패 3을 보존하면서 예약된 다음 트릭만 4장까지 보충한다',()=>{
  const root={CardEffects:Effects};
  root.battle=battleState({hand:[{uid:'a'},{uid:'b'}],deck:[{uid:'c'},{uid:'d'},{uid:'e'}],slots:[{}]});
  root.drawP=function(n=1){while(n--&&root.battle.hand.length<root.battle.maxHandSize&&root.battle.deck.length)root.battle.hand.push(root.battle.deck.pop())};
  Support.grantNextTrickHandCapacity(root.battle,1,{set:1,trick:1});
  assert.equal(Support.installDrawAdapter(root),true);
  root.drawP(3);
  assert.equal(root.battle.hand.length,4);
  assert.equal(root.battle.maxHandSize,3);
  assert.equal(Support.queuedPostRefillDraw(root.battle,{set:1,trick:2}),0);
});

test('정찰 미리보기 어댑터는 공개 중에만 다음 적 카드의 정확한 무늬와 숫자를 보여준다',()=>{
  const root={battle:battleState({nextEnemyPreview:{suit:'H',rank:11}}),suitObj:suit=>({sym:suit==='H'?'♥':'?'}),rankLabel:rank=>rank===11?'J':String(rank)};
  root.forecastText=()=>'?';
  assert.equal(Support.installForecastAdapter(root),true);
  assert.equal(root.forecastText('enemy'),'?');
  Support.revealNextEnemyPreview(root.battle);
  assert.equal(root.forecastText('enemy'),'♥J');
});

test('일반 카드 effect context는 선택된 2차 손패 대상을 효과 실행에 전달할 수 있다',()=>{
  const target={uid:'target'},source={uid:'source',definition:{targeting:{zone:'hand',count:1,excludeSelf:true}}};
  const root={battle:battleState({hand:[source,target]}),effectContext:card=>({card})};
  Support.beginSecondaryHandTarget(root.battle,source);
  Support.selectSecondaryHandTarget(root.battle,'target');
  assert.equal(Support.installEffectContextAdapter(root),true);
  const context=root.effectContext(source);
  assert.strictEqual(context.battle,root.battle);
  assert.strictEqual(context.secondaryTargetCard,target);
  assert.equal(context.secondaryTargetUid,'target');
});

test('남은 6종은 아직 비활성 상태지만 3-2A에서 요구 엔진 기능은 모두 제공된다',()=>{
  assert.equal(Migration.RUNTIME_ACTIVE,false);
  assert.equal(Migration.SUPPORT_STAGE,'3-2A');
  assert.equal(Migration.summary().engineSupported,6);
  for(const id of Migration.BLOCKED_IDS){
    assert.equal(Migration.engineSupportReady(Migration.BY_ID[id]),true,id);
    assert.deepEqual(Migration.unsupportedRequirements(Migration.BY_ID[id]),[],id);
  }
  const activeLegacyIds=new Set(Cards.createBaseCardSlots().flatMap(card=>card.definition?.legacyTacticId?[card.definition.legacyTacticId]:[]));
  for(const id of Migration.BLOCKED_IDS)assert.equal(activeLegacyIds.has(id),false,id);
});

test('effects.js는 브라우저에서 3-2A 지원 런타임을 자동 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','effects.js'),'utf8');
  assert.match(source,/tactic-migration-support\.js/);
  assert.match(source,/loadTacticMigrationSupportRuntime/);
});