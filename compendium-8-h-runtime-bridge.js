(function(root,factory){
  const api=factory(root,typeof module!=='undefined'?require('./compendium-8-h.js'):root.Compendium8H);
  if(typeof module!=='undefined')module.exports=api;
  root.Compendium8HRuntimeBridge=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Compendium){
  const STAGE='8-H';
  const LAYOUT_FIX_STAGE='8-H-MOBILE-LAYOUT-FIX';
  let installed=false;
  let layoutObserver=null;
  let viewState={section:'cards',cardFilter:'all',query:''};

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
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
  function fieldStateBridgeIsSerializable(runState){
    return !!runState&&!Object.keys(runState).includes('fieldState');
  }

  function termsHtml(){
    const rows=Compendium?.keywordCatalog?.()||[];
    return `<h2>용어 도움말</h2><p>현재 적용 중인 규칙을 기준으로 정리했다. 굵은 키워드를 누르면 짧은 설명을 다시 볼 수 있다.</p><div class="choiceList">${rows.map(row=>`<div class="choice"><b>${escapeHtml(row.term)}</b><span>${Compendium.highlightKeywordsText(row.description)}</span></div>`).join('')}<button class="choice" data-close-keyword-terms><b>닫기</b></button></div>`;
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

  function layoutCss(){return`
#overlay.compFixOpen{display:flex!important;align-items:stretch!important;justify-content:stretch!important;padding:0!important;background:#080b11f5;z-index:40}
#overlay.compFixOpen>.modal.compFixModal{width:100%!important;height:100%!important;max-height:none!important;padding:0!important;overflow:hidden!important;border:0!important;background:linear-gradient(180deg,#151d2b,#0b1018)!important;box-shadow:none!important}
.compFixShell{height:100%;min-height:0;display:flex;flex-direction:column;gap:8px;padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom));color:#f2ead8}
.compFixHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex:0 0 auto}.compFixHeader h2{margin:0;font-size:17px}.compFixHeader p{margin:3px 0 0!important;font-size:9px!important;line-height:1.35!important;color:#9eabc1!important}.compFixClose{flex:0 0 auto;padding:7px 10px!important}
.compFixTabs,.compFixFilters{display:flex;gap:5px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;flex:0 0 auto;padding:1px 0 2px}.compFixTabs::-webkit-scrollbar,.compFixFilters::-webkit-scrollbar{display:none}.compFixTabs .pixelBtn,.compFixFilters .pixelBtn{flex:0 0 auto;padding:5px 7px;font-size:9px;white-space:nowrap}.compFixTabs .sel,.compFixFilters .sel{box-shadow:0 0 0 2px #67d3d0 inset;color:#fff}
.compFixSearch{width:100%;flex:0 0 auto;background:#0b111b;color:#f2ead8;border:2px solid #000;box-shadow:0 0 0 2px #3b4965 inset;padding:8px 9px;font:inherit;font-size:10px;outline:none}.compFixSearch:focus{box-shadow:0 0 0 2px #67d3d0 inset}
.compFixHelp{flex:0 0 auto;background:#111827;border:2px solid #000;box-shadow:0 0 0 2px #52617d inset;padding:8px 9px;font-size:9px;line-height:1.4}.compFixHelp[hidden]{display:none}.compFixHelpHead{display:flex;align-items:center;justify-content:space-between;gap:8px}.compFixHelp b{color:#f4d98f;font-size:10px}.compFixHelp button{padding:2px 7px!important}.compFixHelp p{margin:4px 0 0!important;font-size:9px!important;color:#d4dceb!important}
.compFixList{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:grid;grid-template-columns:1fr;gap:8px;align-content:start;padding:2px 2px 10px;scrollbar-width:thin}
.compFixItem{display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;align-items:start;background:#111a28;border:2px solid #000;box-shadow:0 0 0 2px #364765 inset;padding:7px;min-width:0}.compFixItem.compFixTextOnly{grid-template-columns:1fr}.compFixGlyph{width:52px;min-height:70px;background:linear-gradient(180deg,#efe5cc,#dfcfb0);border:2px solid #000;box-shadow:0 0 0 2px #b5a47e inset;color:#252933;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center}.compFixGlyph.red{color:#b13e4b}.compFixGlyph strong{font-size:18px}.compFixGlyph small{font-size:7px;color:#5c6471}.compFixCopy{min-width:0}.compFixTitle{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.compFixTitle b{font-size:11px;line-height:1.3}.compFixMeta{font-size:8px;color:#f4d98f;white-space:nowrap}.compFixBadges{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.compFixBadges span{font-size:7px;background:#202b3e;padding:2px 4px;color:#b9c7dc}.compFixItem p{margin:6px 0 0!important;font-size:9px!important;line-height:1.5!important;color:#cbd5e4!important;overflow-wrap:anywhere}.compFixEmpty{font-size:10px;color:#9eabc1;text-align:center;padding:24px 8px}
.compFixFooter{display:flex;justify-content:space-between;align-items:center;gap:8px;flex:0 0 auto;font-size:8px;color:#9eabc1;padding-top:1px}
.compFixShell .compKeyword{display:inline!important;padding:0!important;border:0!important;background:none!important;color:#8fe0df!important;font:inherit!important;cursor:pointer!important;text-decoration:underline dotted;text-underline-offset:2px}.compFixShell .compKeyword strong{font-weight:900}.compFixShell .compKeyword:focus-visible{outline:1px solid #67d3d0;outline-offset:2px}
#startScreen .startBottom.compFixStartBottom{display:grid!important;grid-template-columns:minmax(0,1fr) 86px;gap:7px;align-items:stretch}.compFixStartBottom>[data-open-compendium]{width:auto!important;margin:0!important;padding:11px 8px!important;order:2}.compFixStartBottom>.primary{order:1;min-width:0}
@media(min-width:720px){.compFixShell{padding:18px 20px}.compFixList{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.compFixItem{grid-template-columns:62px minmax(0,1fr);padding:9px}.compFixGlyph{width:62px;min-height:82px}.compFixItem p{font-size:10px!important}.compFixHeader h2{font-size:20px}.compFixTabs .pixelBtn,.compFixFilters .pixelBtn{font-size:10px}}
@media(max-width:360px){#startScreen .startBottom.compFixStartBottom{grid-template-columns:minmax(0,1fr) 74px}.compFixItem{grid-template-columns:44px minmax(0,1fr);gap:6px;padding:6px}.compFixGlyph{width:44px;min-height:62px}.compFixGlyph strong{font-size:15px}}
`;}
  function injectLayoutStyles(doc){
    if(!doc||doc.querySelector?.('style[data-compendium-mobile-fix]'))return false;
    const style=doc.createElement('style');
    style.dataset.compendiumMobileFix='true';
    style.textContent=layoutCss();
    (doc.head||doc.documentElement)?.appendChild(style);
    return true;
  }

  function itemBadges(item){
    const badges=typeof Compendium?.itemBadges==='function'?Compendium.itemBadges(item):[];
    return Array.isArray(badges)?badges.filter(Boolean):[];
  }
  function itemDescription(item){return String(item?.description||item?.text||'설명 없음')}
  function keywordHtml(text){return typeof Compendium?.highlightKeywordsText==='function'?Compendium.highlightKeywordsText(text):escapeHtml(text)}
  function itemHtml(item,index){
    const badges=itemBadges(item).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    const badgeHtml=badges?`<div class="compFixBadges">${badges}</div>`:'';
    const description=`<p>${keywordHtml(itemDescription(item))}</p>`;
    if(item?.kind==='card'){
      const suit=suitSymbol(item.suit),rank=rankLabel(item.rank),pack=item.packId||item.category||'카드';
      return`<article class="compFixItem" data-comp-fix-index="${index}" data-comp-kind="card"><div class="compFixGlyph ${isRedSuit(item.suit)?'red':''}"><strong>${escapeHtml(rank)}${escapeHtml(suit)}</strong><small>${escapeHtml(pack)}</small></div><div class="compFixCopy"><div class="compFixTitle"><b>${escapeHtml(item.name||item.id||'카드')}</b><span class="compFixMeta">${escapeHtml(suit)} ${escapeHtml(rank)}</span></div>${badgeHtml}${description}</div></article>`;
    }
    return`<article class="compFixItem compFixTextOnly" data-comp-fix-index="${index}" data-comp-kind="${escapeHtml(item?.kind||'entry')}"><div class="compFixCopy"><div class="compFixTitle"><b>${escapeHtml(item?.name||item?.id||'항목')}</b><span class="compFixMeta">${escapeHtml(item?.meta||'')}</span></div>${badgeHtml}${description}</div></article>`;
  }

  function currentItems(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);
    const section=Compendium?.SECTION_ORDER?.includes?.(viewState.section)?viewState.section:'cards';
    const cardFilter=Compendium?.CARD_FILTERS?.includes?.(viewState.cardFilter)?viewState.cardFilter:'all';
    const items=typeof Compendium?.filteredCatalog==='function'?Compendium.filteredCatalog(section,{cardFilter,query:viewState.query,runState}):[];
    const counts=typeof Compendium?.catalogCounts==='function'?Compendium.catalogCounts(runState):{};
    return{runState,section,cardFilter,items:Array.isArray(items)?items:[],counts:counts||{}};
  }

  function fixedCompendiumHtml(runtimeRoot=root){
    const {section,cardFilter,items,counts}=currentItems(runtimeRoot);
    const sections=Compendium?.SECTION_ORDER||['cards'];
    const labels=Compendium?.SECTION_LABELS||{cards:'카드'};
    const filters=Compendium?.CARD_FILTERS||['all'];
    const filterLabels=Compendium?.CARD_FILTER_LABELS||{all:'전체'};
    const tabs=sections.map(key=>`<button type="button" class="pixelBtn ${section===key?'sel':''}" data-comp-fix-section="${escapeHtml(key)}">${escapeHtml(labels[key]||key)} <b>${escapeHtml(counts[key]??'')}</b></button>`).join('');
    const filterHtml=section==='cards'?`<div class="compFixFilters">${filters.map(key=>`<button type="button" class="pixelBtn ${cardFilter===key?'sel':''}" data-comp-fix-filter="${escapeHtml(key)}">${escapeHtml(filterLabels[key]||key)} ${escapeHtml(counts[key]??'')}</button>`).join('')}</div>`:'';
    const list=items.length?items.map(itemHtml).join(''):'<div class="compFixEmpty">조건에 맞는 항목이 없다.</div>';
    const keywordCount=typeof Compendium?.keywordTerms==='function'?Compendium.keywordTerms().length:0;
    return`<div class="compFixShell" data-comp-fix-shell><div class="compFixHeader"><div><h2>도감</h2><p>카드·유물·상태와 현재 규칙을 확인한다. 굵은 키워드를 누르면 설명이 이 화면 안에서 열린다.</p></div><button type="button" class="pixelBtn compFixClose" data-comp-fix-close>닫기</button></div><div class="compFixTabs">${tabs}</div>${filterHtml}<input class="compFixSearch" data-comp-fix-search type="search" placeholder="이름·효과·키워드 검색" value="${escapeHtml(viewState.query)}"><div class="compFixHelp" data-comp-fix-help hidden></div><div class="compFixList" data-comp-fix-list>${list}</div><div class="compFixFooter"><span>${items.length}개 표시 · 키워드 ${keywordCount}개</span><span>${escapeHtml(LAYOUT_FIX_STAGE)}</span></div></div>`;
  }

  function showKeywordHelp(runtimeRoot,term){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    const help=doc?.querySelector?.('[data-comp-fix-help]');
    const definition=Compendium?.keywordDefinition?.(term);
    if(!help||!definition)return false;
    help.hidden=false;
    help.innerHTML=`<div class="compFixHelpHead"><b>${escapeHtml(definition.term||term)}</b><button type="button" class="pixelBtn" data-comp-fix-help-close>×</button></div><p>${escapeHtml(definition.description||'')}</p>`;
    const close=help.querySelector?.('[data-comp-fix-help-close]');
    if(close)close.onclick=()=>{help.hidden=true;help.innerHTML=''};
    return true;
  }
  function closeFixedCompendium(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    const overlay=doc?.getElementById?.('overlay'),modal=doc?.getElementById?.('modal');
    overlay?.classList?.remove?.('compFixOpen');
    modal?.classList?.remove?.('compFixModal');
    if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else overlay?.classList?.remove?.('show');
    return true;
  }
  function bindFixedCompendium(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal');
    if(!modal)return false;
    modal.querySelectorAll?.('[data-comp-fix-section]')?.forEach(button=>{button.onclick=()=>{viewState.section=button.dataset.compFixSection;viewState.query='';renderFixedCompendium(runtimeRoot)}});
    modal.querySelectorAll?.('[data-comp-fix-filter]')?.forEach(button=>{button.onclick=()=>{viewState.cardFilter=button.dataset.compFixFilter;renderFixedCompendium(runtimeRoot)}});
    const search=modal.querySelector?.('[data-comp-fix-search]');
    if(search)search.oninput=()=>{viewState.query=search.value;renderFixedCompendium(runtimeRoot);const next=doc.querySelector?.('[data-comp-fix-search]');next?.focus?.();if(next)try{next.setSelectionRange(next.value.length,next.value.length)}catch(_error){}};
    modal.querySelectorAll?.('.compKeyword[data-keyword]')?.forEach(button=>{button.onclick=event=>{event.preventDefault();event.stopPropagation();showKeywordHelp(runtimeRoot,button.dataset.keyword)}});
    const close=modal.querySelector?.('[data-comp-fix-close]');if(close)close.onclick=()=>closeFixedCompendium(runtimeRoot);
    return true;
  }
  function renderFixedCompendium(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),overlay=doc?.getElementById?.('overlay'),modal=doc?.getElementById?.('modal');
    if(!doc||!overlay||!modal||!Compendium?.filteredCatalog)return false;
    ensureFieldStateBridge(activeRun(runtimeRoot));
    injectLayoutStyles(doc);
    overlay.classList?.remove?.('closing');
    overlay.classList?.add?.('show','compFixOpen');
    modal.classList?.add?.('compFixModal');
    modal.innerHTML=fixedCompendiumHtml(runtimeRoot);
    bindFixedCompendium(runtimeRoot);
    return currentItems(runtimeRoot);
  }
  function showFixedCompendium(runtimeRoot=root,section='cards',cardFilter='all'){
    viewState={section:Compendium?.SECTION_ORDER?.includes?.(section)?section:'cards',cardFilter:Compendium?.CARD_FILTERS?.includes?.(cardFilter)?cardFilter:'all',query:''};
    return renderFixedCompendium(runtimeRoot);
  }

  function isCompendiumTrigger(button){
    if(!button||button.closest?.('#modal'))return false;
    if(button.dataset?.openCompendium!==undefined)return true;
    return String(button.textContent||'').trim()==='도감';
  }
  function fixStartEntry(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),startBottom=doc?.querySelector?.('#startScreen .startBottom');
    if(!startBottom)return false;
    injectLayoutStyles(doc);
    const button=startBottom.querySelector?.('[data-open-compendium]');
    if(!button)return false;
    startBottom.classList.add('compFixStartBottom');
    button.style?.removeProperty?.('width');
    button.style?.removeProperty?.('margin-bottom');
    const primary=startBottom.querySelector?.('.primary');
    if(primary&&button!==startBottom.lastElementChild)startBottom.appendChild(button);
    return true;
  }
  function installFieldBridgeHooks(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    if(!doc)return false;
    if(!doc.__compendium8HFieldHook){
      doc.__compendium8HFieldHook=true;
      doc.addEventListener('click',event=>{
        const target=event.target?.closest?.('button');
        if(!target)return;
        if(target.dataset?.openCompendium!==undefined||target.dataset?.compSection==='fields'||String(target.textContent||'').trim()==='도감')ensureFieldStateBridge(activeRun(runtimeRoot));
      },true);
    }
    if(!doc.__compendium8HMobileLayoutHook){
      doc.__compendium8HMobileLayoutHook=true;
      doc.addEventListener('click',event=>{
        const button=event.target?.closest?.('button');
        if(!isCompendiumTrigger(button))return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showFixedCompendium(runtimeRoot);
      },true);
    }
    return true;
  }
  function installLayoutObserver(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    if(!doc)return false;
    injectLayoutStyles(doc);
    fixStartEntry(runtimeRoot);
    if(layoutObserver||typeof runtimeRoot?.MutationObserver!=='function')return true;
    layoutObserver=new runtimeRoot.MutationObserver(()=>fixStartEntry(runtimeRoot));
    layoutObserver.observe(doc.getElementById?.('app')||doc.body,{childList:true,subtree:true});
    return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;
    if(!Compendium?.keywordCatalog||!runtimeRoot?.document)return false;
    ensureFieldStateBridge(activeRun(runtimeRoot));
    wrapShowTerms(runtimeRoot);
    installFieldBridgeHooks(runtimeRoot);
    installLayoutObserver(runtimeRoot);
    installed=true;
    return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{
      if(installBrowserRuntime(runtimeRoot))return;
      if(attempts++<100)setTimeout(attempt,25);
      else runtimeRoot?.console?.warn?.('[8-H] 도감 런타임 브리지를 찾지 못했습니다.');
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }
  function resetForTests(){installed=false;viewState={section:'cards',cardFilter:'all',query:''};layoutObserver?.disconnect?.();layoutObserver=null}

  return{STAGE,LAYOUT_FIX_STAGE,activeRun,fieldStateView,ensureFieldStateBridge,fieldStateBridgeIsSerializable,termsHtml,showTerms,wrapShowTerms,layoutCss,injectLayoutStyles,itemHtml,currentItems,fixedCompendiumHtml,showKeywordHelp,closeFixedCompendium,bindFixedCompendium,renderFixedCompendium,showFixedCompendium,isCompendiumTrigger,fixStartEntry,installFieldBridgeHooks,installLayoutObserver,installBrowserRuntime,installWhenReady,resetForTests};
});
