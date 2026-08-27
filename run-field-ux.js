(function(root,factory){
  const RunFields=typeof module!=='undefined'?require('./run-fields.js'):root.RunFields;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const api=factory(RunFields,EncounterRules,root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.RunFieldUX=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(RunFields,EncounterRules,root){
  const VERSION='M8-1';
  let installed=false;

  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function activeBattle(runtimeRoot=root){if(runtimeRoot?.battle)return runtimeRoot.battle;try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function sourceLabel(source){const labels={event:'이벤트',shop:'상점',card:'카드',boss:'보스',elite:'엘리트',relic:'유물',contract:'계약',scripted:'특수 효과'};return labels[source?.type]||'특수 효과'}
  function definitionModel(id){const definition=RunFields?.fieldDefinition?.(id);if(!definition)return null;return{id:definition.id,label:definition.label||definition.name||definition.id,description:definition.description||''}}
  function fieldLoadoutModel(runState){
    if(!runState||!RunFields?.ensureRunFieldState)return{slotCount:1,owned:[],queued:null,empty:true};
    const state=RunFields.ensureRunFieldState(runState),queuedId=state.queuedFieldId||null;
    const owned=state.owned.map(id=>definitionModel(id)).filter(Boolean).map(field=>({...field,queued:field.id===queuedId,status:field.id===queuedId?'예약됨':'보유',actionLabel:field.id===queuedId?'예약됨':queuedId?'교체 예약':'다음 전투 예약'}));
    const queued=queuedId?owned.find(field=>field.id===queuedId)||definitionModel(queuedId):null;
    return{slotCount:1,owned,queued:queued?{...queued,source:state.queuedSource||null}:null,empty:!queuedId,ownedCount:owned.length};
  }
  function injectStyles(doc){
    if(!doc||doc.querySelector?.('style[data-run-field-ux]'))return;
    const style=doc.createElement('style');style.dataset.runFieldUx='true';style.textContent=`
#runFieldLoadoutPanel{margin:6px 10px 0;padding:7px 8px;min-height:72px;background:linear-gradient(180deg,#171f2e,#101722);position:relative;z-index:4}
#runFieldLoadoutPanel .fieldUxHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;font-size:10px;color:#d7c78e}
#runFieldLoadoutPanel .fieldUxBody{display:grid;grid-template-columns:minmax(108px,.9fr) minmax(0,2fr);gap:6px;align-items:stretch}
#runFieldLoadoutPanel .fieldQueueSlot{min-height:48px;border:2px solid #000;box-shadow:0 0 0 2px #596b8c inset;background:#101826;padding:5px;display:flex;flex-direction:column;justify-content:center;position:relative}
#runFieldLoadoutPanel .fieldQueueSlot.empty{border-style:dashed;color:#8290a8;background:#0b111a}
#runFieldLoadoutPanel .fieldQueueSlot b{font-size:10px;line-height:1.15}.fieldQueueSlot span{margin-top:3px;font-size:8px;line-height:1.2;color:#aebbd0}
#runFieldLoadoutPanel .fieldQueueSlot button{margin-top:4px;align-self:flex-start;border:0;background:transparent;color:#e6b76f;padding:0;font-size:8px;text-decoration:underline;cursor:pointer}
#runFieldOwnedList{display:flex;gap:5px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;min-width:0}#runFieldOwnedList::-webkit-scrollbar{display:none}
.fieldOwnedCard{flex:0 0 114px;min-height:48px;border:2px solid #000;background:linear-gradient(180deg,#27334a,#182131);box-shadow:0 0 0 2px #4c5f80 inset;padding:5px;text-align:left;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;gap:3px}
.fieldOwnedCard[aria-pressed=true]{background:linear-gradient(180deg,#305c61,#1b3337);box-shadow:0 0 0 2px #69aeb0 inset}.fieldOwnedCard:disabled{opacity:.82;cursor:default}
.fieldOwnedCard b{font-size:9px;line-height:1.15}.fieldOwnedCard span{font-size:8px;line-height:1.2;color:#aebbd0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.fieldOwnedCard em{font-style:normal;font-size:8px;color:#f0ca74}
.fieldInstallBanner{position:absolute;z-index:24;left:8px;right:8px;top:78px;padding:10px;border:2px solid #000;background:#13262af5;box-shadow:0 0 0 2px #67d3d0 inset,4px 4px 0 #0008;pointer-events:none;animation:fieldInstallIn .22s cubic-bezier(.2,.8,.2,1),fieldInstallOut .28s ease 2.15s forwards}
.fieldInstallBanner .kicker{font-size:9px;color:#7ce0dc}.fieldInstallBanner b{display:block;margin-top:2px;font-size:14px}.fieldInstallBanner span{display:block;margin-top:4px;font-size:10px;line-height:1.35;color:#d3d9e7}
@keyframes fieldInstallIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@keyframes fieldInstallOut{to{opacity:0;transform:translateY(-6px)}}
@media(max-width:420px){#runFieldLoadoutPanel{padding:6px}.fieldOwnedCard{flex-basis:104px}#runFieldLoadoutPanel .fieldUxBody{grid-template-columns:104px minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.fieldInstallBanner{animation:none}}
`;
    doc.head?.appendChild(style);
  }
  function queueOwnedField(runtimeRoot=root,id){
    const runState=activeRun(runtimeRoot);if(!runState)return{changed:false,reason:'no_run'};
    const result=RunFields.queueField(runState,id,{source:'manual:field-panel'});
    if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx(result.changed?'reward':'click');
    if(typeof runtimeRoot?.renderMap==='function')runtimeRoot.renderMap();
    return result;
  }
  function clearQueuedField(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return{changed:false,reason:'no_run'};
    const result=RunFields.activateField(runState,null,{source:'manual:field-panel'});
    if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');
    if(typeof runtimeRoot?.renderMap==='function')runtimeRoot.renderMap();
    return result;
  }
  function renderMapFieldPanel(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;
    injectStyles(doc);const model=fieldLoadoutModel(runState),mapScreen=doc.getElementById?.('mapScreen'),mapWrap=doc.getElementById?.('mapWrap');if(!mapScreen||!mapWrap)return model;
    let panel=doc.getElementById?.('runFieldLoadoutPanel');if(!panel){panel=doc.createElement('section');panel.id='runFieldLoadoutPanel';panel.className='pixel';panel.dataset.m8FieldPanel='true';mapWrap.insertAdjacentElement('beforebegin',panel)}
    mapScreen.classList.add('hasFieldUx');const queued=model.queued;
    panel.innerHTML=`<div class="fieldUxHead"><b>필드 카드</b><span>보유 ${model.ownedCount} · 다음 전투 슬롯 1칸</span></div><div class="fieldUxBody"><div class="fieldQueueSlot ${queued?'':'empty'}" data-run-field-slot="${queued?escapeHtml(queued.id):''}">${queued?`<b>다음 전투 · ${escapeHtml(queued.label)}</b><span>${escapeHtml(queued.description)}</span><button type="button" data-run-field-clear>예약 해제</button>`:'<b>다음 전투 필드</b><span>비어 있음 · 보유 필드에서 예약할 수 있다.</span>'}</div><div id="runFieldOwnedList" aria-label="보유 필드 카드">${model.owned.length?model.owned.map(field=>`<button type="button" class="fieldOwnedCard" data-run-field-owned="${escapeHtml(field.id)}" data-run-field-queue="${escapeHtml(field.id)}" aria-pressed="${field.queued?'true':'false'}" ${field.queued?'disabled':''}><b>${escapeHtml(field.label)}</b><span>${escapeHtml(field.description)}</span><em>${escapeHtml(field.actionLabel)}</em></button>`).join(''):'<div class="fieldQueueSlot empty"><b>보유 필드 없음</b><span>이벤트·상점 등에서 필드를 얻을 수 있다.</span></div>'}</div></div>`;
    for(const button of panel.querySelectorAll?.('[data-run-field-queue]')||[])button.onclick=()=>queueOwnedField(runtimeRoot,button.dataset.runFieldQueue);
    const clear=panel.querySelector?.('[data-run-field-clear]');if(clear)clear.onclick=()=>clearQueuedField(runtimeRoot);return model;
  }
  function offerStatus(runState,fieldId){
    const state=RunFields.ensureRunFieldState(runState),owned=state.owned.includes(fieldId),queued=state.queuedFieldId===fieldId,replace=!!state.queuedFieldId&&!queued;
    if(queued)return'보유 중 · 예약됨';if(owned)return replace?'보유 중 · 교체 예약':'보유 중 · 다음 전투 예약';return replace?'신규 보유 · 교체 예약':'신규 보유 · 다음 전투 예약';
  }
  function decorateEventOffer(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),button=doc?.querySelector?.('#modal [data-run-field-event]');if(!runState||!button)return false;
    const fieldId=RunFields.fieldOfferIdForNode(node,'event'),definition=RunFields.fieldDefinition(fieldId);if(!definition)return false;const status=offerStatus(runState,fieldId);button.dataset.runFieldOfferStatus=status;button.dataset.runFieldOfferId=fieldId;
    button.innerHTML=`<b>${escapeHtml(status)} · ${escapeHtml(definition.label||definition.name)}</b><span>${escapeHtml(definition.description||'')} · 필드 슬롯 1칸 · 다음 전투 1회 적용</span>`;return true;
  }
  function decorateShopOffer(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),button=doc?.querySelector?.('#modal [data-run-field-shop]');if(!runState||!button)return false;
    const fieldId=RunFields.fieldOfferIdForNode(node,'shop'),definition=RunFields.fieldDefinition(fieldId);if(!definition)return false;const state=RunFields.ensureRunFieldState(runState),owned=state.owned.includes(fieldId),status=offerStatus(runState,fieldId),price=owned?'재예약 무료':`${RunFields.SHOP_FIELD_COST}G`;button.dataset.runFieldOfferStatus=status;button.dataset.runFieldOfferId=fieldId;
    button.innerHTML=`<b>${escapeHtml(status)} · ${escapeHtml(definition.label||definition.name)}</b><span>${escapeHtml(definition.description||'')} · ${escapeHtml(price)} · 필드 슬롯 1칸</span>`;return true;
  }
  function fieldInstallationModel(state){
    const applied=state?.runFieldApplied;if(!applied?.id)return null;const definition=RunFields.fieldDefinition(applied.id)||state.field;if(!definition)return null;return{id:applied.id,label:definition.label||definition.name||applied.label||applied.id,description:definition.description||state.field?.description||'',source:applied.source||state.fieldSource||null};
  }
  function presentFieldInstallation(state,runtimeRoot=root){
    const model=fieldInstallationModel(state);if(!model||state.fieldInstallationPresented)return model;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc)return model;injectStyles(doc);const arena=doc.getElementById?.('arena');if(!arena)return model;
    arena.querySelector?.('.fieldInstallBanner')?.remove?.();const banner=doc.createElement('div');banner.className='fieldInstallBanner';banner.dataset.runFieldInstallation=model.id;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.innerHTML=`<div class="kicker">플레이어 필드 설치 · ${escapeHtml(sourceLabel(model.source))}</div><b>${escapeHtml(model.label)}</b><span>${escapeHtml(model.description)}</span>`;arena.appendChild(banner);state.fieldInstallationPresented=true;setTimeout(()=>banner.remove(),2600);return model;
  }
  function wrapRenderMap(runtimeRoot=root){if(typeof runtimeRoot?.renderMap!=='function')return false;if(runtimeRoot.renderMap.__m8FieldUx)return true;const original=runtimeRoot.renderMap;const wrapped=function(...args){const result=original.apply(this,args);renderMapFieldPanel(runtimeRoot);return result};wrapped.__m8FieldUx=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true}
  function wrapRenderBattle(runtimeRoot=root){if(typeof runtimeRoot?.renderBattle!=='function')return false;if(runtimeRoot.renderBattle.__m8FieldUx)return true;const original=runtimeRoot.renderBattle;const wrapped=function(...args){const result=original.apply(this,args);presentFieldInstallation(activeBattle(runtimeRoot),runtimeRoot);return result};wrapped.__m8FieldUx=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function wrapStartBattle(runtimeRoot=root){if(typeof runtimeRoot?.startBattle!=='function')return false;if(runtimeRoot.startBattle.__m8FieldUx)return true;const original=runtimeRoot.startBattle;const wrapped=function(...args){const result=original.apply(this,args);presentFieldInstallation(activeBattle(runtimeRoot),runtimeRoot);return result};wrapped.__m8FieldUx=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true}
  function wrapShowEvent(runtimeRoot=root){if(typeof runtimeRoot?.showEvent!=='function')return false;if(runtimeRoot.showEvent.__m8FieldUx)return true;const original=runtimeRoot.showEvent;const wrapped=function(node,...args){const result=original.call(this,node,...args);decorateEventOffer(runtimeRoot,node);return result};wrapped.__m8FieldUx=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true}
  function wrapShowShop(runtimeRoot=root){if(typeof runtimeRoot?.showShop!=='function')return false;if(runtimeRoot.showShop.__m8FieldUx)return true;const original=runtimeRoot.showShop;const wrapped=function(node,...args){const result=original.call(this,node,...args);decorateShopOffer(runtimeRoot,node);return result};wrapped.__m8FieldUx=true;wrapped.__legacyShowShop=original;runtimeRoot.showShop=wrapped;return true}
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(!RunFields||typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.startBattle!=='function')return false;
    injectStyles(runtimeRoot.document||(typeof document!=='undefined'?document:null));wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);wrapStartBattle(runtimeRoot);wrapShowEvent(runtimeRoot);wrapShowShop(runtimeRoot);runtimeRoot.queueRunFieldFromMap=id=>queueOwnedField(runtimeRoot,id);runtimeRoot.clearRunFieldReservation=()=>clearQueuedField(runtimeRoot);installed=true;if(activeRun(runtimeRoot))renderMapFieldPanel(runtimeRoot);return true;
  }
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;attempts++;if(attempts<80)setTimeout(attempt,25);else console.warn('[run-field-ux] 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true}
  return{VERSION,activeRun,activeBattle,sourceLabel,definitionModel,fieldLoadoutModel,queueOwnedField,clearQueuedField,renderMapFieldPanel,offerStatus,decorateEventOffer,decorateShopOffer,fieldInstallationModel,presentFieldInstallation,wrapRenderMap,wrapRenderBattle,wrapStartBattle,wrapShowEvent,wrapShowShop,installBrowserRuntime,installWhenReady};
});
