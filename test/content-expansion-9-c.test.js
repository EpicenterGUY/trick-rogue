const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const StatusSystem=require('../status-system.js');
const RelicSystem=require('../relics.js');
const Contracts=require('../contracts.js');
const TrumpFields=require('../trump-fields.js');
const RunFields=require('../run-fields.js');
const Content=require('../content-expansion-9-c.js');

function battleState(){return{type:'battle',setIndex:1,trick:1,phase:'trick',enemy:{hp:40,maxHp:40},field:null,fieldHistory:[],deck:[],hand:[],slots:[],maxHandSize:3,statuses:{player:{},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}}}

test('9-C는 유물 4종·계약 묶음 3종·상태 2종·필드 2종을 기존 레지스트리에 추가한다',()=>{
  const summary=Content.catalogSummary();
  assert.deepEqual(summary.added,{relics:4,offerings:3,statuses:2,fields:2});
  assert.deepEqual(summary.totals,{relics:12,contracts:6,taboos:6,offerings:6,statuses:7,fields:8});
  assert.deepEqual(Content.validateContent(),[]);
});

test('원본 도장과 순수 왕관은 최신 원래값·순수 카드 조건을 공통 효과 엔진으로 사용한다',()=>{
  const original=RelicSystem.relicDefinition('original_stamp'),pure=RelicSystem.relicDefinition('pure_crown');
  assert.equal(original.effects[0].condition,'printed_equals_trick');
  assert.equal(original.effects[0].action,'gain_chips');
  assert.equal(pure.effects[0].condition,'pure_card_in_showdown');
  assert.equal(pure.effects[0].action,'showdown_power');
  assert.deepEqual(RelicSystem.validateRelicDefinition(original,'original_stamp'),[]);
  assert.deepEqual(RelicSystem.validateRelicDefinition(pure,'pure_crown'),[]);
});

test('잿빛 바늘과 추적 표찰은 새 상태를 범용 apply_status 경로로 부여한다',()=>{
  const scar=RelicSystem.relicDefinition('ash_needle').effects[0],mark=RelicSystem.relicDefinition('hunter_tag').effects[0];
  assert.equal(scar.action,'apply_status');assert.deepEqual(scar.value,{target:'enemy',statusId:'scar',amount:1});
  assert.equal(mark.action,'apply_status');assert.deepEqual(mark.value,{target:'enemy',statusId:'mark',amount:2});
});

test('흉터는 최대 2까지 쌓이고 트릭 종료마다 감소 없이 지속 피해를 준다',()=>{
  const statuses={player:{},enemy:{}};CombatEffects.addStatus(statuses,'enemy','scar',3);assert.equal(CombatEffects.getStatusValue(statuses,'enemy','scar'),2);
  const dealt=[];const events=CombatEffects.resolveStatusTrigger({statuses,actor:'enemy',trigger:'on_trick_end',damage:(_actor,value,meta)=>{dealt.push({value,meta});return value}});
  assert.equal(events.length,1);assert.equal(dealt[0].value,2);assert.equal(dealt[0].meta.statusId,'scar');assert.equal(CombatEffects.getStatusValue(statuses,'enemy','scar'),2);
});

test('표식은 최대 5까지 쌓이고 다음 양수 피해를 증폭한 뒤 모두 사라진다',()=>{
  const statuses={player:{},enemy:{}};CombatEffects.addStatus(statuses,'enemy','mark',9);assert.equal(CombatEffects.getStatusValue(statuses,'enemy','mark'),5);
  const damageEvent={amount:12,cancelled:false};CombatEffects.resolveStatusTrigger({statuses,actor:'enemy',trigger:'before_damage',damageEvent});
  assert.equal(damageEvent.amount,17);assert.equal(CombatEffects.getStatusValue(statuses,'enemy','mark'),0);
});

test('흉터와 표식은 한국어 상태 HUD 메타데이터로 노출된다',()=>{
  assert.equal(StatusSystem.statusDefinition('scar').label,'흉터');
  assert.equal(StatusSystem.statusDefinition('mark').label,'표식');
  const state=battleState();state.statuses.enemy.scar=1;state.statuses.enemy.mark=2;
  const entries=StatusSystem.statusHudModel(state).enemy;
  assert(entries.some(entry=>entry.id==='scar'&&entry.value===1));
  assert(entries.some(entry=>entry.id==='mark'&&entry.value===2));
});

