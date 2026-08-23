(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.ShowdownHighRoll=api;
    api.installBrowser(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='7.5-Q';
  const OVERKILL_THRESHOLD=1.5;
  const MEGA_OVERKILL_THRESHOLD=2;
  const HISTORY_LIMIT=20;
  const STYLE_ID='showdown-highroll-7-5q-style';

  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function numeric(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function ratioPercent(ratio){return Math.round(Math.max(0,numeric(ratio))*1000)/10}

  function classifyOverkill({plannedDamage=0,hpBefore=0,targetDefeated=false}={}){
    const planned=Math.max(0,numeric(plannedDamage)),remainingHp=Math.max(0,numeric(hpBefore));
    const ratio=remainingHp>0?planned/remainingHp:0;
    let tier='none',label='';
    if(targetDefeated===true&&remainingHp>0&&ratio>=MEGA_OVERKILL_THRESHOLD){tier='mega_overkill';label='대압승'}
    else if(targetDefeated===true&&remainingHp>0&&ratio>=OVERKILL_THRESHOLD){tier='overkill';label='압승'}
    return{
      stage:STAGE,
      tier,
      label,
      qualified:tier!=='none',
      plannedDamage:planned,
      hpBefore:remainingHp,
      ratio,
      ratioPercent:ratioPercent(ratio),
      threshold:tier==='mega_overkill'?MEGA_OVERKILL_THRESHOLD:tier==='overkill'?OVERKILL_THRESHOLD:null,
      targetDefeated:targetDefeated===true,
      reward:{type:'none',amount:0},
      rewardPolicy:'spectacle_only'
    };
  }

  function highRollText(record){
    if(!record?.qualified)return'';
    return`${record.label} · ${record.plannedDamage} 피해 · 남은 HP의 ${record.ratioPercent}%`;
  }

  function recordHighRoll(state,record){
    if(!state||!record)return null;
    const snapshot=clone(record);
    state.highRollLast=snapshot;
    if(!Array.isArray(state.highRollHistory))state.highRollHistory=[];
    state.highRollHistory.push(snapshot);
    if(state.highRollHistory.length>HISTORY_LIMIT)state.highRollHistory.splice(0,state.highRollHistory.length-HISTORY_LIMIT);
    return snapshot;
  }

  function appendTrace(target,record){
    if(!target||!record?.qualified)return;
    if(!Array.isArray(target.showdownTrace))target.showdownTrace=[];
    const line=`고점: ${highRollText(record)}`;
    if(!target.showdownTrace.includes(line))target.showdownTrace.push(line);
  }

  function attachRecord(target,record){
    if(!target||typeof target!=='object'||!record)return target;
    const snapshot=clone(record);
    target.highRoll=snapshot;
    if(target.attacks?.player)target.attacks.player.highRoll=clone(snapshot);
    return target;
  }

  function enrichArchivedBreakdown(state,archived,record){
    if(!record)return archived;
    attachRecord(archived,record);
    const refs=[state?.showdownBreakdown,state?.lastShowdownBreakdown];
    if(Array.isArray(state?.showdownHistory)&&state.showdownHistory.length)refs.push(state.showdownHistory[state.showdownHistory.length-1]);
    for(const ref of refs)attachRecord(ref,record);
    appendTrace(state,record);
    return archived;
  }

  function ensureHighRollStyles(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;if(!doc?.createElement||!doc?.head?.appendChild)return null;
    const existing=doc.getElementById?.(STYLE_ID);if(existing)return existing;
    const style=doc.createElement('style');style.id=STYLE_ID;
    style.textContent=`
#showdownSequence.overkill .sequenceLabel{color:#ffe6a3;font-weight:900}
#showdownSequence.overkill .sequenceValue{font-size:34px;color:#fff1ad;text-shadow:4px 4px 0 #000,0 0 16px #f2bd5faa;animation:highRollPulse .34s cubic-bezier(.12,.9,.2,1) both}
#showdownSequence.megaOverkill .sequenceLabel{color:#fff}
#showdownSequence.megaOverkill .sequenceValue{font-size:42px;color:#fff8d5;text-shadow:4px 4px 0 #000,0 0 20px #fff1a6,0 0 32px #ef657588}
#arena.highRollImpact{animation:highRollImpact .3s linear both}
@keyframes highRollPulse{0%{transform:scale(.55);opacity:.2}55%{transform:scale(1.18);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes highRollImpact{0%,100%{transform:translate(0,0)}20%{transform:translate(-5px,2px)}40%{transform:translate(5px,-2px)}60%{transform:translate(-3px,1px)}80%{transform:translate(3px,-1px)}}
@media (prefers-reduced-motion:reduce){#showdownSequence.overkill .sequenceValue,#arena.highRollImpact{animation-duration:.01ms}}
`;
    doc.head.appendChild(style);return style;
  }

  function presentHighRoll(runtimeRoot,record){
    if(!record?.qualified)return false;
    ensureHighRollStyles(runtimeRoot);
    const className=record.tier==='mega_overkill'?'overkill megaOverkill':'overkill';
    runtimeRoot?.showShowdownStep?.(record.label,`${record.plannedDamage} 피해 · ${record.ratioPercent}%`,className);
    const arena=runtimeRoot?.document?.getElementById?.('arena');
    if(arena?.classList?.add){arena.classList.add('highRollImpact');const timer=runtimeRoot?.setTimeout||setTimeout;timer(()=>arena.classList?.remove?.('highRollImpact'),320)}
    return true;
  }

  function isPlayerShowdownAttack(feedback,metadata){
    return feedback==='showdown'&&metadata?.source==='showdown_player_attack'&&metadata?.attacker==='player'&&metadata?.target==='enemy';
  }

  function wrapShowdown(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.showdown;
    if(typeof original!=='function'||original.__tricklogHighRoll75Q)return false;
    async function wrapped(...args){
      const state=activeBattle(runtimeRoot),originalDamageEnemy=runtimeRoot?.damageEnemy;
      let latestRecord=null,damageWrapper=null;
      if(typeof originalDamageEnemy==='function'){
        damageWrapper=function(plannedDamage,feedback,metadata,...rest){
          if(!isPlayerShowdownAttack(feedback,metadata))return originalDamageEnemy.call(this,plannedDamage,feedback,metadata,...rest);
          const current=activeBattle(runtimeRoot)||state,hpBefore=Math.max(0,numeric(current?.enemy?.hp));
          const dealt=originalDamageEnemy.call(this,plannedDamage,feedback,metadata,...rest),hpAfter=Math.max(0,numeric(current?.enemy?.hp));
          latestRecord=classifyOverkill({plannedDamage,hpBefore,targetDefeated:hpAfter<=0});
          latestRecord.dealt=Math.max(0,numeric(dealt));latestRecord.hpAfter=hpAfter;latestRecord.setIndex=current?.setIndex??state?.setIndex??null;latestRecord.source='showdown_player_attack';
          recordHighRoll(state||current,latestRecord);
          if(latestRecord.qualified)presentHighRoll(runtimeRoot,latestRecord);
          return dealt;
        };
        damageWrapper.__tricklogHighRoll75Q=true;damageWrapper.__original=originalDamageEnemy;runtimeRoot.damageEnemy=damageWrapper;
      }
      try{
        const archived=await original.apply(this,args);
        if(latestRecord)enrichArchivedBreakdown(state,archived,latestRecord);
        return archived;
      }finally{
        if(damageWrapper&&runtimeRoot.damageEnemy===damageWrapper)runtimeRoot.damageEnemy=originalDamageEnemy;
      }
    }
    wrapped.__tricklogHighRoll75Q=true;wrapped.__original=original;runtimeRoot.showdown=wrapped;return true;
  }

  function installBrowser(runtimeRoot=defaultRoot){ensureHighRollStyles(runtimeRoot);return{showdown:wrapShowdown(runtimeRoot)}}

  return{STAGE,OVERKILL_THRESHOLD,MEGA_OVERKILL_THRESHOLD,HISTORY_LIMIT,STYLE_ID,activeBattle,numeric,ratioPercent,classifyOverkill,highRollText,recordHighRoll,appendTrace,attachRecord,enrichArchivedBreakdown,ensureHighRollStyles,presentHighRoll,isPlayerShowdownAttack,wrapShowdown,installBrowser};
});
