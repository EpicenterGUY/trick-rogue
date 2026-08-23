(function(root,factory){
  const BuildSynergySystem=typeof module!=='undefined'?require('./build-synergies.js'):root.BuildSynergySystem;
  const ChipBuilds9E=typeof module!=='undefined'?require('./chip-builds-9-e.js'):root.ChipBuilds9E;
  const api=factory(BuildSynergySystem,ChipBuilds9E,root);
  if(typeof module!=='undefined')module.exports=api;
  root.ChipBuilds9ECompendiumBridge=api;
  api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(BuildSynergySystem,ChipBuilds9E,root){
  const STAGE='9-E';
  function chipDefinition(definition){return definition&&ChipBuilds9E?.CHIP_BUILD_DEFINITIONS?.[definition.id]||null}
  function install(runtimeRoot=root){
    const system=BuildSynergySystem||runtimeRoot?.BuildSynergySystem;
    if(!system||!ChipBuilds9E?.CHIP_BUILD_DEFINITIONS)return false;
    if(system.__chipBuild9ECompendiumBridge)return true;
    const originalDefinitions=system.SYNERGY_DEFINITIONS||{};
    const originalIsActive=system.isSynergyActive;
    const originalDefinition=system.synergyDefinition;
    system.SYNERGY_DEFINITIONS=Object.freeze({...originalDefinitions,...ChipBuilds9E.CHIP_BUILD_DEFINITIONS});
    system.isSynergyActive=function(definition,runState){
      const chip=chipDefinition(definition);
      if(chip)return ChipBuilds9E.isBuildActive(chip,runState);
      return typeof originalIsActive==='function'?originalIsActive.call(this,definition,runState):false;
    };
    system.synergyDefinition=function(id){return ChipBuilds9E.CHIP_BUILD_DEFINITIONS[id]||(typeof originalDefinition==='function'?originalDefinition.call(this,id):null)};
    system.__chipBuild9ECompendiumBridge={stage:STAGE,originalDefinitions,originalIsActive,originalDefinition};
    return true;
  }
  return{STAGE,chipDefinition,install};
});
