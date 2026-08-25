(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.BattleReadableFeedback=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const NORMAL_TIMING=Object.freeze({approach:180,impact:90,values:260,result:620,settle:120,scan:54,hand:360,advantage:360,effects:320,finalPower:520,damageCalc:680,preImpact:140});
  const REDUCED_TIMING=Object.freeze({approach:0,impact:0,values:35,result:80,settle:0,scan:12,hand:45,advantage:45,effects:45,finalPower:60,damageCalc:80,preImpact:25});
  const STYLE_ID='trick-readable-feedback-style';
  const SCRIPT_READY_ATTEMPTS=80;

  function outcomeMeta(result){
    if(result>0)return{label:'플레이어 승리',short:'승리',className:'player'};
    if(result<0)return{label:'적 승리',short:'패배',className:'enemy'};
    return{label:'동점',short:'동점',className:'draw'};
  }
  function damageEquation(playerPower,enemyPower){
    const pp=Number(playerPower)||0,ep=Number(enemyPower)||0,diff=Math.abs(pp-ep);
    if(pp>ep)return{diff,winner:'플레이어',loser:'적',formula:`플레이어 ${pp} - 적 ${ep} = ${diff}`};
    if(ep>pp)return{diff,winner:'적',loser:'플레이어',formula:`적 ${ep} - 플레이어 ${pp} = ${diff}`};
    return{diff:0,winner:null,loser:null,formula:`플레이어 ${pp} = 적 ${ep}`};
  }
  function timing(reduced){return reduced?REDUCED_TIMING:NORMAL_TIMING}
  function isReduced(root){try{return !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches}catch(_){return false}}
  function wait(root,ms){return new Promise(resolve=>(root.setTimeout||setTimeout)(resolve,ms))}

  function styleText(){return `
#versus{isolation:isolate}
.trickValueBadge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;min-width:42px;padding:5px 7px;border:2px solid #05070c;background:#111827ee;box-shadow:0 0 0 2px #50607e inset,0 4px 0 #0008;color:#f7f0df;text-align:center;font-size:10px;font-weight:900;line-height:1.05;pointer-events:none}
.trickValueBadge b{display:block;margin-top:2px;font-size:20px;color:#fff}
.stageCard.trickWinner{filter:drop-shadow(0 0 12px #78d68bcc)!important}
.stageCard.trickWinner:after{content:'승';position:absolute;right:4px;top:4px;z-index:8;width:24px;height:24px;display:grid;place-items:center;border:2px solid #05070c;background:#78d68b;color:#09110b;font-size:13px;font-weight:900;box-shadow:0 0 0 2px #b9efc3 inset}
.stageCard.trickLoser{filter:brightness(.42) saturate(.45)!important}
#trickOutcomeBanner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:12;width:min(190px,72vw);padding:9px 10px;border:2px solid #05070c;background:#111827f2;box-shadow:0 0 0 2px #56637f inset,0 5px 0 #0009;text-align:center;pointer-events:none;opacity:0}
#trickOutcomeBanner.show{animation:trickOutcomePop 620ms cubic-bezier(.15,.85,.2,1) forwards}
#trickOutcomeBanner.player{box-shadow:0 0 0 2px #78d68b inset,0 5px 0 #0009}#trickOutcomeBanner.enemy{box-shadow:0 0 0 2px #ef6575 inset,0 5px 0 #0009}#trickOutcomeBanner.draw{box-shadow:0 0 0 2px #e4bd62 inset,0 5px 0 #0009}
.trickOutcomeTitle{font-size:17px;font-weight:900;letter-spacing:-1px}.trickOutcomeCompare{margin-top:3px;font-size:11px;color:#c4cde0}.trickOutcomeRule{margin-top:2px;font-size:9px;color:#f4d98f}
@keyframes trickOutcomePop{0%{opacity:0;transform:translate(-50%,-50%) scale(.82)}14%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}26%{transform:translate(-50%,-50%) scale(1)}82%{opacity:1}100%{opacity:0;transform:translate(-50%,-54%) scale(.98)}}
#showdownSequence.damageCalc .sequenceValue{font-size:20px;line-height:1.25}#showdownSequence.finalPower .sequenceValue{font-size:26px}#showdownSequence.preImpact .sequenceValue{animation-duration:360ms!important}
@media (prefers-reduced-motion:reduce){#trickOutcomeBanner.show{animation:none;opacity:1}.stageCard.trickWinner,.stageCard.trickLoser{filter:none!important}}
`}
  function ensureStyles(doc){
    if(!doc||doc.getElementById?.(STYLE_ID))return false;
    const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=styleText();(doc.head||doc.documentElement).appendChild(style);return true;
  }
  function currentBattle(root){try{if(typeof battle!=='undefined')return battle}catch(_){ }return root?.battle||null}
  function finalTrickValues(root){
    const battleState=currentBattle(root);if(!battleState)return{player:null,enemy:null,reverse:false};
    try{
      const core=root.BattleCore,playerCard=battleState.playerStage,enemyCard=battleState.enemyCard;
      const playerEffective=typeof root.effective==='function'?root.effective(playerCard):playerCard;
      const enemyEffective=core?.effectiveCard?core.effectiveCard(enemyCard):enemyCard;
      const player=core?.resolveTrickValue?core.resolveTrickValue(playerEffective,battleState.trump).finalValue:Number(playerEffective?.rank)||0;
      const enemy=core?.resolveTrickValue?core.resolveTrickValue(enemyEffective,battleState.trump).finalValue:Number(enemyEffective?.rank)||0;
      return{player,enemy,reverse:!!battleState.mods?.reverse};
    }catch(_){return{player:null,enemy:null,reverse:!!battleState.mods?.reverse}}
  }
  function addValueBadge(doc,element,label,value){
    if(!element||value===null||value===undefined)return null;
    const badge=doc.createElement('div');badge.className='trickValueBadge';badge.innerHTML=`${label}<b>${value}</b>`;element.appendChild(badge);return badge;
  }
  function clearStage(root,element){
    if(!element)return;
    element.classList.remove('trickWinner','trickLoser');
    element.querySelectorAll?.('.trickValueBadge').forEach(el=>el.remove());
    if(typeof root.clearStageAnimationStyles==='function')root.clearStageAnimationStyles(element);else element.getAnimations?.().forEach(animation=>animation.cancel());
  }
  function showOutcome(root,result,values){
    const doc=root.document,vs=doc?.getElementById?.('versus');if(!doc||!vs)return null;
    doc.getElementById('trickOutcomeBanner')?.remove();
    const meta=outcomeMeta(result),banner=doc.createElement('div');banner.id='trickOutcomeBanner';banner.className=`${meta.className}`;
    const comparison=values.player===null||values.enemy===null?'판정 완료':`플레이어 ${values.player} : ${values.enemy} 적`;
    banner.innerHTML=`<div class="trickOutcomeTitle">${meta.label}</div><div class="trickOutcomeCompare">${comparison}</div>${values.reverse?'<div class="trickOutcomeRule">역전 판정 적용</div>':''}`;
    vs.appendChild(banner);void banner.offsetWidth;banner.classList.add('show');return banner;
  }

  function install(root){
    if(!root?.document||typeof root.animateTrickResult!=='function'||typeof root.animateShowdownSequence!=='function')return false;
    if(root.animateTrickResult.__readableFeedback)return true;
    ensureStyles(root.document);
    root.animateTrickResult=async function(result){
      const doc=root.document,enemy=doc.getElementById('enemyStage'),player=doc.getElementById('playerStage'),vs=doc.getElementById('versus'),arena=doc.getElementById('arena');
      if(!enemy?.classList.contains('show')||!player?.classList.contains('show'))return;
      const reduced=isReduced(root),t=timing(reduced),values=finalTrickValues(root),animations=[];
      const enemyBox=enemy.getBoundingClientRect(),playerBox=player.getBoundingClientRect(),versusBox=vs.getBoundingClientRect();
      const center=versusBox.left+versusBox.width/2,meetingGap=17;
      const enemyMeet=center-meetingGap-(enemyBox.left+enemyBox.width/2),playerMeet=center+meetingGap-(playerBox.left+playerBox.width/2);
      let banner=null,enemyBadge=null,playerBadge=null;
      try{
        if(!reduced){
          const move={duration:t.approach,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'};
          const ea=enemy.animate([{transform:'translateX(0)'},{transform:`translateX(${enemyMeet}px)`}],move),pa=player.animate([{transform:'translateX(0)'},{transform:`translateX(${playerMeet}px)`}],move);
          animations.push(ea,pa);await Promise.all([ea.finished,pa.finished]);
          vs.classList.add('cardImpact');
          if(arena&&typeof root.burstAt==='function'){const ar=arena.getBoundingClientRect(),vr=vs.getBoundingClientRect();root.burstAt(vr.left-ar.left+vr.width/2,vr.top-ar.top+vr.height/2,'#f4d98f',8)}
          await wait(root,t.impact);vs.classList.remove('cardImpact');
        }
        enemyBadge=addValueBadge(doc,enemy,'적',values.enemy);playerBadge=addValueBadge(doc,player,'플레이어',values.player);
        await wait(root,t.values);
        const winner=result>0?player:result<0?enemy:null,loser=result>0?enemy:result<0?player:null;
        winner?.classList.add('trickWinner');loser?.classList.add('trickLoser');
        if(!reduced){
          const winnerMeet=result>0?playerMeet:enemyMeet,loserMeet=result>0?enemyMeet:playerMeet,loserPush=result>0?-18:18,resultAnimations=[];
          if(winner)resultAnimations.push(winner.animate([{transform:`translateX(${winnerMeet}px) scale(1)`,filter:'brightness(1)'},{transform:`translateX(${winnerMeet}px) scale(1.12)`,filter:'brightness(1.22)'}],{duration:180,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'}));
          if(loser)resultAnimations.push(loser.animate([{transform:`translateX(${loserMeet}px) scale(1)`,filter:'brightness(1)'},{transform:`translateX(${loserMeet+loserPush}px) rotate(${result>0?-3:3}deg) scale(.93)`,filter:'brightness(.34) saturate(.4)'}],{duration:180,easing:'cubic-bezier(.16,.78,.2,1)',fill:'forwards'}));
          animations.push(...resultAnimations);await Promise.all(resultAnimations.map(animation=>animation.finished.catch(()=>{})));
        }
        banner=showOutcome(root,result,values);await wait(root,t.result);await wait(root,t.settle);
      }finally{
        vs?.classList.remove('cardImpact');banner?.remove();enemyBadge?.remove();playerBadge?.remove();animations.forEach(animation=>animation.cancel());clearStage(root,enemy);clearStage(root,player);
      }
    };
    root.animateTrickResult.__readableFeedback=true;

    root.animateShowdownSequence=async function(p,advantage,pp,ep){
      const reduced=isReduced(root),t=timing(reduced),doc=root.document;
      const battleState=currentBattle(root);if(!battleState)return;
      battleState.showdownVisualStage='scan';
      for(let i=0;i<5;i++){const slot=doc.getElementById(`showdown-slot-${i}`);if(slot)slot.classList.add('showdownScan');await wait(root,t.scan)}
      root.showShowdownStep('족보 확정',p.name);await wait(root,t.hand);
      battleState.showdownVisualStage='advantage';
      const advantageLabel=root.advantageText(advantage);doc.getElementById('edgeText').textContent=advantageLabel;
      root.showShowdownStep('우세 판정',advantageLabel);await wait(root,t.advantage);
      root.showShowdownStep('쇼다운 효과','효과 적용');await wait(root,t.effects);
      root.showShowdownStep('최종 위력',`플레이어 ${pp} : ${ep} 적`,'finalPower');await wait(root,t.finalPower);
      const equation=damageEquation(pp,ep);
      if(equation.diff){root.showShowdownStep('데미지 계산',equation.formula,'damageCalc');await wait(root,t.damageCalc);doc.getElementById('showdownSequence')?.classList.add('preImpact');await wait(root,t.preImpact)}
      else{root.showShowdownStep('데미지 계산','동점 · 피해 없음','damageCalc');await wait(root,t.damageCalc)}
    };
    root.animateShowdownSequence.__readableFeedback=true;
    return true;
  }
  function installWhenReady(root){
    let attempts=0;
    const attempt=()=>{if(install(root))return true;if(attempts++<SCRIPT_READY_ATTEMPTS){(root.setTimeout||setTimeout)(attempt,25);return false}root.console?.warn?.('[battle-feedback] 읽기 쉬운 전투 피드백 초기화가 지연되었습니다.');return false};
    return attempt();
  }
  return{NORMAL_TIMING,REDUCED_TIMING,outcomeMeta,damageEquation,timing,styleText,ensureStyles,currentBattle,finalTrickValues,install,installWhenReady};
});
