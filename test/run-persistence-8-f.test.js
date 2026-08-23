const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Persistence=require('../run-persistence.js');

function card(uid,suit='S',rank=2,extra={}){return{uid,suit,rank,printedSuit:suit,printedRank:rank,...extra}}
function runFixture(overrides={}){
  return{
    runSeed:0x12345678,actId:'common',actIndex:0,hp:52,maxHp:60,gold:75,
    deck:[card('a','S',6),card('b','H',7,{cardId:'core.draw',definition:{id:'core.draw',name:'old'}})],
    map:[{id:'c0',type:'battle',lane:1,row:0,next:['c1']},{id:'c1',type:'event',lane:1,row:1,next:[]}],
    available:new Set(['c0']),completed:new Set(),currentNodeId:null,runComplete:false,
    runFlow:{version:'8-B',phase:'common',choiceRound:0,pendingRegionOfferIds:[],visitedRegionIds:[],completedRegionIds:[],currentRegionId:null,history:[]},
    routeState:{locked:new Set(['x']),meta:new Map([['k',2]])},...overrides
  };
}
function memoryStorage(){
  const data=new Map();return{getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),_data:data};
}

test('8-F 런 직렬화는 Set/Map을 포함한 진행 상태를 JSON 안전 포맷으로 왕복한다',()=>{
  const run=runFixture(),before=Persistence.runFingerprint(run),text=Persistence.stringifySave(run,{now:0,reason:'test'}),parsed=Persistence.parseSave(text);
  assert.equal(parsed.envelope.format,Persistence.SAVE_FORMAT);assert.equal(parsed.envelope.version,Persistence.SAVE_VERSION);
  assert.ok(parsed.runState.available instanceof Set);assert.ok(parsed.runState.completed instanceof Set);
  assert.ok(parsed.runState.routeState.locked instanceof Set);assert.ok(parsed.runState.routeState.meta instanceof Map);
  assert.deepEqual([...parsed.runState.available],['c0']);assert.equal(parsed.runState.routeState.meta.get('k'),2);
  assert.equal(Persistence.runFingerprint(parsed.runState),before);
});

test('저장 문자열에는 체크섬이 붙고 payload가 한 글자라도 바뀌면 불러오기를 거부한다',()=>{
  const raw=JSON.parse(Persistence.stringifySave(runFixture(),{now:0}));raw.payload.checkpoint.deckSize=999;
  assert.throws(()=>Persistence.parseSave(JSON.stringify(raw)),/checksum_mismatch/);
});

test('지원 버전보다 미래의 저장 데이터는 조용히 덮어쓰지 않고 명시적으로 거부한다',()=>{
  const raw=JSON.parse(Persistence.stringifySave(runFixture(),{now:0}));raw.version=Persistence.SAVE_VERSION+1;
  assert.throws(()=>Persistence.parseSave(JSON.stringify(raw)),/newer than supported/);
});

test('구버전 plain JSON 런은 v1 저장 포맷으로 마이그레이션되고 진행 배열은 Set으로 복구된다',()=>{
  const legacy={run:{runSeed:77,hp:40,maxHp:60,gold:10,deck:[card('a')],map:[],available:['n1'],completed:['n0'],currentNodeId:null}};
  const parsed=Persistence.parseSave(JSON.stringify(legacy));
  assert.equal(parsed.migrated,true);assert.equal(parsed.envelope.migratedFrom,0);assert.equal(parsed.runState.runSeed,77);
  assert.ok(parsed.runState.available instanceof Set);assert.deepEqual([...parsed.runState.completed],['n0']);
});

test('안전 체크포인트는 전투와 노드 처리 중 저장을 막고 맵 대기 상태에서만 연다',()=>{
  assert.deepEqual(Persistence.saveAvailability(null,null),{allowed:false,reason:'no_run'});
  assert.equal(Persistence.saveAvailability(runFixture(),{ended:false}).reason,'battle_active');
  assert.equal(Persistence.saveAvailability(runFixture({currentNodeId:'c0'}),null).reason,'node_in_progress');
  assert.deepEqual(Persistence.saveAvailability(runFixture(),null),{allowed:true,reason:'checkpoint'});
});

