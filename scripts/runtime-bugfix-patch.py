from pathlib import Path

INDEX = Path('index.html')
GAME_UI = Path('game-ui.js')
TEST = Path('test/runtime-bugfixes-v1.test.js')


def patch_index():
    text = INDEX.read_text()
    old_forecast = "function forecastText(target){ if(target==='me'){ if(battle.myForecast<=0) return '???'; recycleP(); const c=battle.deck[battle.deck.length-1]; if(!c) return '없음'; if(battle.myForecast===1) return c.rank>=11?'고랭크':c.rank<=5?'저랭크':'중랭크'; if(battle.myForecast===2) return `${rankLabel(c.rank)} 근처`; return `${suitObj(c.suit).sym}${rankLabel(c.rank)}` } else { if(battle.enemyForecast<=0) return '???'; const c=battle.nextEnemyPreview; if(battle.enemyForecast===1) return c.rank>=11?'고랭크':c.rank<=5?'저랭크':'중랭크'; if(battle.enemyForecast===2) return `${rankLabel(c.rank)} 근처`; return `${suitObj(c.suit).sym}${rankLabel(c.rank)}` } }"
    new_forecast = "function forecastText(target){ if(target==='me'){ if(battle.myForecast<=0) return '???'; const c=battle.deck[battle.deck.length-1]; if(!c) return battle.discard.length?'셔플 대기':'없음'; if(battle.myForecast===1) return c.rank>=11?'고랭크':c.rank<=5?'저랭크':'중랭크'; if(battle.myForecast===2) return `${rankLabel(c.rank)} 근처`; return `${suitObj(c.suit).sym}${rankLabel(c.rank)}` } else { if(battle.enemyForecast<=0) return '???'; const c=battle.nextEnemyPreview; if(!c) return '없음'; if(battle.enemyForecast===1) return c.rank>=11?'고랭크':c.rank<=5?'저랭크':'중랭크'; if(battle.enemyForecast===2) return `${rankLabel(c.rank)} 근처`; return `${suitObj(c.suit).sym}${rankLabel(c.rank)}` } }"
    if old_forecast in text:
        text = text.replace(old_forecast, new_forecast, 1)
    elif new_forecast not in text:
        raise SystemExit('forecastText target not found')

    old_show_deck = "function showDeck(){ const namedCount=run.deck.filter(c=>c.named).length; poolView={mode:'deck',title:`현재 덱 · 총 ${run.deck.length}장 / 네임드 ${namedCount}장`,items:run.deck.map(poolItemFromCard),selected:0}; renderPoolModal(); }"
    new_show_deck = old_show_deck + "\nfunction showBattlePile(kind='deck'){ if(!battle){showDeck();return} const piles={deck:battle.deck||[],discard:battle.discard||[],hand:battle.hand||[],exhausted:battle.exhausted||[]}; const labels={deck:'남은 전투 덱',discard:'버림 더미',hand:'현재 손패',exhausted:'소진 카드'}; const cards=piles[kind]||piles.deck; poolView={mode:'battle',title:`${labels[kind]||labels.deck} · ${cards.length}장`,items:cards.map(poolItemFromCard),selected:0}; renderPoolModal(); }"
    if old_show_deck in text and 'function showBattlePile(' not in text:
        text = text.replace(old_show_deck, new_show_deck, 1)
    elif 'function showBattlePile(' not in text:
        raise SystemExit('showDeck target not found')

    old_draw = "drawInfo.textContent=`덱 ${battle.deck.length} · 버림 ${battle.discard.length}`;"
    new_draw = "drawInfo.textContent='';"
    if old_draw in text:
        text = text.replace(old_draw, new_draw, 1)
    elif new_draw not in text:
        raise SystemExit('drawInfo target not found')

    INDEX.write_text(text)


