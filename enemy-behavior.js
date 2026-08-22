(function(root){
  if(typeof module!=='undefined'){
    module.exports=require('./enemy-behavior-core.js');
    return;
  }
  if(typeof document==='undefined')return;
  function loadScript(src,datasetKey,onload){
    const selector=`script[data-${datasetKey}]`;
    const existing=document.querySelector(selector);
    if(existing){
      if(typeof onload==='function'){
        if(existing.dataset.loaded==='true')onload();else existing.addEventListener('load',onload,{once:true});
      }
      return existing;
    }
    const script=document.createElement('script');
    script.src=src;script.async=false;script.setAttribute(`data-${datasetKey}`,'true');
    script.addEventListener('load',()=>{script.dataset.loaded='true';if(typeof onload==='function')onload()},{once:true});
    document.head.appendChild(script);return script;
  }
  function loadBattleLayoutFile(){
    if(root.BattleLayout)return;
    loadScript('battle-layout.js','trick-battle-layout-runtime');
  }
  function loadBattleLayoutRuntime(){
    if(root.ChipEconomy){loadBattleLayoutFile();return;}
    const script=loadScript('chip-economy.js','trick-chip-economy-runtime');
    if(script?.dataset?.loaded==='true')loadBattleLayoutFile();else script?.addEventListener?.('load',loadBattleLayoutFile,{once:true});
  }
  function loadBattleLayout(){
    if(root.ShowdownAdvantage){loadBattleLayoutRuntime();return;}
    const script=loadScript('showdown-advantage.js','trick-showdown-advantage-runtime');
    if(script?.dataset?.loaded==='true')loadBattleLayoutRuntime();else script?.addEventListener?.('load',loadBattleLayoutRuntime,{once:true});
  }
  function loadRunResults(){
    if(root.RunResults){loadBattleLayout();return;}
    const script=loadScript('run-results.js','trick-run-results-runtime');
    if(script?.dataset?.loaded==='true')loadBattleLayout();else script?.addEventListener?.('load',loadBattleLayout,{once:true});
  }
  function loadRunMapGeneration(){
    if(root.RunMapGeneration){loadRunResults();return;}
    const script=loadScript('run-map-generation.js','trick-run-map-generation-runtime');
    if(script?.dataset?.loaded==='true')loadRunResults();else script?.addEventListener?.('load',loadRunResults,{once:true});
  }
  function loadRunPaths(){
    if(root.RunPaths){loadRunMapGeneration();return;}
    const script=loadScript('run-paths.js','trick-run-paths-runtime');
    if(script?.dataset?.loaded==='true')loadRunMapGeneration();else script?.addEventListener?.('load',loadRunMapGeneration,{once:true});
  }
  function loadRunStructure(){
    if(root.RunStructure){loadRunPaths();return;}
    const script=loadScript('run-structure.js','trick-run-structure-runtime');
    if(script?.dataset?.loaded==='true')loadRunPaths();else script?.addEventListener?.('load',loadRunPaths,{once:true});
  }
  function loadBuildSynergies(){
    if(root.BuildSynergySystem){loadRunStructure();return;}
    const script=loadScript('build-synergies.js','trick-build-synergy-runtime');
    if(script?.dataset?.loaded==='true')loadRunStructure();else script?.addEventListener?.('load',loadRunStructure,{once:true});
  }
  function loadContracts(){
    if(root.ContractSystem){loadBuildSynergies();return;}
    const script=loadScript('contracts.js','trick-contract-system-runtime');
    if(script?.dataset?.loaded==='true')loadBuildSynergies();else script?.addEventListener?.('load',loadBuildSynergies,{once:true});
  }
  function loadStatusSystem(){
    if(root.StatusSystem){loadContracts();return;}
    const script=loadScript('status-system.js','trick-status-system-runtime');
    if(script?.dataset?.loaded==='true')loadContracts();else script?.addEventListener?.('load',loadContracts,{once:true});
  }
  function loadRelics(){
    if(root.RelicSystem){loadStatusSystem();return;}
    const script=loadScript('relics.js','trick-relic-system-runtime');
    if(script?.dataset?.loaded==='true')loadStatusSystem();else script?.addEventListener?.('load',loadStatusSystem,{once:true});
  }
  function loadRunFields(){
    if(root.RunFields){loadRelics();return;}
    const script=loadScript('run-fields.js','trick-run-fields-runtime');
    if(script?.dataset?.loaded==='true')loadRelics();else script?.addEventListener?.('load',loadRelics,{once:true});
  }
  function loadEncounterRules(){
    if(root.EncounterRules){loadRunFields();return;}
    loadScript('encounter-rules.js','trick-encounter-rules-runtime',loadRunFields);
  }
  if(root.EnemyBehavior)loadEncounterRules();
  else loadScript('enemy-behavior-core.js','trick-enemy-behavior-core',loadEncounterRules);
})(typeof globalThis!=='undefined'?globalThis:this);