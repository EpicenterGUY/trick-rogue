const assert=require('node:assert/strict');
const test=require('node:test');
const Feedback=require('../battle-feedback.js');
test('피해량별 흔들림은 작은 피해, 일반 피해, 큰 피해로 단계화된다',()=>{assert.equal(Feedback.damageTier(1),'small');assert.equal(Feedback.damageTier(2),'small');assert.equal(Feedback.damageTier(3),'normal');assert.equal(Feedback.damageTier(7),'normal');assert.equal(Feedback.damageTier(8),'large')});
test('흔들림 프로필은 0~6px와 80~150ms 범위 안에 있다',()=>{assert.deepEqual(Feedback.SHAKE_PROFILES.small,{amplitude:1,duration:80});assert.deepEqual(Feedback.SHAKE_PROFILES.normal,{amplitude:3,duration:110});assert.deepEqual(Feedback.SHAKE_PROFILES.large,{amplitude:4,duration:135});assert.deepEqual(Feedback.SHAKE_PROFILES.showdown,{amplitude:6,duration:150})});
test('연속 흔들림은 기존 애니메이션을 취소하고 교체한다',()=>{let cancelled=0;const animations=[];const element={animate(frames,options){const animation={frames,options,cancel(){cancelled++},finished:new Promise(()=>{})};animations.push(animation);return animation}};const controller=Feedback.createController({element});controller.damage(4);controller.shake('showdown');assert.equal(cancelled,1);assert.equal(animations[1].options.duration,150)});