def patch_game_ui():
    text = GAME_UI.read_text()
    old_markup = "<button type=\"button\" class=\"battlePile deck\" id=\"battleDeckPile\" aria-label=\"덱 보기\"><span class=\"pileStack\"><span class=\"pileMark\">◆</span></span><span class=\"pileCopy\"><span class=\"pileLabel\">DECK</span><strong class=\"pileCount\" id=\"battleDeckCount\">0</strong></span></button><div id=\"battlePileCenter\"><span class=\"pileCenterLabel\">DRAW PILES</span><strong class=\"pileCenterValue\" id=\"battleExchangeCount\">전투 덱</strong></div><div class=\"battlePile discard\" id=\"battleDiscardPile\"><span class=\"pileStack\"><span class=\"pileMark\">◇</span></span><span class=\"pileCopy\"><span class=\"pileLabel\">DISCARD</span><strong class=\"pileCount\" id=\"battleDiscardCount\">0</strong></span></div>"
    new_markup = "<button type=\"button\" class=\"battlePile deck\" id=\"battleDeckPile\" aria-label=\"남은 전투 덱 보기\"><span class=\"pileStack\"><span class=\"pileMark\">◆</span></span><span class=\"pileCopy\"><span class=\"pileLabel\">DECK</span><strong class=\"pileCount\" id=\"battleDeckCount\">0</strong></span></button><div id=\"battlePileCenter\"><span class=\"pileCenterLabel\">DRAW PILES</span><strong class=\"pileCenterValue\" id=\"battleExchangeCount\">전투 덱</strong></div><button type=\"button\" class=\"battlePile discard\" id=\"battleDiscardPile\" aria-label=\"버림 더미 보기\"><span class=\"pileStack\"><span class=\"pileMark\">◇</span></span><span class=\"pileCopy\"><span class=\"pileLabel\">DISCARD</span><strong class=\"pileCount\" id=\"battleDiscardCount\">0</strong></span></button>"
    if old_markup in text:
        text = text.replace(old_markup, new_markup, 1)
    elif new_markup not in text:
        raise SystemExit('battle pile markup target not found')

    old_listener = "const deckButton=hud.querySelector('#battleDeckPile');deckButton?.addEventListener?.('click',()=>{if(typeof runtimeRoot?.showDeck==='function')runtimeRoot.showDeck()});"
    new_listener = "const deckButton=hud.querySelector('#battleDeckPile'),discardButton=hud.querySelector('#battleDiscardPile');deckButton?.addEventListener?.('click',()=>{if(typeof runtimeRoot?.showBattlePile==='function')runtimeRoot.showBattlePile('deck');else if(typeof runtimeRoot?.showDeck==='function')runtimeRoot.showDeck()});discardButton?.addEventListener?.('click',()=>{if(typeof runtimeRoot?.showBattlePile==='function')runtimeRoot.showBattlePile('discard')});"
    if old_listener in text:
        text = text.replace(old_listener, new_listener, 1)
    elif new_listener not in text:
        raise SystemExit('battle pile listener target not found')

    GAME_UI.write_text(text)


def write_tests():
    TEST.write_text("""const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\n\nconst index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');\nconst ui=fs.readFileSync(path.join(__dirname,'..','game-ui.js'),'utf8');\n\ntest('예측 표시는 덱 재순환이나 셔플을 실행하지 않는다',()=>{\n  const match=index.match(/function forecastText\\(target\\)\\{[\\s\\S]*?\\n\\nfunction cardArtKey/);\n  assert.ok(match,'forecastText를 찾을 수 있어야 한다');\n  assert.doesNotMatch(match[0],/recycleP\\(\\)/);\n  assert.match(match[0],/battle\\.discard\\.length\\?'셔플 대기':'없음'/);\n});\n\ntest('전투 덱 HUD는 전체 런 덱 대신 남은 전투 덱과 버림 더미를 연다',()=>{\n  assert.match(index,/function showBattlePile\\(kind='deck'\\)/);\n  assert.match(index,/deck:battle\\.deck\\|\\|\\[\\],discard:battle\\.discard\\|\\|\\[\\]/);\n  assert.match(ui,/showBattlePile==='function'\\)runtimeRoot\\.showBattlePile\\('deck'\\)/);\n  assert.match(ui,/showBattlePile==='function'\\)runtimeRoot\\.showBattlePile\\('discard'\\)/);\n});\n\ntest('손패 제목은 덱과 버림 수량을 중복 표시하지 않는다',()=>{\n  assert.match(index,/drawInfo\\.textContent='';/);\n  assert.doesNotMatch(index,/drawInfo\\.textContent=`덱 \\${battle\\.deck\\.length} · 버림 \\${battle\\.discard\\.length}`/);\n});\n""")


patch_index()
patch_game_ui()
write_tests()
