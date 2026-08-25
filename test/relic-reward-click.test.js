const test=require('node:test');
const assert=require('node:assert/strict');
const RelicSystem=require('../relics.js');

test('유물 보상 버튼은 다시 렌더링되어도 실행 가능한 전역 UI 핸들러를 직접 가진다',()=>{
  const node={id:'elite-click',type:'elite'};
  const root={
    run:{map:[node]},battle:{node},legacyRewards:0,modalHtml:'',
    showReward(){this.legacyRewards++},
    showModal(html){this.modalHtml=html},
    renderMap(){},renderBattle(){},beginRun(){},sfx(){}
  };
  RelicSystem.wrapShowReward(root);
  const options=root.showReward(node);
  assert.equal(options.length,3);
  assert.match(root.modalHtml,/data-relic-reward=/);
  assert.match(root.modalHtml,/onclick="RelicSystem\.takeRelicRewardFromUi\('/);
});

test('보스 보상 클릭은 노드가 run.map에서 빠져도 현재 battle.node를 이용해 유물을 받고 카드 보상으로 이어진다',()=>{
  const node={id:'regional-boss-click',type:'boss'};
  const root={
    run:{map:[]},battle:{node},legacyRewards:0,modalHtml:'',sounds:[],
    showReward(){this.legacyRewards++},
    showModal(html){this.modalHtml=html},
    renderMap(){},renderBattle(){},beginRun(){},sfx(name){this.sounds.push(name)}
  };
  RelicSystem.wrapShowReward(root);
  const options=root.showReward(node);
  assert.equal(options.length,3);
  assert.equal(RelicSystem.resolveRewardNode(root,node.id),node);
  const clicked=RelicSystem.takeRelicRewardFromUi(options[0],node.id,root);
  assert.equal(clicked,true);
  assert.equal(root.run.relics.length,1);
  assert.equal(RelicSystem.rewardClaimed(root.run,node.id),true);
  assert.equal(root.legacyRewards,1);
  assert.deepEqual(root.sounds,['reward']);
});

test('이미 받은 유물 보상은 빠른 연속 탭에서도 두 번 지급되지 않는다',()=>{
  const node={id:'boss-double-tap',type:'boss'};
  const root={
    run:{map:[node]},battle:{node},legacyRewards:0,
    showReward(){this.legacyRewards++},showModal(){},renderMap(){},renderBattle(){},beginRun(){},sfx(){}
  };
  RelicSystem.wrapShowReward(root);
  const options=root.showReward(node);
  assert.equal(RelicSystem.takeRelicRewardFromUi(options[0],node.id,root),true);
  assert.equal(RelicSystem.takeRelicRewardFromUi(options[1],node.id,root),false);
  assert.equal(root.run.relics.length,1);
  assert.equal(root.legacyRewards,1);
});
