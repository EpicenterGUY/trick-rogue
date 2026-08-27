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
  function loadGameUi(){
    if(root.GameUI)return;
    loadScript('game-ui.js','trick-game-ui-runtime');
  }
  function loadRunBalanceTelemetry(){
    if(root.RunBalanceTelemetry){loadGameUi();return;}
    const script=loadScript('run-balance-telemetry.js','trick-run-balance-telemetry-runtime');
    if(script?.dataset?.loaded==='true')loadGameUi();else script?.addEventListener?.('load',loadGameUi,{once:true});
  }
  function loadBattleLayoutFinal(){
    if(root.BattleLayout){loadRunBalanceTelemetry();return;}
    const script=loadScript('battle-layout.js','trick-battle-layout-runtime');
    if(script?.dataset?.loaded==='true')loadRunBalanceTelemetry();else script?.addEventListener?.('load',loadRunBalanceTelemetry,{once:true});
  }
  function finishRunPersistence(){
    root.RelicSystem?.wrapShowReward?.(root);
    loadBattleLayoutFinal();
  }
  function loadRunPersistence(){
    if(root.RunPersistence){finishRunPersistence();return;}
    const script=loadScript('run-persistence.js','trick-run-persistence-runtime');
    if(script?.dataset?.loaded==='true')finishRunPersistence();else script?.addEventListener?.('load',finishRunPersistence,{once:true});
  }
  function finishFoldExperiment(){
    loadRunPersistence();
  }
  function loadFoldExperiment(){
    if(root.FoldExperiment){finishFoldExperiment();return;}
    const script=loadScript('fold-experiment.js','trick-fold-experiment-runtime');
    if(script?.dataset?.loaded==='true')finishFoldExperiment();else script?.addEventListener?.('load',finishFoldExperiment,{once:true});
  }
  function finishShowdownSlotManipulation(){
    loadFoldExperiment();
  }
  function loadShowdownSlotManipulation(){
    if(root.ShowdownSlotManipulation){finishShowdownSlotManipulation();return;}
    const script=loadScript('showdown-slot-manipulation.js','trick-showdown-slot-manipulation-runtime');
    if(script?.dataset?.loaded==='true')finishShowdownSlotManipulation();else script?.addEventListener?.('load',finishShowdownSlotManipulation,{once:true});
  }
  function finishBattleRewardMarket(){
    loadShowdownSlotManipulation();
  }
  function loadBattleRewardMarket(){
    if(root.BattleRewardMarket){finishBattleRewardMarket();return;}
    const script=loadScript('battle-reward-market.js','trick-battle-reward-market-runtime');
    if(script?.dataset?.loaded==='true')finishBattleRewardMarket();else script?.addEventListener?.('load',finishBattleRewardMarket,{once:true});
  }
  function finishRunEconomyV2(){
    loadBattleRewardMarket();
  }
  function loadRunEconomyV2(){
    if(root.RunEconomyV2){finishRunEconomyV2();return;}
    const script=loadScript('run-economy-v2.js','trick-run-economy-v2-runtime');
    if(script?.dataset?.loaded==='true')finishRunEconomyV2();else script?.addEventListener?.('load',finishRunEconomyV2,{once:true});
  }
  function loadRedWardRegionM9(){
    if(root.RedWardRegionM9){loadRunEconomyV2();return;}
    const script=loadScript('red-ward-region-m9.js','trick-red-ward-region-m9-runtime');
    if(script?.dataset?.loaded==='true')loadRunEconomyV2();else script?.addEventListener?.('load',loadRunEconomyV2,{once:true});
  }
  function loadCasinoRegionM9(){
    if(root.CasinoRegionM9){loadRedWardRegionM9();return;}
    const script=loadScript('casino-region-m9.js','trick-casino-region-m9-runtime');
    if(script?.dataset?.loaded==='true')loadRedWardRegionM9();else script?.addEventListener?.('load',loadRedWardRegionM9,{once:true});
  }
  function loadContentExpansion9C(){
    if(root.ContentExpansion9C){loadCasinoRegionM9();return;}
    const script=loadScript('content-expansion-9-c.js','trick-content-expansion-9-c-runtime');
    if(script?.dataset?.loaded==='true')loadCasinoRegionM9();else script?.addEventListener?.('load',loadCasinoRegionM9,{once:true});
  }
  function loadRunEvents(){
    if(root.RunEvents){loadContentExpansion9C();return;}
    const script=loadScript('run-events.js','trick-run-events-runtime');
    if(script?.dataset?.loaded==='true')loadContentExpansion9C();else script?.addEventListener?.('load',loadContentExpansion9C,{once:true});
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
  function loadRunStartV2(){
    if(root.RunStartV2){loadRunFlowV2();return;}
    const script=loadScript('run-start-v2.js','trick-run-start-v2-runtime');
    if(script?.dataset?.loaded==='true')loadRunFlowV2();else script?.addEventListener?.('load',loadRunFlowV2,{once:true});
  }
  function loadTrickOutcomePreview(){
    if(root.TrickOutcomePreview){loadRunStartV2();return;}
    const script=loadScript('trick-outcome-preview.js','trick-outcome-preview-runtime');
    if(script?.dataset?.loaded==='true')loadRunStartV2();else script?.addEventListener?.('load',loadRunStartV2,{once:true});
  }
  function loadEnemyInformation(){
    if(root.EnemyInformation){loadTrickOutcomePreview();return;}
    const script=loadScript('enemy-information.js','trick-enemy-information-runtime');
    if(script?.dataset?.loaded==='true')loadTrickOutcomePreview();else script?.addEventListener?.('load',loadTrickOutcomePreview,{once:true});
  }
  function loadDeckBoundaries(){
    if(root.DeckBoundaries){loadEnemyInformation();return;}
    const script=loadScript('deck-boundaries.js','trick-deck-boundaries-runtime');
    if(script?.dataset?.loaded==='true')loadEnemyInformation();else script?.addEventListener?.('load',loadEnemyInformation,{once:true});
  }
  function loadEncounterTempo(){
    if(root.EncounterTempo){loadDeckBoundaries();return;}
    const script=loadScript('encounter-tempo.js','trick-encounter-tempo-runtime');
    if(script?.dataset?.loaded==='true')loadDeckBoundaries();else script?.addEventListener?.('load',loadDeckBoundaries,{once:true});
  }
  function loadShowdownHighRoll(){
    if(root.ShowdownHighRoll){loadEncounterTempo();return;}
    const script=loadScript('showdown-highroll.js','trick-showdown-highroll-runtime');
    if(script?.dataset?.loaded==='true')loadEncounterTempo();else script?.addEventListener?.('load',loadEncounterTempo,{once:true});
  }
  function loadBattleLayoutFile(){
    if(root.ShowdownResolution){loadShowdownHighRoll();return;}
    const script=loadScript('showdown-resolution.js','trick-showdown-resolution-runtime');
    if(script?.dataset?.loaded==='true')loadShowdownHighRoll();else script?.addEventListener?.('load',loadShowdownHighRoll,{once:true});
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
  function loadRunFieldUx(){
    if(root.RunFieldUX){loadRelics();return;}
    const script=loadScript('run-field-ux.js','trick-run-field-ux-runtime');
    if(script?.dataset?.loaded==='true')loadRelics();else script?.addEventListener?.('load',loadRelics,{once:true});
  }
  function loadRunFieldsRuntime(){
    if(root.RunFields){loadRunFieldUx();return;}
    const script=loadScript('run-fields.js','trick-run-fields-runtime');
    if(script?.dataset?.loaded==='true')loadRunFieldUx();else script?.addEventListener?.('load',loadRunFieldUx,{once:true});
  }
  function loadRunFields(){
    if(root.TrumpFields){loadRunFieldsRuntime();return;}
    const script=loadScript('trump-fields.js','trick-trump-fields-runtime');
    if(script?.dataset?.loaded==='true')loadRunFieldsRuntime();else script?.addEventListener?.('load',loadRunFieldsRuntime,{once:true});
  }
  function loadEncounterRules(){
    if(root.EncounterRules){loadRunFields();return;}
    loadScript('encounter-rules.js','trick-encounter-rules-runtime',loadRunFields);
  }
  if(root.EnemyBehavior)loadEncounterRules();
  else loadScript('enemy-behavior-core.js','trick-enemy-behavior-core',loadEncounterRules);
})(typeof globalThis!=='undefined'?globalThis:this);