from pathlib import Path
p=Path('test/browser-smoke-v1.test.js')
s=p.read_text(encoding='utf-8')
old='    await clickElement(cdp,"document.querySelector(\'#handRow .card\')",\'첫 손패 카드\');\n    await waitFor(cdp,"!document.getElementById(\'playBtn\').disabled",{label:\'enabled play button\'});'
new='    const playableCardExpr=`(()=>{const els=[...document.querySelectorAll(\'#handRow .card\')];return els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid);return card&&!card.named&&!card.definition&&!card.cardId})||els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid),def=card?.definition||card?.named;return card&&!def?.targeting})||els[0]})()`;\n    await clickElement(cdp,playableCardExpr,\'바로 낼 수 있는 손패 카드\',{hitTest:true});\n    await waitFor(cdp,"!document.getElementById(\'playBtn\').disabled",{label:\'enabled play button\'});'
if old not in s: raise SystemExit('target not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('patched browser smoke playable card selection')
