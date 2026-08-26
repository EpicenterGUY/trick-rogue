from pathlib import Path

# Make the mobile hand visually cleaner and keep each card's center reliably tappable.
scene=Path('battle-scene-v2.js')
s=scene.read_text(encoding='utf-8')
old="  #handRow .card{min-width:84px!important;width:84px!important;height:124px!important;margin-left:-10px!important}"
new="  #handRow .card{min-width:84px!important;width:84px!important;height:124px!important;margin-left:-6px!important;transform:translateX(var(--fan-x,0px)) translateY(var(--fan-y,0px)) rotate(0deg)!important;touch-action:manipulation}"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('battle scene hand rule not found')
scene.write_text(s,encoding='utf-8')

# Browser smoke should pick a card that can be played immediately instead of a targeting card.
p=Path('test/browser-smoke-v1.test.js')
s=p.read_text(encoding='utf-8')
old_select='    await clickElement(cdp,"document.querySelector(\'#handRow .card\')",\'첫 손패 카드\');\n    await waitFor(cdp,"!document.getElementById(\'playBtn\').disabled",{label:\'enabled play button\'});'
new_select='    const playableCardExpr=`(()=>{const els=[...document.querySelectorAll(\'#handRow .card\')];return els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid);return card&&!card.named&&!card.definition&&!card.cardId})||els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid),def=card?.definition||card?.named;return card&&!def?.targeting})||els[0]})()`;\n    await clickElement(cdp,playableCardExpr,\'바로 낼 수 있는 손패 카드\',{hitTest:true});\n    await waitFor(cdp,"!document.getElementById(\'playBtn\').disabled",{label:\'enabled play button\'});'
if old_select in s:s=s.replace(old_select,new_select,1)
elif 'const playableCardExpr=' not in s:raise SystemExit('browser smoke selection target not found')
# Keep useful hit-test diagnostics if a future overlay blocks a card.
old_hit="""    const receives=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return !!(el&&hit&&(hit===el||el.contains(hit)))})()`);
    assert.equal(receives,true,`${label} should be the topmost click target`);"""
new_hit="""    const hitInfo=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return{receives:!!(el&&hit&&(hit===el||el.contains(hit))),target:el?{tag:el.tagName,id:el.id,cls:el.className}:null,hit:hit?{tag:hit.tagName,id:hit.id,cls:hit.className}:null}})()`);
    if(!hitInfo.receives)console.error('HITTEST_DIAG',JSON.stringify({label,point,hitInfo}));
    assert.equal(hitInfo.receives,true,`${label} should be the topmost click target`);"""
if old_hit in s:s=s.replace(old_hit,new_hit,1)
p.write_text(s,encoding='utf-8')

# Lock the no-rotation / lower-overlap tap-safe hand in the V2 regression test.
t=Path('test/battle-scene-v2.test.js')
s=t.read_text(encoding='utf-8')
anchor="  assert.match(css,/#handRow \\.card\\{min-width:84px/);"
extra="  assert.match(css,/#handRow \\.card\\{[^}]*margin-left:-6px/);\n  assert.match(css,/#handRow \\.card\\{[^}]*rotate\\(0deg\\)/);"
if extra not in s:
    if anchor not in s:raise SystemExit('battle scene test anchor not found')
    s=s.replace(anchor,anchor+'\n'+extra,1)
t.write_text(s,encoding='utf-8')
print('finalized battle scene hand tap accessibility')
