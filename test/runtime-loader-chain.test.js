const test=require('node:test');
const assert=require('node:assert/strict');
const Chain=require('../runtime-loader-chain.js');

test('브라우저 런타임 로더 매니페스트는 중복 없이 유효하다',()=>{
  assert.equal(Chain.VERSION,'M9-LOADER-1');
  assert.deepEqual(Chain.validate(),[]);
  assert.equal(Chain.ENTRIES[0].globalName,'EnemyBehavior');
  assert.equal(Chain.ENTRIES.at(-1).globalName,'GameUI');
});

test('RUN V3 후반 로더 순서는 콘텐츠 → 신규 지역 → 경제 → UI를 보존한다',()=>{
  const names=Chain.ENTRIES.map(entry=>entry.globalName);
  const expected=['ContentExpansion9C','CasinoRegionM9','RedWardRegionM9','ScrapMarketRegionM9','RunEconomyV2','BattleRewardMarket','ShowdownSlotManipulation','FoldExperiment','RunPersistence','BattleLayout','RunBalanceTelemetry','LegacyRegionsM9','GameUI'];
  assert.deepEqual(names.slice(names.indexOf('ContentExpansion9C')),expected);
});

test('RunPersistence 뒤 보상 래핑 훅과 핵심 파일 식별자는 매니페스트에 명시된다',()=>{
  assert.equal(Chain.entry('RunPersistence').after,'relic_reward_wrap');
  assert.deepEqual(Chain.entry('BattleLayout'),{globalName:'BattleLayout',src:'battle-layout.js',dataset:'trick-battle-layout-runtime',after:null});
  assert.deepEqual(Chain.entry('RunBalanceTelemetry'),{globalName:'RunBalanceTelemetry',src:'run-balance-telemetry.js',dataset:'trick-run-balance-telemetry-runtime',after:null});
  assert.deepEqual(Chain.entry('LegacyRegionsM9'),{globalName:'LegacyRegionsM9',src:'legacy-regions-m9.js',dataset:'trick-legacy-regions-m9-runtime',after:null});
});
