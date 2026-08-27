const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const RunFields=require('../run-fields.js');
const FieldUX=require('../run-field-ux.js');

test('M8 필드 UX는 보유 목록과 다음 전투 1칸 예약을 같은 모델로 읽는다',()=>{
  const run={};
  RunFields.acquireField(run,'inversion_zone',{activate:true,source:'event:n1'});
  RunFields.acquireField(run,'resonance_floor',{activate:false,source:'shop:n4'});
  const model=FieldUX.fieldLoadoutModel(run);
  assert.equal(FieldUX.VERSION,'M8-1');
  assert.equal(model.slotCount,1);
  assert.equal(model.ownedCount,2);
  assert.equal(model.queued.id,'inversion_zone');
  assert.equal(model.owned.find(field=>field.id==='inversion_zone').actionLabel,'예약됨');
  assert.equal(model.owned.find(field=>field.id==='resonance_floor').actionLabel,'교체 예약');
});

test('맵 필드 버튼 동작은 보유 필드만 교체 예약하고 렌더를 갱신한다',()=>{
  const root={run:{},renderCount:0,sfxLog:[],renderMap(){this.renderCount++},sfx(name){this.sfxLog.push(name)}};
  RunFields.acquireField(root.run,'inversion_zone',{activate:true,source:'event:n1'});
  RunFields.acquireField(root.run,'resonance_floor',{activate:false,source:'shop:n4'});
  const result=FieldUX.queueOwnedField(root,'resonance_floor');
  assert.equal(result.changed,true);
  assert.equal(result.replaced,true);
  assert.equal(root.run.fieldLoadout.queuedFieldId,'resonance_floor');
  assert.equal(root.renderCount,1);
  assert.deepEqual(root.sfxLog,['reward']);
  const cleared=FieldUX.clearQueuedField(root);
  assert.equal(cleared.changed,true);
  assert.equal(root.run.fieldLoadout.queuedFieldId,null);
  assert.equal(root.renderCount,2);
});

test('획득 UI 상태는 신규/보유/예약/교체를 구분한다',()=>{
  const run={};RunFields.ensureRunFieldState(run);
  assert.equal(FieldUX.offerStatus(run,'inversion_zone'),'신규 보유 · 다음 전투 예약');
  RunFields.acquireField(run,'inversion_zone',{activate:true,source:'event:n1'});
  assert.equal(FieldUX.offerStatus(run,'inversion_zone'),'보유 중 · 예약됨');
  assert.equal(FieldUX.offerStatus(run,'resonance_floor'),'신규 보유 · 교체 예약');
  RunFields.acquireField(run,'resonance_floor',{activate:false,source:'shop:n4'});
  assert.equal(FieldUX.offerStatus(run,'resonance_floor'),'보유 중 · 교체 예약');
  RunFields.activateField(run,null,{source:'manual:test'});
  assert.equal(FieldUX.offerStatus(run,'resonance_floor'),'보유 중 · 다음 전투 예약');
});

test('전투 설치 모델은 실제 소비된 플레이어 필드와 출처만 설명한다',()=>{
  const run={};RunFields.acquireField(run,'resonance_floor',{activate:true,source:'shop:n4'});
  const battle={type:'battle',setIndex:1,trick:1,phase:'trick',enemy:{hp:12,maxHp:12},hand:[],slots:[],bossRules:[],field:null,chip:0,statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}},reservations:[],setHistory:{wins:0,losses:0,draws:0}};
  RunFields.consumeQueuedFieldForBattle(run,battle);
  const model=FieldUX.fieldInstallationModel(battle);
  assert.equal(model.id,'resonance_floor');
  assert.equal(model.label,'과충전 구역');
  assert.equal(model.source.type,'shop');
  assert.equal(FieldUX.sourceLabel(model.source),'상점');
  assert.equal(run.fieldLoadout.queuedFieldId,null);
});

test('적 행동 부트스트랩은 run-fields 다음에 M8 UX를 로드한 뒤 후속 런타임으로 진행한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/function loadRunFieldUx\(\)/);
  assert.match(source,/loadScript\('run-field-ux\.js','trick-run-field-ux-runtime'\)/);
  assert.match(source,/if\(root\.RunFields\)\{loadRunFieldUx\(\);return;\}/);
  assert.match(source,/loadScript\('run-fields\.js','trick-run-fields-runtime'\)/);
});

test('M8 브라우저 UI 계약은 보유/예약/설치용 실제 클릭 표식을 가진다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','run-field-ux.js'),'utf8');
  assert.match(source,/data-run-field-owned/);
  assert.match(source,/data-run-field-queue/);
  assert.match(source,/data-run-field-slot/);
  assert.match(source,/data-run-field-installation/);
  assert.match(source,/교체 예약/);
  assert.match(source,/플레이어 필드 설치/);
});