test('강 건너기는 저장된 리버 적중에 +8, 후보가 있었던 실패에 -3을 서로 배타적으로 적용한다',()=>{
  const run={};Contracts.acquireOffering(run,'river_crossing');
  let score={value:20},battle={setIndex:1,setHistory:{wins:0,losses:0,draws:0},riverSnapshot:{active:true},riverHit:{active:true}};
  assert.equal(Contracts.resolveShowdown(run,{battle,score}).delta,8);assert.equal(score.value,28);
  score={value:20};battle={...battle,riverHit:{active:false}};
  assert.equal(Contracts.resolveShowdown(run,{battle,score}).delta,-3);assert.equal(score.value,17);
});

test('압도적 패와 동점 장부는 세트 승패·무승부 기록만으로 판정한다',()=>{
  let run={};Contracts.acquireOffering(run,'dominant_hand');
  let score={value:20};assert.equal(Contracts.resolveShowdown(run,{battle:{setHistory:{wins:4,losses:1,draws:0}},score}).delta,8);
  score={value:20};assert.equal(Contracts.resolveShowdown(run,{battle:{setHistory:{wins:2,losses:2,draws:0}},score}).delta,-3);
  run={};Contracts.acquireOffering(run,'draw_ledger');score={value:20};assert.equal(Contracts.resolveShowdown(run,{battle:{setHistory:{wins:2,losses:2,draws:1}},score}).delta,5);
  score={value:20};assert.equal(Contracts.resolveShowdown(run,{battle:{setHistory:{wins:3,losses:2,draws:0}},score}).delta,-2);
});

test('과열 테이블은 손패 2장 대신 트럼프 +4를 주고 자동 승리 규칙은 만들지 않는다',()=>{
  const state=battleState();TrumpFields.setField(state,'loaded_table');
  assert.equal(state.maxHandSize,2);assert.equal(TrumpFields.trumpBonusForState(state),4);
  const result=TrumpFields.compareTrickWithRules({suit:'S',rank:2},{suit:'H',rank:8},'S',state);
  assert.equal(result,-1);
});

test('넓은 테이블은 트럼프 +2로 낮추는 대신 기본 최대 손패를 4장으로 늘린다',()=>{
  const state=battleState();TrumpFields.setField(state,'wide_table');
  assert.equal(state.maxHandSize,4);assert.equal(TrumpFields.trumpBonusForState(state),2);
});

test('9-C 필드는 보유 후 다음 전투 한 번에 예약되며 이미 가진 필드는 신규 설계 선택지에서 빠진다',()=>{
  const run={};assert.deepEqual(Content.availableFieldOfferIds(run),['loaded_table','wide_table']);
  const acquired=Content.acquireFieldOffer(run,'loaded_table',{source:'event:e1'});assert.equal(acquired.queued,true);
  assert.equal(run.fieldLoadout.queuedFieldId,'loaded_table');assert.deepEqual(Content.availableFieldOfferIds(run),['wide_table']);
  const state=battleState();const applied=RunFields.consumeQueuedFieldForBattle(run,state);assert.equal(applied.applied,true);assert.equal(state.field.id,'loaded_table');assert.equal(run.fieldLoadout.queuedFieldId,null);
});

test('이벤트에서 필드를 고르면 기존 completeNode 흐름으로 이벤트를 끝낸다',()=>{
  const node={id:'e9',type:'event'},root={run:{map:[node]},completed:0,sfx(){},completeNode(got){assert.equal(got,node);this.completed++}};
  const result=Content.takeFieldOfferFromEvent(root,'wide_table','e9');assert.equal(result.ok,true);assert.equal(root.completed,1);assert.equal(root.run.fieldLoadout.queuedFieldId,'wide_table');
  assert.deepEqual(Content.takeFieldOfferFromEvent(root,'wide_table','e9'),{ok:false,reason:'unavailable'});
});

test('9-C 콘텐츠는 폐기된 전술 덱·트럼프 자동 승리·상시 무늬 우세를 재도입하지 않는다',()=>{
  const sources=['content-expansion-9-c.js','relics.js','contracts.js','combat-effects.js','trump-fields.js'].map(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
  assert.doesNotMatch(sources,/tacticDeck|tacticHand|advantageMargin|showdownAdvantagePower/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','content-expansion-9-c.js'),'utf8'),/autoTrumpWin|trumpPriority/);
});

test('전투 레이아웃 로더는 9-B 뒤 9-C 콘텐츠 런타임도 자동 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');
  assert.match(source,/enemy-content-9-b\.js/);assert.match(source,/content-expansion-9-c\.js/);
  assert(source.indexOf('loadEnemyContent(doc)')<source.indexOf('loadContentExpansion(doc)'));
});