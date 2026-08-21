(function(root,factory){
  const cards=typeof module!=='undefined'?require('./cards.js'):root;
  const api=factory(root,cards);
  if(typeof module!=='undefined')module.exports=api;
  root.LegacyTacticRetirement=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Cards){
  const STAGE='3-3A';
  const PACKAGE_CARD_IDS=Object.freeze({
    steady:Object.freeze(['core.plus2','core.plus2','core.paint','core.draw','core.draw','core.scout','core.double','core.barrier','core.burn','core.reverse']),
    future:Object.freeze(['core.scout','core.scout','core.draw','core.draw','core.paint','core.plus2','core.double','core.barrier','core.burn','core.reverse']),
    rush:Object.freeze(['core.double','core.double','core.plus2','core.draw','core.draw','core.paint','core.barrier','core.burn','core.reverse','core.scout'])
  });
  const PACKAGE_DESCRIPTIONS=Object.freeze({
    steady:'숫자 조작과 드로우 효과 카드를 더 많이 포함한다.',
    future:'정찰과 다음 트릭 준비 효과 카드 중심.',
    rush:'더블다운과 저랭크 효과 카드 중심.'
  });
  const GOLDEN_HAND_EFFECTS=Object.freeze([
    Object.freeze({trigger:'on_trick_win',action:'gain_chips',value:1,duration:'trick'}),
    Object.freeze({trigger:'on_trick_win',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'})
  ]);
  let installed=false;

  function randomUid(){return Math.random().toString(36).slice(2)}
  function activeRun(){
    if(root?.run)return root.run;
    try{if(typeof run!=='undefined')return run}catch{}
    return null;
  }
  function activeBattle(){
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch{}
    return null;
  }
  function legacyPacks(){
    if(Array.isArray(root?.PACKS))return root.PACKS;
    try{if(typeof PACKS!=='undefined'&&Array.isArray(PACKS))return PACKS}catch{}
    return null;
  }
  function legacyTactics(){
    if(Array.isArray(root?.TACTICS))return root.TACTICS;
    try{if(typeof TACTICS!=='undefined'&&Array.isArray(TACTICS))return TACTICS}catch{}
    return null;
  }
  function currentPoolView(){
    if(root?.poolView)return root.poolView;
    try{if(typeof poolView!=='undefined')return poolView}catch{}
    return null;
  }

  function createGeneralCard(cardId,cards=Cards){
    if(!cards?.createDefinitionCard)throw new TypeError('createDefinitionCard is required');
    return cards.createDefinitionCard(cardId,{uid:randomUid()});
  }
  function isPlainCard(card){
    return !!card&&!card.named&&!card.definition&&!card.cardId&&(!Array.isArray(card.effects)||card.effects.length===0);
  }
  function applyPackageToDeck(deck,packId,cards=Cards){
    if(!Array.isArray(deck))throw new TypeError('deck must be an array');
    const ids=PACKAGE_CARD_IDS[packId];
    if(!ids)throw new TypeError(`Unknown package: ${packId}`);
    let replaced=0;
    for(const cardId of ids){
      const plainIndex=deck.findIndex(isPlainCard);
      if(plainIndex<0)break;
      deck.splice(plainIndex,1,createGeneralCard(cardId,cards));
      replaced++;
    }
    return replaced;
  }
  function applyStartingPackage(runState,cards=Cards){
    if(!runState?.deck||!runState?.pack?.id)return 0;
    if(runState.__generalPackageApplied)return 0;
    const replaced=applyPackageToDeck(runState.deck,runState.pack.id,cards);
    runState.__generalPackageApplied=true;
    runState.generalPackageCardIds=[...PACKAGE_CARD_IDS[runState.pack.id]];
    return replaced;
  }
  function retireRunTactics(runState){
    if(!runState||typeof runState!=='object')return runState;
    runState.tactics=[];
    runState.tacticSystemRetired=true;
    return runState;
  }
  function retireBattleTactics(battleState){
    if(!battleState||typeof battleState!=='object')return battleState;
    battleState.tdeck=[];
    battleState.thand=[];
    battleState.tdisc=[];
    battleState.selectedTactic=null;
    battleState.tacticsOpen=false;
    battleState.tacticUsing=false;
    battleState.tacticSystemRetired=true;
    return battleState;
  }

  function patchNamedDefinitions(cards=Cards){
    const defs=cards?.CARD_DEFINITION_BY_ID,details=cards?.CARD_DETAIL_BY_ID;
    if(!defs)return false;
    const golden=defs['pack01.golden_hand'];
    if(golden){
      golden.effects=GOLDEN_HAND_EFFECTS.map(effect=>({...effect}));
      golden.description='트릭 승리 시 칩 +1. 다음 트릭의 손패 한도와 보충 드로우 +1.';
      golden.terms=['트릭','칩','손패','드로우'];
    }
    const goldenDetail=details?.['pack01.golden_hand'];
    if(goldenDetail){
      delete goldenDetail.condition;
      goldenDetail.effect='칩 +1. 다음 트릭의 손패 한도와 보충 드로우 +1.';
      goldenDetail.extra='추가 손패는 다음 트릭에만 적용되고 이후 기본 손패 한도로 돌아온다.';
      goldenDetail.terms=['트릭','칩','손패','드로우'];
    }
    const recursive=defs['pack01.recursive_function'];
    if(recursive){
      recursive.description='트릭 승리 시 직전에 발동한 다른 네임드 카드의 복사 가능한 수치 효과 하나를 1회 복사한다.';
      recursive.terms=['트릭','피해','회복','칩','보호막','출혈','예측'];
    }
    const recursiveDetail=details?.['pack01.recursive_function'];
    if(recursiveDetail){
      recursiveDetail.extra='복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측이며 자기 자신은 복사하지 않는다.';
      recursiveDetail.terms=['트릭','피해','회복','칩','보호막','출혈','예측'];
    }
    return true;
  }
  function patchPackageMetadata(){
    const packs=legacyPacks();if(!packs)return false;
    for(const pack of packs){
      if(!PACKAGE_CARD_IDS[pack.id])continue;
      pack.cardIds=[...PACKAGE_CARD_IDS[pack.id]];
      pack.desc=PACKAGE_DESCRIPTIONS[pack.id]||pack.desc;
    }
    return true;
  }
  function patchTerms(){
    let terms=null,notes=null;
    try{if(typeof TERMS!=='undefined')terms=TERMS}catch{}
    try{if(typeof SYSTEM_NOTES!=='undefined')notes=SYSTEM_NOTES}catch{}
    if(terms){
      terms['순수']='효과가 없는 일반 트럼프 카드. 별도 카드 타입이 아니라 효과 유무를 설명하는 표현이다.';
      terms['칩']='일부 카드 효과에서 획득하거나 소비하는 전투 자원.';
      terms['전술']='폐지된 레거시 별도 카드 시스템. 현재 효과는 일반 카드에 통합되어 있다.';
      terms['전술 카드']='폐지된 레거시 용어. 현재는 숫자와 무늬를 가진 일반 효과 카드로 통합되어 있다.';
      terms['전술 패']='폐지된 레거시 용어. 현재 전투에서는 일반 손패만 사용한다.';
    }
    if(notes?.['조건'])notes['조건']='효과가 켜지기 위해 먼저 만족해야 하는 전제. 예: 트릭 숫자 5 이하, 우세 무늬 2개 이상.';
    return !!terms;
  }

  function hideTacticUi(){
    if(typeof document==='undefined')return false;
    const panel=document.getElementById('tacticPanel');
    if(panel){panel.hidden=true;panel.style.display='none'}
    return !!panel;
  }
  function installBeginRunAdapter(){
    if(typeof root?.beginRun!=='function')return false;
    if(root.beginRun.__tacticRetirement)return true;
    const legacy=root.beginRun;
    const wrapped=function(...args){
      const result=legacy.apply(this,args),runState=activeRun();
      if(runState){
        applyStartingPackage(runState,Cards);
        retireRunTactics(runState);
        try{if(typeof root.renderMap==='function')root.renderMap();else if(typeof renderMap==='function')renderMap()}catch{}
      }
      return result;
    };
    wrapped.__tacticRetirement=true;wrapped.__legacyBeginRun=legacy;root.beginRun=wrapped;return true;
  }
  function installBattleAdapter(){
    if(typeof root?.startBattle!=='function')return false;
    if(root.startBattle.__tacticRetirement)return true;
    const legacy=root.startBattle;
    const wrapped=function(...args){
      const runState=activeRun();if(runState)retireRunTactics(runState);
      const result=legacy.apply(this,args),battleState=activeBattle();
      if(battleState)retireBattleTactics(battleState);
      hideTacticUi();
      return result;
    };
    wrapped.__tacticRetirement=true;wrapped.__legacyStartBattle=legacy;root.startBattle=wrapped;return true;
  }
  function installRenderAdapter(){
    if(typeof root?.renderBattle!=='function')return false;
    if(root.renderBattle.__tacticRetirement)return true;
    const legacy=root.renderBattle;
    const wrapped=function(...args){
      const result=legacy.apply(this,args);hideTacticUi();
      if(typeof document!=='undefined'){
        const b=activeBattle(),desc=document.getElementById('inspectDesc');
        if(desc&&b&&!b.selected&&b.inspectSlot===null&&!b.inspectStage)desc.textContent='손패, 전장 카드, 쇼다운 슬롯 카드를 누르면 아래에 설명이 뜬다.';
      }
      return result;
    };
    wrapped.__tacticRetirement=true;wrapped.__legacyRenderBattle=legacy;root.renderBattle=wrapped;return true;
  }
  function installPoolAdapter(){
    if(typeof root?.showPool!=='function')return false;
    if(root.showPool.__tacticRetirement)return true;
    const legacy=root.showPool;
    const wrapped=function(...args){
      const tactics=legacyTactics(),saved=tactics?[...tactics]:null;
      if(tactics)tactics.splice(0,tactics.length);
      try{
        const result=legacy.apply(this,args),view=currentPoolView();
        if(view&&args[0]!=='pack01'&&view.activePackId==='all'){
          view.title=`전체 카드풀 · 일반 카드 52장 + 네임드 ${Cards.CARD_DEFINITIONS?.length||0}장`;
          try{if(typeof root.renderPoolModal==='function')root.renderPoolModal();else if(typeof renderPoolModal==='function')renderPoolModal()}catch{}
        }
        return result;
      }finally{if(tactics&&saved)tactics.push(...saved)}
    };
    wrapped.__tacticRetirement=true;wrapped.__legacyShowPool=legacy;root.showPool=wrapped;return true;
  }
  function installShopAdapter(){
    if(typeof root?.showShop!=='function'||typeof root?.shopPick!=='function')return false;
    if(!root.showShop.__tacticRetirement){
      const legacyShow=root.showShop;
      const wrappedShow=function(...args){
        const result=legacyShow.apply(this,args);
        if(typeof document!=='undefined'){
          const modal=document.getElementById('modal');
          if(modal)modal.innerHTML=modal.innerHTML.replace('정찰 구매 · 35G','정찰 카드 · 35G').replace('전술 카드 정찰 추가','일반 효과 카드 정찰 추가');
        }
        return result;
      };
      wrappedShow.__tacticRetirement=true;wrappedShow.__legacyShowShop=legacyShow;root.showShop=wrappedShow;
    }
    if(!root.shopPick.__tacticRetirement){
      const legacyPick=root.shopPick;
      const wrappedPick=function(id,type,cost){
        if(type!=='scout')return legacyPick.apply(this,arguments);
        const runState=activeRun();if(!runState)return;
        if(runState.gold<cost){try{if(typeof root.sfx==='function')root.sfx('lose');else if(typeof sfx==='function')sfx('lose')}catch{}return}
        runState.gold-=cost;
        runState.deck.push(createGeneralCard('core.scout',Cards));
        try{
          const node=runState.map.find(n=>n.id===id);
          if(typeof root.showShop==='function')root.showShop(node);else if(typeof showShop==='function')showShop(node);
        }catch{}
      };
      wrappedPick.__tacticRetirement=true;wrappedPick.__legacyShopPick=legacyPick;root.shopPick=wrappedPick;
    }
    return true;
  }
  function installShortEffectAdapter(){
    if(typeof root?.shortEffect!=='function')return false;
    if(root.shortEffect.__tacticRetirement)return true;
    const legacy=root.shortEffect;
    const wrapped=function(card){
      const id=card?.cardId||card?.definition?.id||card?.named?.id;
      if(id==='pack01.golden_hand')return '승리: 칩 +1 · 다음 트릭 손패 +1';
      return legacy.apply(this,arguments);
    };
    wrapped.__tacticRetirement=true;wrapped.__legacyShortEffect=legacy;root.shortEffect=wrapped;return true;
  }
  function installFinishRunAdapter(){
    if(typeof root?.finishRun!=='function')return false;
    if(root.finishRun.__tacticRetirement)return true;
    const legacy=root.finishRun;
    const wrapped=function(...args){
      const result=legacy.apply(this,args);
      if(typeof document!=='undefined'){
        const runState=activeRun(),modal=document.getElementById('modal');
        if(runState&&modal){
          const effectCount=runState.deck.filter(card=>card?.definition?.effects?.length||card?.named?.effects?.length||card?.effects?.length).length;
          modal.innerHTML=modal.innerHTML.replace(/ \/ 전술 \d+장/,'').replace(/덱 (\d+)장 \/ 네임드 (\d+)장/,`덱 $1장 / 네임드 $2장 / 효과 카드 ${effectCount}장`);
        }
      }
      return result;
    };
    wrapped.__tacticRetirement=true;wrapped.__legacyFinishRun=legacy;root.finishRun=wrapped;return true;
  }

  function install(){
    if(installed)return true;
    if(typeof root?.beginRun!=='function'||typeof root?.startBattle!=='function'||typeof root?.renderBattle!=='function')return false;
    patchNamedDefinitions(Cards);
    patchPackageMetadata();
    patchTerms();
    installBeginRunAdapter();
    installBattleAdapter();
    installRenderAdapter();
    installPoolAdapter();
    installShopAdapter();
    installShortEffectAdapter();
    installFinishRunAdapter();
    hideTacticUi();
    installed=true;
    return true;
  }
  function installWhenReady(){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{
      if(install())return;
      attempts++;
      if(attempts<40)setTimeout(attempt,25);else console.warn('[legacy-tactic-retirement] 전투 런타임을 찾지 못했습니다.');
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);
    return true;
  }

  return{STAGE,PACKAGE_CARD_IDS,PACKAGE_DESCRIPTIONS,GOLDEN_HAND_EFFECTS,isPlainCard,createGeneralCard,applyPackageToDeck,applyStartingPackage,retireRunTactics,retireBattleTactics,patchNamedDefinitions,patchPackageMetadata,patchTerms,hideTacticUi,installBeginRunAdapter,installBattleAdapter,installRenderAdapter,installPoolAdapter,installShopAdapter,installShortEffectAdapter,installFinishRunAdapter,install,installWhenReady};
});
