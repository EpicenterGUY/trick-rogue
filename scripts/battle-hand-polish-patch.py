from pathlib import Path

path=Path('index.html')
text=path.read_text(encoding='utf-8')

repls=[]

def replace(old,new,label):
    global text
    if old not in text:
        raise SystemExit(f'missing target: {label}')
    text=text.replace(old,new,1)

replace(
".hpFill{height:100%;transition:width 200ms cubic-bezier(.2,.7,.25,1);will-change:width}",
".hpFill{height:100%;transition:width 340ms cubic-bezier(.12,.78,.18,1);will-change:width}",
'hp bar pacing')

replace(
"#handRow{display:flex;gap:6px;overflow-x:auto;overflow-y:visible;align-items:flex-start;padding:4px 2px 10px}",
"#handRow{display:flex;gap:6px;overflow-x:auto;overflow-y:visible;align-items:flex-start;padding:12px 2px 12px;position:relative;isolation:isolate}",
'hand row spacing')

replace(
"#handRow.has-selection .card:not(.sel){transform:translateY(3px)}.card.sel,.card.sel:hover{transform:translateY(-8px) scale(1.04);filter:drop-shadow(0 0 0 #000) drop-shadow(0 0 10px #63d3d599);z-index:2}",
"#handRow.has-selection .card:not(.sel):not(.is-selected):not(.exchange-selected):not([data-exchange-selected=\"true\"]):not([aria-pressed=\"true\"]){transform:translateY(3px) scale(.985);filter:brightness(.83) saturate(.82)}\n.card.sel,.card.is-selected,.card.exchange-selected,.card[data-exchange-selected=\"true\"],.card[aria-pressed=\"true\"],.card.sel:hover{transform:translateY(-11px) scale(1.05);filter:drop-shadow(0 0 0 #000) drop-shadow(0 0 12px #63d3d5bb);z-index:4;animation:handSelectSnap 190ms cubic-bezier(.16,.86,.25,1)}\n.card.sel:before,.card.is-selected:before,.card.exchange-selected:before,.card[data-exchange-selected=\"true\"]:before,.card[aria-pressed=\"true\"]:before{content:'✓';position:absolute;right:-3px;top:-5px;width:20px;height:20px;display:grid;place-items:center;border-radius:50%;z-index:6;color:#071013;background:#72ddd8;box-shadow:0 0 0 2px #071013,0 0 12px #67d3d099;font-size:13px;font-weight:900;pointer-events:none}\n#inspect,#handPanel .panelTitle,#handPanel button:not(.card),#battleScreen .handExchangeAction{position:relative;z-index:16}\n@keyframes handSelectSnap{0%{transform:translateY(-3px) scale(.98)}55%{transform:translateY(-13px) scale(1.065)}100%{transform:translateY(-11px) scale(1.05)}}",
'hand selection styles')

replace(
".flyingCard{position:absolute;z-index:50;pointer-events:none;transform-origin:center;filter:drop-shadow(0 10px 10px #0008);will-change:left,top,width,height,transform}",
".flyingCard{position:absolute;z-index:14;pointer-events:none;transform-origin:center;filter:drop-shadow(0 10px 10px #0008);will-change:left,top,width,height,transform}.handDiscardGhost{position:fixed!important;z-index:13!important;pointer-events:none!important;transform-origin:center;will-change:transform,opacity}.handDealIn{transform-origin:center bottom}#versus.cardImpact .vsText{animation:versusImpact 180ms cubic-bezier(.16,.86,.25,1)}@keyframes versusImpact{0%{transform:scale(1)}38%{transform:scale(1.28);filter:brightness(1.65)}100%{transform:scale(1);filter:none}}",
'flying layer and impact')

replace(
"animation:damagePop .62s linear forwards",
"animation:damagePop .82s cubic-bezier(.12,.72,.18,1) forwards",
'damage number duration')

replace(
"@keyframes damagePop{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}36%{opacity:1;transform:translate(-50%,-50%) scale(.9)}52%{opacity:1;transform:translate(-50%,-50%) scale(1)}78%{opacity:1;transform:translate(-50%,-58%) scale(1)}100%{opacity:0;transform:translate(-50%,-85%) scale(1)}}",
"@keyframes damagePop{0%{opacity:0;transform:translate(-50%,-50%) scale(.72)}10%{opacity:1;transform:translate(-50%,-50%) scale(1.38)}24%{opacity:1;transform:translate(-50%,-50%) scale(.94)}40%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}68%{opacity:1;transform:translate(-50%,-58%) scale(1)}100%{opacity:0;transform:translate(-50%,-92%) scale(.96)}}",
'damage pop keyframes')

