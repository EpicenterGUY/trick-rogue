(function(root,factory){
  const value=factory();
  if(typeof module!=='undefined')module.exports=value;
  root.BOSS_SIGNATURE_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  return [
    {
      id:'boss.theater.encore',name:'앙코르',short:'앙코르',suit:'H',rank:7,
      description:'패배 — 보호막 5. 막이 내려가도 한 번 더 버틴다.',
      terms:['트릭','보호막'],image:'assets/cards/pack01/emergency_guard.png',packId:'boss-signature',art:'boss_theater_encore',
      category:'boss_signature',rarity:'boss',signatureBossId:'three_face_dealer',signatureRegionId:'region_theater',signatureWeight:2.5,
      effects:[{trigger:'on_trick_loss',action:'gain_shield',value:5,duration:'battle'}]
    },
    {
      id:'boss.theater.curtain_call',name:'커튼콜',short:'커튼콜',suit:'S',rank:11,
      description:'승리 — 상대에게 출혈 2. 마지막 인사 뒤에도 상처가 남는다.',
      terms:['트릭','출혈'],image:'assets/cards/pack01/sharp_glass.png',packId:'boss-signature',art:'boss_theater_curtain_call',
      category:'boss_signature',rarity:'boss',signatureBossId:'three_face_dealer',signatureRegionId:'region_theater',signatureWeight:2.5,
      effects:[{trigger:'on_trick_win',action:'apply_enemy_bleed',value:2,duration:'battle'}]
    },
    {
      id:'boss.observatory.fog_mirror',name:'안개 거울',short:'안개 거울',suit:'D',rank:8,
      description:'무승부 — 보호막 6. 결론이 나지 않은 순간을 방어로 바꾼다.',
      terms:['트릭','보호막'],image:'assets/cards/pack01/ambush_observer.png',packId:'boss-signature',art:'boss_observatory_fog_mirror',
      category:'boss_signature',rarity:'boss',signatureBossId:'fog_curator',signatureRegionId:'region_observatory',signatureWeight:2.5,
      effects:[{trigger:'on_trick_draw',action:'gain_shield',value:6,duration:'battle'}]
    },
    {
      id:'boss.observatory.redaction',name:'기록 말소',short:'기록 말소',suit:'C',rank:9,
      description:'승리 — 상대에게 피해 3, 자신은 보호막 2. 불리한 기록을 지우고 유리한 기록만 남긴다.',
      terms:['트릭','피해','보호막'],image:'assets/cards/pack01/recursive_function.png',packId:'boss-signature',art:'boss_observatory_redaction',
      category:'boss_signature',rarity:'boss',signatureBossId:'fog_curator',signatureRegionId:'region_observatory',signatureWeight:2.5,
      effects:[
        {trigger:'on_trick_win',action:'damage_enemy',value:3,duration:'trick'},
        {trigger:'on_trick_win',action:'gain_shield',value:2,duration:'battle'}
      ]
    },
    {
      id:'boss.frontier.war_tax',name:'전시 징수',short:'전시 징수',suit:'D',rank:6,
      description:'승리 — 상대에게 피해 5. 트릭을 빼앗는 순간 대가도 함께 걷는다.',
      terms:['트릭','피해'],image:'assets/cards/pack01/golden_hand.png',packId:'boss-signature',art:'boss_frontier_war_tax',
      category:'boss_signature',rarity:'boss',signatureBossId:'frontier_marshal',signatureRegionId:'region_frontier',signatureWeight:2.5,
      effects:[{trigger:'on_trick_win',action:'damage_enemy',value:5,duration:'trick'}]
    },
    {
      id:'boss.frontier.entrench',name:'진지 구축',short:'진지 구축',suit:'H',rank:9,
      description:'무승부 — 보호막 7. 전선이 멈춘 틈에 즉시 진지를 굳힌다.',
      terms:['트릭','보호막'],image:'assets/cards/pack01/emergency_guard.png',packId:'boss-signature',art:'boss_frontier_entrench',
      category:'boss_signature',rarity:'boss',signatureBossId:'frontier_marshal',signatureRegionId:'region_frontier',signatureWeight:2.5,
      effects:[{trigger:'on_trick_draw',action:'gain_shield',value:7,duration:'battle'}]
    }
  ];
});