test('스토리지 저장/불러오기/삭제는 하나의 버전 키를 사용하고 손상 저장을 정상 저장으로 취급하지 않는다',()=>{
  const storage=memoryStorage(),saved=Persistence.saveToStorage(storage,runFixture(),{now:0});assert.equal(saved.ok,true);
  assert.equal(Persistence.hasStorageSave(storage),true);const loaded=Persistence.loadFromStorage(storage);assert.equal(loaded.ok,true);
  storage.setItem(Persistence.SAVE_KEY,'{"bad":true}');assert.equal(Persistence.loadFromStorage(storage).reason,'invalid_save');
  assert.equal(Persistence.clearStorage(storage),true);assert.equal(Persistence.hasStorageSave(storage),false);
});

test('불러오기 시 저장 속 낡은 카드 정의 대신 현재 카드 레지스트리 참조를 다시 연결한다',()=>{
  const current={id:'core.draw',name:'현재 드로우'};const runtimeRoot={CARD_DEFINITION_BY_ID:{'core.draw':current}};
  const parsed=Persistence.parseSave(Persistence.stringifySave(runFixture(),{now:0}),{runtimeRoot});
  assert.equal(parsed.runState.deck[1].definition,current);assert.equal(parsed.runState.deck[1].definition.name,'현재 드로우');
});

test('verifyRoundTrip은 저장 전후 결정적 런 지문이 같을 때만 성공한다',()=>{
  const result=Persistence.verifyRoundTrip(runFixture());assert.equal(result.ok,true);assert.equal(result.before,result.after);
});

test('디버그 스냅샷은 시드·런 지문·맵 진행과 현재 전투 핵심 상태를 한 번에 노출한다',()=>{
  const storage=memoryStorage(),run=runFixture(),battle={type:'elite',phase:'trick',setIndex:2,trick:4,trump:'H',chip:3,hand:[card('h')],deck:[],discard:[card('d')],slots:[{card:card('s')}],enemy:{hp:31,maxHp:64},riverSnapshot:{id:'river-x'},foldHistory:[{}]};
  const root={run,battle,localStorage:storage};const snap=Persistence.debugSnapshot(root);
  assert.equal(snap.run.runSeed,0x12345678);assert.match(snap.run.fingerprint,/^run:/);assert.equal(snap.battle.setIndex,2);assert.equal(snap.battle.trick,4);assert.equal(snap.battle.enemyHp,31);assert.equal(snap.battle.riverSnapshotId,'river-x');
  assert.equal(snap.saveAvailability.reason,'battle_active');
});

test('브라우저 복구 어댑터는 런을 교체하고 battle을 비운 뒤 맵 화면과 렌더를 복원한다',()=>{
  const calls={screen:[],render:0,close:0},root={run:null,battle:{phase:'trick'},closeOverlay(){calls.close++},showScreen(id){calls.screen.push(id)},renderMap(){calls.render++},setTimeout(fn){fn()}};
  const run=runFixture();Persistence.restoreBrowserRun(root,run,{screenId:'mapScreen'});
  assert.equal(root.run,run);assert.equal(root.battle,null);assert.equal(calls.close,1);assert.deepEqual(calls.screen,['mapScreen']);assert.equal(calls.render,1);
});

test('8-F 런타임은 8-E 폴드 뒤 최종 전투 레이아웃 전에 로드된다',()=>{
  const loader=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(loader,/function finishFoldExperiment\(\)\{\s*loadRunPersistence\(\);\s*\}/);
  assert.match(loader,/run-persistence\.js/);
  assert.match(loader,/function finishRunPersistence\(\)[\s\S]*loadBattleLayoutFinal\(\)/);
});

test('일반 UI는 저장이 있을 때만 계속하기를 노출하고 디버그 패널은 debug=1 또는 명시 플래그에서만 켠다',()=>{
  assert.equal(Persistence.debugEnabled({TRICKLOG_DEBUG:true}),true);
  assert.equal(Persistence.debugEnabled({location:{search:'?debug=1'}}),true);
  assert.equal(Persistence.debugEnabled({location:{search:''}}),false);
});
