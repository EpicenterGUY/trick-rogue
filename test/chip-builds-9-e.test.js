const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const ChipEconomy=require('../chip-economy.js');
const BuildSynergySystem=require('../build-synergies.js');
const ChipBuilds=require('../chip-builds-9-e.js');

function chipCard(id,{generator=true,spender=false}={}){
  const effects=[];
  if(generator)effects.push({trigger:'on_trick_win',action:'gain_chips',value:1,duration:'trick'});
  if(spender)effects.push({trigger:'on_play',condition:'chips_spent',action:'gain_shield',value:1,duration:'battle'});
  return{id,effects};
}
function runWithChipCards(count){return{deck:Array.from({length:count},(_,i)=>chipCard(`chip-${i}`,{generator:i!==count-1,spender:i===count-1}))}}

ChipBuilds.registerChipConditions();

test('9-E는 칩 운용의 네 축을 run 패시브 4종으로 정의한다',()=>{
  assert.deepEqual(Object.keys(ChipBuilds.CHIP_BUILD_DEFINITIONS),['working_capital','full_stack_dividend','exchange_receipt','turnover_bonus']);
  assert.deepEqual(ChipBuilds.validateBuildRegistry(),[]);
  for(const definition of Object.values(ChipBuilds.CHIP_BUILD_DEFINITIONS)){
    assert.equal(definition.effectOwnerType,'passive');
    assert.ok(definition.effects.length>=1);
    assert.ok(definition.effects.every(effect=>effect.duration==='run'));
  }
});

test('칩 연계 카드는 칩 생성 또는 칩 소비 보상 효과를 실제 effects에서 판정한다',()=>{
  assert.deepEqual(ChipBuilds.chipCardRoles(chipCard('gain')),{generator:true,spender:false,linked:true});
  assert.deepEqual(ChipBuilds.chipCardRoles(chipCard('spend',{generator:false,spender:true})),{generator:false,spender:true,linked:true});
  assert.equal(ChipBuilds.isChipLinkedCard({id:'plain',effects:[{trigger:'on_play',action:'gain_shield',value:2,duration:'battle'}]}),false);
  const nested={definition:{effects:[{trigger:'on_play',condition:'chips_spent',action:'gain_shield',value:2,duration:'battle'}]}};
  assert.equal(ChipBuilds.isChipLinkedCard(nested),true);
});

test('활성 임계치는 칩 연계 카드 3/4/4/5장으로 단계적으로 열린다',()=>{
  assert.deepEqual(ChipBuilds.activeBuildIds(runWithChipCards(2)),[]);
  assert.deepEqual(ChipBuilds.activeBuildIds(runWithChipCards(3)),['working_capital']);
  assert.deepEqual(ChipBuilds.activeBuildIds(runWithChipCards(4)),['working_capital','full_stack_dividend','exchange_receipt']);
  assert.deepEqual(ChipBuilds.activeBuildIds(runWithChipCards(5)),['working_capital','full_stack_dividend','exchange_receipt','turnover_bonus']);
});

test('풀스택 조건은 현재 칩 5개에서만 열리고 기본 최대치 5를 바꾸지 않는다',()=>{
  assert.equal(ChipEconomy.CHIP_CAP,5);
  assert.equal(ChipEconomy.HAND_EXCHANGE_COST,2);
  const battle={chipEconomy:{balance:4},chip:4,history:{chipsSpent:0}};
  assert.equal(CardEffects.conditions.chips_at_least({battle},{conditionValue:5}),false);
  battle.chipEconomy.balance=5;battle.chip=5;
  assert.equal(CardEffects.conditions.chips_at_least({battle},{conditionValue:5}),true);
  assert.equal(ChipEconomy.grantChips(battle,99).after,5);
});

test('교환 영수증 조건은 실제 2칩 손패 교환을 쓴 바로 그 트릭에만 참이다',()=>{
  const outgoing={uid:'out'},incoming={uid:'in'};
  const battle={phase:'trick',setIndex:1,trick:2,hand:[outgoing],deck:[incoming],discard:[],history:{chipsSpent:0,cardsDrawn:0}};
  ChipEconomy.initializeBattleChipState(battle,{balance:2});
  assert.equal(ChipEconomy.exchangeHandCard(battle,'out').ok,true);
  assert.equal(CardEffects.conditions.hand_exchange_used_this_trick({battle,setIndex:1,trick:2}),true);
  assert.equal(CardEffects.conditions.hand_exchange_used_this_trick({battle,setIndex:1,trick:3}),false);
  assert.equal(battle.history.chipsSpent,2);
});

test('회전 보너스 조건은 전투 누적 칩 소비 4개부터 열린다',()=>{
  const battle={history:{chipsSpent:3}};
  assert.equal(CardEffects.conditions.chips_spent_at_least({battle},{conditionValue:4}),false);
  battle.history.chipsSpent=4;
  assert.equal(CardEffects.conditions.chips_spent_at_least({battle},{conditionValue:4}),true);
});

