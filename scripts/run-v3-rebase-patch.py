from pathlib import Path

# Preserve the latest reward-market loader chain while inserting the V3 runtime modules.
path=Path('enemy-behavior.js')
text=path.read_text(encoding='utf-8')
old="""  function loadRunEconomyV2(){
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
new="""  function loadRunEconomyV2(){
    if(root.RunEconomyV2){finishRunEconomyV2();return;}
    const script=loadScript('run-economy-v2.js','trick-run-economy-v2-runtime');
    if(script?.dataset?.loaded==='true')finishRunEconomyV2();else script?.addEventListener?.('load',finishRunEconomyV2,{once:true});
  }
  function loadRunEvents(){
    if(root.RunEvents){loadRunEconomyV2();return;}
    const script=loadScript('run-events.js','trick-run-events-runtime');
    if(script?.dataset?.loaded==='true')loadRunEconomyV2();else script?.addEventListener?.('load',loadRunEconomyV2,{once:true});
  }
  function loadRunMinigames(){
    if(root.RunMinigames){loadRunEvents();return;}
    const script=loadScript('run-minigames.js','trick-run-minigames-runtime');
    if(script?.dataset?.loaded==='true')loadRunEvents();else script?.addEventListener?.('load',loadRunEvents,{once:true});
  }
  function loadRunFlowV2(){
    if(root.RunFlowV2){loadRunMinigames();return;}
    const script=loadScript('run-flow-v2.js','trick-run-flow-v2-runtime');
    if(script?.dataset?.loaded==='true')loadRunMinigames();else script?.addEventListener?.('load',loadRunMinigames,{once:true});
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
print('Run V3 latest-main compatibility patch applied')
