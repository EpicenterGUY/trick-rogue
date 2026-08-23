const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const RunEconomy=require('../run-economy-v2.js');
const Relics=require('../relics.js');
const Contracts=require('../contracts.js');
const RunStart=require('../run-start-v2.js');
const TrumpFields=require('../trump-fields.js');
const StatusSystem=require('../status-system.js');
const BuildSynergies=require('../build-synergies.js');
const PureSynergies=require('../pure-synergies-9-d.js');
const Compendium=require('../compendium-8-h.js');

test('8-H 통합 도감은 실제 시스템 레지스트리를 한 API에서 읽는다',()=>{
  assert.equal(Compendium.STAGE,'8-H');
  const counts=Compendium.catalogCounts(null);
  assert.equal(counts.cards,72);
  assert.equal(counts.pack01,10);
  assert.equal(counts.pack02,10);
  assert.equal(counts.relics,Object.keys(Relics.RELIC_DEFINITIONS).length);
  assert.equal(counts.clauses,Object.keys(Contracts.CONTRACT_DEFINITIONS).length+Object.keys(Contracts.TABOO_DEFINITIONS).length);
  assert.equal(counts.traits,RunStart.RUN_TRAITS.length);
  assert.equal(counts.fields,Object.keys(TrumpFields.FIELD_DEFINITIONS).length);
  assert.equal(counts.statuses,StatusSystem.statusCatalog().length);
  assert.equal(counts.synergies,Object.keys(BuildSynergies.SYNERGY_DEFINITIONS).length+Object.keys(PureSynergies.PURE_SYNERGY_DEFINITIONS).length);
});

test('카드 도감은 표준 52슬롯과 활성 네임드 20장을 모두 노출하고 중복 id가 없다',()=>{
  const items=Compendium.cardCatalog();
  assert.equal(items.length,Cards.createBaseCardSlots().length+Cards.CARD_DEFINITIONS.length);
  assert.equal(new Set(items.map(item=>item.id)).size,items.length);
  assert.equal(items.filter(item=>item.packId==='pack01').length,10);
  assert.equal(items.filter(item=>item.packId==='pack02').length,10);
  assert(items.some(item=>item.category==='pure'));
  assert(items.some(item=>item.category==='general'));
});

test('도감의 보상 후보 표시는 8-C 실제 candidateCatalog와 같은 키를 사용한다',()=>{
  const actual=new Set(RunEconomy.candidateCatalog(Cards).map(item=>item.key));
  const cards=Compendium.cardCatalog();
  for(const item of cards){
    const key=item.source?.definition?.id||item.source?.named?.id?`def:${item.source.definition?.id||item.source.named?.id}`:item.packId?`def:${item.id}`:`pure:${item.suit}${item.rank}`;
    if(item.category==='general')assert.equal(item.rewardEligible,actual.has(`def:${item.id}`));
    else if(item.packId)assert.equal(item.rewardEligible,actual.has(`def:${item.id}`));
    else assert.equal(item.rewardEligible,actual.has(key));
  }
  assert(cards.filter(item=>item.packId==='pack02').every(item=>item.rewardEligible));
});

test('카드 필터는 순수/일반 효과/pack01/pack02를 분리한다',()=>{
  const cards=Compendium.cardCatalog();
  for(const filter of Compendium.CARD_FILTERS){
    const filtered=cards.filter(item=>Compendium.cardFilterMatch(item,filter));
    if(filter==='all')assert.equal(filtered.length,cards.length);
    else assert(filtered.length>0,`${filter} should not be empty`);
  }
  assert(cards.filter(item=>Compendium.cardFilterMatch(item,'pure')).every(item=>item.category==='pure'));
  assert(cards.filter(item=>Compendium.cardFilterMatch(item,'general')).every(item=>item.category==='general'));
});

test('도감 검색은 이름·효과·팩 id를 함께 검색한다',()=>{
  const river=Compendium.filteredCatalog('cards',{cardFilter:'all',query:'리버',runState:null});
  assert(river.length>0);
  const pack02=Compendium.filteredCatalog('cards',{cardFilter:'all',query:'pack02',runState:null});
  assert.equal(pack02.length,10);
  const bleed=Compendium.filteredCatalog('relics',{query:'출혈',runState:null});
  assert(bleed.some(item=>item.id==='rusty_needle'));
});

