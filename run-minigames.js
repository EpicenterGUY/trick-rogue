(function(root,factory){
  const ShowdownResolution=typeof module!=='undefined'&&module.exports?require('./showdown-resolution.js'):root.ShowdownResolution;
  const api=factory(ShowdownResolution);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RunMinigames=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(ShowdownResolution){
  const STAGE='RUN-V3';
  const SUITS=Object.freeze(['S','H','D','C']);
  const RANKS=Object.freeze([2,3,4,5,6,7,8,9,10,11,12,13,14]);
  const POKER_STRENGTH=Object.freeze(['high_card','pair','two_pair','three_kind','straight','flush','full_house','four_kind','straight_flush']);

  function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function safeRandom(random=Math.random){const raw=Number(random());return Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0}
  function randomIndex(length,random){return Math.floor(safeRandom(random)*Math.max(1,length))}
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function cardKey(card){return `${card?.suit||'?'}:${Number(card?.rank)||0}`}
  function rankLabel(rank){return Number(rank)===14?'A':Number(rank)===13?'K':Number(rank)===12?'Q':Number(rank)===11?'J':String(rank)}
  function suitSymbol(suit){return suit==='S'?'♠':suit==='H'?'♥':suit==='D'?'♦':suit==='C'?'♣':String(suit||'?')}
  function cardLabel(card){return `${suitSymbol(card?.suit)}${rankLabel(card?.rank)}`}
  function standardDeck(){const cards=[];for(const suit of SUITS)for(const rank of RANKS)cards.push({suit,rank});return cards}
  function takeUniqueCards(count,random=Math.random,excluded=[]){
    const blocked=new Set((excluded||[]).map(cardKey)),pool=standardDeck().filter(card=>!blocked.has(cardKey(card))),out=[];
    while(out.length<count&&pool.length){const index=randomIndex(pool.length,random);out.push(pool.splice(index,1)[0])}
    return out;
  }
  function evaluatePoker(cards){
    if(typeof ShowdownResolution?.evaluatePoker==='function')return ShowdownResolution.evaluatePoker(cards);
    if(!Array.isArray(cards)||cards.length!==5)throw new RangeError('Poker evaluation requires exactly five cards');
    const ranks=cards.map(card=>Number(card.rank)).sort((a,b)=>a-b),suits=cards.map(card=>card.suit),counts={};
    for(const rank of ranks)counts[rank]=(counts[rank]||0)+1;
    const groups=Object.values(counts).sort((a,b)=>b-a),unique=[...new Set(ranks)],flush=new Set(suits).size===1;
    const straight=(unique.length===5&&unique[4]-unique[0]===4)||JSON.stringify(unique)===JSON.stringify([2,3,4,5,14]);
    let id='high_card';
    if(straight&&flush)id='straight_flush';else if(groups[0]===4)id='four_kind';else if(groups[0]===3&&groups[1]===2)id='full_house';else if(flush)id='flush';else if(straight)id='straight';else if(groups[0]===3)id='three_kind';else if(groups[0]===2&&groups[1]===2)id='two_pair';else if(groups[0]===2)id='pair';
    const names={high_card:'하이카드',pair:'페어',two_pair:'투페어',three_kind:'트리플',straight:'스트레이트',flush:'플러시',full_house:'풀하우스',four_kind:'포카드',straight_flush:'스트레이트 플러시'};
    return{id,name:names[id],strength:POKER_STRENGTH.indexOf(id),ranks,suits};
  }
  function pokerStrength(hand){const id=typeof hand==='string'?hand:hand?.id;const fromEngine=Number(hand?.strength);return Number.isFinite(fromEngine)?fromEngine:POKER_STRENGTH.indexOf(id)}
  function reward(tier,actions=[],label=''){return{tier,label,actions:actions.map(action=>({...action}))}}
  function riverReward(hand){
    const strength=pokerStrength(hand);
    if(strength>=6)return reward('great',[{type:'gain_gold',amount:40},{type:'gain_relic',mode:'candidate'}],`${hand.name} · 대성공`);
    if(strength>=4)return reward('success',[{type:'gain_gold',amount:30},{type:'add_card',mode:'reward'}],`${hand.name} · 성공`);
    if(strength>=2)return reward('normal',[{type:'gain_gold',amount:20},{type:'add_card',mode:'reward'}],`${hand.name} · 보통`);
    return reward('consolation',[{type:'gain_gold',amount:12}],`${hand.name} · 참가 보상`);
  }
  function createRiverTable(context={}){
    const random=context.random||Math.random,base=clone(context.baseCards)||takeUniqueCards(4,random),candidates=clone(context.candidateCards)||takeUniqueCards(3,random,base);
    if(base.length!==4||candidates.length!==3)throw new RangeError('리버 테이블은 기본 4장과 후보 3장이 필요합니다.');
    return{id:'river_table',phase:'choose',baseCards:base,candidateCards:candidates,chosenIndex:null,result:null};
  }
  function chooseRiverTable(state,choice){
    if(state.phase!=='choose')return{ok:false,reason:'resolved'};const index=Number(typeof choice==='object'?choice.index:choice);
    if(!Number.isInteger(index)||index<0||index>=state.candidateCards.length)return{ok:false,reason:'invalid_choice'};
    const fifth=state.candidateCards[index],hand=evaluatePoker([...state.baseCards,fifth]),result=riverReward(hand);
    state.chosenIndex=index;state.phase='resolved';state.result={hand,fifth:clone(fifth),reward:result};return{ok:true,...clone(state.result)};
  }

  function stageLayoutConditions(cards,slots){
    const placed=slots.map(index=>cards[index]).filter(Boolean);if(placed.length!==5)return{score:0,conditions:[],complete:false};
    const highest=Math.max(...cards.map(card=>Number(card.rank))),center=placed[2],highestCenter=Number(center.rank)===highest;
    let adjacentSuit=false;for(let i=0;i<placed.length-1;i++)if(placed[i].suit===placed[i+1].suit){adjacentSuit=true;break}
    return{score:Number(highestCenter)+Number(adjacentSuit),complete:true,conditions:[{id:'highest_center',name:'가장 높은 숫자를 3번 슬롯에 배치',success:highestCenter},{id:'adjacent_suit',name:'같은 무늬를 한 쌍 이상 인접 배치',success:adjacentSuit}]};
  }
  function createStageLayout(context={}){
    const cards=clone(context.cards)||(context.random?takeUniqueCards(5,context.random):[{suit:'S',rank:6},{suit:'H',rank:10},{suit:'H',rank:4},{suit:'D',rank:13},{suit:'C',rank:8}]);
    return{id:'stage_layout',phase:'arrange',cards,slots:[null,null,null,null,null],selectedCardIndex:null,result:null};
  }
  function chooseStageLayout(state,choice){
    if(state.phase!=='arrange')return{ok:false,reason:'resolved'};
    if(choice?.reset===true){state.slots=[null,null,null,null,null];state.selectedCardIndex=null;return{ok:true,state:clone(state)}}
    const cardIndex=Number(choice?.cardIndex),slotIndex=Number(choice?.slotIndex);
    if(!Number.isInteger(cardIndex)||cardIndex<0||cardIndex>=state.cards.length||!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=5)return{ok:false,reason:'invalid_choice'};
    const oldSlot=state.slots.indexOf(cardIndex);if(oldSlot>=0)state.slots[oldSlot]=null;
    const displaced=state.slots[slotIndex];state.slots[slotIndex]=cardIndex;if(displaced!=null&&oldSlot>=0)state.slots[oldSlot]=displaced;
    const complete=state.slots.every(index=>index!=null);
    if(!complete)return{ok:true,complete:false,state:clone(state)};
    const judged=stageLayoutConditions(state.cards,state.slots),result=judged.score===2?reward('success',[{type:'gain_gold',amount:30},{type:'add_card',mode:'reward'}],'조건 2개 성공'):judged.score===1?reward('normal',[{type:'gain_gold',amount:18}],'조건 1개 성공'):reward('consolation',[{type:'gain_gold',amount:8}],'참가 보상');
    state.phase='resolved';state.result={...judged,reward:result};return{ok:true,complete:true,...clone(state.result)};
  }

  function createObservationTest(context={}){
    const random=context.random||Math.random,cards=clone(context.cards)||takeUniqueCards(3,random),highest=Math.max(...cards.map(card=>Number(card.rank))),answerIndex=cards.findIndex(card=>Number(card.rank)===highest);
    return{id:'observation_test',phase:'choose',cards,question:'가장 높은 숫자의 카드는?',answerIndex,revealed:false,result:null};
  }
  function chooseObservationTest(state,choice){
    if(state.phase!=='choose')return{ok:false,reason:'resolved'};
    if(choice?.type==='reveal'){state.revealed=true;return{ok:true,revealed:true,costAction:{type:'gain_gold',amount:-5}}}
    const index=Number(typeof choice==='object'?choice.index:choice);if(!Number.isInteger(index)||index<0||index>=state.cards.length)return{ok:false,reason:'invalid_choice'};
    const correct=index===state.answerIndex,result=correct?reward('success',[{type:'gain_gold',amount:25},{type:'add_card',mode:'reward'}],'관측 성공'):reward('consolation',[{type:'gain_gold',amount:8}],'부분 보상');
    state.phase='resolved';state.result={correct,answerIndex:state.answerIndex,reward:result};return{ok:true,...clone(state.result)};
  }

  function supplyRewardForStep(step){
    if(step===1)return[{type:'gain_gold',amount:15}];
    if(step===2)return[{type:'gain_gold',amount:15},{type:'add_card',mode:'reward'}];
    if(step>=3)return[{type:'gain_gold',amount:25},{type:'add_card',mode:'reward'},{type:'gain_relic',mode:'candidate'}];
    return[];
  }
  function createSupplyHeist(context={}){
    const random=context.random||Math.random,riskRolls=Array.isArray(context.riskRolls)?[...context.riskRolls]:[safeRandom(random),safeRandom(random),safeRandom(random)];
    return{id:'supply_heist',phase:'push',step:0,maxStep:3,riskRolls,pendingActions:[],result:null};
  }
  function chooseSupplyHeist(state,choice){
    if(state.phase!=='push')return{ok:false,reason:'resolved'};const action=typeof choice==='string'?choice:choice?.action;
    if(action==='withdraw'){
      const tier=state.step>=3?'great':state.step===2?'success':state.step===1?'normal':'consolation',result=reward(tier,state.pendingActions.length?state.pendingActions:[{type:'gain_gold',amount:5}],`철수 · ${state.step}단계`);
      state.phase='resolved';state.result={withdrawn:true,step:state.step,reward:result};return{ok:true,...clone(state.result)};
    }
    if(action!=='continue')return{ok:false,reason:'invalid_choice'};
    const nextStep=state.step+1;if(nextStep>state.maxStep)return chooseSupplyHeist(state,'withdraw');
    const risks=[0.12,0.25,0.40],roll=finite(state.riskRolls[nextStep-1],1),risk=risks[nextStep-1],failed=roll<risk;
    state.step=nextStep;
    if(failed){
      const result=reward('consolation',[{type:'gain_gold',amount:Math.max(5,8*nextStep)},{type:'damage_player',amount:3}],`발각 · ${nextStep}단계`);
      state.phase='resolved';state.result={failed:true,step:nextStep,risk,roll,reward:result};return{ok:true,...clone(state.result)};
    }
    state.pendingActions=supplyRewardForStep(nextStep);
    if(nextStep===state.maxStep){const result=reward('great',state.pendingActions,'보급품 완전 확보');state.phase='resolved';state.result={failed:false,step:nextStep,risk,roll,reward:result};return{ok:true,...clone(state.result)}}
    return{ok:true,failed:false,step:nextStep,risk,roll,canContinue:true,pendingActions:clone(state.pendingActions)};
  }

  function shootingOptimalIndex(target,cards){
    let best=-1,bestRank=Infinity;cards.forEach((card,index)=>{const rank=Number(card.rank);if(rank>=target&&rank<bestRank){best=index;bestRank=rank}});return best;
  }
  function createShootingRange(context={}){
    const random=context.random||Math.random,target=Number(context.target)||7+randomIndex(5,random),cards=clone(context.cards)||takeUniqueCards(3,random),optimalIndex=shootingOptimalIndex(target,cards);
    return{id:'shooting_range',phase:'choose',target,cards,optimalIndex,result:null};
  }
  function chooseShootingRange(state,choice){
    if(state.phase!=='choose')return{ok:false,reason:'resolved'};const index=Number(typeof choice==='object'?choice.index:choice);
    if(!Number.isInteger(index)||index<0||index>=state.cards.length)return{ok:false,reason:'invalid_choice'};
    const rank=Number(state.cards[index].rank),qualifies=rank>=state.target,optimal=index===state.optimalIndex;
    const result=optimal?reward('success',[{type:'gain_gold',amount:30},{type:'add_card',mode:'reward'}],'최적 사격'):qualifies?reward('normal',[{type:'gain_gold',amount:15}],'명중'):reward('consolation',[{type:'gain_gold',amount:6}],'연습 보상');
    state.phase='resolved';state.result={chosenIndex:index,optimalIndex:state.optimalIndex,qualifies,optimal,reward:result};return{ok:true,...clone(state.result)};
  }

  const MINIGAME_DEFINITIONS=Object.freeze({
    river_table:Object.freeze({id:'river_table',title:'리버 테이블',instructions:'기본 4장에 붙일 5번째 후보를 골라 가장 좋은 족보를 노린다.',createState:createRiverTable,choose:chooseRiverTable}),
    stage_layout:Object.freeze({id:'stage_layout',title:'무대 배치',instructions:'카드를 선택한 뒤 슬롯을 눌러 두 배치 조건을 최대한 만족시킨다.',createState:createStageLayout,choose:chooseStageLayout}),
    observation_test:Object.freeze({id:'observation_test',title:'관측 시험',instructions:'보이는 카드 정보를 비교해 정답을 고른다.',createState:createObservationTest,choose:chooseObservationTest}),
    supply_heist:Object.freeze({id:'supply_heist',title:'보급품 탈취',instructions:'계속할수록 보상과 위험이 함께 오른다. 원하는 때 철수한다.',createState:createSupplyHeist,choose:chooseSupplyHeist}),
    shooting_range:Object.freeze({id:'shooting_range',title:'사격장',instructions:'표적 이상이면서 가장 작은 숫자의 카드를 고르면 최고 보상이다.',createState:createShootingRange,choose:chooseShootingRange})
  });
  function definition(id){return MINIGAME_DEFINITIONS[id]||null}
  function createState(id,context={}){const def=definition(id);if(!def)throw new TypeError(`Unknown minigame: ${String(id)}`);return def.createState(context)}
  function choose(state,choice,context={}){const def=definition(state?.id);if(!def)throw new TypeError(`Unknown minigame state: ${String(state?.id)}`);return def.choose(state,choice,context)}
  function summary(state){const def=definition(state?.id);return{id:state?.id||null,title:def?.title||state?.id||'',phase:state?.phase||null,result:clone(state?.result)}}

  return{STAGE,SUITS,RANKS,POKER_STRENGTH,MINIGAME_DEFINITIONS,finite,safeRandom,clone,cardKey,rankLabel,suitSymbol,cardLabel,standardDeck,takeUniqueCards,evaluatePoker,pokerStrength,reward,riverReward,createRiverTable,chooseRiverTable,stageLayoutConditions,createStageLayout,chooseStageLayout,createObservationTest,chooseObservationTest,supplyRewardForStep,createSupplyHeist,chooseSupplyHeist,shootingOptimalIndex,createShootingRange,chooseShootingRange,definition,createState,choose,summary};
});