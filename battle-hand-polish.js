(()=>{
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handRowEl=()=>document.getElementById('handRow');
  const arenaEl=()=>document.getElementById('arena');
  const versusEl=()=>document.getElementById('versus');
  let pendingPlayedUid=null;

  function pileCenter(id,fallbackRect){
    const el=document.getElementById(id);
    const r=el?.getBoundingClientRect?.()||fallbackRect;
    return{x:r.left+r.width/2,y:r.top+r.height/2};
  }

  /* Removed cards now visibly travel toward the discard pile instead of simply fading. */
  animateRemovedHandCard=function(el,rect){
    if(reduced()||!rect.width)return;
    const ghost=el.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.add('handDiscardGhost');
    Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0'});
    document.body.appendChild(ghost);
    const fallback={left:innerWidth*.76,top:innerHeight*.76,width:1,height:1};
    const dest=pileCenter('battleDiscardPile',fallback);
    const sx=rect.left+rect.width/2,sy=rect.top+rect.height/2,dx=dest.x-sx,dy=dest.y-sy;
    ghost.animate([
      {opacity:1,transform:'translate(0,0) rotate(0deg) scale(1)'},
      {opacity:1,transform:`translate(${dx*.55}px,${dy*.48-14}px) rotate(5deg) scale(.93)`,offset:.55},
      {opacity:0,transform:`translate(${dx}px,${dy}px) rotate(11deg) scale(.72)`}
    ],{duration:240,easing:'cubic-bezier(.25,.7,.2,1)',fill:'forwards'}).finished.catch(()=>{}).finally(()=>ghost.remove());
  };

  /* Hand FLIP/deal animation: new cards come from DECK, exchanged cards leave toward DISCARD. */
  renderHand=function(){
    const row=handRowEl();
    if(!row||!battle)return;
    const previous=new Map([...row.children].map(el=>[el.dataset.uid,{el,rect:el.getBoundingClientRect()}]));
    const oldRects=new Map([...previous].map(([uid,item])=>[uid,item.rect]));
    const selectedUid=battle.selected||null,fragment=document.createDocumentFragment();
    for(const card of battle.hand){
      const prior=previous.get(card.uid),el=prior?.el||document.createElement('button');
      if(!prior){
        el.id=`card-${card.uid}`;
        el.innerHTML=`<div class="cardArt">${artHtml(card,'hand')}</div>`;
        el.onclick=()=>selectCard(card.uid);
      }
      el.dataset.uid=card.uid;
      el.className=`card ${card.named?'named':''} ${selectedUid===card.uid?'sel':''}`;
      fragment.appendChild(el);
      previous.delete(card.uid);
    }
    for(const [uid,{el,rect}] of previous){
      if(uid===pendingPlayedUid){pendingPlayedUid=null;continue}
      animateRemovedHandCard(el,rect);
    }
    row.replaceChildren(fragment);
    row.classList.toggle('has-selection',!!selectedUid||!!row.querySelector('.is-selected,.exchange-selected,[data-exchange-selected="true"],[aria-pressed="true"]'));
    if(reduced())return;

    const drawInfo=document.getElementById('drawInfo');
    const fallback=drawInfo?.getBoundingClientRect?.()||{left:innerWidth*.2,top:innerHeight*.8,width:1,height:1};
    const deck=pileCenter('battleDeckPile',fallback);
    let dealIndex=0;
    for(const el of row.children){
      const end=el.getBoundingClientRect(),oldRect=oldRects.get(el.dataset.uid);
      let dx,dy,delay=0,frames,duration;
      if(oldRect){
        dx=oldRect.left-end.left;dy=oldRect.top-end.top;duration=210;
        if(Math.abs(dx)<.5&&Math.abs(dy)<.5)continue;
        frames=[{transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1},{transform:'none',opacity:1}];
      }else{
        dx=deck.x-end.left-end.width/2;dy=deck.y-end.top-end.height/2;delay=dealIndex++*42;duration=250;
        frames=[
          {transform:`translate(${dx}px,${dy}px) rotate(-5deg) scale(.76)`,opacity:.08},
          {transform:'translateY(-3px) rotate(1deg) scale(1.035)',opacity:1,offset:.76},
          {transform:'none',opacity:1}
        ];
      }
      el.animate(frames,{duration,delay,easing:'cubic-bezier(.18,.82,.2,1)'}).finished.catch(()=>{});
    }
  };

  function syncHandExchangeControls(){
    const row=handRowEl();
    document.querySelectorAll('#battleScreen button').forEach(btn=>{
      if(btn.classList.contains('card'))return;
      const label=(btn.textContent||'').replace(/\s+/g,' ').trim();
      btn.classList.toggle('handExchangeAction',/패\s*교환|패갈이|손패\s*교환/.test(label));
    });
    if(row)row.classList.toggle('has-selection',!!battle?.selected||!!row.querySelector('.is-selected,.exchange-selected,[data-exchange-selected="true"],[aria-pressed="true"]'));
  }

  const coreRenderBattle=renderBattle;
  renderBattle=function(...args){
    const out=coreRenderBattle(...args);
    syncHandExchangeControls();
    return out;
  };

  /* Avoid jumping the whole mobile battle view every time a hand card is picked. */
  selectCard=function(uid){
    if(battle.animating)return;
    if(battle.selected===uid&&battle.inspectSlot===null){battle.selected=null;sfx('cardSelect');renderBattle();return}
    battle.selected=uid;battle.inspectSlot=null;battle.inspectStage=null;sfx('cardSelect');renderBattle();
    const panel=document.getElementById('inspect'),r=panel?.getBoundingClientRect?.();
    if(r&&(r.bottom>innerHeight-8||r.top<0))panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  };

  /* Play motion is intentionally minimal: hand -> player side. Trick clash owns the dramatic beat. */
  animateCardFlight=async function(card){
    pendingPlayedUid=card?.uid||null;
    const src=document.getElementById(`card-${card.uid}`),appEl=document.getElementById('app'),vs=versusEl();
    if(!src||!appEl||!vs||reduced())return;
    const appRect=appEl.getBoundingClientRect(),start=src.getBoundingClientRect(),field=vs.getBoundingClientRect();
    const targetX=field.left+field.width*.76-start.width/2,targetY=field.top+field.height*.53-start.height/2;
    const clone=src.cloneNode(true);clone.removeAttribute('id');clone.className='flyingCard card '+(card.named?'named':'');
    Object.assign(clone.style,{left:(start.left-appRect.left)+'px',top:(start.top-appRect.top)+'px',width:start.width+'px',height:start.height+'px',margin:'0',animation:'none',transition:'none'});
    const originalVisibility=src.style.visibility;appEl.appendChild(clone);src.style.visibility='hidden';
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    try{
      await frame();
      clone.style.transition='left 145ms cubic-bezier(.18,.82,.2,1), top 145ms cubic-bezier(.18,.82,.2,1), opacity 145ms linear';
      clone.style.left=(targetX-appRect.left)+'px';clone.style.top=(targetY-appRect.top)+'px';clone.style.opacity='.96';
      await wait(145);
    }finally{
      clone.getAnimations().forEach(animation=>animation.cancel());
      src.style.visibility=originalVisibility;
      clone.remove();
    }
  };

  /* Trick clash keeps the same total tempo but gives the contact frame a stronger beat. */
  animateTrickResult=async function(result){
    const enemy=document.getElementById('enemyStage'),player=document.getElementById('playerStage'),vs=versusEl(),arena=arenaEl();
    if(!enemy?.classList.contains('show')||!player?.classList.contains('show')||reduced())return;
    const enemyBox=enemy.getBoundingClientRect(),playerBox=player.getBoundingClientRect(),versusBox=vs.getBoundingClientRect();
    const center=versusBox.left+versusBox.width/2,meetingGap=17;
    const enemyMeet=center-meetingGap-(enemyBox.left+enemyBox.width/2),playerMeet=center+meetingGap-(playerBox.left+playerBox.width/2);
    const animations=[];
    try{
      const timing={duration:170,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'};
      const ea=enemy.animate([{transform:'translateX(0)'},{transform:`translateX(${enemyMeet}px)`}],timing);
      const pa=player.animate([{transform:'translateX(0)'},{transform:`translateX(${playerMeet}px)`}],timing);
      animations.push(ea,pa);await Promise.all([ea.finished,pa.finished]);
      vs.classList.add('cardImpact');
      if(arena){const ar=arena.getBoundingClientRect(),vr=vs.getBoundingClientRect();burstAt(vr.left-ar.left+vr.width/2,vr.top-ar.top+vr.height/2,'#f4d98f',7)}
      await wait(72);vs.classList.remove('cardImpact');
      const winner=result>0?player:result<0?enemy:null,loser=result>0?enemy:result<0?player:null;
      const winnerMeet=result>0?playerMeet:enemyMeet,loserMeet=result>0?enemyMeet:playerMeet,loserPush=result>0?-16:16;
      const resultAnimations=[];
      if(winner)resultAnimations.push(winner.animate([
        {transform:`translateX(${winnerMeet}px) scale(1)`,filter:'brightness(1)'},
        {transform:`translateX(${winnerMeet}px) scale(1.095)`,filter:'brightness(1.18)'}
      ],{duration:135,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'}));
      if(loser)resultAnimations.push(loser.animate([
        {transform:`translateX(${loserMeet}px) scale(1)`,filter:'brightness(1)'},
        {transform:`translateX(${loserMeet+loserPush}px) rotate(${result>0?-2:2}deg) scale(.95)`,filter:'brightness(.44) saturate(.5)'}
      ],{duration:135,easing:'cubic-bezier(.16,.78,.2,1)',fill:'forwards'}));
      if(!winner){
        resultAnimations.push(enemy.animate([{transform:`translateX(${enemyMeet}px)`},{transform:`translateX(${enemyMeet}px) scale(1.035)`}],{duration:125,fill:'forwards'}));
        resultAnimations.push(player.animate([{transform:`translateX(${playerMeet}px)`},{transform:`translateX(${playerMeet}px) scale(1.035)`}],{duration:125,fill:'forwards'}));
      }
      animations.push(...resultAnimations);await Promise.all(resultAnimations.map(a=>a.finished.catch(()=>{})));await wait(68);
    }finally{
      vs?.classList.remove('cardImpact');animations.forEach(a=>a.cancel());clearStageAnimationStyles(enemy);clearStageAnimationStyles(player);
    }
  };

  /* Showdown calculation deliberately breathes for ~1.4s, then lands the damage. */
  animateShowdownSequence=async function(p,advantage,pp,ep){
    battle.showdownVisualStage='scan';
    for(let i=0;i<5;i++){
      const slot=document.getElementById(`showdown-slot-${i}`);if(slot)slot.classList.add('showdownScan');
      await wait(reduced()?15:62);
    }
    showShowdownStep('족보 확정',p.name);await wait(reduced()?30:150);
    battle.showdownVisualStage='advantage';
    document.getElementById('edgeText').textContent=advantageText(advantage);
    showShowdownStep('우세 판정',advantageText(advantage));await wait(reduced()?30:175);
    showShowdownStep('쇼다운 효과','효과 적용');await wait(reduced()?30:155);
    showShowdownStep('최종 위력',`${pp} : ${ep}`,'finalPower');await wait(reduced()?40:285);
    const diff=Math.abs(pp-ep);
    if(diff){
      showShowdownStep('차이 피해',`${Math.max(pp,ep)} - ${Math.min(pp,ep)} = ${diff}`,'damageCalc');
      await wait(reduced()?35:235);
      document.getElementById('showdownSequence').classList.add('preImpact');
      await wait(reduced()?20:90);
    }
  };

  const corePresentDamage=presentDamage;
  presentDamage=function(target,result,feedback='damage'){
    corePresentDamage(target,result,feedback);
    if(result?.dealt&&feedback==='showdown')sfx(BattleFeedback.damageTier(result.dealt)==='large'?'bigDamage':'damage');
  };

  damageNumber=function(amount,position){
    const d=document.createElement('div');d.className='damageNumber';d.textContent=`-${amount}`;
    d.style.left=position.x+'px';d.style.top=position.y+'px';d.style.fontSize=(30+Math.min(22,Math.sqrt(amount)*3.2))+'px';
    arenaEl()?.appendChild(d);setTimeout(()=>d.remove(),900);
  };

  const observer=new MutationObserver(syncHandExchangeControls);
  const battleScreen=document.getElementById('battleScreen');
  if(battleScreen)observer.observe(battleScreen,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed','data-exchange-selected']});
  syncHandExchangeControls();
})();