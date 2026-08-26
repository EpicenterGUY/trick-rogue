from pathlib import Path
p=Path('test/browser-smoke-v1.test.js')
s=p.read_text(encoding='utf-8')
old='    await clickElement(cdp,"document.querySelector(\'#handRow .card\')",\'첫 손패 카드\');\n    await waitFor(cdp,"!document.getElementById(\'playBtn\').disabled",{label:\'enabled play button\'});'
new='    const playableCardExpr=`(()=>{const els=[...document.querySelectorAll(\'#handRow .card\')];return els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid);return card&&!card.named&&!card.definition&&!card.cardId})||els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid),def=card?.definition||card?.named;return card&&!def?.targeting})||els[0]})()`;\n    await clickElement(cdp,playableCardExpr,\'바로 낼 수 있는 손패 카드\',{hitTest:true});\n    await waitFor(cdp,"!document.getElementById(\'playBtn\').disabled",{label:\'enabled play button\'});'
if old not in s: raise SystemExit('target not found')
s=s.replace(old,new,1)
old_hit="""    const receives=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return !!(el&&hit&&(hit===el||el.contains(hit)))})()`);
    assert.equal(receives,true,`${label} should be the topmost click target`);"""
new_hit="""    const hitInfo=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return{receives:!!(el&&hit&&(hit===el||el.contains(hit))),target:el?{tag:el.tagName,id:el.id,cls:el.className,rect:(()=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()}:null,hit:hit?{tag:hit.tagName,id:hit.id,cls:hit.className,text:(hit.textContent||'').trim().slice(0,80),pointer:getComputedStyle(hit).pointerEvents,z:getComputedStyle(hit).zIndex,position:getComputedStyle(hit).position}:null}})()`);
    if(!hitInfo.receives)console.error('HITTEST_DIAG',JSON.stringify({label,point,hitInfo}));
    assert.equal(hitInfo.receives,true,`${label} should be the topmost click target`);"""
if old_hit not in s: raise SystemExit('hit-test target not found')
s=s.replace(old_hit,new_hit,1)
p.write_text(s,encoding='utf-8')
print('patched browser smoke playable card selection + diagnostics')
