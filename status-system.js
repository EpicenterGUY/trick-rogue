(function(root,factory){
  const CombatEffects=typeof module!=='undefined'?require('./combat-effects.js'):root.CombatEffects;
  const api=factory(CombatEffects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.StatusSystem=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CombatEffects,root){
  const STATUS_UI_VERSION='6-2A';
  const STATUS_PRESENTATION=Object.freeze({
    shield:Object.freeze({id:'shield',label:'보호막',kind:'buff',chipClass:'cyan',description:'받는 피해를 현재 수치만큼 먼저 흡수한다.',timing:'피해를 받을 때'}),
    bleed:Object.freeze({id:'bleed',label:'출혈',kind:'debuff',chipClass:'red',description:'트릭 종료 시 현재 수치만큼 피해를 받고, 발동 후 1 감소한다.',timing:'트릭 종료'}),
    poison:Object.freeze({id:'poison',label:'중독',kind:'reserved',chipClass:'gold',description:'규칙이 아직 확정되지 않아 현재 전투에서는 자동 발동하지 않는다.',timing:'미정'})
  });
  let installed=false;

  function combatDefinition(id){return CombatEffects?.STATUS_DEFINITIONS?.[id]||null}
  function statusPresentation(id){return STATUS_PRESENTATION[id]||Object.freeze({id,label:id,kind:'status',chipClass:'',description:'추가 설명 없음.',timing:'-'})}
  function statusDefinition(id){
    const definition=combatDefinition(id);if(!definition)return null;
    const presentation=statusPresentation(id);
    return Object.freeze({...definition,...presentation,implemented:definition.implemented===true});
  }
  function statusCatalog(){return Object.keys(CombatEffects?.STATUS_DEFINITIONS||{}).map(statusDefinition).filter(Boolean)}
  function statusValue(statuses,actor,id){return CombatEffects?.getStatusValue?CombatEffects.getStatusValue(statuses,actor,id):Math.max(0,Number(statuses?.[actor]?.[id])||0)}
  function activeStatusEntries(statuses,actor,{includeInactive=false}={}){
    if(!statuses)return[];
    return statusCatalog().filter(def=>includeInactive||def.implemented).map(def=>({
      id:def.id,actor,label:def.label,value:statusValue(statuses,actor,def.id),kind:def.kind,chipClass:def.chipClass,
      description:def.description,timing:def.timing,implemented:def.implemented,dispellable:def.dispellable,duration:def.duration
    })).filter(entry=>entry.value>0);
  }
  function reservationEntries(state){
    return (Array.isArray(state?.reservations)?state.reservations:[]).map((reservation,index)=>({
      id:reservation.id||`reservation-${index}`,kind:'reservation',label:reservation.label||'예약 효과',value:null,description:'지정된 시점에 한 번 처리되는 예약 효과다.'
    }));
  }
  function statusHudModel(state,{includeInactive=false}={}){
    const statuses=state?.statuses||null;
    return{
      player:activeStatusEntries(statuses,'player',{includeInactive}),
      enemy:activeStatusEntries(statuses,'enemy',{includeInactive}),
      reservations:reservationEntries(state)
    };
  }
  function statusDetail(id,{actor='player',value=0}={}){
    const definition=statusDefinition(id);if(!definition)return null;
    return{
      id,actor,label:definition.label,value:Math.max(0,Number(value)||0),kind:definition.kind,description:definition.description,
      timing:definition.timing,duration:definition.duration,dispellable:definition.dispellable,implemented:definition.implemented,
      stateLabel:definition.implemented?'사용 중':'규칙 미확정'
    };
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function chipHtml(entry,{enemy=false}={}){
    const prefix=enemy?'적 ':'';
    return `<button type="button" class="stateChip statusInfoChip ${escapeHtml(entry.chipClass||'')}" data-status-id="${escapeHtml(entry.id)}" data-status-actor="${enemy?'enemy':'player'}" title="${escapeHtml(entry.description)}">${prefix}${escapeHtml(entry.label)} ${entry.value}</button>`;
  }
  function reservationHtml(entry){return `<span class="stateChip gold" title="${escapeHtml(entry.description)}">예약 · ${escapeHtml(entry.label)}</span>`}
  function runtimeBattle(runtimeRoot=root){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function injectStyles(doc){
    if(!doc||doc.querySelector?.('style[data-status-system-ui]'))return;
    const style=doc.createElement('style');style.dataset.statusSystemUi='true';style.textContent=`
.statusInfoChip{font:inherit;cursor:pointer;border:0}.statusInfoChip:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.statusRuleNote{font-size:10px;line-height:1.5;color:#aeb8ca}.statusRuleNote b{color:#fff}
`;
    doc.head.appendChild(style);
  }
  function showStatusInfo(runtimeRoot=root,id,actor='player'){
    const state=runtimeBattle(runtimeRoot),value=state?.statuses?statusValue(state.statuses,actor,id):0,detail=statusDetail(id,{actor,value});
    if(!detail)return false;
    const actorLabel=actor==='enemy'?'적':'나';
    const html=`<h2>${escapeHtml(detail.label)} ${detail.value}</h2><p>${escapeHtml(detail.description)}</p><div class="statusRuleNote"><b>대상</b> ${actorLabel} · <b>발동</b> ${escapeHtml(detail.timing)} · <b>지속</b> ${escapeHtml(detail.duration)} · <b>해제</b> ${detail.dispellable?'가능':'기본 불가'}</div><div class="choiceList"><button class="choice" data-close-status-info><b>닫기</b></button></div>`;
    if(typeof runtimeRoot?.showModal==='function')runtimeRoot.showModal(html);else{
      const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');
      if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');
    }
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-status-info]');
    if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};
    return true;
  }
  function renderStatusHud(runtimeRoot=root,state=runtimeBattle(runtimeRoot)){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),host=doc?.getElementById?.('statuses');if(!doc||!host||!state)return null;
    injectStyles(doc);const model=statusHudModel(state),parts=[];
    model.player.forEach(entry=>parts.push(chipHtml(entry)));
    model.enemy.forEach(entry=>parts.push(chipHtml(entry,{enemy:true})));
    model.reservations.forEach(entry=>parts.push(reservationHtml(entry)));
    host.innerHTML=parts.join('')||'<span class="stateChip">상태 없음</span>';
    host.querySelectorAll?.('[data-status-id]').forEach(button=>button.addEventListener('click',()=>showStatusInfo(runtimeRoot,button.dataset.statusId,button.dataset.statusActor)));
    return model;
  }
  function wrapRenderBattle(runtimeRoot=root){
    if(typeof runtimeRoot?.renderBattle!=='function')return false;if(runtimeRoot.renderBattle.__statusSystemAdapter)return true;
    const original=runtimeRoot.renderBattle;
    const wrapped=function(...args){const result=original.apply(this,args);renderStatusHud(runtimeRoot,runtimeBattle(runtimeRoot));return result};
    wrapped.__statusSystemAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){if(installed)return true;if(!wrapRenderBattle(runtimeRoot))return false;installed=true;return true}
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;
    const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;setTimeout(()=>{if(!installBrowserRuntime(runtimeRoot))console.warn('[status-system] 전투 런타임을 찾지 못했습니다.')},0)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STATUS_UI_VERSION,STATUS_PRESENTATION,statusPresentation,statusDefinition,statusCatalog,statusValue,activeStatusEntries,reservationEntries,statusHudModel,statusDetail,chipHtml,reservationHtml,showStatusInfo,renderStatusHud,wrapRenderBattle,installBrowserRuntime,installWhenReady};
});
