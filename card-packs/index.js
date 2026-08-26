(function(root){
  if(typeof module!=='undefined'||typeof document==='undefined'||root.PACK03_CARDS||document.querySelector('script[data-trick-pack03-bootstrap]'))return;
  if(document.readyState!=='loading')return;
  document.write('<script src="card-packs/pack03.js" data-trick-pack03-bootstrap="true"><\/script>');
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  if(typeof module!=='undefined'||typeof document==='undefined'||root.BOSS_SIGNATURE_CARDS||document.querySelector('script[data-trick-boss-signature-bootstrap]'))return;
  if(document.readyState!=='loading')return;
  document.write('<script src="card-packs/boss-signatures.js" data-trick-boss-signature-bootstrap="true"><\/script>');
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  if(typeof module!=='undefined'||typeof document==='undefined'||root.PACK04_CARDS||document.querySelector('script[data-trick-pack04-bootstrap]'))return;
  if(document.readyState!=='loading')return;
  document.write('<script src="card-packs/pack04.js" data-trick-pack04-bootstrap="true"><\/script>');
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./pack01.js'):root.PACK01_CARDS,
    typeof module!=='undefined'?require('./pack02.js'):root.PACK02_CARDS,
    typeof module!=='undefined'?require('./pack03.js'):root.PACK03_CARDS,
    typeof module!=='undefined'?require('./boss-signatures.js'):root.BOSS_SIGNATURE_CARDS,
    typeof module!=='undefined'?require('./pack04.js'):root.PACK04_CARDS
  );
  if(typeof module!=='undefined')module.exports=api;
  Object.assign(root,api);
  if(typeof module!=='undefined')require('../card-personality-runtime.js');
})(typeof globalThis!=='undefined'?globalThis:this,function(PACK01_CARDS,PACK02_CARDS,PACK03_CARDS,BOSS_SIGNATURE_CARDS,PACK04_CARDS){
  const EFFECT_CARD_DEFINITIONS=Object.freeze([...(PACK01_CARDS||[]),...(PACK02_CARDS||[]),...(PACK03_CARDS||[]),...(BOSS_SIGNATURE_CARDS||[]),...(PACK04_CARDS||[])]);
  const EFFECT_CARD_IDS=Object.freeze(EFFECT_CARD_DEFINITIONS.map(card=>card.id));

  // 프로토타입 규칙: 효과 카드는 팩/지역으로 활성화하거나 제한하지 않는다.
  // 아래 CARD_PACK_* 이름은 기존 cards.js와 저장 데이터 호환을 위한 임시 어댑터일 뿐,
  // 게임 규칙상의 팩을 의미하지 않는다. 보스 시그니처 카드는 카탈로그에는 포함되지만
  // 실제 보상 후보에서는 해당 보스를 처치한 뒤에만 해금된다.
  const LEGACY_COLLECTION_ID='all-effects';
  const legacyCollection=Object.freeze({
    id:LEGACY_COLLECTION_ID,
    name:'전체 효과 카드',
    version:'prototype',
    enabledByDefault:true,
    rewardWeight:1,
    cards:EFFECT_CARD_DEFINITIONS,
    cardIds:EFFECT_CARD_IDS
  });
  const CARD_PACK_LIST=Object.freeze([legacyCollection]);
  const CARD_PACKS=Object.freeze({[LEGACY_COLLECTION_ID]:legacyCollection});

  function validateEnabledPacks(enabledPacks){
    if(!Array.isArray(enabledPacks))throw new TypeError('enabledPacks must be an array');
    const accepted=new Set([LEGACY_COLLECTION_ID,'pack01','pack02','pack03','pack04']);
    const unknown=enabledPacks.filter(id=>!accepted.has(id));
    if(unknown.length)throw new RangeError(`Unknown legacy card collection reference: ${unknown.join(', ')}`);
    return [LEGACY_COLLECTION_ID];
  }
  function defaultEnabledPacks(){return [LEGACY_COLLECTION_ID]}
  function createRunPackState(enabledPacks=defaultEnabledPacks()){validateEnabledPacks(enabledPacks);return{enabledPacks:[LEGACY_COLLECTION_ID]}}

  return{EFFECT_CARD_DEFINITIONS,EFFECT_CARD_IDS,CARD_PACK_LIST,CARD_PACKS,defaultEnabledPacks,validateEnabledPacks,createRunPackState};
});

(function(root){
  if(typeof module!=='undefined'){
    const links=require('../card-system-links.js');
    links.applyDefinitionPatches(root.EFFECT_CARD_DEFINITIONS||[]);
    root.CardSystemLinks=links;
    return;
  }
  if(typeof document==='undefined'||root.CardSystemLinks||document.querySelector('script[data-trick-card-system-links]'))return;
  if(document.readyState==='loading'){
    document.write('<script src="card-system-links.js" data-trick-card-system-links="true"><\/script>');
    return;
  }
  const script=document.createElement('script');script.src='card-system-links.js';script.async=false;script.dataset.trickCardSystemLinks='true';document.head.appendChild(script);
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  if(typeof document==='undefined'||root.MigratedTacticCards||document.querySelector('script[data-trick-common-card-bootstrap]'))return;
  if(document.readyState!=='loading')return;
  document.write('<script src="tactic-card-migration.js" data-trick-common-card-bootstrap="migration"><\/script><script src="migrated-tactic-cards.js" data-trick-common-card-bootstrap="definitions"><\/script>');
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  if(typeof document==='undefined'||root.CardBuildTags||document.querySelector('script[data-trick-build-tags-runtime]'))return;
  if(document.readyState==='loading'){
    document.write('<script src="card-build-tags.js" data-trick-build-tags-runtime="true"><\/script>');
    return;
  }
  const script=document.createElement('script');script.src='card-build-tags.js';script.async=false;script.dataset.trickBuildTagsRuntime='true';document.head.appendChild(script);
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  if(typeof document==='undefined'||root.CardPersonalityRuntime||document.querySelector('script[data-trick-card-personality-runtime]'))return;
  if(document.readyState==='loading'){
    document.write('<script src="card-personality-runtime.js" data-trick-card-personality-runtime="true"><\/script>');
    return;
  }
  const script=document.createElement('script');
  script.src='card-personality-runtime.js';
  script.async=false;
  script.dataset.trickCardPersonalityRuntime='true';
  document.head.appendChild(script);
})(typeof globalThis!=='undefined'?globalThis:this);
