(function(root,factory){
  const api=factory(
    root,
    typeof module!=='undefined'?require('./cards.js'):root,
    typeof module!=='undefined'?require('./run-economy-v2.js'):root.RunEconomyV2,
    typeof module!=='undefined'?require('./relics.js'):root.RelicSystem,
    typeof module!=='undefined'?require('./contracts.js'):root.ContractSystem,
    typeof module!=='undefined'?require('./run-start-v2.js'):root.RunStartV2,
    typeof module!=='undefined'?require('./trump-fields.js'):root.TrumpFields,
    typeof module!=='undefined'?require('./status-system.js'):root.StatusSystem,
    typeof module!=='undefined'?require('./build-synergies.js'):root.BuildSynergySystem,
    typeof module!=='undefined'?require('./pure-synergies-9-d.js'):root.PureSynergy9D
  );
  if(typeof module!=='undefined')module.exports=api;
  root.Compendium8H=api;
  root.KeywordHelp8H=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Cards,RunEconomyV2,RelicSystem,ContractSystem,RunStartV2,TrumpFields,StatusSystem,BuildSynergySystem,PureSynergy9D){
  const STAGE='8-H';
  const KEYWORD_DEFINITIONS=Object.freeze({
    '트럼프':Object.freeze({term:'트럼프',description:'세트 시작 시 무작위로 정해지는 무늬. 해당 무늬 카드는 트릭 적용 숫자 +3을 받지만 자동 승리나 우선권은 없다.'}),
    '적용 숫자':Object.freeze({term:'적용 숫자',description:'현재 트릭 승패 비교에 실제로 쓰는 최종 숫자. 인쇄 숫자와 카드·트럼프·상태·필드 보정을 순서대로 적용한다.'}),
    '트릭값':Object.freeze({term:'트릭값',description:'현재 트릭에서 사용하는 카드의 숫자와 무늬. 기본 인쇄값과 달라질 수 있으며 쇼다운 원래값을 자동으로 바꾸지 않는다.'}),
    '인쇄값':Object.freeze({term:'인쇄값',description:'카드에 원래 적힌 숫자와 무늬. 쇼다운은 기본적으로 이 값을 사용한다.'}),
    '쇼다운 위력':Object.freeze({term:'쇼다운 위력',description:'5장의 족보 기본 위력에 카드 효과·계약·상태·추가 배율 등을 반영한 최종 비교 수치.'}),
    '쇼다운':Object.freeze({term:'쇼다운',description:'5트릭이 끝난 뒤 양쪽 5장의 최종 위력을 비교하는 단계. 높은 쪽만 승리하며 최종 위력 차이만큼 패자에게 피해를 준다. 동점은 피해가 없다.'}),
    '우세':Object.freeze({term:'우세',description:'카드·유물·규칙이 명시적으로 부여하는 조건부 쇼다운 상태. 활성화되면 추가 배율 +25%를 주며 쇼다운 뒤 해제된다. 무늬 수 비교로 자동 발생하지 않는다.'}),
    '리버 적중':Object.freeze({term:'리버 적중',description:'4번째 트릭 뒤 고정해 둔 합법적인 5번째 카드 후보 중 하나와 실제 5번째 카드의 인쇄 숫자·무늬가 정확히 일치한 상태. 추가 배율 +25%.'}),
    '리버':Object.freeze({term:'리버',description:'4번째 트릭 뒤 현재 쇼다운 4장을 기준으로 합법적인 5번째 카드 후보를 한 번 고정하는 규칙. 5번째 카드 이후 다시 계산하지 않는다.'}),
    '칩':Object.freeze({term:'칩',description:'전투 전용 자원. 기본 최대 5, 트릭 승리 시 +1. 손패 교체는 칩 2를 쓰고 선택한 카드를 드로우 덱 맨 아래로 보낸 뒤 1장을 뽑는다.'}),
    '순수 카드':Object.freeze({term:'순수 카드',description:'고유 효과가 없는 표준 52장 카드. 효과 카드와 같은 인쇄 숫자·무늬를 가질 수 있으며, 강화로 고유 효과가 생기지 않는 한 순수 판정을 유지한다.'}),
    '예약':Object.freeze({term:'예약',description:'현재 즉시 처리하지 않고 지정된 다음 트릭·쇼다운 등 특정 시점에 한 번 실행하도록 저장한 효과.'}),
    '기억':Object.freeze({term:'기억',description:'이전 트릭·세트의 결과나 사용 기록을 참조하는 효과 계열.'}),
    '표식':Object.freeze({term:'표식',description:'다음 양수 피해를 받을 때 보호막 계산 전에 피해가 현재 수치만큼 증가하고 모두 사라지는 상태. 최대 5.'}),
    '흉터':Object.freeze({term:'흉터',description:'트릭 종료 시 현재 수치만큼 피해를 주며 자연 감소하지 않는 전투 상태. 최대 2.'}),
    '계약':Object.freeze({term:'계약',description:'조건을 만족하면 쇼다운 위력을 올리는 런 규칙. 계약을 얻을 때 대응하는 금기도 함께 얻는다.'}),
    '금기':Object.freeze({term:'금기',description:'특정 조건을 만족하면 쇼다운 위력을 낮추는 계약의 대가.'}),
    '필드':Object.freeze({term:'필드',description:'전투 전체의 규칙 일부를 바꾸는 효과. 기본 전투에는 필드가 없으며 설계된 필드는 예약된 전투에서만 적용된다.'}),
    '보호막':Object.freeze({term:'보호막',description:'받는 피해를 현재 수치만큼 먼저 흡수하는 상태.'}),
    '출혈':Object.freeze({term:'출혈',description:'트릭 종료 시 현재 수치만큼 피해를 받고 발동 후 1 감소하는 상태.'}),
    '재생':Object.freeze({term:'재생',description:'트릭 종료 시 현재 수치만큼 체력을 회복하고 발동 후 1 감소하는 상태.'}),
    '취약':Object.freeze({term:'취약',description:'다음 피해를 받을 때 보호막 계산 전에 피해량이 현재 수치만큼 증가하고 모두 사라지는 상태.'}),
    '족보':Object.freeze({term:'족보',description:'쇼다운 5장 조합. 스트레이트 플러시 > 포카드 > 풀하우스 > 플러시 > 스트레이트 > 트리플 > 투페어 > 페어 > 하이카드 순.'}),
    '손패':Object.freeze({term:'손패',description:'현재 사용할 수 있는 카드. 기본 최대 3장이며 매 트릭 카드를 낸 직후 다시 보충한다. 5번째 트릭도 쇼다운 전에 보충한다.'}),
    '드로우':Object.freeze({term:'드로우',description:'드로우 덱에서 카드를 손패로 가져오는 행동. 덱이 비었을 때만 버림 더미를 다시 섞어 사용한다.'}),
    '골드':Object.freeze({term:'골드',description:'런 동안 유지되는 상점 자원. 전투용 칩과 별개다.'}),
    '폴드':Object.freeze({term:'폴드',description:'쇼다운 슬롯이 3~4장일 때 세트를 접는 선택. 양측 일반 쇼다운 정산을 생략하고 슬롯을 버린 뒤 고정 체력 8을 잃고 다음 세트로 간다.'})
  });
  const SECTION_ORDER=Object.freeze(['cards','relics','clauses','traits','fields','statuses','synergies']);
  const SECTION_LABELS=Object.freeze({cards:'카드',relics:'유물',clauses:'계약·금기',traits:'특성',fields:'필드',statuses:'상태',synergies:'빌드 시너지'});
  const CARD_FILTERS=Object.freeze(['all','pure','general','pack01','pack02']);
  const CARD_FILTER_LABELS=Object.freeze({all:'전체',pure:'순수',general:'공용 효과',pack01:'pack01',pack02:'pack02'});
  const SUIT_ORDER=Object.freeze(['S','H','D','C']);
  let installed=false;
  let originalShowModal=null;
  let viewState={section:'cards',cardFilter:'all',query:'',selected:null};

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function rankLabel(rank){return Number(rank)===14?'A':Number(rank)===13?'K':Number(rank)===12?'Q':Number(rank)===11?'J':String(rank)}
  function suitSymbol(suit){return suit==='S'?'♠':suit==='H'?'♥':suit==='D'?'♦':suit==='C'?'♣':'?'}
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function keywordDefinition(term){return KEYWORD_DEFINITIONS[term]||null}
  function keywordTerms(){return Object.keys(KEYWORD_DEFINITIONS).sort((a,b)=>b.length-a.length||a.localeCompare(b,'ko'))}
  function keywordPattern(){return new RegExp(`(${keywordTerms().map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'g')}
  function highlightKeywordsText(text){
    const source=String(text??''),pattern=keywordPattern();let cursor=0,html='',match;
    while((match=pattern.exec(source))){html+=escapeHtml(source.slice(cursor,match.index));const term=match[0],definition=keywordDefinition(term);html+=`<button type="button" class="compKeyword" data-keyword="${escapeHtml(term)}" title="${escapeHtml(definition.description)}"><strong>${escapeHtml(term)}</strong></button>`;cursor=match.index+term.length}
    return html+escapeHtml(source.slice(cursor));
  }
  function keywordCatalog(){return keywordTerms().map(term=>({...KEYWORD_DEFINITIONS[term]}))}

  function isPureCard(card){return typeof Cards?.isPureCard==='function'?Cards.isPureCard(card):!card?.cardId&&!card?.definition&&!card?.named&&!(card?.effects?.length)}
  function cardDefinition(card){return card?.definition||card?.named||null}
  function rewardKeyForCard(card){const definition=cardDefinition(card);return definition?.id?`def:${definition.id}`:`pure:${card?.suit}${card?.rank}`}
  function rewardEligibleKeys(){
    if(typeof RunEconomyV2?.candidateCatalog!=='function')return new Set();
    return new Set(RunEconomyV2.candidateCatalog(Cards).map(entry=>entry.key));
  }
  function cardCatalogOrder(item){
    if(item.category==='pure')return 0;
    if(item.category==='general')return 1;
    if(item.packId==='pack01')return 2;
    if(item.packId==='pack02')return 3;
    return 4;
  }
  function compareCardCatalogItems(a,b){
    const category=cardCatalogOrder(a)-cardCatalogOrder(b);if(category)return category;
    const suit=SUIT_ORDER.indexOf(a.suit)-SUIT_ORDER.indexOf(b.suit);if(suit)return suit;
    const rank=Number(b.rank)-Number(a.rank);if(rank)return rank;
    return String(a.name||a.id).localeCompare(String(b.name||b.id),'ko');
  }
  function cardCatalog(){
    const rewardKeys=rewardEligibleKeys(),items=[];
    const slots=typeof Cards?.createBaseCardSlots==='function'?Cards.createBaseCardSlots():[];
    for(const card of slots){
      items.push({kind:'card',id:`pure.${card.suit}${card.rank}`,name:'순수 카드',suit:card.suit,rank:Number(card.rank),category:'pure',packId:null,description:'고유 효과가 없는 표준 카드. 효과 카드와 같은 인쇄 숫자·무늬를 가져도 별도 카드로 존재한다.',implemented:true,rewardEligible:rewardKeys.has(rewardKeyForCard(card)),source:card});
    }
    for(const definition of Cards?.GENERAL_EFFECT_CARD_DEFINITIONS||[]){
      const card=typeof Cards?.createDefinitionCard==='function'?Cards.createDefinitionCard(definition.id,{uid:`compendium-${definition.id}`}):{suit:definition.suit,rank:definition.rank,definition};
      items.push({kind:'card',id:definition.id,name:definition.name||definition.id,suit:definition.suit,rank:Number(definition.rank),category:'general',packId:null,description:definition.description||definition.text||'',implemented:definition.implemented!==false,rewardEligible:rewardKeys.has(`def:${definition.id}`),source:card});
    }
    for(const definition of Cards?.CARD_DEFINITIONS||[]){
      const card=typeof Cards?.createDefinitionCard==='function'?Cards.createDefinitionCard(definition.id,{uid:`compendium-${definition.id}`}):{suit:definition.suit,rank:definition.rank,definition};
      items.push({kind:'card',id:definition.id,name:definition.name||definition.id,suit:definition.suit,rank:Number(definition.rank),category:definition.packId||'named',packId:definition.packId||null,description:definition.description||definition.text||'',implemented:definition.implemented!==false,rewardEligible:rewardKeys.has(`def:${definition.id}`),source:card});
    }
    return items.sort(compareCardCatalogItems);
  }
  function relicCatalog(runState=activeRun()){
    const owned=new Set((runState?.relics||[]).map(value=>typeof value==='string'?value:value?.id).filter(Boolean));
    return Object.values(RelicSystem?.RELIC_DEFINITIONS||{}).map(def=>({kind:'relic',id:def.id,name:def.name,description:def.description||'',meta:`${def.rarity==='rare'?'희귀':def.rarity==='uncommon'?'고급':'일반'} 유물`,owned:owned.has(def.id),implemented:true}));
  }
  function clauseCatalog(runState=activeRun()){
    const contracts=new Set((runState?.contracts||[]).map(value=>typeof value==='string'?value:value?.id).filter(Boolean)),taboos=new Set((runState?.taboos||[]).map(value=>typeof value==='string'?value:value?.id).filter(Boolean));
    return[
      ...Object.values(ContractSystem?.CONTRACT_DEFINITIONS||{}).map(def=>({kind:'contract',id:def.id,name:def.name,description:def.description||'',meta:'계약',owned:contracts.has(def.id),implemented:true})),
      ...Object.values(ContractSystem?.TABOO_DEFINITIONS||{}).map(def=>({kind:'taboo',id:def.id,name:def.name,description:def.description||'',meta:'금기',owned:taboos.has(def.id),implemented:true}))
    ];
  }
  function traitCatalog(runState=activeRun()){
    const modern=[...(RunStartV2?.RUN_TRAITS||[])],archived=(RunStartV2?.ARCHIVED_TRAITS||[]).filter(def=>runState?.traitId===def.id);
    return [...modern,...archived].map(def=>({kind:'trait',id:def.id,name:def.name,description:def.desc||'',meta:def.archived?'구버전 특성':'시작 특성',owned:runState?.traitId===def.id,implemented:true}));
  }
  function fieldCatalog(runState=activeRun()){
    const owned=new Set(runState?.fieldState?.owned||runState?.runFieldState?.owned||[]),activeId=runState?.fieldState?.queued||runState?.runFieldState?.queued||null;
    return Object.values(TrumpFields?.FIELD_DEFINITIONS||{}).map(def=>({kind:'field',id:def.id,name:def.label||def.name||def.id,description:def.description||'',meta:activeId===def.id?'다음 전투 예약':owned.has(def.id)?'보유':'필드',owned:owned.has(def.id)||activeId===def.id,implemented:true}));
  }
  function statusCatalog(){
    if(typeof StatusSystem?.statusCatalog==='function')return StatusSystem.statusCatalog().map(def=>({kind:'status',id:def.id,name:def.label||def.id,description:def.description||'',meta:def.implemented?'사용 중':'규칙 미확정',owned:false,implemented:def.implemented===true}));
    return[];
  }
  function synergyCatalog(runState=activeRun()){
    const normal=Object.values(BuildSynergySystem?.SYNERGY_DEFINITIONS||{}).map(def=>({kind:'synergy',id:`build:${def.id}`,name:def.name,description:def.description||'',meta:'조합 시너지',owned:!!runState&&!!BuildSynergySystem?.isSynergyActive?.(def,runState),implemented:true}));
    const pure=Object.values(PureSynergy9D?.PURE_SYNERGY_DEFINITIONS||{}).map(def=>({kind:'synergy',id:`pure:${def.id}`,name:def.name,description:def.description||'',meta:'순수 카드 시너지',owned:!!runState&&!!PureSynergy9D?.isSynergyActive?.(def,runState),implemented:true}));
    return[...normal,...pure];
  }
  function sectionCatalog(section,runState=activeRun()){
    if(section==='cards')return cardCatalog();if(section==='relics')return relicCatalog(runState);if(section==='clauses')return clauseCatalog(runState);if(section==='traits')return traitCatalog(runState);if(section==='fields')return fieldCatalog(runState);if(section==='statuses')return statusCatalog();if(section==='synergies')return synergyCatalog(runState);return[];
  }
  function cardFilterMatch(item,filter){
    if(filter==='all')return true;if(filter==='pure')return item.category==='pure';if(filter==='general')return item.category==='general';return item.packId===filter;
  }
  function searchableText(item){return`${item.name||''} ${item.description||''} ${item.meta||''} ${item.id||''} ${item.packId||''} ${item.suit||''}${item.rank||''} ${suitSymbol(item.suit)}${rankLabel(item.rank)}`.toLocaleLowerCase('ko')}
  function filteredCatalog(section=viewState.section,{cardFilter=viewState.cardFilter,query=viewState.query,runState=activeRun()}={}){
    const needle=String(query||'').trim().toLocaleLowerCase('ko');return sectionCatalog(section,runState).filter(item=>(section!=='cards'||cardFilterMatch(item,cardFilter))&&(!needle||searchableText(item).includes(needle)));
  }
  function catalogCounts(runState=activeRun()){
    const cards=cardCatalog();return{
      cards:cards.length,pure:cards.filter(item=>item.category==='pure').length,general:cards.filter(item=>item.category==='general').length,
      pack01:cards.filter(item=>item.packId==='pack01').length,pack02:cards.filter(item=>item.packId==='pack02').length,
      relics:relicCatalog(runState).length,clauses:clauseCatalog(runState).length,traits:traitCatalog(runState).length,fields:fieldCatalog(runState).length,statuses:statusCatalog().length,synergies:synergyCatalog(runState).length
    };
  }

  function cardArtHtml(item,runtimeRoot=root){
    const card=item?.source;if(card&&typeof runtimeRoot?.artHtml==='function'){try{return runtimeRoot.artHtml(card)}catch(_error){}}
    return `<div class="compCardFallback"><b>${escapeHtml(suitSymbol(item?.suit))}${escapeHtml(rankLabel(item?.rank))}</b><span>${escapeHtml(item?.name||'카드')}</span></div>`;
  }
  function itemBadges(item){
    const badges=[];
    if(item.kind==='card'){
      if(item.packId)badges.push(item.packId);else badges.push(item.category==='pure'?'순수':'공용 효과');
      badges.push(item.rewardEligible?'보상 후보':'보상 제외');
    }else if(item.meta)badges.push(item.meta);
    if(item.owned)badges.push(item.kind==='synergy'?'활성':'보유');
    if(item.implemented===false)badges.push('미구현');
    return badges;
  }
  function itemListHtml(items,section){
    if(!items.length)return'<div class="compEmpty">조건에 맞는 항목이 없다.</div>';
    return items.map((item,index)=>{
      const badges=itemBadges(item).map(b=>`<span>${escapeHtml(b)}</span>`).join('');
      if(section==='cards')return`<button type="button" class="compCardRow" data-comp-index="${index}"><div class="compThumb">${cardArtHtml(item)}</div><div><b>${escapeHtml(item.name)} <em>${escapeHtml(suitSymbol(item.suit))}${escapeHtml(rankLabel(item.rank))}</em></b><small>${badges}</small><p>${highlightKeywordsText(item.description)}</p></div></button>`;
      return`<button type="button" class="compListRow" data-comp-index="${index}"><div><b>${escapeHtml(item.name)}</b><small>${badges}</small><p>${highlightKeywordsText(item.description)}</p></div></button>`;
    }).join('');
  }
  function detailHtml(item){
    if(!item)return'<div class="compDetailEmpty">항목을 선택하면 자세한 설명을 볼 수 있다.</div>';
    const badges=itemBadges(item).map(b=>`<span>${escapeHtml(b)}</span>`).join('');
    const cardMeta=item.kind==='card'?`<div class="compDetailCard">${cardArtHtml(item)}</div><div class="compStats">${escapeHtml(suitSymbol(item.suit))}${escapeHtml(rankLabel(item.rank))} · ${escapeHtml(item.packId||CARD_FILTER_LABELS[item.category]||'카드')}</div>`:'';
    return`${cardMeta}<h3>${escapeHtml(item.name)}</h3><div class="compBadges">${badges}</div><p>${highlightKeywordsText(item.description)}</p>${item.kind==='card'?`<p class="compFine">현재 8-C 보상 생성기 기준: <b>${item.rewardEligible?'획득 후보에 포함':'획득 후보에서 제외'}</b></p>`:''}`;
  }
  function injectStyles(doc){
    if(!doc||doc.querySelector?.('style[data-compendium-8-h]'))return;
    const style=doc.createElement('style');style.dataset.compendium8H='true';style.textContent=`
.compKeyword{display:inline;padding:0;border:0;background:none;color:#8fe0df;font:inherit;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px}.compKeyword strong{font-weight:900}.compKeyword:hover,.compKeyword:focus-visible{color:#f4d98f;outline:none}
#keywordHelp8H{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(420px,calc(100vw - 24px));z-index:120;background:#111827;border:2px solid #000;box-shadow:0 0 0 2px #52617d inset,4px 4px 0 #0009;padding:10px;color:#f2ead8;font-size:11px;line-height:1.45}#keywordHelp8H b{color:#f4d98f;font-size:12px}#keywordHelp8H button{float:right;background:#242d40;border:1px solid #6a7896;color:#fff;cursor:pointer}
.compShell{display:flex;flex-direction:column;gap:9px;max-height:min(78dvh,720px)}.compTop{display:flex;gap:6px;flex-wrap:wrap}.compTop button,.compFilters button{padding:5px 7px;font-size:10px}.compTop button.sel,.compFilters button.sel{box-shadow:0 0 0 2px #67d3d0 inset;color:#fff}.compSearch{width:100%;background:#0d1420;color:#f2ead8;border:2px solid #000;box-shadow:0 0 0 2px #3b4965 inset;padding:8px;font:inherit}.compFilters{display:flex;gap:5px;flex-wrap:wrap}.compContent{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:8px;min-height:0}.compList{overflow:auto;display:grid;gap:6px;align-content:start;max-height:52dvh;padding-right:2px}.compCardRow,.compListRow{width:100%;text-align:left;color:#e9edf5;background:#111a28;border:2px solid #000;box-shadow:0 0 0 2px #364765 inset;padding:6px;display:grid;grid-template-columns:54px 1fr;gap:7px;cursor:pointer}.compListRow{grid-template-columns:1fr}.compCardRow:hover,.compListRow:hover,.compCardRow.sel,.compListRow.sel{box-shadow:0 0 0 2px #67d3d0 inset}.compThumb{width:54px;height:80px;overflow:hidden}.compThumb svg,.compThumb img,.compDetailCard svg,.compDetailCard img{width:100%;height:100%;display:block}.compCardFallback{width:100%;height:100%;background:#efe5cc;color:#252933;border:2px solid #b5a47e;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:7px 4px;font-size:9px;text-align:center}.compCardFallback b{font-size:15px}.compCardRow b,.compListRow b{font-size:11px}.compCardRow em{font-style:normal;color:#f4d98f}.compCardRow small,.compListRow small,.compBadges{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}.compCardRow small span,.compListRow small span,.compBadges span{font-size:8px;background:#202b3e;padding:2px 4px;color:#b9c7dc}.compCardRow p,.compListRow p,.compDetail p{font-size:9px;line-height:1.45;margin:5px 0 0;color:#cbd5e4}.compDetail{overflow:auto;max-height:52dvh;background:#0d1521;border:2px solid #000;box-shadow:0 0 0 2px #394966 inset;padding:8px}.compDetailCard{width:76px;height:112px;margin:0 auto 7px}.compDetail h3{font-size:12px;margin:4px 0}.compStats,.compFine,.compEmpty,.compDetailEmpty{font-size:9px;color:#9eabc1}.compBottom{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:9px;color:#9eabc1}.compBottom button{padding:6px 9px}
@media(max-width:560px){.compContent{grid-template-columns:1fr}.compDetail{max-height:25dvh}.compList{max-height:35dvh}.compCardRow{grid-template-columns:46px 1fr}.compThumb{width:46px;height:68px}}
`;(doc.head||doc.documentElement)?.appendChild(style);
  }
  function keywordPopover(runtimeRoot=root,term){
    const definition=keywordDefinition(term),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!definition||!doc)return false;injectStyles(doc);let box=doc.getElementById?.('keywordHelp8H');if(!box){box=doc.createElement('div');box.id='keywordHelp8H';(doc.body||doc.documentElement).appendChild(box)}box.innerHTML=`<button type="button" aria-label="닫기">×</button><b>${escapeHtml(term)}</b><div>${escapeHtml(definition.description)}</div>`;box.querySelector('button').onclick=()=>box.remove();return true;
  }
  function decorateKeywords(container,runtimeRoot=root){
    const doc=container?.ownerDocument||runtimeRoot?.document;if(!container||!doc?.createTreeWalker)return 0;const SHOW_TEXT=runtimeRoot?.NodeFilter?.SHOW_TEXT||4,walker=doc.createTreeWalker(container,SHOW_TEXT),nodes=[];let node;
    while((node=walker.nextNode())){const parent=node.parentElement;if(!node.nodeValue?.trim()||parent?.closest?.('.compKeyword,script,style,input,textarea,button[data-keyword]'))continue;if(keywordPattern().test(node.nodeValue)){keywordPattern().lastIndex=0;nodes.push(node)}}
    let count=0;
    for(const textNode of nodes){const text=textNode.nodeValue,pattern=keywordPattern(),fragment=doc.createDocumentFragment();let cursor=0,match;while((match=pattern.exec(text))){fragment.appendChild(doc.createTextNode(text.slice(cursor,match.index)));const term=match[0],button=doc.createElement('button');button.type='button';button.className='compKeyword';button.dataset.keyword=term;button.title=keywordDefinition(term).description;const strong=doc.createElement('strong');strong.textContent=term;button.appendChild(strong);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();keywordPopover(runtimeRoot,term)});fragment.appendChild(button);cursor=match.index+term.length;count++}fragment.appendChild(doc.createTextNode(text.slice(cursor)));textNode.replaceWith(fragment)}
    container.querySelectorAll?.('.compKeyword[data-keyword]')?.forEach(button=>{if(button.dataset.keywordBound)return;button.dataset.keywordBound='true';button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();keywordPopover(runtimeRoot,button.dataset.keyword)})});return count;
  }

  function setView(next={}){viewState={...viewState,...next};return{...viewState}}
  function showModal(runtimeRoot,html){if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true}
  function renderCompendium(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),items=filteredCatalog(viewState.section,{cardFilter:viewState.cardFilter,query:viewState.query,runState});if(!items.some(item=>item.id===viewState.selected))viewState.selected=items[0]?.id||null;const selected=items.find(item=>item.id===viewState.selected)||items[0]||null,counts=catalogCounts(runState);
    const tabs=SECTION_ORDER.map(section=>`<button type="button" class="pixelBtn ${viewState.section===section?'sel':''}" data-comp-section="${section}">${escapeHtml(SECTION_LABELS[section])} <b>${counts[section]}</b></button>`).join('');
    const filters=viewState.section==='cards'?`<div class="compFilters">${CARD_FILTERS.map(filter=>`<button type="button" class="pixelBtn ${viewState.cardFilter===filter?'sel':''}" data-card-filter="${filter}">${escapeHtml(CARD_FILTER_LABELS[filter])} ${counts[filter]??''}</button>`).join('')}</div>`:'';
    const html=`<div class="compShell"><div><h2 style="margin:0 0 4px">도감</h2><p style="margin:0;font-size:10px">실제 게임 레지스트리를 그대로 읽는다. 굵은 키워드를 누르면 현재 규칙 설명을 바로 확인할 수 있다.</p></div><div class="compTop">${tabs}</div>${filters}<input class="compSearch" data-comp-search type="search" placeholder="이름·효과·키워드 검색" value="${escapeHtml(viewState.query)}"><div class="compContent"><div class="compList">${itemListHtml(items,viewState.section)}</div><div class="compDetail">${detailHtml(selected)}</div></div><div class="compBottom"><span>${items.length}개 표시 · 키워드 ${keywordTerms().length}개</span><button type="button" class="pixelBtn" data-comp-close>닫기</button></div></div>`;
    if(!showModal(runtimeRoot,html))return false;bindCompendium(runtimeRoot,items);return{section:viewState.section,items,selected,counts};
  }
  function bindCompendium(runtimeRoot=root,items=[]){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal');if(!modal)return false;injectStyles(doc);decorateKeywords(modal,runtimeRoot);
    modal.querySelectorAll?.('[data-comp-section]')?.forEach(button=>button.onclick=()=>{setView({section:button.dataset.compSection,selected:null});renderCompendium(runtimeRoot)});
    modal.querySelectorAll?.('[data-card-filter]')?.forEach(button=>button.onclick=()=>{setView({cardFilter:button.dataset.cardFilter,selected:null});renderCompendium(runtimeRoot)});
    const search=modal.querySelector?.('[data-comp-search]');if(search)search.oninput=()=>{setView({query:search.value,selected:null});renderCompendium(runtimeRoot);const next=doc.querySelector?.('[data-comp-search]');next?.focus?.();if(next)try{next.setSelectionRange(next.value.length,next.value.length)}catch(_error){}};
    modal.querySelectorAll?.('[data-comp-index]')?.forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.compIndex)];if(!item)return;setView({selected:item.id});renderCompendium(runtimeRoot)});
    const close=modal.querySelector?.('[data-comp-close]');if(close)close.onclick=()=>runtimeRoot?.closeOverlay?.();return true;
  }
  function showCompendium(runtimeRoot=root,section='cards',cardFilter='all'){setView({section:SECTION_ORDER.includes(section)?section:'cards',cardFilter:CARD_FILTERS.includes(cardFilter)?cardFilter:'all',selected:null});return renderCompendium(runtimeRoot)}

  function wrapShowModal(runtimeRoot=root){
    const original=runtimeRoot?.showModal;if(typeof original!=='function')return false;if(original.__compendium8H)return true;originalShowModal=original;
    const wrapped=function(html,...args){const result=original.call(this,html,...args),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal');if(modal)decorateKeywords(modal,runtimeRoot);return result};wrapped.__compendium8H=true;wrapped.__legacyShowModal=original;runtimeRoot.showModal=wrapped;return true;
  }
  function wrapInspectCard(runtimeRoot=root){
    const original=runtimeRoot?.inspectCard;if(typeof original!=='function')return false;if(original.__compendium8H)return true;
    const wrapped=function(...args){const result=original.apply(this,args),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);for(const id of ['inspectDesc','inspectApply','systemLegend']){const el=doc?.getElementById?.(id);if(el)decorateKeywords(el,runtimeRoot)}return result};wrapped.__compendium8H=true;wrapped.__legacyInspectCard=original;runtimeRoot.inspectCard=wrapped;return true;
  }
  function buttonByText(container,text){return[...(container?.querySelectorAll?.('button')||[])].find(button=>String(button.textContent||'').trim()===text)||null}
  function installEntryButtons(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc)return false;injectStyles(doc);
    const mapTop=doc.querySelector?.('#mapScreen .topbar');if(mapTop){const pool=buttonByText(mapTop,'카드풀');if(pool){pool.textContent='도감';pool.onclick=()=>showCompendium(runtimeRoot)}const old=buttonByText(mapTop,'신규 1팩');old?.remove?.();if(!buttonByText(mapTop,'도감')){const button=doc.createElement('button');button.className='pixelBtn';button.textContent='도감';button.onclick=()=>showCompendium(runtimeRoot);mapTop.appendChild(button)}}
    const startBottom=doc.querySelector?.('#startScreen .startBottom');if(startBottom&&!startBottom.querySelector?.('[data-open-compendium]')){const button=doc.createElement('button');button.type='button';button.className='pixelBtn';button.dataset.openCompendium='true';button.style.cssText='width:100%;margin-bottom:7px';button.textContent='도감';button.onclick=()=>showCompendium(runtimeRoot);startBottom.prepend(button)}
    const battleRow=doc.querySelector?.('#battleScreen .topbar .row');if(battleRow&&!battleRow.querySelector?.('[data-open-compendium]')){const button=doc.createElement('button');button.type='button';button.className='pixelBtn';button.dataset.openCompendium='true';button.textContent='도감';button.onclick=()=>showCompendium(runtimeRoot);battleRow.prepend(button)}
    return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(!runtimeRoot?.document||!Cards?.createBaseCardSlots||!RelicSystem?.RELIC_DEFINITIONS||!ContractSystem?.CONTRACT_DEFINITIONS||!RunStartV2?.RUN_TRAITS||!TrumpFields?.FIELD_DEFINITIONS||!StatusSystem?.statusCatalog)return false;
    wrapShowModal(runtimeRoot);wrapInspectCard(runtimeRoot);installEntryButtons(runtimeRoot);const doc=runtimeRoot.document,observer=typeof runtimeRoot.MutationObserver==='function'?new runtimeRoot.MutationObserver(()=>installEntryButtons(runtimeRoot)):null;observer?.observe?.(doc.getElementById?.('app')||doc.body,{childList:true,subtree:true});installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<100)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[8-H] 도감 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function resetForTests(){installed=false;originalShowModal=null;viewState={section:'cards',cardFilter:'all',query:'',selected:null}}
  return{STAGE,KEYWORD_DEFINITIONS,SECTION_ORDER,SECTION_LABELS,CARD_FILTERS,CARD_FILTER_LABELS,SUIT_ORDER,keywordDefinition,keywordTerms,keywordPattern,highlightKeywordsText,keywordCatalog,activeRun,isPureCard,cardDefinition,rewardKeyForCard,rewardEligibleKeys,cardCatalogOrder,compareCardCatalogItems,cardCatalog,relicCatalog,clauseCatalog,traitCatalog,fieldCatalog,statusCatalog,synergyCatalog,sectionCatalog,cardFilterMatch,searchableText,filteredCatalog,catalogCounts,setView,itemBadges,decorateKeywords,keywordPopover,renderCompendium,showCompendium,wrapShowModal,wrapInspectCard,installEntryButtons,installBrowserRuntime,installWhenReady,resetForTests};
});