replace(
".card.sel,.card.sel:hover{transform:translateY(-8px) scale(1.04)}\n.card.sel:active{transform:translateY(-5px) scale(1)}",
".card.sel,.card.sel:hover,.card.is-selected,.card.exchange-selected,.card[data-exchange-selected=\"true\"],.card[aria-pressed=\"true\"]{transform:translateY(-11px) scale(1.05)}\n.card.sel:active,.card.is-selected:active,.card.exchange-selected:active{transform:translateY(-7px) scale(1.01)}",
'later selection override')

old_hand="""const HAND_MOTION_MS=180;
function handMotionDisabled(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
function animateRemovedHandCard(el,rect){
 if(handMotionDisabled()||!rect.width)return;
 const ghost=el.cloneNode(true);ghost.removeAttribute('id');ghost.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;z-index:40;pointer-events:none`;
 document.body.appendChild(ghost);
 ghost.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(-6px) scale(.94)'}],{duration:160,easing:'cubic-bezier(.4,0,.8,.2)',fill:'forwards'}).finished.finally(()=>ghost.remove());
}
function renderHand(){
 const previous=new Map([...handRow.children].map(el=>[el.dataset.uid,{el,rect:el.getBoundingClientRect()}]));
 const oldRects=new Map([...previous].map(([uid,item])=>[uid,item.rect]));
 const selectedUid=battle.selected||null,fragment=document.createDocumentFragment();
 for(const card of battle.hand){
  const prior=previous.get(card.uid),el=prior?.el||document.createElement('button');
  if(!prior){el.id=`card-${card.uid}`;el.innerHTML=`<div class="cardArt">${artHtml(card,'hand')}</div>`;el.onclick=()=>selectCard(card.uid)}
  el.dataset.uid=card.uid;el.className=`card ${card.named?'named':''} ${selectedUid===card.uid?'sel':''}`;fragment.appendChild(el);previous.delete(card.uid);
 }
 for(const {el,rect} of previous.values())animateRemovedHandCard(el,rect);
 handRow.replaceChildren(fragment);handRow.classList.toggle('has-selection',!!selectedUid);
 if(handMotionDisabled())return;
 const deckRect=drawInfo.getBoundingClientRect();
 for(const el of handRow.children){
  const end=el.getBoundingClientRect(),oldRect=oldRects.get(el.dataset.uid);let dx,dy,scale=.94,opacity=1;
  if(oldRect){dx=oldRect.left-end.left;dy=oldRect.top-end.top;scale=1}
  else{dx=deckRect.left+deckRect.width/2-end.left-end.width/2;dy=deckRect.top+deckRect.height/2-end.top-end.height/2;opacity=0}
  if(Math.abs(dx)<.5&&Math.abs(dy)<.5&&opacity===1)continue;
  el.animate([{transform:`translate(${dx}px,${dy}px) scale(${scale})`,opacity},{transform:'none',opacity:1}],{duration:HAND_MOTION_MS,easing:'cubic-bezier(.2,.8,.2,1)'});
 }
}
"""
new_hand="""const HAND_MOTION_MS=250;
function handMotionDisabled(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
function pileCenter(id,fallbackRect){const el=document.getElementById(id),r=el?.getBoundingClientRect?.()||fallbackRect;return{x:r.left+r.width/2,y:r.top+r.height/2}}
function animateRemovedHandCard(el,rect){
 if(handMotionDisabled()||!rect.width)return;
 const ghost=el.cloneNode(true);ghost.removeAttribute('id');ghost.classList.add('handDiscardGhost');ghost.style.cssText+=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;`;
 document.body.appendChild(ghost);
 const fallback={left:innerWidth*.76,top:innerHeight*.76,width:1,height:1},dest=pileCenter('battleDiscardPile',fallback),sx=rect.left+rect.width/2,sy=rect.top+rect.height/2,dx=dest.x-sx,dy=dest.y-sy;
 ghost.animate([{opacity:1,transform:'translate(0,0) rotate(0deg) scale(1)'},{opacity:1,transform:`translate(${dx*.55}px,${dy*.48-14}px) rotate(5deg) scale(.93)`,offset:.55},{opacity:0,transform:`translate(${dx}px,${dy}px) rotate(11deg) scale(.72)`}],{duration:240,easing:'cubic-bezier(.25,.7,.2,1)',fill:'forwards'}).finished.catch(()=>{}).finally(()=>ghost.remove());
}
function renderHand(){
 const previous=new Map([...handRow.children].map(el=>[el.dataset.uid,{el,rect:el.getBoundingClientRect()}]));
 const oldRects=new Map([...previous].map(([uid,item])=>[uid,item.rect]));
 const selectedUid=battle.selected||null,fragment=document.createDocumentFragment(),newUids=[];
 for(const card of battle.hand){
  const prior=previous.get(card.uid),el=prior?.el||document.createElement('button');
  if(!prior){el.id=`card-${card.uid}`;el.innerHTML=`<div class="cardArt">${artHtml(card,'hand')}</div>`;el.onclick=()=>selectCard(card.uid);newUids.push(card.uid)}
  el.dataset.uid=card.uid;el.className=`card ${card.named?'named':''} ${selectedUid===card.uid?'sel':''}`;fragment.appendChild(el);previous.delete(card.uid);
 }
 for(const {el,rect} of previous.values())animateRemovedHandCard(el,rect);
 handRow.replaceChildren(fragment);handRow.classList.toggle('has-selection',!!selectedUid||!!handRow.querySelector('.is-selected,.exchange-selected,[data-exchange-selected="true"],[aria-pressed="true"]'));
 if(handMotionDisabled())return;
 const fallback=drawInfo.getBoundingClientRect(),deck=pileCenter('battleDeckPile',fallback);
 let dealIndex=0;
 for(const el of handRow.children){
  const end=el.getBoundingClientRect(),oldRect=oldRects.get(el.dataset.uid);let dx,dy,scale=.94,opacity=1,delay=0;
  if(oldRect){dx=oldRect.left-end.left;dy=oldRect.top-end.top;scale=1}
  else{dx=deck.x-end.left-end.width/2;dy=deck.y-end.top-end.height/2;scale=.76;opacity=.08;delay=dealIndex++*42;el.classList.add('handDealIn')}
  if(Math.abs(dx)<.5&&Math.abs(dy)<.5&&opacity===1)continue;
  const frames=oldRect?[{transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1},{transform:'none',opacity:1}]:[{transform:`translate(${dx}px,${dy}px) rotate(-5deg) scale(${scale})`,opacity},{transform:'translateY(-3px) rotate(1deg) scale(1.035)',opacity:1,offset:.76},{transform:'none',opacity:1}];
  const anim=el.animate(frames,{duration:oldRect?210:HAND_MOTION_MS,delay,easing:'cubic-bezier(.18,.82,.2,1)'});anim.finished.catch(()=>{}).finally(()=>el.classList.remove('handDealIn'));
 }
}
function syncHandExchangeControls(){
 document.querySelectorAll('#battleScreen button').forEach(btn=>{if(btn.classList.contains('card'))return;const label=(btn.textContent||'').replace(/\\s+/g,' ').trim();btn.classList.toggle('handExchangeAction',/패\\s*교환|패갈이|손패\\s*교환/.test(label))})
}
"""
replace(old_hand,new_hand,'hand animation block')

