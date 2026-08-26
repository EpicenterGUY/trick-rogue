from pathlib import Path

# Preserve the established RunFlowV2 -> RunEconomyV2 loader contract. Run V3's
# minigame/event layers are attached after economy is ready and before the
# battle reward market, so older loader invariants remain valid while every V3
# browser dependency is present before the final UI chain completes.
path=Path('enemy-behavior.js')
text=path.read_text(encoding='utf-8')
old="""  function finishRunEconomyV2(){
    loadBattleRewardMarket();
  }
  function loadRunEconomyV2(){
    if(root.RunEconomyV2){finishRunEconomyV2();return;}
    const script=loadScript('run-economy-v2.js','trick-run-economy-v2-runtime');
    if(script?.dataset?.loaded==='true')finishRunEconomyV2();else script?.addEventListener?.('load',finishRunEconomyV2,{once:true});
  }
  function loadRunFlowV2(){
    if(root.RunFlowV2){loadRunEconomyV2();return;}
    const script=loadScript('run-flow-v2.js','trick-run-flow-v2-runtime');
    if(script?.dataset?.loaded==='true')loadRunEconomyV2();else script?.addEventListener?.('load',loadRunEconomyV2,{once:true});
  }
"""
new="""  function loadRunEvents(){
    if(root.RunEvents){loadBattleRewardMarket();return;}
    const script=loadScript('run-events.js','trick-run-events-runtime');
    if(script?.dataset?.loaded==='true')loadBattleRewardMarket();else script?.addEventListener?.('load',loadBattleRewardMarket,{once:true});
  }
  function loadRunMinigames(){
    if(root.RunMinigames){loadRunEvents();return;}
    const script=loadScript('run-minigames.js','trick-run-minigames-runtime');
    if(script?.dataset?.loaded==='true')loadRunEvents();else script?.addEventListener?.('load',loadRunEvents,{once:true});
  }
  function finishRunEconomyV2(){
    loadRunMinigames();
  }
  function loadRunEconomyV2(){
    if(root.RunEconomyV2){finishRunEconomyV2();return;}
    const script=loadScript('run-economy-v2.js','trick-run-economy-v2-runtime');
    if(script?.dataset?.loaded==='true')finishRunEconomyV2();else script?.addEventListener?.('load',finishRunEconomyV2,{once:true});
  }
  function loadRunFlowV2(){
    if(root.RunFlowV2){loadRunEconomyV2();return;}
    const script=loadScript('run-flow-v2.js','trick-run-flow-v2-runtime');
    if(script?.dataset?.loaded==='true')loadRunEconomyV2();else script?.addEventListener?.('load',loadRunEconomyV2,{once:true});
  }
"""
if old not in text:
    raise SystemExit('enemy-behavior loader target missing')
path.write_text(text.replace(old,new,1),encoding='utf-8')

# Normalize the HTML quote escape while touching the V3 flow file.
path=Path('run-flow-v2.js')
text=path.read_text(encoding='utf-8')
text=text.replace("'\\\"':'&quot'", "'\\\"':'&quot;'", 1)
path.write_text(text,encoding='utf-8')

# The smoke test wants the canonical current actionable node. V3 can expose
# route/decorative nodes that satisfy the old lock/done heuristic but are not
# the active click target.
path=Path('test/browser-smoke-v1.test.js')
text=path.read_text(encoding='utf-8')
old_selector="[...document.querySelectorAll('#mapGrid .node')].find(el=>!el.classList.contains('lock')&&!el.classList.contains('done'))"
new_selector="document.querySelector('#mapGrid .node.current:not(:disabled)')"
if old_selector in text:
    text=text.replace(old_selector,new_selector,1)
elif new_selector not in text:
    raise SystemExit('browser smoke map selector target missing')
path.write_text(text,encoding='utf-8')
print('Run V3 latest-main compatibility patch applied')
