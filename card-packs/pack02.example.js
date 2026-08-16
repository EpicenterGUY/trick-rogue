// Copy this file to packNN.js, fill exactly ten existing/approved card definitions,
// then import it in cards.js and add its metadata to CARD_PACK_LIST.
(function(root,factory){
  const value=factory();
  if(typeof module!=='undefined')module.exports=value;
  root.PACK02_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  return [
    // { id:'pack02.approved_id', name:'확정된 이름', short:'...', suit:'S', rank:2,
    //   description:'확정된 효과', terms:[], image:'assets/cards/pack02/file.png',
    //   packId:'pack02', art:'approved_art_key' }
  ];
});
