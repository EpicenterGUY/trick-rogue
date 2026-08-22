(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.CardTextMode=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const SUIT_SYMBOL=Object.freeze({S:'♠',H:'♥',D:'♦',C:'♣'});
  const RED_SUITS=new Set(['H','D']);
  const ACTION_LABELS=Object.freeze({
    damage_enemy:'피해',heal_player:'회복',gain_chips:'칩',gain_shield:'보호막',apply_enemy_bleed:'출혈',increase_enemy_forecast:'예측',
increase_effective_rank:'트릭 숫자',showdown_power:'쇼다운 위력',reserve_next_win_damage:'예약 피해',
    set_next_trick_suit_to_trump:'트릭 무늬→트럼프',increase_next_trick_rank:'트릭 숫자',draw_cards:'드로우',increase_forecast:'예측',
    set_reverse_compare:'숫자 비교 반전',set_last_showdown_suit_to_trump:'쇼다운 무늬→트럼프',increase_last_showdown_rank:'쇼다운 숫자',discard_selected_card:'카드 버림'
  });
  const COMPACT_TEXT=Object.freeze({
    'pack01.recursive_function':{trigger:'승리 시',summary:'직전 네임드의 복사 가능한 수치 효과 1회 복사'},
    'pack01.black_bullet':{trigger:'승리 시',summary:'피해 3 · 쇼다운 위력 +4'},
    'core.burn':{trigger:'낼 때',summary:'손패 1장 버리고 칩 +1, 카드 1장 뽑기'},
    'core.plus2':{trigger:'낼 때',summary:'이 카드의 트릭 숫자 +2'},
    'core.double':{trigger:'쇼다운 계산 시',summary:'우세 무늬 2개 이상이면 쇼다운 위력 +6'}
  });
  let enabled=true;
  let installed=false;
  let originalArtHtml=null;

  function escapeHtml(value=''){
    return String(value).replace(/[&<>"']/g,char=>({"&":'&amp;',"<":'&lt;',">":'&gt;',"\"":'&quot;',"'":'&#39;'}[char]));
  }
  function rankLabel(rank){return({11:'J',12:'Q',13:'K',14:'A'}[rank]||String(rank??''))}
  function printedSuit(card){return card?.printedSuit||card?.suit||'S'}
  function printedRank(card){return card?.printedRank??card?.rank??''}
  function definition(card){return card?.definition||card?.named||null}
  function cardName(card){
    const def=definition(card);
    return def?.name||card?.name||card?.title||card?.short||'';
  }
  function effectList(card){
    if(Array.isArray(card?.effects))return card.effects;
    const def=definition(card);
    return Array.isArray(def?.effects)?def.effects:[];
  }
  function shouldUseTextFace(card){
    return !!card&&(!!definition(card)||!!cardName(card)||effectList(card).length>0);
  }
  function compact(text,max=46){
    const normalized=String(text||'').replace(/\s+/g,' ').trim();
    if(normalized.length<=max)return normalized;
    const words=normalized.split(' '),kept=[];
    for(const word of words){if([...kept,word].join(' ').length>max)break;kept.push(word)}
    return kept.length?kept.join(' '):normalized.slice(0,max);
  }
  function summarizeEffects(card){
    if(typeof root.shortEffect==='function'){
      try{
        const summary=root.shortEffect(card);
        if(summary&&!/^효과 없음/.test(summary))return compact(summary,62);
      }catch(_error){}
    }
    const def=definition(card);
    if(def?.description){
      const cleaned=String(def.description).replace(/(?:발동|조건|효과|추가)\s*:/g,'').replace(/\s+/g,' ').trim();
      if(cleaned)return compact(cleaned,62);
    }
    const parts=[];
    for(const effect of effectList(card).slice(0,2)){
      const label=ACTION_LABELS[effect.action]||'';
      if(!label)continue;
      const value=Number.isFinite(effect.value)?` ${effect.value>0?'+':''}${effect.value}`:'';
      parts.push(`${label}${value}`);
    }
    return compact(parts.join(' · '),62);
  }
  function compactTrigger(card){
    const def=definition(card),activation=def?.activation||'';
    if(activation.includes('승리'))return '승리 시';
    if(activation.includes('쇼다운'))return '쇼다운 계산 시';
    if(activation.includes('트릭 종료'))return '트릭 종료 시';
    if(activation.includes('낼 때')||activation.includes('사용'))return '낼 때';
    return ({on_play:'낼 때',on_trick_win:'승리 시',on_trick_end:'트릭 종료 시',on_showdown_score:'쇼다운 계산 시',after_card_slotted:'슬롯 배치 시'})[effectList(card)[0]?.trigger]||'';
  }
  function buildCardCompactText(card){
    const def=definition(card),key=card?.cardId||def?.id,known=COMPACT_TEXT[key]||COMPACT_TEXT[cardName(card)];
    return {title:cardName(card)||'효과 카드',trigger:known?.trigger||compactTrigger(card),summary:known?.summary||summarizeEffects(card)};
  }
  function fallbackPureFace(card){
    const suit=printedSuit(card),sym=SUIT_SYMBOL[suit]||'',rank=rankLabel(printedRank(card)),red=RED_SUITS.has(suit);
    return `<span class="textPureFallback ${red?'redSuit':''}"><span>${escapeHtml(rank)}</span><b>${escapeHtml(sym)}</b><span class="textPureFallbackBottom">${escapeHtml(rank)} ${escapeHtml(sym)}</span></span>`;
  }
  function textCardFace(card,variant='hand'){
    const suit=printedSuit(card),sym=SUIT_SYMBOL[suit]||'',rank=rankLabel(printedRank(card)),preview=buildCardCompactText(card);
    const mini=variant==='mini',red=RED_SUITS.has(suit);
    return `<span class="cardTextOnlyFace cardTextOnlyFace--${escapeHtml(variant)} ${red?'redSuit':''}" role="img" aria-label="${escapeHtml(`${preview.title} ${sym}${rank}`)}">
      <span class="cardTextIndex cardTextIndexTop"><b>${escapeHtml(rank)}</b><i>${escapeHtml(sym)}</i></span>
      <span class="cardTextSuitWatermark" aria-hidden="true">${escapeHtml(sym)}</span>
      <span class="cardTextBody"><strong class="cardTextTitle">${escapeHtml(preview.title)}</strong>${!mini&&preview.trigger?`<small class="cardTextTrigger">${escapeHtml(preview.trigger)}</small>`:''}${!mini&&preview.summary?`<small class="cardTextEffect">${escapeHtml(preview.summary)}</small>`:''}</span>
      <span class="cardTextDivider" aria-hidden="true"></span><span class="cardTextDiamond" aria-hidden="true">◇</span>
      <span class="cardTextIndex cardTextIndexBottom"><b>${escapeHtml(rank)}</b><i>${escapeHtml(sym)}</i></span>
    </span>`;
  }
  function renderCardFace(card,variant='hand'){
    if(!enabled&&originalArtHtml)return originalArtHtml(card);
    if(!shouldUseTextFace(card)){
      if(typeof root.pureCardSvg==='function')return root.pureCardSvg(card);
      if(originalArtHtml)return originalArtHtml(card);
      return fallbackPureFace(card);
    }
    return textCardFace(card,variant);
  }
  function injectStyles(){
    if(document.querySelector('style[data-card-text-only-style]'))return;
    const style=document.createElement('style');
    style.dataset.cardTextOnlyStyle='true';
    style.textContent=`
      .cardTextOnlyFace,.textPureFallback{position:relative;display:block;width:100%;height:100%;aspect-ratio:100/148;overflow:hidden;container-type:inline-size;container-name:cardface;border-radius:7px;background:#f3ead5;color:#2b2e34;box-shadow:inset 0 0 0 2px #c69a43,inset 0 0 0 5px #efe1c4}
      .cardTextOnlyFace:before{content:"";position:absolute;inset:7px;border:1px solid #d8bd82;border-radius:4px;pointer-events:none}
      .cardTextOnlyFace.redSuit{color:#b94758}.cardTextIndex{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;line-height:.9;font-family:Arial,sans-serif;font-style:normal}.cardTextIndex b{font-size:14px}.cardTextIndex i{font-size:13px;font-style:normal;margin-top:3px}.cardTextIndexTop{left:10px;top:10px}.cardTextIndexBottom{right:10px;bottom:10px;transform:rotate(180deg)}
      .cardTextSuitWatermark{position:absolute;z-index:0;left:50%;top:50%;transform:translate(-50%,-52%);font-family:Arial,sans-serif;font-size:52cqw;line-height:1;opacity:.055;color:currentColor;pointer-events:none}
      .cardTextBody{position:absolute;z-index:2;left:12%;right:12%;top:23%;bottom:24%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4%;text-align:center;color:#262a31;font-family:Arial,sans-serif;overflow:hidden}
      .cardTextTitle{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-width:100%;font-size:12px;font-size:clamp(9px,12cqw,16px);line-height:1.12;word-break:keep-all;overflow-wrap:anywhere;font-weight:800;letter-spacing:-.02em}
      .cardTextTrigger{display:block;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:clip;font-size:clamp(6.5px,7cqw,9px);line-height:1.2;color:#806d4a;font-weight:700;word-break:keep-all}
      .cardTextEffect{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-width:100%;font-size:8px;font-size:clamp(6.5px,7.5cqw,10px);line-height:1.25;color:#5a5650;word-break:keep-all;overflow-wrap:anywhere}
      .stageInner .cardTextEffect{-webkit-line-clamp:3}
      .slotArt .cardTextBody{top:25%;bottom:23%}.slotArt .cardTextTitle{-webkit-line-clamp:2}.slotArt .cardTextTrigger,.slotArt .cardTextEffect{display:none}
      .cardTextDivider{position:absolute;z-index:1;left:32%;right:32%;bottom:17%;height:1px;background:#cbb17a}.cardTextDiamond{position:absolute;z-index:2;left:50%;bottom:12.5%;transform:translateX(-50%);font-size:9px;color:#b38e48;background:#f3ead5;padding:0 2px}
      .textPureFallback{display:grid;place-items:center;font-family:Arial,sans-serif;font-size:22px}.textPureFallback>b{font-size:38px}.textPureFallbackBottom{position:absolute;right:9px;bottom:9px;transform:rotate(180deg);font-size:12px}.textPureFallback.redSuit{color:#b94758}
      @container cardface (max-width:72px){.cardTextEffect{display:none}.cardTextBody{left:13%;right:13%;top:24%;bottom:22%;gap:0}.cardTextTitle{font-size:9px}.cardTextIndex b{font-size:10px}.cardTextIndex i{font-size:9px}.cardTextIndexTop{left:7px;top:7px}.cardTextIndexBottom{right:7px;bottom:7px}.cardTextDivider,.cardTextDiamond{display:none}}
    `;
    document.head.appendChild(style);
  }
  function refresh(){
    try{if(typeof root.renderBattle==='function'&&currentBattle())root.renderBattle()}catch(_error){}
  }
  function install(){
    if(installed)return true;
    if(typeof root.artHtml!=='function')return false;
    injectStyles();
    originalArtHtml=root.artHtml;
    root.artHtml=function(card,variant){return renderCardFace(card,variant)};
    root.artHtml.__textOnlyMode=true;
    installed=true;
    refresh();
    return true;
  }
  function installWhenReady(){
    if(typeof document==='undefined')return false;
    const attempt=()=>{
      if(install())return;
      setTimeout(()=>{if(!install())console.warn('[card-text-mode] 카드 렌더러를 찾지 못했습니다.')},0);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }
  function setEnabled(value){enabled=!!value;if(installed)refresh();return enabled}
  function isEnabled(){return enabled}
  return{SUIT_SYMBOL,RED_SUITS,ACTION_LABELS,COMPACT_TEXT,escapeHtml,rankLabel,cardName,effectList,shouldUseTextFace,summarizeEffects,buildCardCompactText,textCardFace,renderCardFace,install,installWhenReady,setEnabled,isEnabled};
});
