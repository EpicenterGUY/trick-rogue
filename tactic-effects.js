(function(root,factory){
  const effects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const api=factory(effects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.TacticEffects=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,root){
  const TACTIC_EFFECTS=Object.freeze({
    paint:Object.freeze({effects:Object.freeze([{action:'set_next_trick_suit_to_trump'}]),feedback:{mode:'flash',text:'페인트'}}),
    plus2:Object.freeze({effects:Object.freeze([{action:'increase_next_trick_rank',value:2}]),feedback:{text:'숫자 +2',tone:'cyan'}}),
    draw:Object.freeze({effects:Object.freeze([{action:'draw_cards',value:1}]),feedback:{text:'카드 +1',tone:'cyan'}}),
    scout:Object.freeze({effects:Object.freeze([{action:'increase_forecast',value:1}]),feedback:{text:'예측 +1',tone:'violet'}}),
    double:Object.freeze({effects:Object.freeze([]),feedback:{text:'현재 효과 없음',tone:'violet'},needsRework:'advantage-v2'}),
    barrier:Object.freeze({effects:Object.freeze([{action:'gain_shield',value:3}]),feedback:{text:'보호막 +3',tone:'cyan'}}),
    burn:Object.freeze({requirements:Object.freeze(['selected_card']),effects:Object.freeze([{action:'discard_selected_card'},{action:'gain_chips',value:1},{action:'draw_cards',value:1}]),feedback:{text:'번 · 칩 +1',tone:'gold'}}),
    reverse:Object.freeze({effects:Object.freeze([{action:'set_reverse_compare'}]),feedback:{mode:'flash',text:'리버스'}}),
    pureboost:Object.freeze({effects:Object.freeze([{action:'increase_next_trick_rank',value:2}]),feedback:{text:'순수 보정 +2',tone:'cyan'},needsRework:'pure-unification'}),
    clean:Object.freeze({effects:Object.freeze([{action:'gain_chips',value:1}]),feedback:{text:'무첨가 · 칩 +1',tone:'green'},needsRework:'pure-unification'}),
    recolor:Object.freeze({effects:Object.freeze([{action:'set_last_showdown_suit_to_trump'}]),feedback:{text:'쇼다운 무늬 변경',tone:'violet'}}),
    fakeid:Object.freeze({effects:Object.freeze([{action:'increase_last_showdown_rank',value:1}]),feedback:{text:'쇼다운 숫자 +1',tone:'gold'}})
  });
  const TACTIC_CARD_MIGRATION_BLOCKERS=Object.freeze({
    startingPackages:'시작 패키지가 아직 레거시 전술 ID 목록을 직접 참조하므로 일반 카드 시작 구성으로 바꿔야 한다.',
    namedDependencies:'황금손의 전술 드로우와 재귀 함수의 전술 드로우 복사 범위가 레거시 전술 덱에 의존한다.',
    legacyBattleState:'전투 상태의 tdeck/thand/tdisc와 전술 드로어 UI, useTactic 호환 경로가 아직 남아 있다.'
  });
  const REQUIREMENTS=Object.freeze({
    selected_card:context=>!!context.selectedCard
  });
  const REQUIREMENT_MESSAGES=Object.freeze({selected_card:'먼저 카드 선택'});

  function definition(id){return TACTIC_EFFECTS[id]||null}
  function migrationStatus(){
    return Object.freeze({
      ready:false,
      cardMigrationReady:true,
      activatedCardCount:12,
      tacticIds:Object.freeze(Object.keys(TACTIC_EFFECTS)),
      blockers:TACTIC_CARD_MIGRATION_BLOCKERS,
      dependentCardIds:Object.freeze(['pack01.golden_hand','pack01.recursive_function'])
    });
  }
  function validateDefinitions(){
    const errors=[];
    for(const [id,entry] of Object.entries(TACTIC_EFFECTS)){
      for(const requirement of entry.requirements||[])if(!REQUIREMENTS[requirement])errors.push(`${id}: unknown requirement ${requirement}`);
      for(const effect of entry.effects||[])if(effect.action&&!CardEffects.ACTIONS.includes(effect.action))errors.push(`${id}: unknown action ${effect.action}`);
    }
    return errors;
  }
  function canRun(id,context){
    const entry=definition(id);if(!entry)return{ok:false,reason:'알 수 없는 전술'};
    for(const requirement of entry.requirements||[])if(!REQUIREMENTS[requirement](context))return{ok:false,reason:REQUIREMENT_MESSAGES[requirement]||'사용 조건 불충족'};
    return{ok:true};
  }
  function runTactic(id,context){
    const check=canRun(id,context);if(!check.ok)return check;
    const entry=definition(id);
    return{ok:true,executed:CardEffects.runEffectList(entry.effects,context),definition:entry};
  }
  function browserContext(){
    const selectedCard=battle?.hand?.find(card=>card.uid===battle.selected)||null;
    const lastSlot=battle?.slots?.length?battle.slots[battle.slots.length-1]:null;
    let failure=null;
    return{
      selectedCard,lastSlot,history:battle.history,mods:battle.mods,currentTrump:battle.trump,
      fail(message){failure=message},
      get failure(){return failure},
      perform(action,value,effect={}){
        if(action==='set_next_trick_suit_to_trump'){battle.mods.paint=true;return}
        if(action==='increase_next_trick_rank'){battle.mods.plus+=value||0;return}
        if(action==='draw_cards'){drawP(value||1);return}
        if(action==='increase_forecast'){battle.myForecast=Math.min(3,battle.myForecast+(value||0));battle.enemyForecast=Math.min(3,battle.enemyForecast+(value||0));return}
        if(action==='gain_chips'){battle.chip=Math.min(9,battle.chip+(value||0));return}
        if(action==='gain_shield'){battle.statuses.player.shield+=value||0;return}
        if(action==='set_reverse_compare'){battle.mods.reverse=true;return}
        if(action==='set_last_showdown_suit_to_trump'){
          const slot=battle.slots[battle.slots.length-1];if(!slot){failure='슬롯 없음';return}slot.card.showdownSuit=battle.trump;return
        }
        if(action==='increase_last_showdown_rank'){
          const slot=battle.slots[battle.slots.length-1];if(!slot){failure='슬롯 없음';return}slot.card.showdownRank=Math.min(14,root.BattleCore.showdownValue(slot.card,'Rank')+(value||0));return
        }
        if(action==='discard_selected_card'){
          const index=battle.hand.findIndex(card=>card.uid===battle.selected);if(index<0){failure='먼저 카드 선택';return}battle.discard.push(battle.hand.splice(index,1)[0]);battle.selected=null;return
        }
        throw new TypeError(`Unsupported tactic action in browser adapter: ${action}`);
      }
    };
  }
  function emitFeedback(entry,context){
    if(context.failure){floatText(arena,context.failure,'red');return}
    const feedback=entry.feedback;if(!feedback)return;
    if(feedback.mode==='flash')flash(feedback.text);else floatText(arena,feedback.text,feedback.tone||'cyan');
  }
  function installBrowserAdapter(){
    if(typeof battle==='undefined'||typeof root.useTactic!=='function')return false;
    if(root.useTactic.__commonEffectAdapter)return true;
    const legacyUseTactic=root.useTactic;
    const migrated=function(uid){
      if(!battle||battle.animating||battle.tacticUsing)return;
      const index=battle.thand.findIndex(tactic=>tactic.uid===uid);if(index<0)return;
      const tactic=battle.thand[index],entry=definition(tactic.id);if(!entry)return legacyUseTactic(uid);
      const context=browserContext(),check=canRun(tactic.id,context);
      if(!check.ok){floatText(arena,check.reason,'cyan');return}
      if(battle.chip<tactic.cost){floatText(arena,'칩 부족','red');sfx('lose');return}
      battle.tacticUsing=true;
      try{
        battle.chip-=tactic.cost;
        battle.history.effectsUsed=true;
        battle.history.effectUseCount++;
        battle.history.tacticsUsed=true;
        battle.history.tacticUseCount++;
        battle.history.chipsSpent+=tactic.cost;
        battle.tdisc.push(battle.thand.splice(index,1)[0]);
        battle.selectedTactic=null;
        sfx('click');
        const result=runTactic(tactic.id,context);
        if(result.ok)emitFeedback(entry,context);
        battle.tacticsOpen=false;
        renderBattle();
      }catch(error){
        console.error('[tactic-effects] 전술 실행 실패',tactic.id,error);
        floatText(arena,'전술 처리 오류','red');
      }finally{battle.tacticUsing=false}
    };
    migrated.__commonEffectAdapter=true;
    migrated.__legacyUseTactic=legacyUseTactic;
    root.useTactic=migrated;
    return true;
  }
  function installWhenReady(){
    const install=()=>{const errors=validateDefinitions();if(errors.length){console.error('[tactic-effects] 정의 오류',errors);return}installBrowserAdapter()};
    if(typeof document==='undefined')return false;
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else setTimeout(install,0);
    return true;
  }
  return{TACTIC_EFFECTS,TACTIC_CARD_MIGRATION_BLOCKERS,REQUIREMENTS,definition,migrationStatus,validateDefinitions,canRun,runTactic,installBrowserAdapter,installWhenReady};
});