test('운영 자금은 기존 칩 경제 경로를 사용하므로 세트 시작 보너스도 5에서 넘치지 않는다',()=>{
  const battle={history:{chipsSpent:0}};ChipEconomy.initializeBattleChipState(battle,{balance:5});
  const owner=ChipBuilds.makeBuildOwner('working_capital');
  CardEffects.runOwner('on_set_start',owner,{battle,perform(action,value){if(action==='gain_chips')ChipEconomy.grantChips(battle,value,{source:'9-E'})}});
  assert.equal(battle.chip,5);
  battle.chipEconomy.balance=3;battle.chip=3;
  CardEffects.runOwner('on_set_start',owner,{battle,effectChain:CardEffects.createEffectChain(),perform(action,value){if(action==='gain_chips')ChipEconomy.grantChips(battle,value,{source:'9-E'})}});
  assert.equal(battle.chip,4);
});

test('풀스택 배당 +6과 회전 보너스 +8은 조건을 모두 만족하면 같은 쇼다운에서 합산된다',()=>{
  const runState=runWithChipCards(5),owners=ChipBuilds.activeBuildOwners(runState);
  const battle={chipEconomy:{balance:5},chip:5,history:{chipsSpent:4}};
  const score={value:20};
  CardEffects.dispatchOwners('on_showdown_score',owners,{battle,history:battle.history,score,perform(action,value){if(action==='showdown_power')score.value+=value}});
  assert.equal(score.value,34);
});

test('칩 빌드 패시브는 기존 CombatEffects 소유자 목록에 중복 없이 합쳐진다',()=>{
  ChipBuilds.installCombatOwnerAdapter();
  const runState=runWithChipCards(5),owners=CombatEffects.activeEffectOwners({hand:[],slots:[]},runState);
  const chipOwners=owners.filter(entry=>String(entry.ownerId||'').startsWith('chip-build:'));
  assert.equal(chipOwners.length,4);
  assert.equal(new Set(chipOwners.map(entry=>entry.ownerId)).size,4);
  ChipBuilds.installCombatOwnerAdapter();
  const again=CombatEffects.activeEffectOwners({hand:[],slots:[]},runState).filter(entry=>String(entry.ownerId||'').startsWith('chip-build:'));
  assert.equal(again.length,4);
});

test('칩 빌드 요약은 덱의 생성/소비 축과 전투의 현재 칩/소비량을 함께 공개한다',()=>{
  const runState={deck:[chipCard('a'),chipCard('b'),chipCard('c'),chipCard('d',{generator:false,spender:true})]};
  const battle={chipEconomy:{balance:3},chip:3,history:{chipsSpent:2}};
  const summary=ChipBuilds.buildSummary(runState,battle);
  assert.equal(summary.deck.chipCards,4);
  assert.equal(summary.deck.generators,3);
  assert.equal(summary.deck.spenders,1);
  assert.equal(summary.count,3);
  assert.deepEqual(summary.battle,{chips:3,spent:2});
});

test('9-E 컴펜디움 브리지는 기존 조합 시너지를 보존하며 칩 시너지 4종을 같은 도감 레지스트리에 노출한다',()=>{
  const before=Object.keys(BuildSynergySystem.SYNERGY_DEFINITIONS).length;
  const bridge=require('../chip-builds-9-e-compendium-bridge.js');
  assert.equal(bridge.install(globalThis),true);
  assert.equal(Object.keys(BuildSynergySystem.SYNERGY_DEFINITIONS).length,before+4);
  const Compendium=require('../compendium-8-h.js');
  const catalog=Compendium.synergyCatalog(runWithChipCards(5));
  for(const name of ['운영 자금','풀스택 배당','교환 영수증','회전 보너스'])assert.ok(catalog.some(item=>item.name===name&&item.owned===true));
  assert.equal(catalog.length,12);
});

test('브라우저 로더는 9-D → 9-E → 도감 순서를 고정하고 9-E가 폐기 규칙을 재도입하지 않는다',()=>{
  const layout=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');
  const chipSource=fs.readFileSync(path.join(__dirname,'..','chip-builds-9-e.js'),'utf8');
  assert.ok(layout.indexOf('pure-synergies-9-d.js')<layout.indexOf('chip-builds-9-e.js'));
  assert.ok(layout.indexOf('chip-builds-9-e-compendium-bridge.js')<layout.indexOf('compendium-8-h.js'));
  for(const forbidden of ['tacticDeck','trumpAutoWin','advantageSuitCount','on_showdown_advantage'])assert.equal(chipSource.includes(forbidden),false);
  assert.equal(ChipEconomy.CHIP_CAP,5);
  assert.equal(ChipEconomy.HAND_EXCHANGE_COST,2);
});
