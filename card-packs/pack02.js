(function(root,factory){
  const effectApi=typeof module!=='undefined'?require('../effects.js'):root.CardEffects;
  const personality=typeof module!=='undefined'?require('../card-personality-runtime.js'):root.CardPersonalityRuntime;
  const value=factory(root,effectApi,personality);
  if(typeof module!=='undefined')module.exports=value;
  root.PACK02_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,effectApi,personality){
  const MEMORY_KEY='cardEffectMemory';

  function activeBattle(context={}){
    if(context?.battle)return context.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return root?.battle||null;
  }
  function currentSet(context={}){return Number(context.setIndex??context.set??context.battle?.setIndex??context.battle?.set??1)}
  function memoryFor(card){
    if(!card||typeof card!=='object')return null;
    if(!card[MEMORY_KEY]||typeof card[MEMORY_KEY]!=='object')card[MEMORY_KEY]={};
    return card[MEMORY_KEY];
  }
  function setMemory(card,key,value,context={}){
    if(!key)return null;
    const memory=memoryFor(card);if(!memory)return null;
    memory[key]={value:Number(value)||0,setIndex:currentSet(context)};
    return memory[key];
  }
  function getMemory(card,key,context={}){
    const entry=card?.[MEMORY_KEY]?.[key];if(!entry)return null;
    if(entry.setIndex!==undefined&&Number.isFinite(currentSet(context))&&entry.setIndex!==currentSet(context))return null;
    return entry;
  }
  function previousSlot(context={}){
    const index=Number(context.slotIndex);if(!Number.isInteger(index)||index<1)return null;
    const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots;
    return Array.isArray(slots)?slots[index-1]||null:null;
  }
  function showdownSuit(entry){const card=entry?.card||entry;return card?.showdownSuit??card?.printedSuit??card?.suit??null}
  function ensureAction(api,name,handler){
    if(!api?.ACTIONS||!api?.registerActionHandler)return false;
    if(!api.ACTIONS.includes(name))api.ACTIONS.push(name);
    api.registerActionHandler(name,handler);return true;
  }
  function installConditions(api){
    if(!api?.conditions)return false;
    api.conditions.effective_suit_is_trump=context=>{
      const suit=context?.trickSuit??context?.effectiveSuit??context?.card?.trickSuit??context?.card?.effectiveSuit??context?.card?.suit??null;
      const trump=context?.trump??context?.currentTrump??context?.battle?.trump??null;
      return!!trump&&suit===trump;
    };
    api.conditions.river_hit=context=>context?.riverHit?.active===true||context?.battle?.riverHit?.active===true||context?.showdown?.riverHit?.active===true;
    api.conditions.pure_cards_at_least=(context,effect)=>{
      const slots=Array.isArray(context?.slots)?context.slots:Array.isArray(context?.battle?.slots)?context.battle.slots:[];
      const needed=Math.max(1,Number(effect?.conditionValue)||1);
      const count=slots.reduce((sum,entry)=>{
        const card=entry?.card||entry;
        if(!card||typeof card!=='object'||card.named||card.definition||card.cardId)return sum;
        const effects=Array.isArray(card.effects)?card.effects:[];
        return sum+(effects.length===0?1:0);
      },0);
      return count>=needed;
    };
    if(typeof api.conditions.previous_showdown_slot_exists!=='function')api.conditions.previous_showdown_slot_exists=context=>!!previousSlot(context);
    return true;
  }
  function installActions(api){
    if(!api?.registerActionHandler)return false;
    ensureAction(api,'spend_all_chips',(context,_value,effect)=>{
      const state=activeBattle(context);if(!state)return null;
      const balance=Math.max(0,Number(state.chipEconomy?.balance??state.chip)||0);
      state.chip=0;if(state.chipEconomy)state.chipEconomy.balance=0;
      if(context.history&&typeof context.history==='object')context.history.chipsSpent=(Number(context.history.chipsSpent)||0)+balance;
      setMemory(context.card,effect.memoryKey||'spent_chips',balance,context);
      return balance;
    });
    ensureAction(api,'showdown_power_from_memory_multiplier',(context,value,effect)=>{
      const stored=getMemory(context.card,effect.memoryKey||'spent_chips',context)?.value??0;
      const bonus=stored*(Number(value)||0);
      if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);
      return bonus;
    });
    ensureAction(api,'copy_previous_showdown_suit',(context)=>{
      const suit=showdownSuit(previousSlot(context));if(!suit||!context.card)return null;
      context.card.showdownSuit=suit;return suit;
    });
    ensureAction(api,'randomize_trick_rank',(context,_value,effect)=>{
      const state=activeBattle(context),card=context.card;if(!state||!card)return null;
      const min=Math.max(2,Math.floor(Number(effect.minRank)||2)),max=Math.max(min,Math.floor(Number(effect.maxRank)||12));
      const rng=typeof context.random==='function'?context.random:Math.random;
      const roll=Math.min(max,min+Math.floor(Math.max(0,Math.min(.999999999999,Number(rng())||0))*(max-min+1)));
      const printed=Number(card.printedRank??card.rank);if(!Number.isFinite(printed))return null;
      if(!state.mods||typeof state.mods!=='object')state.mods={};
      state.mods.plus=(Number(state.mods.plus)||0)+(roll-printed);
      setMemory(card,effect.memoryKey||'random_rank',roll,context);
      return roll;
    });
    return true;
  }
  function ensurePersonalityRuntime(){
    if(typeof document==='undefined'||root.CardPersonalityRuntime||document.querySelector('script[data-trick-card-personality-runtime]'))return;
    const script=document.createElement('script');script.src='card-personality-runtime.js';script.async=false;script.dataset.trickCardPersonalityRuntime='true';document.head.appendChild(script);
  }

  installConditions(effectApi);
  installActions(effectApi);
  personality?.installEffects?.(effectApi,root);
  if(typeof document!=='undefined'){
    if(!effectApi)document.addEventListener('DOMContentLoaded',()=>{installConditions(root.CardEffects);installActions(root.CardEffects)},{once:true});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePersonalityRuntime,{once:true});else ensurePersonalityRuntime();
  }

  return [
    {
      id:'pack02.trump_signal',name:'트럼프 시그널',short:'트럼프 시그널',suit:'S',rank:8,
      description:'승리 — 최종 트릭 무늬가 현재 트럼프라면 칩 +2.',
      terms:['트럼프','트릭','칩'],image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_signal',
      effects:[{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_suit_is_trump',duration:'trick'}]
    },
    {
      id:'pack02.river_ticket',name:'리버 콜',short:'리버 콜',suit:'H',rank:5,
      description:'5번 슬롯 — 리버 적중 시 쇼다운 위력 +12. 4번째 트릭에 후보가 있었지만 빗나갔다면 -4. 후보가 없었다면 페널티 없음.',
      terms:['트릭','쇼다운','쇼다운 슬롯','최종 위력'],image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack02',art:'placeholder_ticket',
      effects:[
        {trigger:'on_showdown_score',action:'showdown_power',value:12,condition:'all',conditions:[{condition:'slot_is',conditionValue:5},{condition:'river_hit'}],duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power',value:-4,condition:'all',conditions:[{condition:'slot_is',conditionValue:5},{condition:'river_miss_with_candidates'}],duration:'set'}
      ]
    },
    {
      id:'pack02.clean_cut',name:'클래식 핸드',short:'클래식 핸드',suit:'D',rank:8,
      description:'쇼다운 — 순수 카드가 3장 이상이면 쇼다운 위력 +7.',
      terms:['쇼다운','순수','최종 위력'],image:'assets/cards/pack01/sharp_glass.png',packId:'pack02',art:'placeholder_clean',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:7,condition:'pure_cards_at_least',conditionValue:3,duration:'set'}]
    },
    {
      id:'pack02.afterburner',name:'라스트 스퍼트',short:'라스트 스퍼트',suit:'C',rank:7,
      description:'4번 슬롯 — 칩 +1. 5번 슬롯 — 칩 +2.',
      terms:['쇼다운 슬롯','칩'],image:'assets/cards/pack01/battery_1pct.png',packId:'pack02',art:'placeholder_afterburner',
      effects:[
        {trigger:'after_card_slotted',action:'gain_chips',value:1,condition:'slot_is',conditionValue:4,duration:'set'},
        {trigger:'after_card_slotted',action:'gain_chips',value:2,condition:'slot_is',conditionValue:5,duration:'set'}
      ]
    },
    {
      id:'pack02.first_strike',name:'선수필승',short:'선수필승',suit:'S',rank:9,
      description:'1번째 트릭 — 적용 숫자 +4. 그 트릭에서 승리했다면 적에게 피해 4. 이후 트릭에는 고유 효과가 없다.',
      terms:['트릭','적용 숫자','피해'],image:'assets/cards/pack01/black_bullet.png',packId:'pack02',art:'placeholder_first_strike',
      effects:[
        {trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'trick_is',conditionValue:1,duration:'trick'},
        {trigger:'on_trick_win',action:'damage_enemy',value:4,condition:'trick_is',conditionValue:1,duration:'trick'}
      ]
    },
    {
      id:'pack02.long_game',name:'복리',short:'복리',suit:'H',rank:11,
      description:'낼 때 — 지금까지의 이번 세트 트릭 승리 횟수를 기록. 쇼다운 — 기록이 1/2/3승 이상이면 위력 +2/+4/+8.',
      terms:['세트','트릭','쇼다운','최종 위력'],image:'assets/cards/pack01/phoenix.png',packId:'pack02',art:'placeholder_interest',
      effects:[
        {trigger:'on_play',action:'snapshot_set_wins',memoryKey:'set_wins_before_play',duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power_from_memory_tiers',memoryKey:'set_wins_before_play',tiers:[{atLeast:1,value:2},{atLeast:2,value:4},{atLeast:3,value:8}],duration:'set'}
      ]
    },
    {
      id:'pack02.advantage_settlement',name:'캐시아웃',short:'캐시아웃',suit:'D',rank:11,
      description:'쇼다운 — 명시적 우세가 활성화되어 있다면 쇼다운 위력 +10. 우세 배율은 별도로 적용된다.',
      terms:['우세','쇼다운','최종 위력'],image:'assets/cards/pack01/dirty_gambler.png',packId:'pack02',art:'placeholder_settlement',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:10,condition:'player_has_advantage',duration:'set'}]
    },
    {
      id:'pack02.trump_forge',name:'트럼프 포지',short:'트럼프 포지',suit:'C',rank:11,
      description:'낼 때 — 이번 트릭에 칩 손패 교환을 사용했다면 트릭 무늬를 현재 트럼프로 바꾸고 트릭 숫자 +2. 인쇄값과 쇼다운값은 유지.',
      terms:['칩','손패','트럼프','트릭값','인쇄값','쇼다운값'],image:'assets/cards/pack01/emergency_guard.png',packId:'pack02',art:'placeholder_forge',
      effects:[
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'chips_spent',duration:'trick'},
        {trigger:'on_play',action:'increase_next_trick_rank',value:2,condition:'chips_spent',duration:'trick'}
      ]
    },
    {
      id:'pack02.insurance_exchange',name:'교환 보험',short:'교환 보험',suit:'H',rank:12,
      description:'낼 때 — 이번 트릭에 칩 손패 교환을 사용했다면 보호막 6.',
      terms:['트릭','칩','손패','보호막'],image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_insurance',
      effects:[{trigger:'on_play',action:'gain_shield',value:6,condition:'chips_spent',duration:'battle'}]
    },
    {
      id:'pack02.originalist',name:'있는 그대로',short:'있는 그대로',suit:'D',rank:12,
      description:'승리 — 최종 트릭값이 인쇄값과 완전히 같다면 적에게 피해 4. 트럼프 보너스를 받았다면 조건을 만족하지 않는다.',
      terms:['인쇄값','트릭값','트릭','피해'],image:'assets/cards/pack01/ambush_observer.png',packId:'pack02',art:'placeholder_original',
      effects:[{trigger:'on_trick_win',action:'damage_enemy',value:4,condition:'unmodified_trick_value',duration:'trick'}]
    },
    {
      id:'pack02.advance_payment',name:'선지급',short:'선지급',suit:'S',rank:7,
      description:'승리 — 적에게 피해 6. 쇼다운 — 이 카드가 포함되어 있으면 위력 -5.',
      terms:['트릭','피해','쇼다운','최종 위력'],image:'assets/cards/pack01/black_bullet.png',packId:'pack02',art:'placeholder_advance_payment',
      effects:[
        {trigger:'on_trick_win',action:'damage_enemy',value:6,duration:'trick'},
        {trigger:'on_showdown_score',action:'showdown_power',value:-5,duration:'set'}
      ]
    },
    {
      id:'pack02.consolation_prize',name:'위로금',short:'위로금',suit:'H',rank:4,
      description:'패배 — 칩 +2. 무승부에는 발동하지 않는다.',
      terms:['트릭','패배','칩'],image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_consolation_prize',
      effects:[{trigger:'on_trick_loss',action:'gain_chips',value:2,duration:'trick'}]
    },
    {
      id:'pack02.last_word',name:'마지막 한 수',short:'마지막 한 수',suit:'D',rank:8,
      description:'5번 쇼다운 슬롯 — 쇼다운 위력 +9.',
      terms:['쇼다운 슬롯','쇼다운','최종 위력'],image:'assets/cards/pack01/ambush_observer.png',packId:'pack02',art:'placeholder_last_word',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:9,condition:'slot_is',conditionValue:5,duration:'set'}]
    },
    {
      id:'pack02.receipt',name:'영수증',short:'영수증',suit:'D',rank:2,
      description:'낼 때 — 보유 칩을 전부 소비하고 소비량을 기록. 쇼다운 — 기록한 칩 1개당 쇼다운 위력 +3. 칩이 0이면 보너스가 없다.',
      terms:['칩','소비','쇼다운','최종 위력'],image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_receipt',
      effects:[
        {trigger:'on_play',action:'spend_all_chips',memoryKey:'receipt_spent',duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power_from_memory_multiplier',value:3,memoryKey:'receipt_spent',duration:'set'}
      ]
    },
    {
      id:'pack02.mirror',name:'거울',short:'거울',suit:'H',rank:5,
      description:'낼 때 — 바로 이전 쇼다운 카드의 무늬를 복사한다. 숫자는 5 그대로이며 1번 슬롯에서는 효과가 없다.',
      terms:['쇼다운','쇼다운 슬롯','무늬','족보'],image:'assets/cards/pack01/recursive_function.png',packId:'pack02',art:'placeholder_mirror',
      effects:[{trigger:'on_play',action:'copy_previous_showdown_suit',condition:'previous_showdown_slot_exists',duration:'set'}]
    },
    {
      id:'pack02.loaded_die',name:'사기 주사위',short:'사기 주사위',suit:'C',rank:6,
      description:'낼 때 — 이번 트릭에서 트럼프 보너스 적용 전 숫자를 2~12 중 무작위 하나로 바꾼다. 쇼다운에서는 인쇄 숫자 6으로 계산한다.',
      terms:['트릭','적용 숫자','무작위','쇼다운','인쇄값'],image:'assets/cards/pack01/dirty_gambler.png',packId:'pack02',art:'placeholder_loaded_die',
      effects:[{trigger:'on_play',action:'randomize_trick_rank',minRank:2,maxRank:12,memoryKey:'loaded_die_roll',duration:'trick'}]
    }
  ];
});
