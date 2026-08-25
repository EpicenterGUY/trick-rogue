(function(root,factory){
  const api=factory(root,typeof module!=='undefined'?require('./compendium-8-h.js'):root.Compendium8H);
  if(typeof module!=='undefined')module.exports=api;
  root.Compendium8HRuntimeBridge=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Compendium){
  const STAGE='8-H';
  const LAYOUT_FIX_STAGE='8-H-COMPLETE';
  const SECTION_ORDER=Object.freeze(['cards','relics','clauses','traits','fields','statuses','synergies','terms']);
  const SECTION_LABELS=Object.freeze({cards:'카드',relics:'유물',clauses:'계약·금기',traits:'특성',fields:'필드',statuses:'상태',synergies:'빌드 시너지',terms:'규칙·용어'});
  const CARD_FILTERS=Object.freeze(['all','pure','effect','signature','owned','locked']);
  const CARD_FILTER_LABELS=Object.freeze({all:'전체',pure:'순수',effect:'효과',signature:'보스 시그니처',owned:'이번 런 보유',locked:'잠김'});
  const BOSS_LABELS=Object.freeze({three_face_dealer:'삼면 딜러',fog_curator:'안개 관장',frontier_marshal:'전선 총감'});
  let installed=false;
  let layoutObserver=null;
  let viewState={section:'cards',cardFilter:'all',query:'',selectedId:null};

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]))}
  function activeRun(runtimeRoot=root){return Compendium?.activeRun?.(runtimeRoot)||runtimeRoot?.run||null}
  function rankLabel(rank){return Number(rank)===14?'A':Number(rank)===13?'K':Number(rank)===12?'Q':Number(rank)===11?'J':String(rank??'')}
  function suitSymbol(suit){return suit==='S'?'♠':suit==='H'?'♥':suit==='D'?'♦':suit==='C'?'♣':''}
  function isRedSuit(suit){return suit==='H'||suit==='D'}

  function fieldStateView(runState){
    const loadout=runState?.fieldLoadout;
    if(!loadout||typeof loadout!=='object')return null;
    return{owned:Array.isArray(loadout.owned)?loadout.owned:[],queued:loadout.queuedFieldId||null};
  }
  function ensureFieldStateBridge(runState=activeRun()){
    if(!runState||typeof runState!=='object'||!runState.fieldLoadout)return false;
    const descriptor=Object.getOwnPropertyDescriptor(runState,'fieldState');
    if(descriptor?.get?.__compendium8HFieldBridge)return true;
    if(descriptor&&!descriptor.configurable)return false;
    const getter=function(){return fieldStateView(this)||{owned:[],queued:null}};
    getter.__compendium8HFieldBridge=true;
    Object.defineProperty(runState,'fieldState',{configurable:true,enumerable:false,get:getter});
    return true;
  }
  function fieldStateBridgeIsSerializable(runState){return !!runState&&!Object.keys(runState).includes('fieldState')}

  function termsCatalog(){
    return (Compendium?.keywordCatalog?.()||[]).map(row=>({kind:'term',id:`term.${row.term}`,name:row.term,description:row.description||'',meta:'현재 규칙',implemented:true,owned:false}));
  }
  function termsHtml(){
    const rows=termsCatalog();
    return `<h2>용어 도움말</h2><p>현재 적용 중인 규칙을 기준으로 정리했다. 굵은 키워드를 누르면 짧은 설명을 다시 볼 수 있다.</p><div class="choiceList">${rows.map(row=>`<div class="choice"><b>${escapeHtml(row.name)}</b><span>${keywordHtml(row.description)}</span></div>`).join('')}<button class="choice" data-close-keyword-terms><b>닫기</b></button></div>`;
  }
  function showTerms(runtimeRoot=root){
    ensureFieldStateBridge(activeRun(runtimeRoot));
    if(typeof runtimeRoot?.showModal!=='function')return false;
    runtimeRoot.showModal(termsHtml());
    const doc=runtimeRoot.document||(typeof document!=='undefined'?document:null);
    const close=doc?.querySelector?.('[data-close-keyword-terms]');
    if(close)close.onclick=()=>runtimeRoot?.closeOverlay?.();
    return true;
  }
  function wrapShowTerms(runtimeRoot=root){
    const original=runtimeRoot?.showTerms;
    if(typeof original!=='function')return false;
    if(original.__compendium8H)return true;
    const wrapped=function(){return showTerms(runtimeRoot)};
    wrapped.__compendium8H=true;
    wrapped.__legacyShowTerms=original;
    runtimeRoot.showTerms=wrapped;
    return true;
  }

  function cardDefinition(item){return item?.source?.definition||item?.source?.named||null}
  function isSignatureCard(item){
    const def=cardDefinition(item);
    return !!(def?.signatureBossId||def?.category==='boss_signature'||item?.category==='boss_signature'||item?.packId==='boss-signature');
  }
  function cardUiCategory(item){return item?.category==='pure'?'pure':isSignatureCard(item)?'signature':'effect'}
  function runDeck(runState){return Array.isArray(runState?.deck)?runState.deck:[]}
  function cardIdentity(card){
    const def=card?.definition||card?.named||null;
    return def?.id||card?.cardId||null;
  }
  function cardOwnedInRun(item,runState){
    const deck=runDeck(runState);
    if(item?.category==='pure')return deck.some(card=>!cardIdentity(card)&&card?.suit===item.suit&&Number(card?.rank)===Number(item.rank));
    return deck.some(card=>cardIdentity(card)===item?.id);
  }
  function signatureUnlocked(item,runState){
    if(!isSignatureCard(item))return true;
    const def=cardDefinition(item),state=runState?.bossSignatureState||{};
    const ids=Array.isArray(state.unlockedDefinitionIds)?state.unlockedDefinitionIds:[];
    const bosses=Array.isArray(state.defeatedBossIds)?state.defeatedBossIds:[];
    return ids.includes(item.id)||!!def?.signatureBossId&&bosses.includes(def.signatureBossId);
  }
  function signatureBossLabel(item){
    const bossId=cardDefinition(item)?.signatureBossId;
    return BOSS_LABELS[bossId]||bossId||'';
  }
  function decorateCardItem(item,runState=activeRun()){
    const category=cardUiCategory(item),owned=cardOwnedInRun(item,runState),unlocked=signatureUnlocked(item,runState);
    const rewardEligible=category==='signature'?unlocked:!!item.rewardEligible;
    return{...item,uiCategory:category,owned,unlocked,rewardEligible,signatureBossLabel:category==='signature'?signatureBossLabel(item):'',legacyPackId:item.packId||null};
  }
  function cardCatalog(runState=activeRun()){return (Compendium?.cardCatalog?.()||[]).map(item=>decorateCardItem(item,runState))}
  function cardFilterMatch(item,filter){
    if(filter==='all')return true;
    if(filter==='pure')return item.uiCategory==='pure';
    if(filter==='effect')return item.uiCategory==='effect';
    if(filter==='signature')return item.uiCategory==='signature';
    if(filter==='owned')return !!item.owned;
    if(filter==='locked')return item.uiCategory==='signature'&&!item.unlocked;
    return true;
  }
  function sectionCatalog(section,runState=activeRun()){
    if(section==='cards')return cardCatalog(runState);
    if(section==='terms')return termsCatalog();
    return typeof Compendium?.sectionCatalog==='function'?Compendium.sectionCatalog(section,runState):[];
  }
  function searchableText(item){
    const parts=[item?.name,item?.description,item?.meta,item?.id,item?.suit,rankLabel(item?.rank),suitSymbol(item?.suit)];
    if(item?.kind==='card'){
      parts.push(CARD_FILTER_LABELS[item.uiCategory],item.owned?'보유':'미보유',item.unlocked===false?'잠김':'해금',item.signatureBossLabel,item.rewardEligible?'보상 후보':'보상 제외');
    }
    return parts.filter(Boolean).join(' ').toLocaleLowerCase('ko');
  }
  function filteredCatalog(section=viewState.section,{cardFilter=viewState.cardFilter,query=viewState.query,runState=activeRun()}={}){
    const needle=String(query||'').trim().toLocaleLowerCase('ko');
    return sectionCatalog(section,runState).filter(item=>(section!=='cards'||cardFilterMatch(item,cardFilter))&&(!needle||searchableText(item).includes(needle)));
  }
  function catalogCounts(runState=activeRun()){
    const cards=cardCatalog(runState),base=typeof Compendium?.catalogCounts==='function'?Compendium.catalogCounts(runState):{};
    return{...base,cards:cards.length,pure:cards.filter(x=>x.uiCategory==='pure').length,effect:cards.filter(x=>x.uiCategory==='effect').length,signature:cards.filter(x=>x.uiCategory==='signature').length,owned:cards.filter(x=>x.owned).length,locked:cards.filter(x=>x.uiCategory==='signature'&&!x.unlocked).length,terms:termsCatalog().length};
  }
  function itemBadges(item){
    if(item?.kind!=='card'){
      const badges=typeof Compendium?.itemBadges==='function'?Compendium.itemBadges(item):[];
      return Array.isArray(badges)?badges.filter(Boolean):[];
    }
    const badges=[item.uiCategory==='pure'?'순수 카드':item.uiCategory==='signature'?'보스 시그니처':'효과 카드'];
    if(item.owned)badges.push('이번 런 보유');
    if(item.uiCategory==='signature')badges.push(item.unlocked?'해금됨':'잠김');
    badges.push(item.rewardEligible?'보상 후보':'보상 제외');
    if(item.implemented===false)badges.push('미구현');
    return badges;
  }
  function itemDescription(item){return String(item?.description||item?.text||'설명 없음')}
  function keywordHtml(text){return typeof Compendium?.highlightKeywordsText==='function'?Compendium.highlightKeywordsText(text):escapeHtml(text)}
  function itemMeta(item){
    if(item?.kind==='card'&&item.uiCategory==='signature')return item.signatureBossLabel?`${item.signatureBossLabel} 처치 해금`:'보스 처치 해금';
    if(item?.kind==='card')return item.uiCategory==='pure'?'표준 52장':'공용 효과 풀';
    return String(item?.meta||'');
  }
  function itemHtml(item,index){
    const badges=itemBadges(item).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    const badgeHtml=badges?`<div class="compFixBadges">${badges}</div>`:'';
    const description=`<p>${keywordHtml(itemDescription(item))}</p>`;
    if(item?.kind==='card'){
      const suit=suitSymbol(item.suit),rank=rankLabel(item.rank),meta=itemMeta(item);
      return`<article class="compFixItem" tabindex="0" role="button" data-comp-fix-index="${index}" data-comp-kind="card"><div class="compFixGlyph ${isRedSuit(item.suit)?'red':''}"><strong>${escapeHtml(rank)}${escapeHtml(suit)}</strong><small>${escapeHtml(item.uiCategory==='pure'?'순수':item.uiCategory==='signature'?'시그니처':'효과')}</small></div><div class="compFixCopy"><div class="compFixTitle"><b>${escapeHtml(item.name||item.id||'카드')}</b><span class="compFixMeta">${escapeHtml(meta)}</span></div>${badgeHtml}${description}</div></article>`;
    }
    return`<article class="compFixItem compFixTextOnly" tabindex="0" role="button" data-comp-fix-index="${index}" data-comp-kind="${escapeHtml(item?.kind||'entry')}"><div class="compFixCopy"><div class="compFixTitle"><b>${escapeHtml(item?.name||item?.id||'항목')}</b><span class="compFixMeta">${escapeHtml(itemMeta(item))}</span></div>${badgeHtml}${description}</div></article>`;
  }
  function detailHtml(item){
    if(!item)return'';
    const badges=itemBadges(item).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    const unlock=item.kind==='card'&&item.uiCategory==='signature'&&!item.unlocked?`<p class="compFixUnlock">해금 조건: ${escapeHtml(item.signatureBossLabel||'해당 지역 보스')} 처치</p>`:'';
    const glyph=item.kind==='card'?`<div class="compFixDetailGlyph ${isRedSuit(item.suit)?'red':''}">${escapeHtml(rankLabel(item.rank))}${escapeHtml(suitSymbol(item.suit))}</div>`:'';
    return`<section class="compFixDetail" data-comp-fix-detail>${glyph}<div class="compFixDetailCopy"><div class="compFixDetailHead"><b>${escapeHtml(item.name||item.id||'항목')}</b><button type="button" class="pixelBtn" data-comp-fix-detail-close>×</button></div><div class="compFixBadges">${badges}</div><p>${keywordHtml(itemDescription(item))}</p>${unlock}</div></section>`;
  }

  function layoutCss(){return`
#overlay.compFixOpen{display:flex!important;align-items:stretch!important;justify-content:stretch!important;padding:0!important;background:#080b11f5;z-index:40}
#overlay.compFixOpen>.modal.compFixModal{width:100%!important;height:100%!important;max-height:none!important;padding:0!important;overflow:hidden!important;border:0!important;background:linear-gradient(180deg,#151d2b,#0b1018)!important;box-shadow:none!important}
.compFixShell{height:100%;min-height:0;display:flex;flex-direction:column;gap:8px;padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom));color:#f2ead8}
.compFixHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex:0 0 auto}.compFixHeader h2{margin:0;font-size:17px}.compFixHeader p{margin:3px 0 0!important;font-size:9px!important;line-height:1.35!important;color:#9eabc1!important}.compFixClose{flex:0 0 auto;padding:7px 10px!important}
.compFixTabs,.compFixFilters{display:flex;gap:5px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;flex:0 0 auto;padding:1px 0 2px}.compFixTabs::-webkit-scrollbar,.compFixFilters::-webkit-scrollbar{display:none}.compFixTabs .pixelBtn,.compFixFilters .pixelBtn{flex:0 0 auto;padding:5px 7px;font-size:9px;white-space:nowrap}.compFixTabs .sel,.compFixFilters .sel{box-shadow:0 0 0 2px #67d3d0 inset;color:#fff}
.compFixSearch{width:100%;flex:0 0 auto;background:#0b111b;color:#f2ead8;border:2px solid #000;box-shadow:0 0 0 2px #3b4965 inset;padding:8px 9px;font:inherit;font-size:10px;outline:none}.compFixSearch:focus{box-shadow:0 0 0 2px #67d3d0 inset}
.compFixHelp{flex:0 0 auto;background:#111827;border:2px solid #000;box-shadow:0 0 0 2px #52617d inset;padding:8px 9px;font-size:9px;line-height:1.4}.compFixHelp[hidden]{display:none}.compFixHelpHead,.compFixDetailHead{display:flex;align-items:center;justify-content:space-between;gap:8px}.compFixHelp b{color:#f4d98f;font-size:10px}.compFixHelp button,.compFixDetail button{padding:2px 7px!important}.compFixHelp p{margin:4px 0 0!important;font-size:9px!important;color:#d4dceb!important}
.compFixDetail{display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px;flex:0 0 auto;max-height:25dvh;overflow:auto;background:#101827;border:2px solid #000;box-shadow:0 0 0 2px #52617d inset;padding:8px}.compFixDetailGlyph{width:48px;height:66px;background:#efe5cc;border:2px solid #000;box-shadow:0 0 0 2px #b5a47e inset;color:#252933;display:flex;align-items:center;justify-content:center;font-size:18px}.compFixDetailGlyph.red{color:#b13e4b}.compFixDetailCopy{min-width:0}.compFixDetailHead b{font-size:12px;color:#f4d98f}.compFixDetail p{font-size:9px!important;line-height:1.45!important;color:#d4dceb!important;margin:5px 0 0!important}.compFixUnlock{color:#f0bd78!important}
.compFixList{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:grid;grid-template-columns:1fr;gap:8px;align-content:start;padding:2px 2px 10px;scrollbar-width:thin}
.compFixItem{display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;align-items:start;background:#111a28;border:2px solid #000;box-shadow:0 0 0 2px #364765 inset;padding:7px;min-width:0;cursor:pointer}.compFixItem:focus-visible,.compFixItem:hover{outline:none;box-shadow:0 0 0 2px #67d3d0 inset}.compFixItem.compFixTextOnly{grid-template-columns:1fr}.compFixGlyph{width:52px;min-height:70px;background:linear-gradient(180deg,#efe5cc,#dfcfb0);border:2px solid #000;box-shadow:0 0 0 2px #b5a47e inset;color:#252933;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center}.compFixGlyph.red{color:#b13e4b}.compFixGlyph strong{font-size:18px}.compFixGlyph small{font-size:7px;color:#5c6471}.compFixCopy{min-width:0}.compFixTitle{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.compFixTitle b{font-size:11px;line-height:1.3}.compFixMeta{font-size:8px;color:#f4d98f;text-align:right}.compFixBadges{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.compFixBadges span{font-size:7px;background:#202b3e;padding:2px 4px;color:#b9c7dc}.compFixItem p{margin:6px 0 0!important;font-size:9px!important;line-height:1.5!important;color:#cbd5e4!important;overflow-wrap:anywhere}.compFixEmpty{font-size:10px;color:#9eabc1;text-align:center;padding:24px 8px}
.compFixFooter{display:flex;justify-content:space-between;align-items:center;gap:8px;flex:0 0 auto;font-size:8px;color:#9eabc1;padding-top:1px}
.compFixShell .compKeyword{display:inline!important;padding:0!important;border:0!important;background:none!important;color:#8fe0df!important;font:inherit!important;cursor:pointer!important;text-decoration:underline dotted;text-underline-offset:2px}.compFixShell .compKeyword strong{font-weight:900}.compFixShell .compKeyword:focus-visible{outline:1px solid #67d3d0;outline-offset:2px}
#startScreen .startBottom.compFixStartBottom{display:grid!important;grid-template-columns:minmax(0,1fr) 86px;gap:7px;align-items:stretch}.compFixStartBottom>[data-open-compendium]{width:auto!important;margin:0!important;padding:11px 8px!important;order:2}.compFixStartBottom>.primary{order:1;min-width:0}
@media(min-width:720px){.compFixShell{padding:18px 20px}.compFixList{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.compFixItem{grid-template-columns:62px minmax(0,1fr);padding:9px}.compFixGlyph{width:62px;min-height:82px}.compFixItem p{font-size:10px!important}.compFixHeader h2{font-size:20px}.compFixTabs .pixelBtn,.compFixFilters .pixelBtn{font-size:10px}.compFixDetail{grid-template-columns:60px minmax(0,1fr);max-height:22dvh}.compFixDetailGlyph{width:60px;height:82px}}
@media(max-width:360px){#startScreen .startBottom.compFixStartBottom{grid-template-columns:minmax(0,1fr) 74px}.compFixItem{grid-template-columns:44px minmax(0,1fr);gap:6px;padding:6px}.compFixGlyph{width:44px;min-height:62px}.compFixGlyph strong{font-size:15px}.compFixMeta{max-width:100px}}
`;}
  function injectLayoutStyles(doc){
    if(!doc||doc.querySelector?.('style[data-compendium-mobile-fix]'))return false;
    const style=doc.createElement('style');style.dataset.compendiumMobileFix='true';style.textContent=layoutCss();(doc.head||doc.documentElement)?.appendChild(style);return true;
  }

  function currentItems(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);
    const section=SECTION_ORDER.includes(viewState.section)?viewState.section:'cards';
    const cardFilter=CARD_FILTERS.includes(viewState.cardFilter)?viewState.cardFilter:'all';
    const items=filteredCatalog(section,{cardFilter,query:viewState.query,runState});
    const counts=catalogCounts(runState);
    return{runState,section,cardFilter,items:Array.isArray(items)?items:[],counts};
  }
  function fixedCompendiumHtml(runtimeRoot=root){
    const {section,cardFilter,items,counts}=currentItems(runtimeRoot);
    const tabs=SECTION_ORDER.map(key=>`<button type="button" class="pixelBtn ${section===key?'sel':''}" data-comp-fix-section="${escapeHtml(key)}">${escapeHtml(SECTION_LABELS[key]||key)} <b>${escapeHtml(counts[key]??'')}</b></button>`).join('');
    const filterHtml=section==='cards'?`<div class="compFixFilters">${CARD_FILTERS.map(key=>`<button type="button" class="pixelBtn ${cardFilter===key?'sel':''}" data-comp-fix-filter="${escapeHtml(key)}">${escapeHtml(CARD_FILTER_LABELS[key]||key)} ${escapeHtml(counts[key]??'')}</button>`).join('')}</div>`:'';
    const list=items.length?items.map(itemHtml).join(''):'<div class="compFixEmpty">조건에 맞는 항목이 없다.</div>';
    const selected=items.find(item=>item.id===viewState.selectedId)||null;
    const detail=selected?detailHtml(selected):'';
    const keywordCount=typeof Compendium?.keywordTerms==='function'?Compendium.keywordTerms().length:0;
    const progress=section==='cards'?` · 보유 ${counts.owned}/${counts.cards}${counts.signature?` · 시그니처 ${counts.signature-counts.locked}/${counts.signature}`:''}`:'';
    return`<div class="compFixShell" data-comp-fix-shell><div class="compFixHeader"><div><h2>도감</h2><p>현재 카드 풀과 규칙을 한곳에서 확인한다. 내부 팩 구분 대신 실제 획득·해금 상태를 표시한다.</p></div><button type="button" class="pixelBtn compFixClose" data-comp-fix-close>닫기</button></div><div class="compFixTabs">${tabs}</div>${filterHtml}<input class="compFixSearch" data-comp-fix-search type="search" placeholder="이름·효과·무늬·해금 상태 검색" value="${escapeHtml(viewState.query)}"><div class="compFixHelp" data-comp-fix-help hidden></div>${detail}<div class="compFixList" data-comp-fix-list>${list}</div><div class="compFixFooter"><span>${items.length}개 표시${progress} · 키워드 ${keywordCount}개</span><span>${escapeHtml(LAYOUT_FIX_STAGE)}</span></div></div>`;
  }

  function showKeywordHelp(runtimeRoot,term){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),help=doc?.querySelector?.('[data-comp-fix-help]'),definition=Compendium?.keywordDefinition?.(term);
    if(!help||!definition)return false;
    help.hidden=false;help.innerHTML=`<div class="compFixHelpHead"><b>${escapeHtml(definition.term||term)}</b><button type="button" class="pixelBtn" data-comp-fix-help-close>×</button></div><p>${escapeHtml(definition.description||'')}</p>`;
    const close=help.querySelector?.('[data-comp-fix-help-close]');if(close)close.onclick=()=>{help.hidden=true;help.innerHTML=''};return true;
  }
  function closeFixedCompendium(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),overlay=doc?.getElementById?.('overlay'),modal=doc?.getElementById?.('modal');
    overlay?.classList?.remove?.('compFixOpen');modal?.classList?.remove?.('compFixModal');
    if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else overlay?.classList?.remove?.('show');return true;
  }
  function selectItem(runtimeRoot,item){viewState.selectedId=item?.id||null;renderFixedCompendium(runtimeRoot)}
  function bindFixedCompendium(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal');if(!modal)return false;
    const {items}=currentItems(runtimeRoot);
    modal.querySelectorAll?.('[data-comp-fix-section]')?.forEach(button=>{button.onclick=()=>{viewState.section=button.dataset.compFixSection;viewState.query='';viewState.selectedId=null;renderFixedCompendium(runtimeRoot)}});
    modal.querySelectorAll?.('[data-comp-fix-filter]')?.forEach(button=>{button.onclick=()=>{viewState.cardFilter=button.dataset.compFixFilter;viewState.selectedId=null;renderFixedCompendium(runtimeRoot)}});
    const search=modal.querySelector?.('[data-comp-fix-search]');if(search)search.oninput=()=>{viewState.query=search.value;viewState.selectedId=null;renderFixedCompendium(runtimeRoot);const next=doc.querySelector?.('[data-comp-fix-search]');next?.focus?.();if(next)try{next.setSelectionRange(next.value.length,next.value.length)}catch(_error){}};
    modal.querySelectorAll?.('[data-comp-fix-index]')?.forEach(article=>{const open=event=>{if(event?.target?.closest?.('.compKeyword'))return;const item=items[Number(article.dataset.compFixIndex)];if(item)selectItem(runtimeRoot,item)};article.onclick=open;article.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(event)}}});
    modal.querySelectorAll?.('.compKeyword[data-keyword]')?.forEach(button=>{button.onclick=event=>{event.preventDefault();event.stopPropagation();showKeywordHelp(runtimeRoot,button.dataset.keyword)}});
    const detailClose=modal.querySelector?.('[data-comp-fix-detail-close]');if(detailClose)detailClose.onclick=()=>{viewState.selectedId=null;renderFixedCompendium(runtimeRoot)};
    const close=modal.querySelector?.('[data-comp-fix-close]');if(close)close.onclick=()=>closeFixedCompendium(runtimeRoot);return true;
  }
  function renderFixedCompendium(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),overlay=doc?.getElementById?.('overlay'),modal=doc?.getElementById?.('modal');
    if(!doc||!overlay||!modal||!Compendium?.cardCatalog)return false;
    ensureFieldStateBridge(activeRun(runtimeRoot));injectLayoutStyles(doc);overlay.classList?.remove?.('closing');overlay.classList?.add?.('show','compFixOpen');modal.classList?.add?.('compFixModal');modal.innerHTML=fixedCompendiumHtml(runtimeRoot);bindFixedCompendium(runtimeRoot);return currentItems(runtimeRoot);
  }
  function showFixedCompendium(runtimeRoot=root,section='cards',cardFilter='all'){
    viewState={section:SECTION_ORDER.includes(section)?section:'cards',cardFilter:CARD_FILTERS.includes(cardFilter)?cardFilter:'all',query:'',selectedId:null};return renderFixedCompendium(runtimeRoot);
  }

  function isCompendiumTrigger(button){if(!button||button.closest?.('#modal'))return false;if(button.dataset?.openCompendium!==undefined)return true;return String(button.textContent||'').trim()==='도감'}
  function fixStartEntry(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),startBottom=doc?.querySelector?.('#startScreen .startBottom');if(!startBottom)return false;
    injectLayoutStyles(doc);const button=startBottom.querySelector?.('[data-open-compendium]');if(!button)return false;startBottom.classList.add('compFixStartBottom');button.style?.removeProperty?.('width');button.style?.removeProperty?.('margin-bottom');const primary=startBottom.querySelector?.('.primary');if(primary&&button!==startBottom.lastElementChild)startBottom.appendChild(button);return true;
  }
  function installFieldBridgeHooks(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc)return false;
    if(!doc.__compendium8HFieldHook){doc.__compendium8HFieldHook=true;doc.addEventListener('click',event=>{const target=event.target?.closest?.('button');if(!target)return;if(target.dataset?.openCompendium!==undefined||target.dataset?.compSection==='fields'||String(target.textContent||'').trim()==='도감')ensureFieldStateBridge(activeRun(runtimeRoot))},true)}
    if(!doc.__compendium8HMobileLayoutHook){doc.__compendium8HMobileLayoutHook=true;doc.addEventListener('click',event=>{const button=event.target?.closest?.('button');if(!isCompendiumTrigger(button))return;event.preventDefault();event.stopImmediatePropagation();showFixedCompendium(runtimeRoot)},true)}
    return true;
  }
  function installLayoutObserver(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc)return false;injectLayoutStyles(doc);fixStartEntry(runtimeRoot);if(layoutObserver||typeof runtimeRoot?.MutationObserver!=='function')return true;layoutObserver=new runtimeRoot.MutationObserver(()=>fixStartEntry(runtimeRoot));layoutObserver.observe(doc.getElementById?.('app')||doc.body,{childList:true,subtree:true});return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(!Compendium?.keywordCatalog||!runtimeRoot?.document)return false;ensureFieldStateBridge(activeRun(runtimeRoot));wrapShowTerms(runtimeRoot);installFieldBridgeHooks(runtimeRoot);installLayoutObserver(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<100)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[8-H] 도감 런타임 브리지를 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function resetForTests(){installed=false;viewState={section:'cards',cardFilter:'all',query:'',selectedId:null};layoutObserver?.disconnect?.();layoutObserver=null}

  return{STAGE,LAYOUT_FIX_STAGE,SECTION_ORDER,SECTION_LABELS,CARD_FILTERS,CARD_FILTER_LABELS,BOSS_LABELS,activeRun,fieldStateView,ensureFieldStateBridge,fieldStateBridgeIsSerializable,termsCatalog,termsHtml,showTerms,wrapShowTerms,cardDefinition,isSignatureCard,cardUiCategory,cardOwnedInRun,signatureUnlocked,signatureBossLabel,decorateCardItem,cardCatalog,cardFilterMatch,sectionCatalog,searchableText,filteredCatalog,catalogCounts,itemBadges,itemHtml,detailHtml,layoutCss,injectLayoutStyles,currentItems,fixedCompendiumHtml,showKeywordHelp,closeFixedCompendium,bindFixedCompendium,renderFixedCompendium,showFixedCompendium,isCompendiumTrigger,fixStartEntry,installFieldBridgeHooks,installLayoutObserver,installBrowserRuntime,installWhenReady,resetForTests};
});
