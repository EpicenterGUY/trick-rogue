#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { CARD_PACK_LIST, CARD_DEFINITIONS, CARD_DEFINITION_BY_ID, CARD_PACKS, defaultEnabledPacks } = require('../cards.js');
const { TRIGGERS, ACTIONS, conditions, handlers } = require('../effects.js');
const { EFFECT_DURATIONS } = require('../battle-core.js');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const termsSource = html.match(/const TERMS=(\{[\s\S]*?\n\});\nconst SYSTEM_NOTES=/);
if (!termsSource) throw new Error('index.html에서 TERMS 레지스트리를 읽을 수 없습니다.');
const TERMS = Function(`"use strict"; return (${termsSource[1]})`)();
const errors = [];
if(CARD_DEFINITIONS.length!==10)errors.push(`활성 네임드 카드가 ${CARD_DEFINITIONS.length}장 (정확히 10장이어야 함)`);
if(!CARD_PACKS.pack01||CARD_PACKS.pack01.cards.length!==10)errors.push('pack01은 정확히 10장이어야 함');
if(Object.keys(CARD_PACKS).some(id=>id!=='pack01'))errors.push('pack01 외 활성 네임드 팩이 존재함');
const duplicates = values => [...new Set(values.filter((value,index) => values.indexOf(value)!==index))];
const duplicatePackIds=duplicates(CARD_PACK_LIST.map(pack=>pack.id));
if(duplicatePackIds.length)errors.push(`중복 팩 ID: ${duplicatePackIds.join(', ')}`);
const duplicateCardIds=duplicates(CARD_DEFINITIONS.map(card=>card.id));
if(duplicateCardIds.length)errors.push(`중복 카드 ID: ${duplicateCardIds.join(', ')}`);
for(const id of defaultEnabledPacks())if(!CARD_PACKS[id])errors.push(`기본 enabled pack 참조가 유효하지 않음: ${id}`);
for (const pack of CARD_PACK_LIST) {
  for(const key of ['id','name','version','enabledByDefault','rewardWeight','cards'])if(pack[key]===undefined)errors.push(`${pack.id||'(ID 없음)'}: 메타데이터 ${key} 누락`);
  if (pack.cards.length !== 10) errors.push(`${pack.id}: ${pack.cards.length}장 (확장 팩은 정확히 10장이어야 함)`);
  for (const card of pack.cards) {
    if (CARD_DEFINITION_BY_ID[card.id] !== card) errors.push(`${card.id}: 중앙 카드 정의와 팩 정의가 동일 객체가 아님`);
    if (card.packId !== pack.id) errors.push(`${card.id}: packId가 ${pack.id}가 아님`);
    if (!card.image || !fs.existsSync(path.join(root,card.image))) errors.push(`${card.id}: 이미지 경로가 없거나 파일이 없음 (${card.image})`);
    for (const term of card.terms || []) if (!Object.hasOwn(TERMS,term)) errors.push(`${card.id}: 미등록 용어 ${term}`);
  }
}
for (const card of CARD_DEFINITIONS) {
  if(typeof card.implemented!=='boolean')errors.push(`${card.id}: implemented 누락`);
  if(!Array.isArray(card.effects))errors.push(`${card.id}: effects 누락`);
  if(card.implemented&&!card.effects.length)errors.push(`${card.id}: 구현 카드에 효과 없음`);
  for(const effect of card.effects||[]){
    if(!TRIGGERS.includes(effect.trigger))errors.push(`${card.id}: 유효하지 않은 trigger ${effect.trigger}`);
    if(effect.action&&!ACTIONS.includes(effect.action))errors.push(`${card.id}: 유효하지 않은 action ${effect.action}`);
    if(effect.condition&&typeof conditions[effect.condition]!=='function')errors.push(`${card.id}: condition 없음 ${effect.condition}`);
    if(!effect.action&&!effect.handler)errors.push(`${card.id}: action 또는 handler 누락`);
    if(effect.handler&&typeof handlers[effect.handler]!=='function')errors.push(`${card.id}: handler 없음 ${effect.handler}`);
    if(!EFFECT_DURATIONS.includes(effect.duration))errors.push(`${card.id}: 유효하지 않은 지속 범위 ${effect.duration}`);
  }
}
if(errors.length){console.error(errors.map(error=>`✗ ${error}`).join('\n'));process.exit(1)}
console.log(`✓ ${CARD_PACK_LIST.length}개 카드군 / ${CARD_DEFINITIONS.length}개 카드 검증 완료`);
