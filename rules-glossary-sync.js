(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.RuleGlossarySync=api;
  if(typeof document!=='undefined'){
    const sync=()=>{
      let terms=null,systemNotes=null;
      try{if(typeof TERMS!=='undefined')terms=TERMS}catch(_error){}
      try{if(typeof SYSTEM_NOTES!=='undefined')systemNotes=SYSTEM_NOTES}catch(_error){}
      api.applyRuleGlossary({terms,systemNotes,document});
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
    else sync();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const RULE_TERMS=Object.freeze({
    '쇼다운':'세트의 5트릭 후 양측의 5장으로 족보와 보정을 계산해 최종 위력을 확정하고 비교하는 단계. 높은 쪽만 두 최종 위력의 차이만큼 피해를 주며, 동점이면 피해가 없다.',
    '우세':'카드·유물·상태 등 명시적 효과로만 부여되는 쇼다운 보너스. 활성화되면 쇼다운 추가 배수 +25%를 얻고 쇼다운 후 소비된다. 무늬 수 비교로 자동 발생하지 않으며 트럼프와 별개다.',
    '트럼프':'세트 시작 시 정해지는 무늬. 최종 트릭 무늬가 트럼프면 적용 숫자 +3. 자동 승리나 우선권은 없고 기본 쇼다운값도 바꾸지 않는다.',
    '더블다운':'이번 세트에서 트릭을 3번 이상 이겼다면 쇼다운 최종 위력 +6을 주는 공용 효과 카드.',
    '순수':'고유 효과가 없는 표준 52장 카드. 같은 인쇄 숫자·무늬를 가진 효과 카드와는 별개의 카드다.',
    '순수 카드':'고유 효과가 없는 표준 52장 카드. 같은 인쇄 숫자·무늬를 가진 효과 카드와는 별개의 카드다.',
    '칩':'전투 전용 자원. 최대 5개이며 트릭 승리 시 기본적으로 +1. 2개를 소비하면 손패 1장을 덱 맨 아래로 보내고 1장 뽑을 수 있고, 이 교환은 트릭당 1회다. 세트 사이에는 유지되고 전투가 끝나면 초기화된다.',
    '리버 적중':'4번째 트릭 종료 시 현재 4장보다 족보가 좋아지는 실제 5번째 카드 후보를 고정한다. 5번째 카드가 그 후보와 정확히 일치하면 리버 적중이며 쇼다운 추가 배수 +25%를 얻는다.',
    '최종 위력':'쇼다운 족보의 기본 위력에 가산 보정과 추가 배수를 적용해 확정한 수치. 양측 최종 위력을 비교한 뒤 높은 쪽만 차이만큼 피해를 준다.'
  });
  const RULE_SYSTEM_NOTES=Object.freeze({
    '조건':'효과가 켜지기 위해 먼저 만족해야 하는 전제. 예: 트릭 숫자 5 이하, 이번 세트 4승 이상, 명시적 우세 활성.'
  });

  function updateAdvantageLabel(doc){
    const status=doc?.querySelector?.('#statusTop .midStat');
    if(!status)return false;
    const textNode=Array.from(status.childNodes||[]).find(node=>node?.nodeType===3);
    if(textNode)textNode.textContent='명시적 우세';
    const edge=status.querySelector?.('#edgeText');
    if(edge&&edge.textContent==='5장 확정 후 판정')edge.textContent='효과로만 부여';
    status.dataset&&(status.dataset.advantageRule='explicit-only');
    return true;
  }

  function applyRuleGlossary({terms,systemNotes,document:doc}={}){
    if(terms&&typeof terms==='object')Object.assign(terms,RULE_TERMS);
    if(systemNotes&&typeof systemNotes==='object')Object.assign(systemNotes,RULE_SYSTEM_NOTES);
    const labelUpdated=updateAdvantageLabel(doc);
    return{termsUpdated:!!terms,systemNotesUpdated:!!systemNotes,labelUpdated};
  }

  return{RULE_TERMS,RULE_SYSTEM_NOTES,updateAdvantageLabel,applyRuleGlossary};
});
