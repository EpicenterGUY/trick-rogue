from pathlib import Path


def replace_once(path, old, new, label):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'{label}: target missing')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

# The common-region reward pool is deliberately still the original 9 cards.
# Starters may contain advanced common cards, but that must not leak them into
# the 52+9 opening reward/shop catalog.
replace_once(
    'run-start-v2.js',
    "    'core.burn','core.pureboost','core.clean','core.reverse','core.recolor'\n",
    "    'core.burn','core.pureboost','core.clean'\n",
    'opening common pool',
)

replace_once(
    'run-start-v2.js',
    """    const commonPool=new Set(commonCardPoolIds(cardsApi));
    for(const id of starter?.effectCardIds||[]){
      if(!cardsApi?.CARD_DEFINITION_BY_ID?.[id])errors.push(`${starter.id}: unknown card ${id}`);
      else if(!commonPool.has(id))errors.push(`${starter.id}: ${id} is not in the common opening pool`);
    }
""",
    """    for(const id of starter?.effectCardIds||[]){
      const definition=cardsApi?.CARD_DEFINITION_BY_ID?.[id];
      if(!definition)errors.push(`${starter.id}: unknown card ${id}`);
      else if(definition.category!=='general'||definition.rarity!=='common')errors.push(`${starter.id}: ${id} is not a common general effect card`);
    }
""",
    'starter effect validation',
)

# Old saves can still own archived traits; keep those visible to the legacy
# compendium data API even though they are not offered on new runs.
replace_once(
    'compendium-8-h.js',
    """  function traitCatalog(runState=activeRun()){
    return (RunStartV2?.RUN_TRAITS||[]).map(def=>({kind:'trait',id:def.id,name:def.name,description:def.desc||'',meta:'시작 특성',owned:runState?.traitId===def.id,implemented:true}));
  }
""",
    """  function traitCatalog(runState=activeRun()){
    return [...(RunStartV2?.RUN_TRAITS||[]),...(RunStartV2?.ARCHIVED_TRAITS||[])].map(def=>({kind:'trait',id:def.id,name:def.name,description:def.desc||'',meta:def.archived?'구버전 특성':'시작 특성',owned:runState?.traitId===def.id,implemented:true}));
  }
""",
    'legacy compendium traits',
)

print('build identity postpatch complete')
