(function(root,factory){
  const BattleCore=typeof module!=='undefined'?require('./battle-core.js'):root.BattleCore;
  const EnemyInformation=typeof module!=='undefined'?require('./enemy-information.js'):root.EnemyInformation;
  const api=factory(BattleCore,EnemyInformation);
  if(typeof module!=='undefined')module.exports=api;
  root.TrickOutcomePreview=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(BattleCore,EnemyInformation){
  const STAGE='BEGINNER-UX-1';
  const SUITS=Object.freeze(['S','H','D','C']);
  const BAND_RANKS=Object.freeze({low:Object.freeze([2,3,4,5,6]),mid:Object.freeze([7,8,9,10]),high:Object.freeze([11,12,13,14])});
  const OUTCOMES=Object.freeze({
    win:Object.freeze({id:'win',label:'승리 확정',className:'confirmed-win'}),
    loss:Object.freeze({id:'loss',label:'패배 확정',className:'confirmed-loss'}),
    draw:Object.freeze({id:'draw',label:'무승부 확정',className:'confirmed-draw'}),
    uncertain:Object.freeze({id:'uncertain',label:'결과 불확실',className:'uncertain'})
  });
  let installed=false;

  function activeBattle(root){
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return null;
  }
  function currentKnowledge(battle,root={}){
    if(!battle||!EnemyInformation)return Object.freeze({knowledge:'none'});
    const model=EnemyInformation.currentEnemyModel(battle);
    if(model?.knowledge==='exact'&&Number.isFinite(Number(model.rank))&&model.suit){
      return Object.freeze({knowledge:'exact',rank:Number(model.rank),suit:model.suit});
    }
    if(model?.knowledge==='partial'&&BAND_RANKS[model.strength]){
      return Object.freeze({knowledge:'partial',strength:model.strength,isTrump:model.isTrump===true});
    }
    return Object.freeze({knowledge:'none'});
  }
  function candidateCards(knowledge,trump){
    if(knowledge?.knowledge==='exact')return[{rank:Number(knowledge.rank),suit:knowledge.suit}];
    if(knowledge?.knowledge!=='partial')return[];
    const ranks=BAND_RANKS[knowledge.strength]||[];
    const suits=knowledge.isTrump&&trump?[trump]:SUITS.filter(suit=>!trump||suit!==trump);
    return ranks.flatMap(rank=>suits.map(suit=>({rank,suit})));
  }
  function playerEffectiveCard(card,battle,root={}){
    if(typeof root?.effective==='function'){
      try{return root.effective(card)}catch(_error){}
    }
    const plus=Number(battle?.mods?.plus)||0,bonus=Number(card?.effectiveRankBonus)||0;
    const rank=Math.min(14,(Number(card?.rank)||0)+plus+bonus),suit=battle?.mods?.paint?battle?.trump:card?.suit;
    return BattleCore.effectiveCard(card,{rank,suit,treatedAsTrump:card?.treatedAsTrump===true});
  }
  function comparePublicCandidate(player,enemy,battle){
    const enemyEffective=BattleCore.effectiveCard(enemy);
    if(battle?.mods?.reverse&&player?.trickSuit===enemyEffective.trickSuit){
      return Math.sign((Number(enemyEffective.trickRank)||0)-(Number(player?.trickRank)||0));
    }
    return BattleCore.compareTrick(player,enemyEffective,battle?.trump);
  }
  function outcomeForResults(results){
    if(!results.length)return OUTCOMES.uncertain;
    if(results.every(result=>result>0))return OUTCOMES.win;
    if(results.every(result=>result<0))return OUTCOMES.loss;
    if(results.every(result=>result===0))return OUTCOMES.draw;
    return OUTCOMES.uncertain;
  }
  function previewForCard(card,battle,root={}){
    if(!card||!battle)return Object.freeze({...OUTCOMES.uncertain,knowledge:'none',playerValue:null,enemyMin:null,enemyMax:null});
    const knowledge=currentKnowledge(battle,root),candidates=candidateCards(knowledge,battle.trump),player=playerEffectiveCard(card,battle,root);
    const results=candidates.map(enemy=>comparePublicCandidate(player,enemy,battle));
    const enemyValues=candidates.map(enemy=>BattleCore.resolveTrickValue(BattleCore.effectiveCard(enemy),battle.trump).finalValue);
    const outcome=outcomeForResults(results),playerValue=BattleCore.resolveTrickValue(player,battle.trump).finalValue;
    return Object.freeze({...outcome,knowledge:knowledge.knowledge,playerValue,enemyMin:enemyValues.length?Math.min(...enemyValues):null,enemyMax:enemyValues.length?Math.max(...enemyValues):null,candidateCount:candidates.length});
  }
  function previewText(preview){
    if(!preview)return OUTCOMES.uncertain.label;
    if(preview.knowledge==='exact'&&preview.enemyMin!==null)return`${preview.label} · 적 ${preview.enemyMin}`;
    if(preview.knowledge==='partial'&&preview.enemyMin!==null)return`${preview.label} · 공개 범위 ${preview.enemyMin}~${preview.enemyMax}`;
    return preview.label;
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function installInspectAdapter(root){
    if(typeof root?.inspectCard!=='function'||!root?.document)return false;
    if(root.inspectCard.__publicTrickOutcomePreview)return true;
    const legacy=root.inspectCard;
    const wrapped=function(card,placed=false,slotIndex=null){
      const battle=activeBattle(root),doc=root.document;
      if(!card||!battle)return legacy.apply(this,arguments);
      const inspect=doc.getElementById('inspect'),title=doc.getElementById('inspectTitle'),desc=doc.getElementById('inspectDesc'),apply=doc.getElementById('inspectApply'),legend=doc.getElementById('systemLegend'),termsHost=doc.getElementById('termRow'),play=doc.getElementById('playBtn');
      if(!inspect||!title||!desc||!apply||!termsHost||!play)return legacy.apply(this,arguments);
      inspect.classList?.remove?.('collapsed');
      play.textContent='내기';
      const definition=card.named||card.definition,effective=playerEffectiveCard(card,battle,root),preview=placed?null:previewForCard(card,battle,root),slotLabel=slotIndex!==null&&slotIndex!==undefined?` · ${slotIndex+1}번 슬롯`:'';
      const suitObj=suit=>typeof root.suitObj==='function'?root.suitObj(suit):{sym:({S:'♠',H:'♥',D:'♦',C:'♣'})[suit]||String(suit||'?')};
      const rankLabel=rank=>typeof root.rankLabel==='function'?root.rankLabel(rank):(rank===14?'A':rank===13?'K':rank===12?'Q':rank===11?'J':String(rank));
      title.textContent=`${definition?definition.name+' ':''}${suitObj(card.suit).sym}${rankLabel(card.rank)}${placed?slotLabel:''}`;
      desc.innerHTML=definition&&typeof root.cardDetailHtml==='function'?root.cardDetailHtml(definition):'효과 없음. 일반 카드는 족보 구성과 쇼다운 재료로 사용된다.';
      if(placed){
        apply.textContent=`전장/쇼다운 카드 · 인쇄값 ${suitObj(BattleCore.printedValue(card,'Suit')).sym}${rankLabel(BattleCore.printedValue(card,'Rank'))} · 쇼다운값 ${suitObj(BattleCore.showdownValue(card,'Suit')).sym}${rankLabel(BattleCore.showdownValue(card,'Rank'))}`;
      }else{
        const trump=BattleCore.isTrumpCard(effective,battle.trump)?' · 트럼프':'';
        apply.textContent=`인쇄 ${suitObj(BattleCore.printedValue(card,'Suit')).sym}${rankLabel(BattleCore.printedValue(card,'Rank'))} → 트릭 ${suitObj(effective.trickSuit).sym}${rankLabel(effective.trickRank)}${trump} · ${previewText(preview)}`;
        apply.dataset.trickOutcomePreview=preview.id;
      }
      if(legend)legend.innerHTML='';
      const cardTerms=definition&&typeof root.cardTerms==='function'?root.cardTerms(definition):[];
      const terms=[...new Set([...(cardTerms||[]),'인쇄값','트릭값','쇼다운값'])];
      termsHost.innerHTML=terms.map(term=>`<button class="termBtn" onclick="showTerm('${escapeHtml(term)}')">${escapeHtml(term)}</button>`).join('');
      play.disabled=placed;
      return preview;
    };
    wrapped.__publicTrickOutcomePreview=true;wrapped.__legacyInspectCard=legacy;root.inspectCard=wrapped;return true;
  }
  function installBrowserRuntime(root){if(installed&&root?.inspectCard?.__publicTrickOutcomePreview)return true;const ok=installInspectAdapter(root);if(ok)installed=true;return ok}
  function installWhenReady(root){
    if(typeof document==='undefined')return false;
    let attempts=0;const attempt=()=>{if(installBrowserRuntime(root))return;attempts++;if(attempts<50)(root.setTimeout||setTimeout)(attempt,25);else root.console?.warn?.('[trick-preview] 공개 정보 미리보기 초기화가 지연되었습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,SUITS,BAND_RANKS,OUTCOMES,activeBattle,currentKnowledge,candidateCards,playerEffectiveCard,comparePublicCandidate,outcomeForResults,previewForCard,previewText,installInspectAdapter,installBrowserRuntime,installWhenReady};
});