replace(
"statuses.innerHTML=statusList(); renderHand(); drawInfo.textContent=''; if(battle.selected)",
"statuses.innerHTML=statusList(); renderHand(); syncHandExchangeControls(); drawInfo.textContent=''; if(battle.selected)",
'render exchange controls')

replace(
"function selectCard(uid){ if(battle.animating)return; if(battle.selected===uid&&battle.inspectSlot===null){battle.selected=null;sfx('cardSelect');renderBattle();return} battle.selected=uid; battle.inspectSlot=null; battle.inspectStage=null; sfx('cardSelect'); renderBattle(); document.getElementById('inspect').scrollIntoView({behavior:'smooth',block:'nearest'}); }",
"function selectCard(uid){ if(battle.animating)return; if(battle.selected===uid&&battle.inspectSlot===null){battle.selected=null;sfx('cardSelect');renderBattle();return} battle.selected=uid; battle.inspectSlot=null; battle.inspectStage=null; sfx('cardSelect'); renderBattle(); const panel=document.getElementById('inspect'),r=panel?.getBoundingClientRect?.();if(r&&(r.bottom>innerHeight-8||r.top<0))panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }",
'selection scroll')

replace(
"await transition({transform:'translateY(-8px) scale(1.04)'},80);",
"await transition({transform:'translateY(-10px) rotate(-1deg) scale(1.045)'},70);",
'flight lift')
replace(
"transform:'translateY(0) scale(1)'},180,'cubic-bezier(.18,.82,.2,1)');",
"transform:'translateY(0) rotate(-3deg) scale(1.065)'},175,'cubic-bezier(.16,.86,.2,1)');versus.classList.add('cardImpact');",
'flight center')
replace(
"{transform:'scale(1.07)',offset:.35},{transform:'scale(.97)',offset:.7},{transform:'scale(1)'}],{duration:100,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}).finished.catch(error=>{if(error.name!=='AbortError')console.warn(error)});\n  await wait(50);",
"{transform:'rotate(-3deg) scale(1.09)',offset:.34},{transform:'rotate(1deg) scale(.97)',offset:.72},{transform:'scale(1)'}],{duration:110,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'}).finished.catch(error=>{if(error.name!=='AbortError')console.warn(error)});versus.classList.remove('cardImpact');\n  await wait(55);",
'flight impact pulse')
replace(
"transform:'scale(1)'},180,'cubic-bezier(.18,.82,.2,1)');",
"transform:'scale(1)'},165,'cubic-bezier(.18,.82,.2,1)');",
'flight to slot')
replace(
"}finally{clone.getAnimations().forEach(animation=>animation.cancel());src.style.visibility=originalVisibility;clone.remove()}",
"}finally{versus.classList.remove('cardImpact');clone.getAnimations().forEach(animation=>animation.cancel());src.style.visibility=originalVisibility;clone.remove()}",
'flight cleanup')

