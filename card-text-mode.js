(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.CardTextMode=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const SUIT_SYMBOL=Object.freeze({S:'♠',H:'♥',D:'♦',C:'♣'});
  const RED_SUITS=new Set(['H','D']);
  const TRIGGER_LABELS=Object.freeze({
    on_play:'낼 때',on_set_start:'세트 시작',on_trick_start:'트릭 시작',before_compare:'비교 전',after_compare:'비교 후',on_trick_win:'승리',on_trick_loss:'패배',on_trick_draw:'무승부',after_card_slotted:'슬롯 배치',on_trick_end:'트릭 종료',before_showdown:'쇼다운 전',on_showdown_score:'쇼다운',after_showdown_result:'쇼다운 결과',on_set_end:'세트 종료',before_damage:'피해 전',after_damage:'피해 후'
  });
  const ACTION_LABELS=Object.freeze({
    damage_enemy:'피해',heal_player:'회복',gain_chips:'칩',spend_chips:'칩 소비',gain_shield:'보호막',apply_enemy_bleed:'출혈',increase_enemy_forecast:'예측',
    increase_effective_rank:'트릭 숫자',showdown_power:'쇼다운 위력',reserve_next_win_damage:'예약 피해',reserve_next_trick_comparison_reward:'다음 트릭 보상 예약',
    set_next_trick_suit_to_trump:'트릭 무늬→트럼프',increase_next_trick_rank:'트릭 숫자',draw_cards:'드로우',increase_forecast:'예측',
    set_reverse_compare:'숫자 비교 반전',set_last_showdown_suit_to_trump:'쇼다운 무늬→트럼프',increase_last_showdown_rank:'쇼다운 숫자',
    copy_previous_showdown_rank:'이전 쇼다운 숫자 복사',copy_previous_showdown_suit:'이전 쇼다운 무늬 복사',snapshot_set_wins:'승리 횟수 기록',showdown_power_from_memory_tiers:'기록별 쇼다운 위력',showdown_power_from_memory_multiplier:'기록 비례 쇼다운 위력',discard_selected_card:'카드 버림',discard_secondary_target:'다른 손패 버림',grant_next_trick_hand_capacity:'다음 트릭 손패',reveal_next_enemy_card:'다음 적 카드 공개',spend_all_chips:'칩 전부 소비',randomize_trick_rank:'트릭 숫자 무작위',apply_status:'상태 부여',remove_status:'상태 제거',add_reservation:'예약 생성'
  });
  const COMPACT_TEXT=Object.freeze({
    'pack01.recursive_function':{trigger:'승리',summary:'직전 효과 카드의 복사 가능한 수치 효과 1회 복사'},
    'pack01.black_bullet':{trigger:'승리',summary:'피해 4 · 5번 슬롯에서 승리하면 추가 피해 4'},
    'core.burn':{trigger:'낼 때',summary:'다른 손패 1장 버림 · 칩 +1 · 드로우 +1'},
    'core.plus2':{trigger:'낼 때',summary:'이번 트릭 적용 숫자 +3'},
    'core.double':{trigger:'낼 때',summary:'칩 1 소비 · 트릭 숫자 +5 · 승리하면 칩 +2'}
  });
  let enabled=true;
  let installed=false;
  let originalArtHtml=null;

  function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({"&":'&amp;',"<":'&lt;',">":'&gt;',"\"":'&quot;',"'":'&#39;'}[char]))}
  function rankLabel(rank){return({11:'J',12:'Q',13:'K',14:'A'}[rank]||String(rank??''))}
  function printedSuit(card){return card?.printedSuit||card?.suit||'S'}
  function printedRank(card){return card?.printedRank??card?.rank??''}
  function definition(card){return card?.definition||card?.named||null}
  function cardName(card){const def=definition(card);return def?.name||card?.name||card?.title||card?.short||''}
  function effectList(card){if(Array.isArray(card?.effects))return card.effects;const def=definition(card);return Array.isArray(def?.effects)?def.effects:[]}
  function shouldUseTextFace(card){return!!card&&(!!definition(card)||!!cardName(card)||effectList(card).length>0)}
  function signed(value){const number=Number(value);return Number.isFinite(number)?`${number>0?'+':''}${number}`:''}
  function conditionValue(effect){return effect?.conditionValue??effect?.value??''}
  function oneConditionText(condition,effect){
    const value=conditionValue(effect);
    if(!condition||condition==='all')return'';
    if(condition==='chips_spent')return'교환 사용 시';
    if(condition==='chips_at_least')return`칩 ${value}+면`;
    if(condition==='effective_rank_at_most')return`적용 ${value}↓면`;
    if(condition==='effective_suit_is_trump')return'트럼프면';
    if(condition==='printed_suit_is_trump')return'인쇄 무늬가 트럼프면';
    if(condition==='printed_suit_is_not_trump')return'인쇄 무늬가 비트럼프면';
    if(condition==='river_hit')return'리버 적중 시';
    if(condition==='river_miss_with_candidates')return'리버 실패 시';
    if(condition==='slot_is')return`${value}번 슬롯`;
    if(condition==='slot_at_least')return`${value}번 슬롯 이후`;
    if(condition==='previous_showdown_slot_exists')return'이전 슬롯 있으면';
    if(condition==='previous_showdown_slot_is_pure')return'이전 슬롯 순수면';
    if(condition==='pure_cards_at_least')return`순수 ${value}장+면`;
    if(condition==='in_hand')return'손패에 있으면';
    if(condition==='player_has_advantage')return'우세면';
    if(condition==='enemy_has_advantage')return'적 우세면';
    if(condition==='set_wins_at_least')return`${value}승+면`;
    if(condition==='pure_card_in_hand')return'손패에 순수 카드가 있으면';
    if(condition==='pure_card_in_showdown')return'쇼다운에 순수 카드가 있으면';
    if(condition==='printed_equals_trick'||condition==='unmodified_trick_value')return'인쇄값 그대로면';
    if(condition==='card_memory_at_least')return`기록 ${value}+면`;
    if(condition==='player_hp_ratio_at_most'){const ratio=Number(value);return`체력 ${Number.isFinite(ratio)?Math.round(ratio*100):value}%↓면`}
    if(condition==='enemy_has_status')return`적 ${effect?.statusId||effect?.status||'상태'} 보유 시`;
    if(condition==='trick_is')return`${value}번째 트릭`;
    if(condition==='player_shield_at_least')return`보호막 ${value}+면`;
    if(condition==='same_suit')return'같은 무늬면';
    return'';
  }
  function conditionText(effect){
    const nested=Array.isArray(effect?.conditions)?effect.conditions:[];
    const rows=[];
    if(effect?.condition&&effect.condition!=='all')rows.push(oneConditionText(effect.condition,effect));
    for(const item of nested){
      if(typeof item==='string')rows.push(oneConditionText(item,effect));
      else rows.push(oneConditionText(item?.condition,item||effect));
    }
    return rows.filter(Boolean).join('·');
  }
  function actionText(effect){
    const value=Number(effect?.value),plus=Number.isFinite(value)?signed(value):'';
    switch(effect?.action){
      case'damage_enemy':return`피해 ${Math.abs(value)||0}`;
      case'heal_player':return`회복 ${Math.abs(value)||0}`;
      case'gain_chips':return`칩 ${plus||'+0'}`;
      case'spend_chips':return`칩 -${Math.abs(value)||0}`;
      case'gain_shield':return`보호막 ${plus||'+0'}`;
      case'apply_enemy_bleed':return`출혈 ${Math.abs(value)||0}`;
      case'increase_enemy_forecast':case'increase_forecast':return`예측 ${plus||'+0'}`;
      case'increase_effective_rank':case'increase_next_trick_rank':return`트릭 숫자 ${plus}`;
      case'showdown_power':return`쇼다운 ${plus}`;
      case'reserve_next_win_damage':return`다음 승리 피해 ${Math.abs(value)||0} 예약`;
      case'reserve_next_trick_comparison_reward':return effect?.rewardAction==='gain_chips'?`다음 비교 보상 칩 +${Math.abs(Number(effect?.value)||1)}`:'다음 비교 보상 예약';
      case'set_next_trick_suit_to_trump':return'무늬→트럼프';
      case'draw_cards':return`드로우 +${Math.abs(value)||1}`;
      case'set_reverse_compare':return'낮은 숫자 승리';
      case'set_last_showdown_suit_to_trump':return'쇼다운 무늬→트럼프';
      case'increase_last_showdown_rank':return`쇼다운 숫자 ${plus}`;
      case'copy_previous_showdown_rank':return'이전 쇼다운 숫자 복사';
      case'copy_previous_showdown_suit':return'이전 쇼다운 무늬 복사';
      case'snapshot_set_wins':return'승리 횟수 기록';
      case'showdown_power_from_memory_tiers':{
        const tiers=Array.isArray(effect?.tiers)?effect.tiers:[];
        if(tiers.length)return`기록 ${tiers.map(row=>row.atLeast).join('/')}→${tiers.map(row=>signed(row.value)).join('/')}`;
        return'기록별 쇼다운 보너스';
      }
      case'showdown_power_from_memory_multiplier':return`기록×${Number(effect?.value)||0} 쇼다운`;
      case'discard_selected_card':case'discard_secondary_target':return'다른 손패 1장 버림';
      case'grant_next_trick_hand_capacity':return`다음 손패 +${Math.abs(value)||1}`;
      case'reveal_next_enemy_card':return'다음 적 카드 공개';
      case'spend_all_chips':return'칩 전부 소비';
      case'randomize_trick_rank':return`트릭 숫자 ${Number(effect?.minRank)||2}~${Number(effect?.maxRank)||12} 무작위`;
      case'apply_status':return`${effect?.statusId||effect?.status||'상태'} ${plus||''}`.trim();
      case'remove_status':return`${effect?.statusId||effect?.status||'상태'} 제거`;
      case'add_reservation':return'예약 생성';
      default:return'';
    }
  }
  function effectPhrase(effect,{includeTrigger=false}={}){
    const action=actionText(effect);if(!action)return'';
    const condition=conditionText(effect),trigger=TRIGGER_LABELS[effect?.trigger]||'';
    return`${includeTrigger&&trigger?`${trigger}·`:''}${condition?`${condition} `:''}${action}`.trim();
  }
  function descriptionSummary(card){
    const def=definition(card),raw=String(def?.description||def?.text||'').replace(/(?:발동|조건|효과|추가)\s*:/g,'').replace(/\s+/g,' ').trim();
    if(!raw)return'';
    const clauses=raw.split(/(?<=[.!?])\s+|\s*\/\s*/).map(row=>row.trim()).filter(Boolean);
    return clauses.join(' ');
  }
  function structuredEffectSummary(card){
    const effects=effectList(card);if(!effects.length)return'';
    const known=effects.map(effect=>({effect,action:actionText(effect)}));
    if(known.some(row=>!row.action))return'';
    const triggers=[...new Set(effects.map(effect=>TRIGGER_LABELS[effect?.trigger]||'').filter(Boolean))];
    const includeTrigger=triggers.length>1;
    return effects.map(effect=>effectPhrase(effect,{includeTrigger})).filter(Boolean).join(' · ');
  }
  function summarizeEffects(card){return structuredEffectSummary(card)||descriptionSummary(card)}
  function compactTrigger(card){
    const def=definition(card),activation=def?.activation||'';
    if(activation.includes('승리'))return'승리';if(activation.includes('쇼다운'))return'쇼다운';if(activation.includes('트릭 종료'))return'트릭 종료';if(activation.includes('낼 때')||activation.includes('사용'))return'낼 때';
    const triggers=[...new Set(effectList(card).map(effect=>TRIGGER_LABELS[effect?.trigger]||'').filter(Boolean))];
    return triggers.length===1?triggers[0]:triggers.length>1?'복합':'';
  }
  function buildCardCompactText(card){const def=definition(card),key=card?.cardId||def?.id,known=COMPACT_TEXT[key]||COMPACT_TEXT[cardName(card)];return{title:cardName(card)||'효과 카드',trigger:known?.trigger||compactTrigger(card),summary:known?.summary||summarizeEffects(card)}}
  function fullEffectText(card){const def=definition(card);return String(def?.description||def?.text||card?.description||card?.text||'').trim()}
  function densityClass(summary){const length=[...String(summary||'')].length;return length>72?' cardTextEffect--dense':length>48?' cardTextEffect--compact':''}
  function fallbackPureFace(card){const suit=printedSuit(card),sym=SUIT_SYMBOL[suit]||'',rank=rankLabel(printedRank(card)),red=RED_SUITS.has(suit);return`<span class="textPureFallback ${red?'redSuit':''}"><span>${escapeHtml(rank)}</span><b>${escapeHtml(sym)}</b><span class="textPureFallbackBottom">${escapeHtml(rank)} ${escapeHtml(sym)}</span></span>`}
  function textCardFace(card,variant='hand'){
    const suit=printedSuit(card),sym=SUIT_SYMBOL[suit]||'',rank=rankLabel(printedRank(card)),preview=buildCardCompactText(card),mini=variant==='mini',red=RED_SUITS.has(suit),full=fullEffectText(card),density=densityClass(preview.summary);
    return`<span class="cardTextOnlyFace cardTextOnlyFace--${escapeHtml(variant)} ${red?'redSuit':''}" role="img" aria-label="${escapeHtml(`${preview.title} ${sym}${rank}${full?` · ${full}`:''}`)}"${full?` data-full-effect="${escapeHtml(full)}"`:''}>
      <span class="cardTextIndex cardTextIndexTop"><b>${escapeHtml(rank)}</b><i>${escapeHtml(sym)}</i></span>
      <span class="cardTextSuitWatermark" aria-hidden="true">${escapeHtml(sym)}</span>
      <span class="cardTextBody"><strong class="cardTextTitle">${escapeHtml(preview.title)}</strong>${!mini&&preview.trigger?`<small class="cardTextTrigger">${escapeHtml(preview.trigger)}</small>`:''}${!mini&&preview.summary?`<small class="cardTextEffect${density}">${escapeHtml(preview.summary)}</small>`:''}</span>
      <span class="cardTextDivider" aria-hidden="true"></span><span class="cardTextDiamond" aria-hidden="true">◇</span>
      <span class="cardTextIndex cardTextIndexBottom"><b>${escapeHtml(rank)}</b><i>${escapeHtml(sym)}</i></span>
    </span>`;
  }
  function renderCardFace(card,variant='hand'){
    if(!enabled&&originalArtHtml)return originalArtHtml(card);
    if(!shouldUseTextFace(card)){if(typeof root.pureCardSvg==='function')return root.pureCardSvg(card);if(originalArtHtml)return originalArtHtml(card);return fallbackPureFace(card)}
    return textCardFace(card,variant);
  }
  function injectStyles(){
    if(document.querySelector('style[data-card-text-only-style]'))return;
    const style=document.createElement('style');style.dataset.cardTextOnlyStyle='true';style.textContent=`
      .cardTextOnlyFace,.textPureFallback{position:relative;display:block;width:100%;height:100%;aspect-ratio:100/148;overflow:hidden;container-type:inline-size;container-name:cardface;border-radius:7px;background:#f3ead5;color:#2b2e34;box-shadow:inset 0 0 0 2px #c69a43,inset 0 0 0 5px #efe1c4}
      .cardTextOnlyFace:before{content:"";position:absolute;inset:7px;border:1px solid #d8bd82;border-radius:4px;pointer-events:none}
      .cardTextOnlyFace.redSuit{color:#b94758}.cardTextIndex{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;line-height:.9;font-family:Arial,sans-serif;font-style:normal}.cardTextIndex b{font-size:14px}.cardTextIndex i{font-size:13px;font-style:normal;margin-top:3px}.cardTextIndexTop{left:10px;top:10px}.cardTextIndexBottom{right:10px;bottom:10px;transform:rotate(180deg)}
      .cardTextSuitWatermark{position:absolute;z-index:0;left:50%;top:50%;transform:translate(-50%,-52%);font-family:Arial,sans-serif;font-size:52cqw;line-height:1;opacity:.055;color:currentColor;pointer-events:none}
      .cardTextBody{position:absolute;z-index:2;left:11%;right:11%;top:21%;bottom:20%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3%;text-align:center;color:#262a31;font-family:Arial,sans-serif;overflow:hidden}
      .cardTextTitle{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-width:100%;font-size:12px;font-size:clamp(9px,12cqw,16px);line-height:1.1;word-break:keep-all;overflow-wrap:anywhere;font-weight:800;letter-spacing:-.02em}
      .cardTextTrigger{display:block;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:clip;font-size:clamp(6.2px,6.8cqw,9px);line-height:1.15;color:#806d4a;font-weight:700;word-break:keep-all}
      .cardTextEffect{display:block;max-width:100%;font-size:clamp(6.4px,7.1cqw,9.6px);line-height:1.18;color:#5a5650;word-break:keep-all;overflow-wrap:anywhere}
      .cardTextEffect--compact{font-size:clamp(5.9px,6.5cqw,8.7px);line-height:1.14}.cardTextEffect--dense{font-size:clamp(5.3px,5.8cqw,7.8px);line-height:1.1}
      .stageInner .cardTextBody{top:20%;bottom:19%}.stageInner .cardTextEffect{font-size:clamp(6px,6.7cqw,9px)}
      .slotArt .cardTextBody{top:25%;bottom:23%}.slotArt .cardTextTitle{-webkit-line-clamp:2}.slotArt .cardTextTrigger,.slotArt .cardTextEffect{display:none}
      .cardTextDivider{position:absolute;z-index:1;left:32%;right:32%;bottom:15%;height:1px;background:#cbb17a}.cardTextDiamond{position:absolute;z-index:2;left:50%;bottom:10.5%;transform:translateX(-50%);font-size:9px;color:#b38e48;background:#f3ead5;padding:0 2px}
      .textPureFallback{display:grid;place-items:center;font-family:Arial,sans-serif;font-size:22px}.textPureFallback>b{font-size:38px}.textPureFallbackBottom{position:absolute;right:9px;bottom:9px;transform:rotate(180deg);font-size:12px}.textPureFallback.redSuit{color:#b94758}
      @container cardface (max-width:72px){.cardTextBody{left:12%;right:12%;top:20%;bottom:17%;gap:2%}.cardTextTitle{font-size:8.2px;line-height:1.05}.cardTextTrigger{font-size:5.3px}.cardTextEffect{display:block;font-size:5px;line-height:1.04}.cardTextEffect--compact{font-size:4.7px}.cardTextEffect--dense{font-size:4.35px}.cardTextIndex b{font-size:10px}.cardTextIndex i{font-size:9px}.cardTextIndexTop{left:7px;top:7px}.cardTextIndexBottom{right:7px;bottom:7px}.cardTextDivider,.cardTextDiamond{display:none}}
    `;(document.head||document.documentElement).appendChild(style);
  }
  function currentBattle(){try{return typeof battle!=='undefined'?battle:root.battle}catch(_error){return root.battle||null}}
  function refresh(){try{if(typeof root.renderBattle==='function'&&currentBattle())root.renderBattle()}catch(_error){}}
  function install(){
    if(installed)return true;if(typeof root.artHtml!=='function')return false;injectStyles();originalArtHtml=root.artHtml;
    root.artHtml=function(card,variant){return renderCardFace(card,variant)};root.artHtml.__textOnlyMode=true;installed=true;refresh();return true;
  }
  function installWhenReady(){
    if(typeof document==='undefined')return false;
    const attempt=()=>{if(install())return;setTimeout(()=>{if(!install())console.warn('[card-text-mode] 카드 렌더러를 찾지 못했습니다.')},0)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function setEnabled(value){enabled=!!value;if(installed)refresh();return enabled}
  function isEnabled(){return enabled}
  return{SUIT_SYMBOL,RED_SUITS,TRIGGER_LABELS,ACTION_LABELS,COMPACT_TEXT,escapeHtml,rankLabel,cardName,effectList,shouldUseTextFace,conditionText,actionText,effectPhrase,structuredEffectSummary,descriptionSummary,summarizeEffects,compactTrigger,buildCardCompactText,fullEffectText,densityClass,textCardFace,renderCardFace,install,installWhenReady,setEnabled,isEnabled};
});
