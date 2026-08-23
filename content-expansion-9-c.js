(function(root,factory){
  const RunFields=typeof module!=='undefined'?require('./run-fields.js'):root.RunFields;
  const RelicSystem=typeof module!=='undefined'?require('./relics.js'):root.RelicSystem;
  const ContractSystem=typeof module!=='undefined'?require('./contracts.js'):root.ContractSystem;
  const CombatEffects=typeof module!=='undefined'?require('./combat-effects.js'):root.CombatEffects;
  const StatusSystem=typeof module!=='undefined'?require('./status-system.js'):root.StatusSystem;
  const TrumpFields=typeof module!=='undefined'?require('./trump-fields.js'):root.TrumpFields;
  const api=factory(RunFields,RelicSystem,ContractSystem,CombatEffects,StatusSystem,TrumpFields,root);
  if(typeof module!=='undefined')module.exports=api;
  root.ContentExpansion9C=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(RunFields,RelicSystem,ContractSystem,CombatEffects,StatusSystem,TrumpFields,root){
  const STAGE='9-C';
  const RELIC_IDS=Object.freeze(['original_stamp','pure_crown','ash_needle','hunter_tag']);
  const OFFERING_IDS=Object.freeze(['river_crossing','dominant_hand','draw_ledger']);
  const STATUS_IDS=Object.freeze(['scar','mark']);
  const FIELD_IDS=Object.freeze(['loaded_table','wide_table']);
  let installed=false;

  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function catalogSummary(){
    return{
      stage:STAGE,
      added:{relics:RELIC_IDS.length,offerings:OFFERING_IDS.length,statuses:STATUS_IDS.length,fields:FIELD_IDS.length},
      totals:{
        relics:Object.keys(RelicSystem?.RELIC_DEFINITIONS||{}).length,
        contracts:Object.keys(ContractSystem?.CONTRACT_DEFINITIONS||{}).length,
        taboos:Object.keys(ContractSystem?.TABOO_DEFINITIONS||{}).length,
        offerings:Object.keys(ContractSystem?.OFFERINGS||{}).length,
        statuses:Object.keys(CombatEffects?.STATUS_DEFINITIONS||{}).length,
        fields:Object.keys(TrumpFields?.FIELD_DEFINITIONS||{}).length
      }
    };
  }
  function validateContent(){
    const errors=[];
    for(const id of RELIC_IDS){const definition=RelicSystem?.relicDefinition?.(id);if(!definition)errors.push(`relic ${id}: missing`);else errors.push(...(RelicSystem.validateRelicDefinition?.(definition,id)||[]).map(error=>`relic ${id}: ${error}`))}
    for(const id of OFFERING_IDS)if(!ContractSystem?.offeringDefinition?.(id))errors.push(`offering ${id}: missing`);
    errors.push(...(ContractSystem?.validateRegistry?.()||[]));
    for(const id of STATUS_IDS){if(!CombatEffects?.STATUS_DEFINITIONS?.[id])errors.push(`status ${id}: missing`);if(!StatusSystem?.STATUS_PRESENTATION?.[id])errors.push(`status ${id}: missing presentation`)}
    errors.push(...(CombatEffects?.validateStatusRegistry?.()||[]));
    for(const id of FIELD_IDS)if(!TrumpFields?.FIELD_DEFINITIONS?.[id])errors.push(`field ${id}: missing`);
    errors.push(...(TrumpFields?.validateFieldRegistry?.()||[]));
    return errors;
  }
  function availableFieldOfferIds(runState){
    if(!runState)return[];const state=RunFields.ensureRunFieldState(runState),owned=new Set(state.owned||[]);return FIELD_IDS.filter(id=>!owned.has(id));
  }
  function acquireFieldOffer(runState,id,{source='event:9-c'}={}){
    if(!FIELD_IDS.includes(id))throw new TypeError(`Unknown 9-C field offer: ${String(id)}`);
    return RunFields.acquireField(runState,id,{activate:true,source});
  }
  function fieldOfferHtml(id){
    const field=TrumpFields.FIELD_DEFINITIONS[id];
    return `<button class="choice" data-9c-field="${escapeHtml(id)}"><b>필드 · ${escapeHtml(field.label)}</b><span>${escapeHtml(field.description)}</span></button>`;
  }
  function showFieldOfferings(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot),ids=availableFieldOfferIds(runState);if(!runState||!node||node.type!=='event'||!ids.length)return false;
    const html=`<h2>필드 설계</h2><p>하나를 설계하면 보유 목록에 추가되고 다음 전투 한 번에 예약된다. 필드가 없는 전투가 기본이다.</p><div class="choiceList">${ids.map(fieldOfferHtml).join('')}<button class="choice" data-back-9c-field><b>돌아가기</b></button></div>`;
    if(typeof runtimeRoot?.showModal==='function')runtimeRoot.showModal(html);else{const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show')}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    doc?.querySelectorAll?.('[data-9c-field]')?.forEach(button=>{button.onclick=()=>takeFieldOfferFromEvent(runtimeRoot,button.dataset['9cField']||button.getAttribute?.('data-9c-field'),node.id)});
    const back=doc?.querySelector?.('[data-back-9c-field]');if(back)back.onclick=()=>runtimeRoot.showEvent?.(node);return ids;
  }
  function takeFieldOfferFromEvent(runtimeRoot=root,id,nodeId){
    const runState=activeRun(runtimeRoot);if(!runState)return{ok:false,reason:'no_run'};
    const node=Array.isArray(runState.map)?runState.map.find(entry=>entry.id===nodeId):null;if(!node||node.type!=='event')return{ok:false,reason:'invalid_node'};
    if(!availableFieldOfferIds(runState).includes(id))return{ok:false,reason:'unavailable'};
    const result=acquireFieldOffer(runState,id,{source:`event:${nodeId}`});runtimeRoot.sfx?.('reward');runtimeRoot.completeNode?.(node);return{ok:true,...result};
  }
  function decorateEvent(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc||node?.type!=='event'||!availableFieldOfferIds(runState).length)return false;
    const list=doc.getElementById?.('modal')?.querySelector?.('.choiceList');if(!list||list.querySelector?.('[data-open-9c-fields]'))return false;
    const button=doc.createElement('button');button.className='choice';button.type='button';button.dataset.open9cFields='true';button.setAttribute?.('data-open-9c-fields','true');button.innerHTML='<b>필드 설계</b><span>절충형 필드를 하나 설계하고 다음 전투 한 번에 예약한다.</span>';button.onclick=()=>showFieldOfferings(runtimeRoot,node);list.appendChild(button);return true;
  }
  function wrapShowEvent(runtimeRoot=root){
    const original=runtimeRoot?.showEvent;if(typeof original!=='function')return false;if(original.__contentExpansion9C)return true;
    const wrapped=function(node,...args){const result=original.call(this,node,...args);decorateEvent(runtimeRoot,node);return result};wrapped.__contentExpansion9C=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;const errors=validateContent();if(errors.length){runtimeRoot?.console?.error?.('[9-C] 콘텐츠 정의 오류',errors);return false}
    if(typeof runtimeRoot?.showEvent!=='function'||!RunFields?.acquireField)return false;wrapShowEvent(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[9-C] 이벤트 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,RELIC_IDS,OFFERING_IDS,STATUS_IDS,FIELD_IDS,activeRun,catalogSummary,validateContent,availableFieldOfferIds,acquireFieldOffer,fieldOfferHtml,showFieldOfferings,takeFieldOfferFromEvent,decorateEvent,wrapShowEvent,installBrowserRuntime,installWhenReady};
});