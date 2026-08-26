from pathlib import Path
import re


def replace_once(path, old, new, label):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'{label}: target missing')
    p.write_text(s.replace(old,new,1),encoding='utf-8')


def sub_once(path, pattern, repl, label, flags=0):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    out,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    p.write_text(out,encoding='utf-8')

# Keep the common-region reward/shop catalog at the established 52 pure + 9
# opening effects. Advanced common effects may exist in a starter without
# leaking into that opening catalog.
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
replace_once(
    'test/run-start-v2.test.js',
    "    assert.ok(starter.effectCardIds.every(id=>commonPool.has(id)));",
    "    assert.ok(starter.effectCardIds.every(id=>Cards.CARD_DEFINITION_BY_ID[id]?.category==='general'&&Cards.CARD_DEFINITION_BY_ID[id]?.rarity==='common'));",
    'starter regression expectation',
)

# TrumpFields is the runtime field source of truth and replaces the legacy
# EncounterRules registry when loaded. Keep both registries identical so the
# data API, browser runtime and compendium all see the same eight fields.
encounter_registry="""  const FIELD_DEFINITIONS=Object.freeze({
    resonance_floor:Object.freeze({id:'resonance_floor',label:'과충전 구역',description:'트럼프 카드의 트릭 적용 숫자 보너스가 +3 대신 +5가 된다.',rulesOverride:Object.freeze({trumpBonus:5}),effects:Object.freeze([])}),
    thin_signal:Object.freeze({id:'thin_signal',label:'감쇠 지대',description:'트럼프 카드의 트릭 적용 숫자 보너스가 +3 대신 +1이 된다.',rulesOverride:Object.freeze({trumpBonus:1}),effects:Object.freeze([])}),
    outlaw_zone:Object.freeze({id:'outlaw_zone',label:'무법지대',description:'이번 전투에서 트럼프 무늬는 유지되지만 트릭 적용 숫자 보너스는 0이 된다.',rulesOverride:Object.freeze({trumpBonus:0}),effects:Object.freeze([])}),
    narrow_table:Object.freeze({id:'narrow_table',label:'좁은 테이블',description:'기본 최대 손패가 1 감소한다.',rulesOverride:Object.freeze({maxHandModifier:-1}),effects:Object.freeze([])}),
    inversion_zone:Object.freeze({id:'inversion_zone',label:'뒤집힌 세계',description:'모든 보정을 끝낸 최종 적용 숫자가 낮은 쪽이 트릭에서 승리한다.',rulesOverride:Object.freeze({lowFinalValueWins:true}),effects:Object.freeze([])}),
    loaded_table:Object.freeze({id:'loaded_table',label:'과열 테이블',description:'기본 최대 손패가 1 감소하지만 트럼프 카드의 트릭 적용 숫자 보너스가 +4가 된다.',rulesOverride:Object.freeze({trumpBonus:4,maxHandModifier:-1}),effects:Object.freeze([])}),
    wide_table:Object.freeze({id:'wide_table',label:'넓은 테이블',description:'기본 최대 손패가 1 증가하지만 트럼프 카드의 트릭 적용 숫자 보너스가 +2가 된다.',rulesOverride:Object.freeze({trumpBonus:2,maxHandModifier:1}),effects:Object.freeze([])}),
    royal_signal:Object.freeze({id:'royal_signal',label:'왕실 중계소',description:'트럼프 카드의 트릭 적용 숫자 보너스가 +3 대신 +6이 된다.',rulesOverride:Object.freeze({trumpBonus:6}),effects:Object.freeze([])})
  });
"""
sub_once(
    'encounter-rules.js',
    r"  const FIELD_DEFINITIONS=Object\.freeze\(\{.*?\n  \}\);\n(?=  const ENCOUNTER_PROFILES)",
    encounter_registry,
    'encounter field registry',
    re.S,
)
sub_once(
    'trump-fields.js',
    r"  const FIELD_DEFINITIONS=Object\.freeze\(\{.*?\n  \}\);\n(?=  let rulesInstalled)",
    encounter_registry,
    'runtime field registry',
    re.S,
)
replace_once(
    'run-fields.js',
    "const EVENT_FIELD_IDS=Object.freeze(['inversion_zone','thin_signal','wide_table','crooked_table']);",
    "const EVENT_FIELD_IDS=Object.freeze(['inversion_zone','thin_signal','wide_table','loaded_table']);",
    'event field pool',
)
replace_once(
    'test/build-identity-overhaul.test.js',
    "['뒤집힌 세계','감쇠 지대','넓은 테이블','삐뚤어진 테이블']",
    "['뒤집힌 세계','감쇠 지대','넓은 테이블','과열 테이블']",
    'field build test labels',
)
replace_once(
    'test/encounter-rules.test.js',
    "  assert.equal(EncounterRules.FIELD_DEFINITIONS.crooked_table.rulesOverride.lowFinalValueWins,true);",
    "  assert.equal(EncounterRules.FIELD_DEFINITIONS.loaded_table.rulesOverride.trumpBonus,4);",
    'field regression test',
)

# Old saves can still own an archived trait. Keep the normal catalog at eight
# modern traits, adding only the active archived trait when loading an old run.
replace_once(
    'compendium-8-h.js',
    """  function traitCatalog(runState=activeRun()){
    return (RunStartV2?.RUN_TRAITS||[]).map(def=>({kind:'trait',id:def.id,name:def.name,description:def.desc||'',meta:'시작 특성',owned:runState?.traitId===def.id,implemented:true}));
  }
""",
    """  function traitCatalog(runState=activeRun()){
    const modern=[...(RunStartV2?.RUN_TRAITS||[])],archived=(RunStartV2?.ARCHIVED_TRAITS||[]).filter(def=>runState?.traitId===def.id);
    return [...modern,...archived].map(def=>({kind:'trait',id:def.id,name:def.name,description:def.desc||'',meta:def.archived?'구버전 특성':'시작 특성',owned:runState?.traitId===def.id,implemented:true}));
  }
""",
    'legacy compendium traits',
)

print('build identity postpatch complete')
