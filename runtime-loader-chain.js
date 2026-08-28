(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.RuntimeLoaderChain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='M9-LOADER-1';
  const ENTRIES=Object.freeze([
    ['EnemyBehavior','enemy-behavior-core.js','trick-enemy-behavior-core'],
    ['EncounterRules','encounter-rules.js','trick-encounter-rules-runtime'],
    ['TrumpFields','trump-fields.js','trick-trump-fields-runtime'],
    ['RunFields','run-fields.js','trick-run-fields-runtime'],
    ['RunFieldUX','run-field-ux.js','trick-run-field-ux-runtime'],
    ['RelicSystem','relics.js','trick-relic-system-runtime'],
    ['StatusSystem','status-system.js','trick-status-system-runtime'],
    ['ContractSystem','contracts.js','trick-contract-system-runtime'],
    ['BuildSynergySystem','build-synergies.js','trick-build-synergy-runtime'],
    ['RunStructure','run-structure.js','trick-run-structure-runtime'],
    ['RunPaths','run-paths.js','trick-run-paths-runtime'],
    ['RunMapGeneration','run-map-generation.js','trick-run-map-generation-runtime'],
    ['RunResults','run-results.js','trick-run-results-runtime'],
    ['ShowdownAdvantage','showdown-advantage.js','trick-showdown-advantage-runtime'],
    ['ChipEconomy','chip-economy.js','trick-chip-economy-runtime'],
    ['ShowdownResolution','showdown-resolution.js','trick-showdown-resolution-runtime'],
    ['ShowdownHighRoll','showdown-highroll.js','trick-showdown-highroll-runtime'],
    ['EncounterTempo','encounter-tempo.js','trick-encounter-tempo-runtime'],
    ['DeckBoundaries','deck-boundaries.js','trick-deck-boundaries-runtime'],
    ['EnemyInformation','enemy-information.js','trick-enemy-information-runtime'],
    ['TrickOutcomePreview','trick-outcome-preview.js','trick-outcome-preview-runtime'],
    ['RunStartV2','run-start-v2.js','trick-run-start-v2-runtime'],
    ['RunFlowV2','run-flow-v2.js','trick-run-flow-v2-runtime'],
    ['RunMinigames','run-minigames.js','trick-run-minigames-runtime'],
    ['RunEvents','run-events.js','trick-run-events-runtime'],
    ['ContentExpansion9C','content-expansion-9-c.js','trick-content-expansion-9-c-runtime'],
    ['CasinoRegionM9','casino-region-m9.js','trick-casino-region-m9-runtime'],
    ['RedWardRegionM9','red-ward-region-m9.js','trick-red-ward-region-m9-runtime'],
    ['ScrapMarketRegionM9','scrap-market-region-m9.js','trick-scrap-market-region-m9-runtime'],
    ['RunEconomyV2','run-economy-v2.js','trick-run-economy-v2-runtime'],
    ['BattleRewardMarket','battle-reward-market.js','trick-battle-reward-market-runtime'],
    ['ShowdownSlotManipulation','showdown-slot-manipulation.js','trick-showdown-slot-manipulation-runtime'],
    ['FoldExperiment','fold-experiment.js','trick-fold-experiment-runtime'],
    ['RunPersistence','run-persistence.js','trick-run-persistence-runtime','relic_reward_wrap'],
    ['BattleLayout','battle-layout.js','trick-battle-layout-runtime'],
    ['RunBalanceTelemetry','run-balance-telemetry.js','trick-run-balance-telemetry-runtime'],
    ['LegacyRegionsM9','legacy-regions-m9.js','trick-legacy-regions-m9-runtime'],
    ['GameUI','game-ui.js','trick-game-ui-runtime']
  ].map(([globalName,src,dataset,after])=>Object.freeze({globalName,src,dataset,after:after||null})));

  function validate(entries=ENTRIES){
    const errors=[],globals=new Set(),sources=new Set(),datasets=new Set();
    for(const entry of entries||[]){
      if(!entry?.globalName||!entry?.src||!entry?.dataset){errors.push('missing loader entry field');continue}
      if(globals.has(entry.globalName))errors.push(`duplicate global: ${entry.globalName}`);globals.add(entry.globalName);
      if(sources.has(entry.src))errors.push(`duplicate src: ${entry.src}`);sources.add(entry.src);
      if(datasets.has(entry.dataset))errors.push(`duplicate dataset: ${entry.dataset}`);datasets.add(entry.dataset);
    }
    if(entries?.[0]?.globalName!=='EnemyBehavior')errors.push('EnemyBehavior must load first');
    if(entries?.[entries.length-1]?.globalName!=='GameUI')errors.push('GameUI must load last');
    return errors;
  }

  function indexOf(globalName,entries=ENTRIES){return entries.findIndex(entry=>entry.globalName===globalName)}
  function entry(globalName,entries=ENTRIES){return entries.find(item=>item.globalName===globalName)||null}

  return{VERSION,ENTRIES,validate,indexOf,entry};
});
