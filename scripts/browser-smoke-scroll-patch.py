from pathlib import Path

path=Path('test/browser-smoke-v1.test.js')
text=path.read_text()
old="""async function clickElement(cdp,expression,label){
  const point=await pointFor(cdp,expression);assert.ok(point,`${label} element should exist`);assert.equal(point.visible,true,`${label} should be visible`);assert.equal(point.disabled,false,`${label} should be enabled`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
"""
new="""async function clickElement(cdp,expression,label){
  await evaluate(cdp,`(()=>{const el=${expression};if(!el)return false;el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true})()`);await sleep(80);
  const point=await pointFor(cdp,expression);assert.ok(point,`${label} element should exist`);assert.equal(point.visible,true,`${label} should be visible`);assert.equal(point.disabled,false,`${label} should be enabled`);assert.ok(point.x>=0&&point.x<=390&&point.y>=0&&point.y<=844,`${label} should be inside mobile viewport after scroll`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
"""
if old not in text: raise SystemExit('clickElement target not found')
path.write_text(text.replace(old,new,1))
