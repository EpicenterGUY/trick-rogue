(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.ShowdownResolution=api;
    api.installBrowser(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='7.5-C';
  const BURST_STAGE='7.5-D';
  const ATTACK_STAGE='7.5-L';
  const RIVER_STAGE='7.5-M';
  const RIVER_MULTIPLIER=1.25;
  const PERFECT_SET_MULTIPLIER=1.5;
  const STANDARD_SUITS=Object.freeze(['S','H','D','C']);
  const STANDARD_RANKS=Object.freeze([2,3,4,5,6,7,8,9,10,11,12,13,14]);
  const SUIT_SYMBOLS=Object.freeze({S:'♠',H:'♥',D:'♦',C:'♣'});
  const SHOWDOWN_PHASES=Object.freeze([
    'cards_locked','pre_showdown_effects','showdown_value_changes','poker','additive_bonuses','rare_multipliers','final_power',
    'player_attack','enemy_survival_check','enemy_attack','overkill','set_end'
  ]);
  const POKER_HANDS=Object.freeze({
    high_card:Object.freeze({id:'high_card',name:'하이카드',power:5}),
    pair:Object.freeze({id:'pair',name:'페어',power:10}),
    two_pair:Object.freeze({id:'two_pair',name:'투페어',power:14}),
    three_kind:Object.freeze({id:'three_kind',name:'트리플',power:18}),
    straight:Object.freeze({id:'straight',name:'스트레이트',power:24}),
    flush:Object.freeze({id:'flush',name:'플러시',power:26}),
    full_house:Object.freeze({id:'full_house',name:'풀하우스',power:32}),
    four_kind:Object.freeze({id:'four_kind',name:'포카드',power:42}),
    straight_flush:Object.freeze({id:'straight_flush',name:'스트레이트 플러시',power:60})
  });
  const POKER_STRENGTH=Object.freeze(['high_card','pair','two_pair','three_kind','straight','flush','full_house','four_kind','straight_flush']);

  function activeBattle(runtimeRoot=defaultRoot){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function activeRun(runtimeRoot=defaultRoot){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function numeric(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function signed(value){const number=numeric(value);return number>0?`+${number}`:String(number)}
  function rankLabel(rank){return rank===14?'A':rank===13?'K':rank===12?'Q':rank===11?'J':String(rank)}
  function suitSymbol(suit){return SUIT_SYMBOLS[suit]||String(suit||'?')}
  function unwrapCard(entry){return entry?.card||entry}
  function showdownValue(card,key,resolver){
    if(typeof resolver==='function')return resolver(card,key);
    const override=card?.[`showdown${key}`];if(override!==undefined)return override;
    const printed=card?.[`printed${key}`];if(printed!==undefined)return printed;
    return card?.[key.toLowerCase()];
  }
  function standardCardSpec(card,valueResolver){
    const rank=numeric(showdownValue(card,'Rank',valueResolver),NaN),suit=String(showdownValue(card,'Suit',valueResolver)||'').toUpperCase();
    if(!Number.isInteger(rank)||!STANDARD_RANKS.includes(rank)||!STANDARD_SUITS.includes(suit))return null;
    return{rank,suit,key:`${suit}:${rank}`};
  }
  function evaluatePoker(entries,{valueResolver}={}){
    if(!Array.isArray(entries)||entries.length!==5)throw new RangeError('Showdown poker requires exactly five cards');
    const cards=entries.map(unwrapCard),ranks=cards.map(card=>numeric(showdownValue(card,'Rank',valueResolver),NaN)).sort((a,b)=>a-b),suits=cards.map(card=>showdownValue(card,'Suit',valueResolver));
    if(ranks.some(rank=>!Number.isFinite(rank)))throw new TypeError('Showdown ranks must be numeric');
    const counts={};for(const rank of ranks)counts[rank]=(counts[rank]||0)+1;
    const groups=Object.values(counts).sort((a,b)=>b-a),unique=[...new Set(ranks)],flush=new Set(suits).size===1;
    const straight=(unique.length===5&&unique[4]-unique[0]===4)||JSON.stringify(unique)===JSON.stringify([2,3,4,5,14]);
    let definition=POKER_HANDS.high_card;
    if(straight&&flush)definition=POKER_HANDS.straight_flush;else if(groups[0]===4)definition=POKER_HANDS.four_kind;else if(groups[0]===3&&groups[1]===2)definition=POKER_HANDS.full_house;
    else if(flush)definition=POKER_HANDS.flush;else if(straight)definition=POKER_HANDS.straight;else if(groups[0]===3)definition=POKER_HANDS.three_kind;
    else if(groups[0]===2&&groups[1]===2)definition=POKER_HANDS.two_pair;else if(groups[0]===2)definition=POKER_HANDS.pair;
    return{...definition,ranks:[...ranks],suits:[...suits]};
  }
  function evaluateFourCardState(entries,{valueResolver}={}){
    if(!Array.isArray(entries)||entries.length!==4)throw new RangeError('River snapshot requires exactly four prior cards');
    const cards=entries.map(unwrapCard),ranks=cards.map(card=>numeric(showdownValue(card,'Rank',valueResolver),NaN)).sort((a,b)=>a-b),suits=cards.map(card=>showdownValue(card,'Suit',valueResolver));
    if(ranks.some(rank=>!Number.isFinite(rank)))throw new TypeError('Showdown ranks must be numeric');
    const counts={};for(const rank of ranks)counts[rank]=(counts[rank]||0)+1;
    const groups=Object.values(counts).sort((a,b)=>b-a);let definition=POKER_HANDS.high_card;
    if(groups[0]===4)definition=POKER_HANDS.four_kind;else if(groups[0]===3)definition=POKER_HANDS.three_kind;else if(groups[0]===2&&groups[1]===2)definition=POKER_HANDS.two_pair;else if(groups[0]===2)definition=POKER_HANDS.pair;
    return{...definition,ranks:[...ranks],suits:[...suits],partial:true};
  }
  function pokerStrength(handOrId){const id=typeof handOrId==='string'?handOrId:handOrId?.id;return POKER_STRENGTH.indexOf(id)}
  function handSummary(hand){return{id:hand.id,name:hand.name,power:hand.power,strength:pokerStrength(hand)}}
  function riverCandidateUniverse(entries,{valueResolver}={}){
    if(!Array.isArray(entries)||entries.length!==4)throw new RangeError('River candidate generation requires exactly four cards');
    const seen=new Set();for(const entry of entries){const spec=standardCardSpec(unwrapCard(entry),valueResolver);if(spec)seen.add(spec.key)}
    const universe=[];for(const suit of STANDARD_SUITS)for(const rank of STANDARD_RANKS){const key=`${suit}:${rank}`;if(!seen.has(key))universe.push({rank,suit,key})}return universe;
  }
  function createRiverCandidates(entries,{valueResolver}={}){
    const before=evaluateFourCardState(entries,{valueResolver}),beforeStrength=pokerStrength(before),candidates=[];
    for(const candidate of riverCandidateUniverse(entries,{valueResolver})){
      const after=evaluatePoker([...entries,candidate],{valueResolver}),strength=pokerStrength(after);if(strength<=beforeStrength)continue;
      candidates.push({rank:candidate.rank,suit:candidate.suit,key:candidate.key,target:{...handSummary(after)}});
    }
    candidates.sort((a,b)=>b.target.strength-a.target.strength||a.rank-b.rank||STANDARD_SUITS.indexOf(a.suit)-STANDARD_SUITS.indexOf(b.suit));
    return{before,candidates};
  }
  function groupRiverCandidates(candidates){
    const groups=new Map();for(const candidate of candidates||[]){const id=candidate.target.id;if(!groups.has(id))groups.set(id,{id,name:candidate.target.name,power:candidate.target.power,strength:candidate.target.strength,cards:[],ranks:[],suits:[]});groups.get(id).cards.push({rank:candidate.rank,suit:candidate.suit,key:candidate.key})}
    const result=[...groups.values()];for(const group of result){group.ranks=[...new Set(group.cards.map(card=>card.rank))].sort((a,b)=>a-b);group.suits=[...new Set(group.cards.map(card=>card.suit))].sort((a,b)=>STANDARD_SUITS.indexOf(a)-STANDARD_SUITS.indexOf(b));group.count=group.cards.length}
    result.sort((a,b)=>b.strength-a.strength||b.count-a.count);return result;
  }
  function riverGroupText(group){
    if(!group)return'리버 후보 없음';if(group.suits.length===1&&group.count>=5)return`${suitSymbol(group.suits[0])}가 들어오면 ${group.name}`;
    const ranks=group.ranks.map(rankLabel);if(ranks.length&&ranks.length<=8)return`${group.name} 가능: ${ranks.join(' / ')}`;return`${group.name} 가능: ${group.count}장`;
  }
  function riverSnapshotLines(snapshot){return snapshot?.groups?.length?snapshot.groups.map(riverGroupText):['리버 후보 없음']}
  function riverHudText(snapshot){const lines=riverSnapshotLines(snapshot);return lines.length<=2?lines.join(' · '):`${lines.slice(0,2).join(' · ')} · 외 ${lines.length-2}종`}
  function createRiverSnapshot(entries,{valueResolver,setIndex=1}={}){
    if(!Array.isArray(entries)||entries.length!==4)throw new RangeError('River snapshot requires exactly four showdown cards');
    const sourceCards=entries.map(entry=>standardCardSpec(unwrapCard(entry),valueResolver));if(sourceCards.some(spec=>!spec))throw new TypeError('River snapshot cards must use standard 52-card specs');
    const generated=createRiverCandidates(entries,{valueResolver}),groups=groupRiverCandidates(generated.candidates),sourceKey=sourceCards.map(spec=>spec.key).join('|');
    return{stage:RIVER_STAGE,id:`set:${setIndex}:${sourceKey}`,setIndex,capturedAfterTrick:4,slotCount:4,frozen:true,
      sourceCards:sourceCards.map(spec=>({rank:spec.rank,suit:spec.suit,key:spec.key})),baseline:handSummary(generated.before),
      candidates:generated.candidates.map(candidate=>({rank:candidate.rank,suit:candidate.suit,key:candidate.key,target:{...candidate.target}})),candidateKeys:generated.candidates.map(candidate=>candidate.key),
      groups:groups.map(group=>({...group,cards:group.cards.map(card=>({...card})),ranks:[...group.ranks],suits:[...group.suits]})),candidateCount:generated.candidates.length,active:generated.candidates.length>0,
      lines:groups.length?groups.map(riverGroupText):['리버 후보 없음']};
  }
  function captureRiverSnapshot(state,{valueResolver,setIndex=state?.setIndex??1}={}){
    if(!state||typeof state!=='object')throw new TypeError('Battle state is required for river snapshot');if(!Array.isArray(state.slots)||state.slots.length!==4)return null;
    const snapshot=createRiverSnapshot(state.slots,{valueResolver,setIndex});if(state.riverSnapshot?.id===snapshot.id)return state.riverSnapshot;state.riverSnapshot=snapshot;state.riverHit=null;return snapshot;
  }
  function resolveRiverHit(snapshot,fifth,{valueResolver,setIndex=snapshot?.setIndex}={}){
    const base={stage:RIVER_STAGE,active:false,hit:false,multiplier:RIVER_MULTIPLIER,reason:null,snapshotId:snapshot?.id||null,snapshotSetIndex:snapshot?.setIndex??null,candidateCount:snapshot?.candidateCount||0,candidateLines:snapshot?.lines?[...snapshot.lines]:[],fifth:null,target:null,matchedCandidate:null};
    if(!snapshot){base.reason='missing_snapshot';return base}if(snapshot.capturedAfterTrick!==4||snapshot.slotCount!==4||snapshot.frozen!==true){base.reason='invalid_snapshot';return base}if(setIndex!==undefined&&snapshot.setIndex!==setIndex){base.reason='stale_snapshot';return base}
    const spec=standardCardSpec(unwrapCard(fifth),valueResolver);if(!spec){base.reason='invalid_fifth_card';return base}base.fifth={rank:spec.rank,suit:spec.suit,key:spec.key};
    const matched=(snapshot.candidates||[]).find(candidate=>candidate.key===spec.key);if(!matched){base.reason='candidate_miss';return base}
    base.active=true;base.hit=true;base.reason='candidate_hit';base.target={...matched.target};base.matchedCandidate={rank:matched.rank,suit:matched.suit,key:matched.key,target:{...matched.target}};return base;
  }
  function applyRiverHitBonus(model,riverHit,{side='player'}={}){
    model.riverHit=riverHit?JSON.parse(JSON.stringify(riverHit)):null;
    if(riverHit?.active)addMultiplier(model,side,{id:'river_hit',label:'리버 적중',factor:riverHit.multiplier,source:'river',metadata:{snapshotId:riverHit.snapshotId,target:riverHit.target,fifth:riverHit.fifth,candidateCount:riverHit.candidateCount}});return riverHit;
  }
  function detectPerfectSet(setHistory){const results=Array.isArray(setHistory?.trickResults)?setHistory.trickResults:[],active=results.length===5&&results.every(result=>result==='player');return{stage:BURST_STAGE,active,multiplier:PERFECT_SET_MULTIPLIER,wins:results.filter(result=>result==='player').length,results:[...results]}}
  function createSide(hand){return{hand:{...hand,ranks:[...(hand?.ranks||[])],suits:[...(hand?.suits||[])]},basePower:numeric(hand?.power),additives:[],additiveTotal:0,preMultiplierPower:numeric(hand?.power),multipliers:[],multiplierProduct:1,finalPower:numeric(hand?.power)}}
  function createBreakdown({playerHand,enemyHand,setIndex=1}={}){if(!playerHand||!enemyHand)throw new TypeError('Both showdown hands are required');return{stage:STAGE,attackStage:ATTACK_STAGE,riverStage:RIVER_STAGE,order:[...SHOWDOWN_PHASES],setIndex,player:createSide(playerHand),enemy:createSide(enemyHand),riverHit:null,attacks:null,attackSequence:null,finalized:false}}
  function sideOf(model,side){if(side!=='player'&&side!=='enemy')throw new TypeError(`Unknown showdown side: ${String(side)}`);if(!model?.[side])throw new TypeError('A showdown breakdown is required');return model[side]}
  function addAdditive(model,side,{id,label,value,source='effect',metadata}={}){const target=sideOf(model,side),amount=numeric(value);if(!amount)return null;const entry={id:id||`${source}:${target.additives.length+1}`,label:label||source,value:amount,source};if(metadata!==undefined)entry.metadata=metadata;target.additives.push(entry);return entry}
  function addMultiplier(model,side,{id,label,factor,source='condition',metadata}={}){const target=sideOf(model,side),multiplier=numeric(factor,1);if(multiplier<=0)throw new RangeError('Showdown multiplier must be greater than zero');if(multiplier===1)return null;const entry={id:id||`${source}:${target.multipliers.length+1}`,label:label||source,factor:multiplier,source,before:null,after:null};if(metadata!==undefined)entry.metadata=metadata;target.multipliers.push(entry);return entry}
  function addPerfectSetMultiplier(model,setHistory,{side='player'}={}){const perfect=detectPerfectSet(setHistory);model.perfectSet=perfect;if(perfect.active)addMultiplier(model,side,{id:'perfect_set',label:'5전 전승',factor:perfect.multiplier,source:'trick_record',metadata:{wins:perfect.wins,results:perfect.results}});return perfect}
  function finalizeSide(side){side.additiveTotal=side.additives.reduce((sum,entry)=>sum+numeric(entry.value),0);side.preMultiplierPower=Math.max(0,side.basePower+side.additiveTotal);let current=side.preMultiplierPower,product=1;for(const entry of side.multipliers){entry.before=current;product*=entry.factor;current=Math.max(0,Math.round(current*entry.factor));entry.after=current}side.multiplierProduct=product;side.finalPower=current;return side}
  function createAttack(attacker,target,plannedAmount){return{stage:ATTACK_STAGE,attacker,target,plannedAmount:Math.max(0,numeric(plannedAmount)),dealt:null,hpBefore:null,hpAfter:null,cancelled:false,cancelReason:null,targetDefeated:false}}
  function finalizeBreakdown(model){finalizeSide(model.player);finalizeSide(model.enemy);model.attacks={player:createAttack('player','enemy',model.player.finalPower),enemy:createAttack('enemy','player',model.enemy.finalPower)};model.attackSequence=null;model.finalized=true;return model}
  function multiplierText(side){return side.multipliers.length?side.multipliers.map(entry=>`${entry.label} ×${entry.factor}`).join(' · '):'없음'}
  function additiveText(side){return`${signed(side.additiveTotal)}`}
  function attackTraceText(attack,label){if(!attack)return`${label} 없음`;if(attack.cancelled)return`${label} 취소`;const amount=Number.isFinite(attack.dealt)?attack.dealt:attack.plannedAmount;return`${label} ${amount}`}
  function traceLines(model){if(!model?.finalized)finalizeBreakdown(model);const river=model.riverHit?.active?`리버: 적중 · ${model.riverHit.target?.name||'후보'} +25%`:`리버: ${model.riverHit?.reason==='candidate_miss'?'불발':'없음'}`;return[`족보: ${model.player.hand.name} ${model.player.basePower} / 적 ${model.enemy.hand.name} ${model.enemy.basePower}`,`덧셈: 나 ${additiveText(model.player)} / 적 ${additiveText(model.enemy)}`,river,`배율: 나 ${multiplierText(model.player)} / 적 ${multiplierText(model.enemy)}`,`최종 위력: ${model.player.finalPower} : ${model.enemy.finalPower}`,`쇼다운 공격: ${attackTraceText(model.attacks?.player,'적 피해')} / ${attackTraceText(model.attacks?.enemy,'플레이어 피해')}`]}
  function snapshotBreakdown(model){return JSON.parse(JSON.stringify(model))}
  function cardLabel(card,index){return card?.named?.name||card?.definition?.name||card?.name||card?.cardId||card?.id||`${index+1}번 슬롯`}
  function advantageExtra(advantage,score){return{score,advantage,playerAdvantages:advantage?.playerAdvantages||[],enemyAdvantages:advantage?.enemyAdvantages||[],playerAdvantageCount:numeric(advantage?.playerAdvantageCount),enemyAdvantageCount:numeric(advantage?.enemyAdvantageCount),playerSuitCounts:advantage?.playerSuitCounts||{},enemySuitCounts:advantage?.enemySuitCounts||{}}}
  function currentContractResolution(state){const resolution=state?.contractTabooLastResolution;return resolution&&resolution.setIndex===(state?.setIndex??resolution.setIndex)?resolution:null}
  function recordScoreTrigger(runtimeRoot,state,model,trigger,score,advantage){
    const slots=Array.isArray(state?.slots)?state.slots:[];for(let index=0;index<slots.length;index++){
      const slot=slots[index],before=numeric(score.value),beforeResolution=currentContractResolution(state);runtimeRoot.runCardEffects?.(trigger,slot.card,{slotIndex:index,...advantageExtra(advantage,score)});const resolution=currentContractResolution(state);
      let after=numeric(score.value),effectAfter=after,contractApplied=0;if(trigger==='on_showdown_score'&&resolution&&resolution!==beforeResolution&&Number.isFinite(resolution.basePower)&&Number.isFinite(resolution.finalPower)){effectAfter=numeric(resolution.basePower);contractApplied=numeric(resolution.finalPower)-numeric(resolution.basePower)}
      const effectDelta=effectAfter-before;if(effectDelta)addAdditive(model,'player',{id:`${trigger}:${index}`,label:`${trigger==='on_showdown_advantage'?'우세 반응':'쇼다운 효과'} · ${cardLabel(slot.card,index)}`,value:effectDelta,source:'effects',metadata:{trigger,slotIndex:index}});
      if(contractApplied)addAdditive(model,'player',{id:`contract_taboo:${state.setIndex}`,label:'계약/금기',value:contractApplied,source:'contract_taboo',metadata:{summary:resolution.summary,nominalDelta:resolution.delta,entries:resolution.entries}})
    }return score;
  }
  function undoLegacyAdvantageScale(state,score){const legacy=state?.advantageState,currentSet=state?.setIndex??1;if(!legacy||legacy.appliedSet!==currentSet)return false;if(!Number.isFinite(legacy.lastPlayerPreMultiplier)||!Number.isFinite(legacy.lastPlayerPostMultiplier))return false;if(numeric(score?.value,NaN)!==legacy.lastPlayerPostMultiplier)return false;score.value=legacy.lastPlayerPreMultiplier;return true}
  function addActiveAdvantageMultipliers(runtimeRoot,state,model,advantage){const factor=numeric(advantage?.multiplier,runtimeRoot?.ShowdownAdvantage?.ADVANTAGE_MULTIPLIER||1.25);if(advantage?.playerActive)addMultiplier(model,'player',{id:'advantage',label:'우세',factor,source:advantage.playerSource||'advantage'});if(advantage?.enemyActive)addMultiplier(model,'enemy',{id:'advantage',label:'우세',factor,source:advantage.enemySource||'advantage'});return model}
  function syncAdvantageDiagnostics(state,model,advantage){const legacy=state?.advantageState;if(!legacy)return;legacy.scoreBase=model.player.basePower;legacy.lastPlayerPreMultiplier=model.player.preMultiplierPower;legacy.lastPlayerPostMultiplier=model.player.finalPower;legacy.appliedSet=advantage?.playerActive?(state?.setIndex??1):null}
  function wait(runtimeRoot,ms){return typeof runtimeRoot?.wait==='function'?runtimeRoot.wait(ms):new Promise(resolve=>(runtimeRoot?.setTimeout||setTimeout)(resolve,ms))}
  async function animateBreakdown(runtimeRoot,state,model){const doc=runtimeRoot?.document;state.showdownVisualStage='scan';for(let index=0;index<5;index++){doc?.getElementById?.(`showdown-slot-${index}`)?.classList?.add?.('showdownScan');await wait(runtimeRoot,45)}const show=runtimeRoot?.showShowdownStep;if(typeof show!=='function')return;show('5장 확정','쇼다운 계산 시작');await wait(runtimeRoot,75);show('쇼다운 전 효과','숫자·무늬·슬롯 변경 확정');await wait(runtimeRoot,90);show('족보 확정',`나 ${model.player.hand.name} ${model.player.basePower} / 적 ${model.enemy.hand.name} ${model.enemy.basePower}`);await wait(runtimeRoot,110);if(model.riverHit?.active){show('리버 적중',`${model.riverHit.target?.name||'후보'} · +25%`,'multiplier');await wait(runtimeRoot,110)}show('덧셈 정산',`나 ${additiveText(model.player)} / 적 ${additiveText(model.enemy)}`);await wait(runtimeRoot,110);if(model.player.multipliers.length||model.enemy.multipliers.length){show('배율 정산',`나 ${multiplierText(model.player)} / 적 ${multiplierText(model.enemy)}`,'multiplier');await wait(runtimeRoot,120)}show('최종 위력',`${model.player.finalPower} : ${model.enemy.finalPower}`,'finalPower');await wait(runtimeRoot,180)}
  function clearShowdownSequence(runtimeRoot){const sequence=runtimeRoot?.document?.getElementById?.('showdownSequence');if(sequence){sequence.className='';sequence.innerHTML=''}}
  function resolveShowdownAttacks(runtimeRoot,state,runState,model){if(!model?.finalized)finalizeBreakdown(model);const playerAttack=model.attacks.player,enemyAttack=model.attacks.enemy,sequence=runtimeRoot?.document?.getElementById?.('showdownSequence');if(playerAttack.plannedAmount>0)sequence?.classList?.add?.('impact');playerAttack.hpBefore=Math.max(0,numeric(state?.enemy?.hp));playerAttack.dealt=Math.max(0,numeric(runtimeRoot.damageEnemy?.(playerAttack.plannedAmount,'showdown',{source:'showdown_player_attack',attacker:'player',target:'enemy'})));playerAttack.hpAfter=Math.max(0,numeric(state?.enemy?.hp));playerAttack.targetDefeated=playerAttack.hpAfter<=0;if(playerAttack.dealt>0)runtimeRoot.flash?.(`적 -${playerAttack.dealt}`);const enemyDefeated=playerAttack.targetDefeated;enemyAttack.hpBefore=Math.max(0,numeric(runState?.hp));if(enemyDefeated){enemyAttack.cancelled=true;enemyAttack.cancelReason='enemy_defeated';enemyAttack.dealt=0;enemyAttack.hpAfter=enemyAttack.hpBefore;enemyAttack.targetDefeated=false;runtimeRoot.flash?.('적 반격 취소')}else{if(enemyAttack.plannedAmount>0)sequence?.classList?.add?.('impact');enemyAttack.dealt=Math.max(0,numeric(runtimeRoot.damagePlayer?.(enemyAttack.plannedAmount,'showdown',{source:'showdown_enemy_attack',attacker:'enemy',target:'player'})));enemyAttack.hpAfter=Math.max(0,numeric(runState?.hp));enemyAttack.targetDefeated=enemyAttack.hpAfter<=0;if(enemyAttack.dealt>0)runtimeRoot.flash?.(`플레이어 -${enemyAttack.dealt}`)}model.attackSequence={stage:ATTACK_STAGE,order:['player_attack','enemy_survival_check','enemy_attack'],enemyDefeated,enemyAttackCancelled:enemyAttack.cancelled,playerDefeated:enemyAttack.targetDefeated};return model.attackSequence}
  function archiveBreakdown(state,model){const snapshot=snapshotBreakdown(model);state.showdownBreakdown=snapshot;state.lastShowdownBreakdown=snapshot;if(!Array.isArray(state.showdownHistory))state.showdownHistory=[];state.showdownHistory.push(snapshot);if(state.showdownHistory.length>20)state.showdownHistory.splice(0,state.showdownHistory.length-20);state.showdownTrace=traceLines(snapshot);return snapshot}
  function ensureRiverHud(runtimeRoot=defaultRoot){const doc=runtimeRoot?.document;if(!doc?.getElementById||!doc?.createElement)return null;let hud=doc.getElementById('riverCandidateHud');if(hud)return hud;const host=doc.querySelector?.('.arenaMeta');if(!host?.appendChild)return null;hud=doc.createElement('span');hud.id='riverCandidateHud';hud.className='badge';hud.innerHTML='리버 <b id="riverCandidateText"></b>';host.appendChild(hud);return hud}
  function syncRiverHud(runtimeRoot=defaultRoot,state=activeBattle(runtimeRoot)){const hud=ensureRiverHud(runtimeRoot);if(!hud)return false;const snapshot=state?.riverSnapshot,visible=!!(snapshot&&snapshot.setIndex===state?.setIndex&&state?.phase==='trick'&&state?.trick===5);hud.style.display=visible?'':'none';if(!visible)return false;const text=riverHudText(snapshot),label=runtimeRoot.document.getElementById?.('riverCandidateText');if(label)label.textContent=text;else hud.textContent=`리버 ${text}`;hud.title=(snapshot.lines||[]).join(' · ');return true}
  async function resolveRuntimeShowdown(runtimeRoot=defaultRoot){
    const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot),core=runtimeRoot?.BattleCore;if(!state||!runState||!core)throw new TypeError('Active battle, run, and BattleCore are required');if(!Array.isArray(state.slots)||state.slots.length!==5||!Array.isArray(state.enemySlots)||state.enemySlots.length!==5)throw new RangeError('Showdown requires five cards on both sides');
    runtimeRoot.sfx?.('showdown');state.phase='showdown';state.showdownVisualStage='scan';const resolver=(card,key)=>core.showdownValue(card,key);
    const riverHit=resolveRiverHit(state.riverSnapshot,state.slots[4],{valueResolver:resolver,setIndex:state.setIndex});state.riverHit=riverHit;
    const advantage=core.resolveShowdownAdvantage?.({playerCards:state.slots,enemyCards:state.enemySlots})||{playerActive:false,enemyActive:false,playerAdvantageCount:0,enemyAdvantageCount:0,multiplier:1.25};state.advantage=advantage;runtimeRoot.renderBattle?.();
    state.slots.forEach((slot,index)=>runtimeRoot.runCardEffects?.('before_showdown',slot.card,{slotIndex:index,advantage,showdownPhase:'pre_poker'}));
    const playerHand=evaluatePoker(state.slots,{valueResolver:resolver}),enemyHand=evaluatePoker(state.enemySlots,{valueResolver:resolver}),model=createBreakdown({playerHand,enemyHand,setIndex:state.setIndex});
    const score={value:playerHand.power},slotBonus=numeric(state.slotBonus);if(slotBonus){score.value+=slotBonus;addAdditive(model,'player',{id:'slot_bonus',label:'슬롯 보너스',value:slotBonus,source:'battle'})}
    recordScoreTrigger(runtimeRoot,state,model,'on_showdown_advantage',score,advantage);recordScoreTrigger(runtimeRoot,state,model,'on_showdown_score',score,advantage);undoLegacyAdvantageScale(state,score);
    const represented=model.player.basePower+model.player.additives.reduce((sum,entry)=>sum+entry.value,0),untracked=numeric(score.value)-represented;if(untracked)addAdditive(model,'player',{id:'untracked_additive',label:'기타 덧셈',value:untracked,source:'runtime'});
    applyRiverHitBonus(model,riverHit);addActiveAdvantageMultipliers(runtimeRoot,state,model,advantage);addPerfectSetMultiplier(model,state.setHistory);finalizeBreakdown(model);syncAdvantageDiagnostics(state,model,advantage);
    await animateBreakdown(runtimeRoot,state,model);resolveShowdownAttacks(runtimeRoot,state,runState,model);const archived=archiveBreakdown(state,model);if(runtimeRoot?.console?.debug)runtimeRoot.console.debug('[showdown 7.5-M]',archived);
    const legacyPowerLead=model.player.finalPower>model.enemy.finalPower,legacyPowerDraw=model.player.finalPower===model.enemy.finalPower;
    state.slots.forEach(slot=>runtimeRoot.runCardEffects?.('after_showdown_result',slot.card,{playerWon:legacyPowerLead,draw:legacyPowerDraw,showdownBreakdown:archived,enemyDefeated:model.attackSequence.enemyDefeated,enemyAttackCancelled:model.attackSequence.enemyAttackCancelled,playerDefeated:model.attackSequence.playerDefeated,playerAttack:model.attacks.player,enemyAttack:model.attacks.enemy,riverHit:model.riverHit}));
    await wait(runtimeRoot,450);clearShowdownSequence(runtimeRoot);state.slots.forEach(slot=>runtimeRoot.runCardEffects?.('on_set_end',slot.card,{showdownBreakdown:archived,riverHit:model.riverHit}));
    state.slots.forEach(slot=>state.discard.push(slot.card));state.enemySlots=[];state.slots=[];state.effects=Array.isArray(state.effects)?state.effects.filter(effect=>effect.duration!=='set'):[];runtimeRoot.ShowdownAdvantage?.consumeAdvantage?.(state);state.advantage=null;state.showdownVisualStage=null;state.contractTabooLastResolution=null;state.contractTabooResolvedSet=null;state.riverSnapshot=null;state.riverHit=null;
    if(runState.hp<=0){runtimeRoot.loseRun?.();return archived}if(state.enemy?.hp<=0){await runtimeRoot.winBattle?.();return archived}
    state.trick=1;state.setIndex=(state.setIndex||1)+1;state.phase='trick';state.setHistory=core.createSetHistory?.()||{trickResults:[],wins:0,losses:0,draws:0};state.history=runtimeRoot.CardEffects?.newHistory?.()||{};state.playerStage=null;state.selected=null;state.inspectSlot=null;state.inspectStage=null;state.mods={paint:false,plus:0,reverse:false,double:false};state.trump=runtimeRoot.drawSetTrump?.(state)??state.trump;runtimeRoot.drawP?.(state.maxHandSize);state.hand?.forEach?.(card=>runtimeRoot.runCardEffects?.('on_set_start',card,{trump:state.trump,setIndex:state.setIndex}));runtimeRoot.nextEnemy?.();runtimeRoot.renderBattle?.();return archived;
  }
  function wrapPoker(runtimeRoot=defaultRoot){const original=runtimeRoot?.poker;if(typeof original!=='function'||original.__tricklogShowdown75C)return false;function wrapped(entries){const core=runtimeRoot?.BattleCore,hand=evaluatePoker(entries,{valueResolver:(card,key)=>core?.showdownValue?core.showdownValue(card,key):showdownValue(card,key)});return{name:hand.name,p:hand.power,id:hand.id,power:hand.power,ranks:hand.ranks,suits:hand.suits}}wrapped.__tricklogShowdown75C=true;wrapped.__original=original;runtimeRoot.poker=wrapped;return true}
  function wrapShowdown(runtimeRoot=defaultRoot){const original=runtimeRoot?.showdown;if(typeof original!=='function'||original.__tricklogShowdown75M)return false;async function wrapped(){return resolveRuntimeShowdown(runtimeRoot)}wrapped.__tricklogShowdown75M=true;wrapped.__original=original;runtimeRoot.showdown=wrapped;return true}
  function wrapNextEnemy(runtimeRoot=defaultRoot){const original=runtimeRoot?.nextEnemy;if(typeof original!=='function'||original.__tricklogRiver75M)return false;function wrapped(...args){const state=activeBattle(runtimeRoot),core=runtimeRoot?.BattleCore;if(state?.phase==='trick'&&state?.trick===5&&Array.isArray(state.slots)&&state.slots.length===4)captureRiverSnapshot(state,{valueResolver:(card,key)=>core?.showdownValue?core.showdownValue(card,key):showdownValue(card,key),setIndex:state.setIndex});const result=original.apply(this,args);syncRiverHud(runtimeRoot,state);return result}wrapped.__tricklogRiver75M=true;wrapped.__original=original;runtimeRoot.nextEnemy=wrapped;return true}
  function wrapRenderBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.renderBattle;if(typeof original!=='function'||original.__tricklogRiver75M)return false;function wrapped(...args){const result=original.apply(this,args);syncRiverHud(runtimeRoot,activeBattle(runtimeRoot));return result}wrapped.__tricklogRiver75M=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true}
  function installBrowser(runtimeRoot=defaultRoot){const installed={poker:wrapPoker(runtimeRoot),showdown:wrapShowdown(runtimeRoot),nextEnemy:wrapNextEnemy(runtimeRoot),renderBattle:wrapRenderBattle(runtimeRoot)};syncRiverHud(runtimeRoot,activeBattle(runtimeRoot));return installed}
  return{STAGE,BURST_STAGE,ATTACK_STAGE,RIVER_STAGE,RIVER_MULTIPLIER,PERFECT_SET_MULTIPLIER,STANDARD_SUITS,STANDARD_RANKS,SUIT_SYMBOLS,SHOWDOWN_PHASES,POKER_HANDS,POKER_STRENGTH,activeBattle,activeRun,numeric,signed,rankLabel,suitSymbol,unwrapCard,showdownValue,standardCardSpec,evaluatePoker,evaluateFourCardState,pokerStrength,handSummary,riverCandidateUniverse,createRiverCandidates,groupRiverCandidates,riverGroupText,riverSnapshotLines,riverHudText,createRiverSnapshot,captureRiverSnapshot,resolveRiverHit,applyRiverHitBonus,detectPerfectSet,createBreakdown,addAdditive,addMultiplier,addPerfectSetMultiplier,finalizeSide,createAttack,finalizeBreakdown,multiplierText,additiveText,attackTraceText,traceLines,snapshotBreakdown,cardLabel,advantageExtra,currentContractResolution,recordScoreTrigger,undoLegacyAdvantageScale,addActiveAdvantageMultipliers,syncAdvantageDiagnostics,animateBreakdown,clearShowdownSequence,resolveShowdownAttacks,archiveBreakdown,ensureRiverHud,syncRiverHud,resolveRuntimeShowdown,wrapPoker,wrapShowdown,wrapNextEnemy,wrapRenderBattle,installBrowser};
});