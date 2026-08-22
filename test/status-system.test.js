const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CombatEffects=require('../combat-effects.js');
const StatusSystem=require('../status-system.js');

function state(){
  return{
    statuses:{player:{shield:4,bleed:2,regen:0,vulnerable:0,poison:0},enemy:{shield:0,bleed:3,regen:0,vulnerable:0,poison:0}},
    reservations:[{id:'next-hit',label:'다음 승리 피해 6'}]
  };
}

test('6-2B 상태 표시 레지스트리는 보호막/출혈/재생/취약/중독 계약을 한국어 메타데이터로 감싼다',()=>{
  assert.equal(StatusSystem.STATUS_UI_VERSION,'6-2B');
  const catalog=StatusSystem.statusCatalog();
  assert.deepEqual(catalog.map(item=>item.id),['shield','bleed','regen','vulnerable','poison']);
  assert.deepEqual(catalog.map(item=>item.label),['보호막','출혈','재생','취약','중독']);
  assert.equal(catalog.find(item=>item.id==='shield').implemented,true);
  assert.equal(catalog.find(item=>item.id==='bleed').implemented,true);
  assert.equal(catalog.find(item=>item.id==='regen').implemented,true);
  assert.equal(catalog.find(item=>item.id==='vulnerable').implemented,true);
  assert.equal(catalog.find(item=>item.id==='poison').implemented,false);
});

test('상태 HUD 모델은 플레이어와 적 상태를 구분하고 0인 상태는 숨긴다',()=>{
  const model=StatusSystem.statusHudModel(state());
  assert.deepEqual(model.player.map(item=>[item.id,item.value]),[['shield',4],['bleed',2]]);
  assert.deepEqual(model.enemy.map(item=>[item.id,item.value]),[['bleed',3]]);
  assert.equal(model.reservations.length,1);
  assert.equal(model.reservations[0].label,'다음 승리 피해 6');
});

test('재생과 취약은 활성 상태일 때 기존 상태 HUD 경로에 표시된다',()=>{
  const current=state();current.statuses.player.regen=2;current.statuses.enemy.vulnerable=3;
  const model=StatusSystem.statusHudModel(current);
  assert(model.player.some(item=>item.id==='regen'&&item.label==='재생'&&item.value===2&&item.chipClass==='green'));
  assert(model.enemy.some(item=>item.id==='vulnerable'&&item.label==='취약'&&item.value===3&&item.chipClass==='violet'));
});

test('규칙 미확정 중독은 값이 있어도 기본 전투 HUD에 노출하지 않는다',()=>{
  const statuses={player:{shield:0,bleed:0,regen:0,vulnerable:0,poison:5},enemy:{shield:0,bleed:0,regen:0,vulnerable:0,poison:0}};
  assert.deepEqual(StatusSystem.activeStatusEntries(statuses,'player'),[]);
  const debug=StatusSystem.activeStatusEntries(statuses,'player',{includeInactive:true});
  assert.equal(debug.length,1);
  assert.equal(debug[0].id,'poison');
  assert.equal(debug[0].implemented,false);
});

test('보호막과 출혈 설명은 실제 현재 발동 시점과 감소 규칙을 반영한다',()=>{
  const shield=StatusSystem.statusDetail('shield',{value:4});
  const bleed=StatusSystem.statusDetail('bleed',{actor:'enemy',value:3});
  assert.match(shield.description,/피해/);
  assert.equal(shield.timing,'피해를 받을 때');
  assert.match(bleed.description,/트릭 종료/);
  assert.match(bleed.description,/1 감소/);
  assert.equal(bleed.actor,'enemy');
});

test('재생과 취약 설명은 실제 발동과 소모 규칙을 반영한다',()=>{
  const regen=StatusSystem.statusDetail('regen',{value:2});
  const vulnerable=StatusSystem.statusDetail('vulnerable',{actor:'enemy',value:3});
  assert.match(regen.description,/회복/);
  assert.match(regen.description,/1 감소/);
  assert.equal(regen.timing,'트릭 종료');
  assert.match(vulnerable.description,/보호막 계산 전에/);
  assert.match(vulnerable.description,/모두 사라진다/);
  assert.equal(vulnerable.timing,'다음 피해를 받을 때');
  assert.equal(vulnerable.dispellable,true);
});

test('6-2B도 중독의 전투 규칙을 임의로 확정하지 않는다',()=>{
  assert.equal(CombatEffects.STATUS_DEFINITIONS.poison.implemented,false);
  assert.equal(CombatEffects.STATUS_DEFINITIONS.poison.trigger,null);
  assert.equal(StatusSystem.statusDefinition('poison').stateLabel,undefined);
  assert.equal(StatusSystem.statusDetail('poison').stateLabel,'규칙 미확정');
});

test('상태 칩은 현재 값과 대상을 표시하고 상세 설명을 title로 제공한다',()=>{
  const player=StatusSystem.chipHtml(StatusSystem.statusHudModel(state()).player[0]);
  const enemy=StatusSystem.chipHtml(StatusSystem.statusHudModel(state()).enemy[0],{enemy:true});
  assert.match(player,/보호막 4/);
  assert.match(player,/data-status-id="shield"/);
  assert.match(enemy,/적 출혈 3/);
  assert.match(enemy,/data-status-actor="enemy"/);
});

test('예약 효과는 상태와 섞어 계산하지 않고 별도 HUD 항목으로 유지한다',()=>{
  const model=StatusSystem.statusHudModel(state());
  assert.equal(model.player.some(item=>item.kind==='reservation'),false);
  assert.equal(model.enemy.some(item=>item.kind==='reservation'),false);
  assert.equal(model.reservations[0].kind,'reservation');
});

test('브라우저 부트스트랩은 기존 AI/필드/유물 뒤에 상태 런타임을 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/loadScript\('run-fields\.js','trick-run-fields-runtime'\)/);
  assert.match(source,/loadScript\('relics\.js','trick-relic-system-runtime'\)/);
  assert.match(source,/loadScript\('status-system\.js','trick-status-system-runtime'\)/);
  assert.match(source,/if\(root\.RelicSystem\)\{loadStatusSystem\(\);return;\}/);
});
