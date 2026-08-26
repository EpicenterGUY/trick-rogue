(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.BattleSceneV2=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STYLE_ID='trick-battle-scene-v2';
  const ATTEMPTS=100;
  const TIMING=Object.freeze({approach:160,impact:80,values:260,retreat:180,result:560,settle:90});

  function reduced(root){try{return !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches}catch(_){return false}}
  function wait(root,ms){return new Promise(resolve=>(root.setTimeout||setTimeout)(resolve,ms))}
  function outcomeMeta(result){
    if(result>0)return{label:'플레이어 승리',short:'승',className:'player'};
    if(result<0)return{label:'적 승리',short:'패',className:'enemy'};
    return{label:'동점',short:'무',className:'draw'};
  }
  function styleText(){return `
@media(max-width:899px){
  #battleMain{gap:0!important}
  #arena.pixel{min-height:354px!important;padding:7px 8px 9px!important;gap:5px!important}
  .intentWrap{grid-template-columns:56px minmax(0,1fr)!important;min-height:58px!important;gap:7px!important}
  .portrait{width:56px!important;height:56px!important}
  .intentBox.pixel{min-height:52px!important;padding:6px 8px!important}
  .intentMain{font-size:11px!important}.intentSub{font-size:7.5px!important}
  #battleScreen .arenaMeta{margin:0 3px!important}.arenaMeta .badge{padding:3px 6px!important}

  #versus{min-height:124px!important;margin:-2px 2px 0!important;grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr)!important}
  .stageCard{height:120px!important;min-height:120px!important}
  .stageInner{width:min(82px,100%)!important}
  .vsText{width:30px!important;height:30px!important;font-size:9px!important}
  .stageCard.trickWinner{filter:brightness(1.08) drop-shadow(0 0 14px #78d68bdd)!important}
  .stageCard.trickLoser{filter:brightness(.36) saturate(.4)!important;opacity:.82}
  .stageCard.trickWinner:after{right:2px!important;top:2px!important;width:22px!important;height:22px!important;font-size:12px!important}
  .trickValueBadge{top:auto!important;bottom:4px!important;min-width:34px!important;padding:3px 5px!important;font-size:7px!important;background:#080d15e8!important;box-shadow:0 0 0 1px #50607e inset,0 3px 0 #0008!important}
  .trickValueBadge b{display:inline!important;margin:0 0 0 3px!important;font-size:13px!important}

  #trickOutcomeBanner{top:2px!important;bottom:auto!important;width:auto!important;min-width:104px!important;max-width:142px!important;padding:4px 8px!important;border:1px solid #05070c!important;border-radius:12px!important;background:#0a1019d9!important;box-shadow:0 0 0 1px #56637f inset,0 3px 8px #0009!important;backdrop-filter:blur(2px);transform:translate(-50%,0)!important}
  #trickOutcomeBanner.show{animation:trickOutcomeRibbon 560ms cubic-bezier(.15,.85,.2,1) forwards!important}
  .trickOutcomeTitle{font-size:12px!important;letter-spacing:-.4px!important;line-height:1.1!important}.trickOutcomeCompare{margin-top:1px!important;font-size:7.5px!important;line-height:1.15!important}.trickOutcomeRule{margin-top:1px!important;font-size:7px!important}
  @keyframes trickOutcomeRibbon{0%{opacity:0;transform:translate(-50%,-5px) scale(.9)}16%{opacity:1;transform:translate(-50%,0) scale(1.04)}30%{transform:translate(-50%,0) scale(1)}82%{opacity:1}100%{opacity:0;transform:translate(-50%,-3px) scale(.98)}}

  #slotRow{margin-top:7px!important;padding:5px 4px 4px!important}
  #slotRow .slot{height:72px!important}
  #slotRow .slotArt{width:min(45px,calc(100% - 1px))!important}

  #battlePileHud{height:40px!important;grid-template-columns:1fr auto 1fr!important;align-items:center!important;padding:2px 18px 0!important;gap:7px!important;margin:1px 0 -1px!important}
  .battlePile{grid-template-columns:28px auto!important;gap:5px!important;align-items:center!important}
  .battlePile.discard{justify-self:end!important}
  .pileStack{width:27px!important;height:34px!important;border-radius:4px!important;box-shadow:0 2px 0 #0008,inset 0 0 0 1px #568297,0 0 0 1px #05070b!important}
  .pileStack:before{transform:translate(-2px,2px)!important}.pileStack:after{display:none!important}.pileStack .pileMark{inset:5px!important;font-size:9px!important}
  .pileCopy{display:flex!important;align-items:baseline!important;gap:4px!important}.pileLabel{font-size:6px!important;letter-spacing:.1em!important}.pileCount{font-size:14px!important;margin-top:0!important}
  #battlePileCenter{padding:0!important;display:flex!important;align-items:center!important}.pileCenterLabel{display:none!important}.pileCenterValue{margin:0!important;padding:3px 7px!important;border-radius:10px!important;background:#0a1018!important;box-shadow:inset 0 0 0 1px #ffffff12!important;font-size:7px!important;color:#c8b986!important;white-space:nowrap!important}

  #handPanel.pixel{margin:0 7px 2px!important;padding:2px 5px 0!important}
  #handPanel .panelTitle{height:14px!important;padding:0 5px!important;margin:0!important;font-size:7px!important;line-height:14px!important}
  #handRow{min-height:126px!important;padding:7px 0 0!important}
  #handRow .card{min-width:84px!important;width:84px!important;height:124px!important;margin-left:-6px!important;transform:translateX(var(--fan-x,0px)) translateY(var(--fan-y,0px)) rotate(0deg)!important;touch-action:manipulation}
  #handRow .card.sel,#handRow .card.sel:hover{transform:translateX(var(--fan-x,0px)) translateY(calc(var(--fan-y,0px) - 10px)) rotate(0deg) scale(1.045)!important}

  #inspect.pixel{margin:0 7px 6px!important;min-height:54px!important;max-height:92px!important;padding:6px 6px 6px 8px!important;grid-template-columns:minmax(0,1fr) 76px!important}
  #inspect.collapsed{min-height:48px!important;max-height:48px!important}#inspect>div{max-height:78px!important;overflow:auto!important}
  #inspectTitle{font-size:9px!important}#inspectDesc{font-size:7.5px!important;line-height:1.3!important}#inspectApply{font-size:7px!important}
  #playBtn{min-width:76px!important;padding:9px 6px!important;font-size:10px!important}
}
`}
  function ensureStyles(doc){
    if(!doc||doc.getElementById?.(STYLE_ID))return false;
    const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=styleText();(doc.head||doc.documentElement).appendChild(style);return true;
  }
  function finalValues(root){
    if(root.BattleReadableFeedback?.finalTrickValues)return root.BattleReadableFeedback.finalTrickValues(root);
    return{player:null,enemy:null,reverse:false};
  }
  function addBadge(doc,element,label,value){
    if(!element||value===null||value===undefined)return null;
    const badge=doc.createElement('div');badge.className='trickValueBadge';badge.innerHTML=`${label}<b>${value}</b>`;element.appendChild(badge);return badge;
  }
  function showOutcome(root,result,values){
    const doc=root.document,vs=doc?.getElementById?.('versus');if(!doc||!vs)return null;
    doc.getElementById('trickOutcomeBanner')?.remove();
    const meta=outcomeMeta(result),banner=doc.createElement('div');banner.id='trickOutcomeBanner';banner.className=meta.className;
    const comparison=values.player===null||values.enemy===null?'판정 완료':`${values.player} : ${values.enemy}`;
    banner.innerHTML=`<div class="trickOutcomeTitle">${meta.label}</div><div class="trickOutcomeCompare">${comparison}</div>${values.reverse?'<div class="trickOutcomeRule">역전 판정</div>':''}`;
    vs.appendChild(banner);void banner.offsetWidth;banner.classList.add('show');return banner;
  }
  function clearStage(root,element){
    if(!element)return;element.classList.remove('trickWinner','trickLoser');element.querySelectorAll?.('.trickValueBadge').forEach(el=>el.remove());
    if(typeof root.clearStageAnimationStyles==='function')root.clearStageAnimationStyles(element);else element.getAnimations?.().forEach(a=>a.cancel());
  }
  async function animateTrickResult(root,result){
    const doc=root.document,enemy=doc.getElementById('enemyStage'),player=doc.getElementById('playerStage'),vs=doc.getElementById('versus'),arena=doc.getElementById('arena');
    if(!enemy?.classList.contains('show')||!player?.classList.contains('show'))return;
    const isReduced=reduced(root),t=isReduced?{approach:0,impact:0,values:40,retreat:0,result:90,settle:0}:TIMING,values=finalValues(root),animations=[];
    const eb=enemy.getBoundingClientRect(),pb=player.getBoundingClientRect(),vb=vs.getBoundingClientRect(),center=vb.left+vb.width/2,gap=16;
    const enemyMeet=center-gap-(eb.left+eb.width/2),playerMeet=center+gap-(pb.left+pb.width/2);
    let banner=null,enemyBadge=null,playerBadge=null;
    try{
      if(!isReduced){
        const move={duration:t.approach,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'};
        const ea=enemy.animate([{transform:'translateX(0)'},{transform:`translateX(${enemyMeet}px)`}],move),pa=player.animate([{transform:'translateX(0)'},{transform:`translateX(${playerMeet}px)`}],move);animations.push(ea,pa);await Promise.all([ea.finished,pa.finished]);
        vs.classList.add('cardImpact');
        if(arena&&typeof root.burstAt==='function'){const ar=arena.getBoundingClientRect(),vr=vs.getBoundingClientRect();root.burstAt(vr.left-ar.left+vr.width/2,vr.top-ar.top+vr.height/2,'#f4d98f',7)}
        await wait(root,t.impact);vs.classList.remove('cardImpact');
      }
      enemyBadge=addBadge(doc,enemy,'적',values.enemy);playerBadge=addBadge(doc,player,'나',values.player);await wait(root,t.values);
      const winner=result>0?player:result<0?enemy:null,loser=result>0?enemy:result<0?player:null;winner?.classList.add('trickWinner');loser?.classList.add('trickLoser');
      if(!isReduced){
        const enemyEnd=result<0?'translateX(0) scale(1.08)':result>0?'translateX(-6px) rotate(-2deg) scale(.94)':'translateX(-2px) scale(1)';
        const playerEnd=result>0?'translateX(0) scale(1.08)':result<0?'translateX(6px) rotate(2deg) scale(.94)':'translateX(2px) scale(1)';
        const ea=enemy.animate([{transform:`translateX(${enemyMeet}px)`},{transform:enemyEnd}],{duration:t.retreat,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'}),pa=player.animate([{transform:`translateX(${playerMeet}px)`},{transform:playerEnd}],{duration:t.retreat,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'});animations.push(ea,pa);await Promise.all([ea.finished,pa.finished]);
      }
      banner=showOutcome(root,result,values);await wait(root,t.result);await wait(root,t.settle);
    }finally{
      vs?.classList.remove('cardImpact');banner?.remove();enemyBadge?.remove();playerBadge?.remove();animations.forEach(a=>a.cancel());clearStage(root,enemy);clearStage(root,player);
    }
  }
  function install(root){
    if(!root?.document||typeof root.animateTrickResult!=='function')return false;
    if(root.animateTrickResult.__battleSceneV2)return true;
    ensureStyles(root.document);
    const wrapped=async function(result){return animateTrickResult(root,result)};wrapped.__battleSceneV2=true;wrapped.__original=root.animateTrickResult;root.animateTrickResult=wrapped;return true;
  }
  function installWhenReady(root){let attempts=0;const attempt=()=>{if(install(root))return true;if(attempts++<ATTEMPTS){(root.setTimeout||setTimeout)(attempt,25);return false}root.console?.warn?.('[battle-scene-v2] 전투씬 초기화 지연');return false};return attempt()}
  return{STYLE_ID,TIMING,outcomeMeta,styleText,ensureStyles,finalValues,install,installWhenReady,animateTrickResult};
});
