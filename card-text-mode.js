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
    draw_tactic:'전술 드로우',increase_effective_rank:'트릭 숫자',showdown_power:'쇼다운 위력',reserve_next_win_damage:'예약 피해',
    set_next_trick_suit_to_trump:'트릭 무늬→트럼프',increase_next_trick_rank:'트릭 숫자',draw_cards:'드로우',increase_forecast:'예측',
    set_reverse_compare:'숫자 비교 반전',set_last_showdown_suit_to_trump:'쇼다운 무늬→트럼프',increase_last_showdown_rank:'쇼다운 숫자',discard_selected_card:'카드 버림'
  });
  let enabled=true;
  let installed=false;
  let originalArtHtml=null;
  let originalTacticView=null;
  let originalTacticIcon=null;

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
  function compact(text,max=58){
    const normalized=String(text||'').replace(/\s+/g,' ').trim();
    return normalized.length>max?`${normalized.slice(0,max-1).trimEnd()}…`:normalized;
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
  function fallbackPureFace(card){
    const suit=printedSuit(card),sym=SUIT_SYMBOL[suit]||'',rank=rankLabel(printedRank(card)),red=RED_SUITS.has(suit);
    return `<span class="textPureFallback ${red?'redSuit':''}"><span>${escapeHtml(rank)}</span><b>${escapeHtml(sym)}</b><span class="textPureFallbackBottom">${escapeHtml(rank)} ${escapeHtml(sym)}</span></span>`;
  }
  function textCardFace(card){
    const suit=printedSuit(card),sym=SUIT_SYMBOL[suit]||'',rank=rankLabel(printedRank(card)),name=cardName(card)||'효과 카드';
    const summary=summarizeEffects(card),red=RED_SUITS.has(suit);
    return `<span class="cardTextOnlyFace ${red?'redSuit':''}" role="img" aria-label="${escapeHtml(`${name} ${sym}${rank}`)}">
      <span class="cardTextIndex cardTextIndexTop"><b>${escapeHtml(rank)}</b><i>${escapeHtml(sym)}</i></span>
      <span class="cardTextSuitWatermark" aria-hidden="true">${escapeHtml(sym)}</span>
      <span class="cardTextBody"><strong class="cardTextTitle">${escapeHtml(name)}</strong>${summary?`<small class="cardTextEffect">${escapeHtml(summary)}</small>`:''}</span>
      <span class="cardTextDivider" aria-hidden="true"></span><span class="cardTextDiamond" aria-hidden="true">◇</span>
      <span class="cardTextIndex cardTextIndexBottom"><b>${escapeHtml(rank)}</b><i>${escapeHtml(sym)}</i></span>
    </span>`;
  }
  function renderCardFace(card){
    if(!enabled&&originalArtHtml)return originalArtHtml(card);
    if(!shouldUseTextFace(card)){
      if(typeof root.pureCardSvg==='function')return root.pureCardSvg(card);
      if(originalArtHtml)return originalArtHtml(card);
      return fallbackPureFace(card);
    }
    return textCardFace(card);
  }
  function lookupTactic(id){
    try{
      if(typeof TACTICS!=='undefined'&&Array.isArray(TACTICS))return TACTICS.find(item=>item.id===id)||null;
    }catch(_error){}
    return null;
  }
  function tacticTextFace(tactic){
    const name=tactic?.name||tactic?.id||'전술';
    const cost=Number.isFinite(tactic?.cost)?tactic.cost:0;
    const description=compact(tactic?.desc||'',52);
    return `<span class="tacticTextOnlyFace" role="img" aria-label="${escapeHtml(`${name}, 비용 ${cost}`)}">
      <span class="tacticTextCost"><b>${cost}</b><small>비용</small></span>
      <span class="tacticTextKind">전술</span>
      <strong class="tacticTextTitle">${escapeHtml(name)}</strong>
      ${description?`<small class="tacticTextDesc">${escapeHtml(description)}</small>`:''}
      <span class="tacticTextDivider" aria-hidden="true"></span><span class="tacticTextDiamond" aria-hidden="true">◇</span>
    </span>`;
  }
  function tacticIconFace(id){
    const tactic=lookupTactic(id)||{id,name:id,cost:0,desc:''};
    return tacticTextFace(tactic);
  }
  function currentBattle(){
    try{return typeof battle!=='undefined'?battle:null}catch(_error){return null}
  }
  function tacticViewText(tactic){
    const state=currentBattle();
    const disabled=state&&Number.isFinite(tactic?.cost)&&state.chip<tactic.cost;
    const selected=state&&state.selectedTactic===tactic?.uid;
    return `<button class="tactic ${disabled?'off':''} ${selected?'sel':''}" onclick="selectTactic('${escapeHtml(tactic?.uid||'')}')" aria-label="${escapeHtml(`${tactic?.name||'전술'}, 비용 ${tactic?.cost||0}`)}"><div class="tacticArt">${tacticTextFace(tactic)}</div></button>`;
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
      .cardTextBody{position:absolute;z-index:2;left:16%;right:16%;top:25%;bottom:25%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6%;text-align:center;color:#262a31;font-family:Arial,sans-serif;overflow:hidden}
      .cardTextTitle{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-width:100%;font-size:12px;font-size:clamp(9px,12cqw,16px);line-height:1.12;word-break:keep-all;overflow-wrap:anywhere;font-weight:800;letter-spacing:-.02em}
      .cardTextEffect{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;max-width:100%;font-size:8px;font-size:clamp(6.5px,7.5cqw,10px);line-height:1.22;color:#5a5650;word-break:keep-all;overflow-wrap:anywhere}
      .cardTextDivider{position:absolute;z-index:1;left:32%;right:32%;bottom:17%;height:1px;background:#cbb17a}.cardTextDiamond{position:absolute;z-index:2;left:50%;bottom:12.5%;transform:translateX(-50%);font-size:9px;color:#b38e48;background:#f3ead5;padding:0 2px}
      .textPureFallback{display:grid;place-items:center;font-family:Arial,sans-serif;font-size:22px}.textPureFallback>b{font-size:38px}.textPureFallbackBottom{position:absolute;right:9px;bottom:9px;transform:rotate(180deg);font-size:12px}.textPureFallback.redSuit{color:#b94758}
      .tacticTextOnlyFace{position:relative;display:block;width:100%;height:100%;aspect-ratio:86/132;overflow:hidden;container-type:inline-size;container-name:tacticface;border-radius:6px;background:#f3f0e8;color:#29323a;box-shadow:inset 0 0 0 2px #394047,inset 0 0 0 5px #d7dfdc;font-family:Arial,sans-serif}
      .tacticTextOnlyFace:before{content:"";position:absolute;inset:7px;border:1px solid #b9c8c7;border-radius:4px;pointer-events:none}.tacticTextCost{position:absolute;z-index:2;left:9%;top:8%;width:24%;aspect-ratio:1;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fffdf6;border:2px solid #4e8790;color:#29323a;line-height:.9}.tacticTextCost b{font-size:11px;font-size:clamp(9px,13cqw,14px)}.tacticTextCost small{font-size:5px;font-size:clamp(5px,6cqw,7px);margin-top:2px;color:#68757a}.tacticTextKind{position:absolute;right:11%;top:11%;font-size:7px;font-size:clamp(6px,7cqw,8px);font-weight:700;letter-spacing:.08em;color:#5d7d81}
      .tacticTextTitle{position:absolute;z-index:2;left:13%;right:13%;top:37%;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-align:center;font-size:11px;font-size:clamp(9px,12cqw,13px);line-height:1.12;font-weight:800;word-break:keep-all;overflow-wrap:anywhere}.tacticTextDesc{position:absolute;z-index:2;left:13%;right:13%;top:56%;max-height:29%;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;text-align:center;font-size:7px;font-size:clamp(6px,7cqw,8px);line-height:1.2;color:#677077;word-break:keep-all;overflow-wrap:anywhere}
      .tacticTextDivider{position:absolute;left:34%;right:34%;bottom:10%;height:1px;background:#7aa1a5}.tacticTextDiamond{position:absolute;left:50%;bottom:5.5%;transform:translateX(-50%);font-size:8px;color:#4e8790;background:#f3f0e8;padding:0 2px}
      .tacticArt>.tacticTextOnlyFace{width:100%;height:100%}.tactic .tacticName{display:none!important}
      @container cardface (max-width:72px){.cardTextEffect{display:none}.cardTextBody{left:13%;right:13%;top:24%;bottom:22%;gap:0}.cardTextTitle{font-size:9px}.cardTextIndex b{font-size:10px}.cardTextIndex i{font-size:9px}.cardTextIndexTop{left:7px;top:7px}.cardTextIndexBottom{right:7px;bottom:7px}.cardTextDivider,.cardTextDiamond{display:none}}
      @container tacticface (max-width:74px){.tacticTextDesc{display:none}.tacticTextTitle{top:43%;font-size:9px}.tacticTextCost{width:26%}}
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
    root.artHtml=function(card){return renderCardFace(card)};
    root.artHtml.__textOnlyMode=true;
    if(typeof root.tacticView==='function'){
      originalTacticView=root.tacticView;
      root.tacticView=function(tactic){return enabled?tacticViewText(tactic):originalTacticView(tactic)};
      root.tacticView.__textOnlyMode=true;
    }
    if(typeof root.tacticIcon==='function'){
      originalTacticIcon=root.tacticIcon;
      root.tacticIcon=function(id){return enabled?tacticIconFace(id):originalTacticIcon(id)};
      root.tacticIcon.__textOnlyMode=true;
    }
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
  return{SUIT_SYMBOL,RED_SUITS,ACTION_LABELS,escapeHtml,rankLabel,cardName,effectList,shouldUseTextFace,summarizeEffects,textCardFace,tacticTextFace,tacticIconFace,tacticViewText,renderCardFace,install,installWhenReady,setEnabled,isEnabled};
});
