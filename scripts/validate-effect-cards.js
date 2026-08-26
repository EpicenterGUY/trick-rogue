#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const {
  CARD_DEFINITIONS,
  CARD_DEFINITION_BY_ID,
  CARD_DETAIL_BY_ID,
  PLAYER_EFFECT_LABELS,
  CARD_PACK_LIST,
  CARD_PACKS,
  defaultEnabledPacks,
  validateEnabledPacks
}=require('../cards.js');
const {TRIGGERS,ACTIONS,conditions,handlers}=require('../effects.js');
const {EFFECT_DURATIONS}=require('../battle-core.js');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const termsSource=html.match(/const TERMS=(\{[\s\S]*?\n\});\nconst SYSTEM_NOTES=/);
if(!termsSource)throw new Error('index.html에서 TERMS 레지스트리를 읽을 수 없습니다.');
const TERMS=Function(`"use strict"; return (${termsSource[1]})`)();
const errors=[];
const duplicates=values=>[...new Set(values.filter((value,index)=>values.indexOf(value)!==index))];

// 프로토타입에서는 효과 카드를 팩/지역으로 분리하지 않는다.
if(CARD_DEFINITIONS.length!==50)errors.push(`현재 공용 효과 카드 카탈로그는 50장이어야 함 (${CARD_DEFINITIONS.length}장)`);
if(CARD_PACK_LIST.length!==1||CARD_PACK_LIST[0]?.id!=='all-effects')errors.push('레거시 호환 컬렉션은 all-effects 하나만 존재해야 함');
if(Object.keys(CARD_PACKS).length!==1||!CARD_PACKS['all-effects'])errors.push('CARD_PACKS 호환 어댑터는 all-effects 하나만 노출해야 함');
try{
  const normalized=validateEnabledPacks(defaultEnabledPacks());
  if(normalized.length!==1||normalized[0]!=='all-effects')errors.push('기본 카드 선택 상태는 all-effects로 정규화되어야 함');
}catch(error){errors.push(`기본 효과 카드 선택 상태가 유효하지 않음: ${error.message}`)}

for(const group of ['triggers','conditions','actions','durations']){
  for(const [key,label] of Object.entries(PLAYER_EFFECT_LABELS[group]||{})){
    if(!label||label===key)errors.push(`플레이어 표시 매핑 누락: ${group}.${key}`);
  }
}

const duplicateCardIds=duplicates(CARD_DEFINITIONS.map(card=>card.id));
if(duplicateCardIds.length)errors.push(`중복 카드 ID: ${duplicateCardIds.join(', ')}`);

for(const card of CARD_DEFINITIONS){
  if(CARD_DEFINITION_BY_ID[card.id]!==card)errors.push(`${card.id}: 중앙 카드 정의와 카탈로그 정의가 동일 객체가 아님`);
  if(typeof card.id!=='string'||!card.id)errors.push('효과 카드 ID 누락');
  if(!['S','H','D','C'].includes(card.suit))errors.push(`${card.id}: 유효하지 않은 무늬 ${card.suit}`);
  if(!Number.isInteger(card.rank)||card.rank<2||card.rank>14)errors.push(`${card.id}: 유효하지 않은 숫자 ${card.rank}`);
  if(!card.image||!fs.existsSync(path.join(root,card.image)))errors.push(`${card.id}: 이미지 경로가 없거나 파일이 없음 (${card.image})`);
  for(const term of card.terms||[])if(!Object.hasOwn(TERMS,term))errors.push(`${card.id}: 미등록 용어 ${term}`);

  const detail=CARD_DETAIL_BY_ID[card.id];
  for(const term of detail?.terms||[])if(!Object.hasOwn(TERMS,term))errors.push(`${card.id}: 상세 정보의 미등록 용어 ${term}`);

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

for(const id of Object.keys(CARD_DETAIL_BY_ID)){
  if(!CARD_DEFINITION_BY_ID[id])errors.push(`${id}: 존재하지 않는 카드의 상세 정보가 남아 있음`);
}

if(errors.length){
  console.error(errors.map(error=>`✗ ${error}`).join('\n'));
  process.exit(1);
}
console.log(`✓ 공용 효과 카드 ${CARD_DEFINITIONS.length}장 검증 완료`);
