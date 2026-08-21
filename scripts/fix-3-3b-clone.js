const fs=require('node:fs');
const path='index.html';
let text=fs.readFileSync(path,'utf8');
const before="function cloneDeckCard(card){return {...card,uid:newUid(),effects:Array.isArray(card.effects)?card.effects.map(effect=>({...effect})):[]}}";
const after="function cloneDeckCard(card){const next={...card,uid:newUid()};if(Array.isArray(card.effects))next.effects=card.effects.map(effect=>({...effect}));else delete next.effects;return next}";
if(!text.includes(before))throw new Error('cloneDeckCard source changed');
text=text.replace(before,after);
fs.writeFileSync(path,text);
console.log('cloneDeckCard no longer masks named fallback effects');
