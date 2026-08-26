from pathlib import Path

path=Path('battle-layout.js')
text=path.read_text(encoding='utf-8')

anchor="  const COMPENDIUM_BRIDGE_DATASET='trick-compendium-8-h-runtime-bridge';"
insert="  const COMPENDIUM_BRIDGE_DATASET='trick-compendium-8-h-runtime-bridge';\n  const BATTLE_SCENE_V2_DATASET='trick-battle-scene-v2';"
if 'BATTLE_SCENE_V2_DATASET' not in text:
    if anchor not in text: raise SystemExit('dataset anchor missing')
    text=text.replace(anchor,insert,1)

anchor="  function loadCompendiumBridge(doc=root.document){return appendScript(doc,'compendium-8-h-runtime-bridge.js',COMPENDIUM_BRIDGE_DATASET,()=>!!root.Compendium8HRuntimeBridge)}"
insert=anchor+"\n  function loadBattleSceneV2(doc=root.document){return appendScript(doc,'battle-scene-v2.js',BATTLE_SCENE_V2_DATASET,()=>!!root.BattleSceneV2)}"
if 'function loadBattleSceneV2' not in text:
    if anchor not in text: raise SystemExit('loader anchor missing')
    text=text.replace(anchor,insert,1)

old="loadCompendium(doc);loadCompendiumBridge(doc);wrapRenderBattle(root);"
new="loadCompendium(doc);loadCompendiumBridge(doc);loadBattleSceneV2(doc);wrapRenderBattle(root);"
if new not in text:
    if old not in text: raise SystemExit('install anchor missing')
    text=text.replace(old,new,1)

old="COMPENDIUM_DATASET,COMPENDIUM_BRIDGE_DATASET,MOBILE_STAGE_WIDTH"
new="COMPENDIUM_DATASET,COMPENDIUM_BRIDGE_DATASET,BATTLE_SCENE_V2_DATASET,MOBILE_STAGE_WIDTH"
if new not in text:
    if old not in text: raise SystemExit('return constants anchor missing')
    text=text.replace(old,new,1)

old="loadCompendium,loadCompendiumBridge,activeBattle"
new="loadCompendium,loadCompendiumBridge,loadBattleSceneV2,activeBattle"
if new not in text:
    if old not in text: raise SystemExit('return loader anchor missing')
    text=text.replace(old,new,1)

path.write_text(text,encoding='utf-8')
print('attached battle scene v2')
