from pathlib import Path


def patch_game_ui():
    path = Path('game-ui.js')
    text = path.read_text()
    old = """  function syncPileHud(doc=root.document,state=activeBattle(root),runtimeRoot=root){
    const hud=ensurePileHud(doc,runtimeRoot);if(!hud)return false;const counts=pileCounts(state,doc);
    const deck=doc.getElementById('battleDeckCount'),discard=doc.getElementById('battleDiscardCount'),exchange=doc.getElementById('battleExchangeCount');
    if(deck)deck.textContent=String(counts.deck);if(discard)discard.textContent=String(counts.discard);if(exchange)exchange.textContent=counts.exchange===null?'전투 덱':`교환 ${counts.exchange}회`;
    hud.dataset.deckEmpty=counts.deck===0?'true':'false';hud.dataset.discardEmpty=counts.discard===0?'true':'false';return counts;
  }
"""
    new = """  function setTextIfChanged(element,value){if(!element)return false;const next=String(value);if(element.textContent===next)return false;element.textContent=next;return true}
  function syncPileHud(doc=root.document,state=activeBattle(root),runtimeRoot=root){
    const hud=ensurePileHud(doc,runtimeRoot);if(!hud)return false;const counts=pileCounts(state,doc);
    const deck=doc.getElementById('battleDeckCount'),discard=doc.getElementById('battleDiscardCount'),exchange=doc.getElementById('battleExchangeCount');
    setTextIfChanged(deck,counts.deck);setTextIfChanged(discard,counts.discard);setTextIfChanged(exchange,counts.exchange===null?'전투 덱':`교환 ${counts.exchange}회`);
    hud.dataset.deckEmpty=counts.deck===0?'true':'false';hud.dataset.discardEmpty=counts.discard===0?'true':'false';return counts;
  }
"""
    if old in text:
        text = text.replace(old, new, 1)
    elif 'function setTextIfChanged' not in text:
        raise SystemExit('game-ui syncPileHud target not found')

    old_observer = "observer.observe(doc.getElementById('app')||doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});"
    new_observer = "observer.observe(doc.getElementById('app')||doc.body,{subtree:true,attributes:true,attributeFilter:['class']});"
    if old_observer in text:
        text = text.replace(old_observer, new_observer, 1)
    elif new_observer not in text:
        raise SystemExit('game-ui observer target not found')

    if 'ensurePileHud,setTextIfChanged,syncPileHud' not in text:
        text = text.replace('ensurePileHud,syncPileHud,', 'ensurePileHud,setTextIfChanged,syncPileHud,', 1)
    path.write_text(text)


def patch_index():
    path = Path('index.html')
    text = path.read_text()
    old = '<section class="screen active" id="startScreen">'
    new = '<section class="screen active" id="startScreen" style="visibility:hidden">'
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit('index startScreen target not found')
    path.write_text(text)


def patch_tests():
    path = Path('test/game-ui-v1.test.js')
    text = path.read_text()
    if '같은 덱 숫자를 다시 쓰지 않아 감시기 재귀 갱신' in text:
        return
    text += r'''

test('전역 UI 동기화는 같은 덱 숫자를 다시 쓰지 않아 감시기 재귀 갱신을 만들지 않는다',()=>{
  const writes={deck:0,discard:0,exchange:0};
  function tracked(key,initial){let text=String(initial);return{get textContent(){return text},set textContent(value){writes[key]++;text=String(value)}}}
  const nodes={handPanel:{parentNode:{}},battlePileHud:{dataset:{}},drawInfo:{textContent:'덱 3 · 버림 4'},battleDeckCount:tracked('deck','3'),battleDiscardCount:tracked('discard','4'),battleExchangeCount:tracked('exchange','전투 덱')};
  const doc={getElementById(id){return nodes[id]||null}};
  UI.syncPileHud(doc,{deck:[1,2,3],discard:[1,2,3,4]},{});
  UI.syncPileHud(doc,{deck:[1,2,3],discard:[1,2,3,4]},{});
  assert.deepEqual(writes,{deck:0,discard:0,exchange:0});
});

test('전역 UI 감시기는 childList를 감시하지 않아 HUD 내부 쓰기를 다시 감지하지 않는다',()=>{
  const Original=global.MutationObserver;let options=null;
  global.MutationObserver=class{constructor(callback){this.callback=callback}observe(_target,next){options=next}};
  const app={},doc={getElementById(id){return id==='app'?app:null},body:{}};
  try{
    assert.equal(UI.observe({document:doc}),true);
    assert.equal(options.attributes,true);
    assert.equal(Object.prototype.hasOwnProperty.call(options,'childList'),false);
  }finally{global.MutationObserver=Original}
});

test('시작 화면은 최신 시작 런타임 준비 전부터 숨겨 구버전 화면 플래시를 막는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(source,/<section class="screen active" id="startScreen" style="visibility:hidden">/);
});
'''
    path.write_text(text)


patch_game_ui()
patch_index()
patch_tests()
