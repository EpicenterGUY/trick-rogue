#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { CARD_DEFINITIONS, CARD_DEFINITION_BY_ID, CARD_PACKS } = require('../cards.js');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const termsSource = html.match(/const TERMS=(\{[\s\S]*?\n\});\nconst SYSTEM_NOTES=/);
if (!termsSource) throw new Error('index.html에서 TERMS 레지스트리를 읽을 수 없습니다.');
const TERMS = Function(`"use strict"; return (${termsSource[1]})`)();
const errors = [];
const ids = CARD_DEFINITIONS.map(card => card.id);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) errors.push(`중복 카드 ID: ${duplicateIds.join(', ')}`);

for (const pack of Object.values(CARD_PACKS)) {
  if (pack.cardIds.length !== 10) errors.push(`${pack.id}: ${pack.cardIds.length}장 (정확히 10장이어야 함)`);
  for (const id of pack.cardIds) {
    const card = CARD_DEFINITION_BY_ID[id];
    if (!card) { errors.push(`${pack.id}: 존재하지 않는 카드 ID ${id}`); continue; }
    if (card.packId !== pack.id) errors.push(`${id}: packId가 ${pack.id}가 아님`);
    if (!card.image || !fs.existsSync(path.join(root, card.image))) errors.push(`${id}: 이미지 경로가 없거나 파일이 없음 (${card.image})`);
    for (const term of card.terms) if (!Object.hasOwn(TERMS, term)) errors.push(`${id}: 미등록 용어 ${term}`);
  }
}
if (errors.length) { console.error(errors.map(error => `✗ ${error}`).join('\n')); process.exit(1); }
console.log(`✓ ${Object.keys(CARD_PACKS).length}개 팩 / ${ids.length}개 카드 검증 완료`);