old_show="""async function animateShowdownSequence(p,advantage,pp,ep){
 battle.showdownVisualStage='scan';
 for(let i=0;i<5;i++){const slot=document.getElementById(`showdown-slot-${i}`);if(slot)slot.classList.add('showdownScan');await wait(55)}
 showShowdownStep('족보 확정',p.name);await wait(100);
 battle.showdownVisualStage='advantage';edgeText.textContent=advantageText(advantage);showShowdownStep('우세 판정',advantageText(advantage));await wait(125);
 showShowdownStep('쇼다운 효과','효과 적용');await wait(125);
 showShowdownStep('최종 위력',`${pp} : ${ep}`,'finalPower');await wait(180);
}
"""
new_show="""async function animateShowdownSequence(p,advantage,pp,ep){
 battle.showdownVisualStage='scan';
 for(let i=0;i<5;i++){const slot=document.getElementById(`showdown-slot-${i}`);if(slot)slot.classList.add('showdownScan');await wait(62)}
 showShowdownStep('족보 확정',p.name);await wait(150);
 battle.showdownVisualStage='advantage';edgeText.textContent=advantageText(advantage);showShowdownStep('우세 판정',advantageText(advantage));await wait(175);
 showShowdownStep('쇼다운 효과','효과 적용');await wait(155);
 showShowdownStep('최종 위력',`${pp} : ${ep}`,'finalPower');await wait(285);
 const diff=Math.abs(pp-ep);if(diff){showShowdownStep('차이 피해',`${Math.max(pp,ep)} - ${Math.min(pp,ep)} = ${diff}`,'damageCalc');await wait(235);showdownSequence.classList.add('preImpact');await wait(90)}
 return diff;
}
"""
replace(old_show,new_show,'showdown pacing')

replace(
"await animateShowdownSequence(p,advantage,pp,ep); const diff=Math.abs(pp-ep); if(diff)showdownSequence.classList.add('impact');",
"const diff=await animateShowdownSequence(p,advantage,pp,ep); if(diff)showdownSequence.classList.add('impact');",
'showdown diff handoff')

replace(
"function presentDamage(target,result,feedback='damage'){renderBattle();if(!result.dealt)return;if(feedback==='showdown')battleFeedback.shake('showdown');else battleFeedback.damage(result.dealt);if(feedback!=='showdown')sfx(BattleFeedback.damageTier(result.dealt)==='large'?'bigDamage':'damage');",
"function presentDamage(target,result,feedback='damage'){renderBattle();if(!result.dealt)return;if(feedback==='showdown')battleFeedback.shake('showdown');else battleFeedback.damage(result.dealt);sfx(BattleFeedback.damageTier(result.dealt)==='large'?'bigDamage':'damage');",
'showdown damage impact sfx')

path.write_text(text,encoding='utf-8')
print('patched index.html')