test('유물·계약/금기·특성·필드·상태·시너지 도감은 현재 보유/활성 상태를 표시할 수 있다',()=>{
  const run={
    deck:Array.from({length:10},(_,i)=>({suit:['S','H','D','C'][i%4],rank:2+(i%13),uid:`p${i}`})),
    relics:[Relics.makeRelic('reinforced_buckle')],contracts:['edge_clause'],taboos:['enemy_edge'],traitId:'durable'
  };
  assert(Compendium.relicCatalog(run).find(item=>item.id==='reinforced_buckle').owned);
  assert(Compendium.clauseCatalog(run).find(item=>item.id==='edge_clause').owned);
  assert(Compendium.clauseCatalog(run).find(item=>item.id==='enemy_edge').owned);
  assert(Compendium.traitCatalog(run).find(item=>item.id==='durable').owned);
  assert(Compendium.synergyCatalog(run).some(item=>item.id==='pure:classic_line'&&item.owned));
});

test('상태 도감은 미구현 상태를 숨기지 않고 규칙 미확정으로 표시한다',()=>{
  const poison=Compendium.statusCatalog().find(item=>item.id==='poison');
  assert(poison);
  assert.equal(poison.implemented,false);
  assert.equal(poison.meta,'규칙 미확정');
});

test('공용 키워드 사전은 8-H 핵심 용어를 포함한다',()=>{
  const required=['트럼프','적용 숫자','쇼다운','우세','리버 적중','칩','순수 카드','예약','기억','표식','계약','필드','보호막','출혈','재생','취약'];
  for(const term of required){
    const definition=Compendium.keywordDefinition(term);
    assert(definition,`missing keyword ${term}`);
    assert(definition.description.length>5);
  }
});

test('키워드 렌더러는 텍스트를 굵은 클릭 용어로 만들고 HTML 입력은 이스케이프한다',()=>{
  const html=Compendium.highlightKeywordsText('<b>트럼프</b>와 리버 적중');
  assert.match(html,/&lt;b&gt;/);
  assert.match(html,/data-keyword="트럼프"/);
  assert.match(html,/<strong>트럼프<\/strong>/);
  assert.match(html,/data-keyword="리버 적중"/);
});

test('키워드 설명은 최신 트럼프/우세/리버 규칙을 고정한다',()=>{
  const trump=Compendium.keywordDefinition('트럼프').description;
  const edge=Compendium.keywordDefinition('우세').description;
  const river=Compendium.keywordDefinition('리버 적중').description;
  assert.match(trump,/\+3/);
  assert.match(trump,/자동 승리나 우선권은 없다/);
  assert.match(edge,/명시적으로 부여/);
  assert.match(edge,/무늬 수 비교로 자동 발생하지 않는다/);
  assert.match(river,/4번째 트릭/);
  assert.match(river,/정확히 일치/);
});

test('도감 UI는 시작/맵/전투 진입점과 기존 카드풀 대체 동작을 제공한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','compendium-8-h.js'),'utf8');
  assert.match(source,/startScreen/);
  assert.match(source,/mapScreen/);
  assert.match(source,/battleScreen/);
  assert.match(source,/pool\.textContent='도감'/);
  assert.match(source,/old\?\.remove/);
  assert.match(source,/data-open-compendium/);
});

test('공용 showModal/inspectCard 래퍼가 카드 상세·보상·상점에도 같은 키워드 사전을 적용한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','compendium-8-h.js'),'utf8');
  assert.match(source,/function wrapShowModal/);
  assert.match(source,/decorateKeywords\(modal,runtimeRoot\)/);
  assert.match(source,/function wrapInspectCard/);
  assert.match(source,/inspectDesc/);
  assert.match(source,/inspectApply/);
});

test('전투 레이아웃 로더는 9-D 뒤에 8-H 도감을 자동 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');
  assert.match(source,/compendium-8-h\.js/);
  assert.match(source,/trick-compendium-8-h/);
  assert(source.indexOf('loadPureSynergies(doc)')<source.indexOf('loadCompendium(doc)'));
});

test('8-H는 폐기된 전술 덱·트럼프 자동승리·상시 무늬 우세 로직을 재도입하지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','compendium-8-h.js'),'utf8');
  assert.doesNotMatch(source,/tacticDeck|tacticHand|autoTrumpWin|trumpPriority|showdownAdvantagePower|advantageMargin/);
});
