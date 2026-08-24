const test=require('node:test');
const assert=require('node:assert/strict');
const DevM2=require('../dev-m2-runtime.js');

class FakeStorage{
  constructor(){this.data=new Map()}
  getItem(key){return this.data.has(key)?this.data.get(key):null}
  setItem(key,value){this.data.set(key,String(value))}
  removeItem(key){this.data.delete(key)}
}

test('시드 정규화는 숫자를 uint32로, 문자열을 안정 해시로 바꾼다',()=>{
  assert.equal(DevM2.normalizeSeed('123'),123);
  assert.equal(DevM2.normalizeSeed(-1),0xffffffff);
  assert.equal(DevM2.normalizeSeed(''),null);
  assert.equal(DevM2.normalizeSeed('test-a'),DevM2.normalizeSeed('test-a'));
  assert.notEqual(DevM2.normalizeSeed('test-a'),DevM2.normalizeSeed('test-b'));
});

test('같은 시드는 같은 난수열을 처음부터 재생한다',()=>{
  const a=DevM2.createSeededRandom(42),b=DevM2.createSeededRandom(42),c=DevM2.createSeededRandom(43);
  const seqA=Array.from({length:6},()=>a()),seqB=Array.from({length:6},()=>b()),seqC=Array.from({length:6},()=>c());
  assert.deepEqual(seqA,seqB);assert.notDeepEqual(seqA,seqC);assert.ok(seqA.every(value=>value>=0&&value<1));
});

test('DEV 모드에서만 일반 저장 키를 개발 저장 키로 라우팅한다',()=>{
  assert.equal(DevM2.routeStorageKey(DevM2.NORMAL_SAVE_KEY,'?dev=1'),DevM2.DEV_SAVE_KEY);
  assert.equal(DevM2.routeStorageKey(DevM2.NORMAL_SAVE_KEY,'?debug=1'),DevM2.NORMAL_SAVE_KEY);
  assert.equal(DevM2.routeStorageKey('other.key','?dev=1'),'other.key');
});

test('저장 라우터는 일반 저장을 보존하고 DEV 저장만 읽고 쓴다',()=>{
  const storage=new FakeStorage();storage.data.set(DevM2.NORMAL_SAVE_KEY,'NORMAL');
  const root={location:{search:'?dev=1'},localStorage:storage};
  assert.equal(DevM2.installStorageRouter(root),true);
  storage.setItem(DevM2.NORMAL_SAVE_KEY,'DEV');
  assert.equal(storage.data.get(DevM2.NORMAL_SAVE_KEY),'NORMAL');
  assert.equal(storage.data.get(DevM2.DEV_SAVE_KEY),'DEV');
  assert.equal(storage.getItem(DevM2.NORMAL_SAVE_KEY),'DEV');
  storage.removeItem(DevM2.NORMAL_SAVE_KEY);
  assert.equal(storage.data.get(DevM2.NORMAL_SAVE_KEY),'NORMAL');
  assert.equal(storage.data.has(DevM2.DEV_SAVE_KEY),false);
});

test('시드 적용은 Math.random을 고정하고 같은 시드 재적용 시 처음부터 반복한다',()=>{
  const math={random:()=>0.987654321};const root={location:{search:'?dev=1'},Math:math,run:null};
  const first=DevM2.applySeed('99',{runtimeRoot:root,syncRun:false});assert.equal(first.ok,true);
  const seq1=[math.random(),math.random(),math.random()];
  DevM2.applySeed('99',{runtimeRoot:root,syncRun:false});const seq2=[math.random(),math.random(),math.random()];
  assert.deepEqual(seq1,seq2);DevM2.restoreRandom(root);assert.equal(math.random(),0.987654321);
});

test('UID와 파티클 래퍼는 고정 RNG를 소비하지 않고 원래 랜덤을 사용한다',()=>{
  let originalCalls=0;const math={random:()=>{originalCalls++;return .75}};const root={location:{search:'?dev=1'},Math:math,run:null};
  DevM2.applySeed(7,{runtimeRoot:root,syncRun:false});const expected=DevM2.createSeededRandom(7),firstExpected=expected(),secondExpected=expected();
  const first=math.random();root.newUid=()=>`u-${math.random()}`;root.burstAt=()=>math.random();
  DevM2.installRuntimeGuards(root);assert.equal(root.newUid(),'u-0.75');assert.equal(root.burstAt(),.75);const second=math.random();
  assert.equal(first,firstExpected);assert.equal(second,secondExpected);assert.equal(originalCalls,2);DevM2.restoreRandom(root);
});

test('런 시작 전 시드 적용은 시작 특성 제안도 같은 난수열로 다시 만든다',()=>{
  const math={random:()=>.5};let seen=[];const root={location:{search:'?dev=1'},Math:math,run:null,RunStartV2:{resetSelection(rng){seen.push([rng(),rng()])},renderStart(){seen.push('render')}}};
  DevM2.applySeed(2026,{runtimeRoot:root,syncRun:false});const first=seen[0];seen=[];DevM2.applySeed(2026,{runtimeRoot:root,syncRun:false});assert.deepEqual(seen[0],first);assert.equal(seen[1],'render');DevM2.restoreRandom(root);
});

test('진행 전 런은 runSeed와 맵을 동기화하지만 진행 중 런은 맵을 되감지 않는다',()=>{
  let generated=0;const fresh={runSeed:1,actId:'act1',completed:new Set(),currentNodeId:null,map:[]};
  const root={run:fresh,RunMapGeneration:{progressStarted:run=>run.completed.size>0,applyGeneratedActMap(run,act,{seed,force}){generated++;run.map=[{id:`${act}-${seed}-${force}`}]} }};
  const result=DevM2.syncFreshRunSeed(root,123);assert.equal(result.ok,true);assert.equal(result.reason,'map_regenerated');assert.equal(fresh.runSeed,123);assert.equal(generated,1);
  fresh.completed.add('n1');const blocked=DevM2.syncFreshRunSeed(root,456);assert.equal(blocked.ok,false);assert.equal(blocked.reason,'progress_started');assert.equal(fresh.runSeed,123);assert.equal(generated,1);
});

test('beginRun 래퍼는 고정 시드가 있으면 새 런 생성 뒤 시드를 동기화한다',()=>{
  const math={random:()=>.5};const root={location:{search:'?dev=1'},Math:math,run:null,beginRun(){this.run={actId:'act1',completed:new Set(),map:[]};return this.run},RunMapGeneration:{progressStarted:()=>false,applyGeneratedActMap(run,act,{seed}){run.map=[{id:`${act}:${seed}`}]} }};
  DevM2.applySeed(314,{runtimeRoot:root,syncRun:false});assert.equal(DevM2.wrapBeginRun(root),true);root.beginRun();assert.equal(root.run.runSeed,314);assert.deepEqual(root.run.map,[{id:'act1:314'}]);DevM2.restoreRandom(root);
});

test('M2 마무리 패널은 시드 적용·랜덤 복원·DEV 저장 삭제 진입점을 제공한다',()=>{
  const html=DevM2.panelHtml();for(const marker of ['id="trickDevSeed"','data-dev-m2="seed"','data-dev-m2="random"','data-dev-m2="clearSave"',DevM2.DEV_SAVE_KEY])assert.match(html,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
