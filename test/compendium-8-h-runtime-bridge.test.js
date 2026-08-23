const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Bridge=require('../compendium-8-h-runtime-bridge.js');

test('8-H 필드 브리지는 실제 fieldLoadout 상태를 도감 형식으로 읽는다',()=>{
  const run={fieldLoadout:{owned:['overcharge','attenuation'],queuedFieldId:'attenuation'}};
  assert.deepEqual(Bridge.fieldStateView(run),{owned:['overcharge','attenuation'],queued:'attenuation'});
  assert.equal(Bridge.ensureFieldStateBridge(run),true);
  assert.deepEqual(run.fieldState,{owned:['overcharge','attenuation'],queued:'attenuation'});
});

test('fieldState 호환 뷰는 저장 데이터에 직렬화되지 않는다',()=>{
  const run={seed:7,fieldLoadout:{owned:['lawless'],queuedFieldId:'lawless'}};
  Bridge.ensureFieldStateBridge(run);
  assert.equal(Bridge.fieldStateBridgeIsSerializable(run),true);
  assert.equal(Object.keys(run).includes('fieldState'),false);
  assert.equal(JSON.stringify(run).includes('fieldState'),false);
  assert.match(JSON.stringify(run),/fieldLoadout/);
});

test('기존 용어 버튼은 공용 키워드 사전으로 교체할 수 있다',()=>{
  let shown='';
  const runtime={
    document:{querySelector:()=>null},
    showTerms(){throw new Error('legacy terms should not run')},
    showModal(html){shown=html},
    closeOverlay(){}
  };
  assert.equal(Bridge.wrapShowTerms(runtime),true);
  assert.equal(runtime.showTerms(),true);
  assert.match(shown,/용어 도움말/);
  assert.match(shown,/트럼프/);
  assert.match(shown,/자동 승리나 우선권은 없다/);
  assert.match(shown,/무늬 수 비교로 자동 발생하지 않는다/);
});

test('전투 레이아웃은 도감 본체 뒤에 런타임 브리지를 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');
  assert.match(source,/compendium-8-h-runtime-bridge\.js/);
  assert.match(source,/COMPENDIUM_BRIDGE_DATASET/);
  assert(source.indexOf('loadCompendium(doc)')<source.indexOf('loadCompendiumBridge(doc)'));
});
