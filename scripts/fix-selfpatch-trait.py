from pathlib import Path
p=Path('scripts/build-identity-selfpatch.py')
s=p.read_text(encoding='utf-8')
old="""old=\"\"\"    runState.traitId=trait.id;runState.trait=trait;\n    return runState;\"\"\"\nnew=\"\"\"    runState.traitId=trait.id;runState.trait=trait;\n    if(runState.char&&typeof runState.char==='object'){\n      runState.char.passives=Array.isArray(trait.effects)&&trait.effects.length?[{\n        id:`trait.${trait.id}`,name:trait.name,description:trait.desc||'',effectOwnerType:'passive',buildTags:[...(trait.buildTags||[])],effects:trait.effects.map(effect=>({...effect}))\n      }]:[];\n    }\n    return runState;\"\"\"\ns=replace_once(s,old,new,'trait passive bridge')"""
new="""s=sub_once(s,\n    r\"(function applyTraitToRun\\(runState,traitOrId\\)\\{.*?\\n\\s*runState\\.traitId=trait\\.id;runState\\.trait=trait;)(\\n\\s*return runState;\\n\\s*\\})\",\n    r\"\\1\\n    if(runState.char&&typeof runState.char==='object'){\\n      runState.char.passives=Array.isArray(trait.effects)&&trait.effects.length?[{\\n        id:`trait.${trait.id}`,name:trait.name,description:trait.desc||'',effectOwnerType:'passive',buildTags:[...(trait.buildTags||[])],effects:trait.effects.map(effect=>({...effect}))\\n      }]:[];\\n    }\\2\",\n    'trait passive bridge',flags=re.S)"""
if old not in s: raise SystemExit('old trait bridge block not found in selfpatch')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('fixed selfpatch trait target')
