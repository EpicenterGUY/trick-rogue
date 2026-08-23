(function(root,factory){
  const api=factory(root,typeof module!=='undefined'?require('./compendium-8-h.js'):root.Compendium8H);
  if(typeof module!=='undefined')module.exports=api;
  root.Compendium8HRuntimeBridge=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Compendium){
  const STAGE='8-H';
  let installed=false;

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function activeRun(runtimeRoot=root){return Compendium?.activeRun?.(runtimeRoot)||runtimeRoot?.run||null}

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
  function installFieldBridgeHooks(runtimeRoot=root){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    if(!doc||doc.__compendium8HFieldHook)return false;
    doc.__compendium8HFieldHook=true;
    doc.addEventListener('click',event=>{
      const target=event.target?.closest?.('button');
      if(!target)return;
      if(target.dataset?.openCompendium!==undefined||target.dataset?.compSection==='fields'||String(target.textContent||'').trim()==='도감')ensureFieldStateBridge(activeRun(runtimeRoot));
    },true);
    return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;
    if(!Compendium?.keywordCatalog||!runtimeRoot?.document)return false;
    ensureFieldStateBridge(activeRun(runtimeRoot));
    wrapShowTerms(runtimeRoot);
    installFieldBridgeHooks(runtimeRoot);
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
  function resetForTests(){installed=false}

  return{STAGE,activeRun,fieldStateView,ensureFieldStateBridge,fieldStateBridgeIsSerializable,termsHtml,showTerms,wrapShowTerms,installFieldBridgeHooks,installBrowserRuntime,installWhenReady,resetForTests};
});
