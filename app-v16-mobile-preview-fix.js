const MOBILE_PREVIEW_STORE='factpulse-mobile-preview-clip';
const LAST_CLIPS_PAGE_STORE='factpulse-last-clips-page';
function mobilePreviewSaveClip(index){
  const i=Number(index);
  const clip=(state.clips||[])[i];
  if(!clip){toast('No clip found. Search again.');return false;}
  localStorage.setItem(MOBILE_PREVIEW_STORE,JSON.stringify(clip));
  localStorage.setItem(LAST_CLIPS_PAGE_STORE,location.pathname.split('/').pop()||'clips-coverr-v16.html');
  return true;
}
function mobilePreviewOpen(index){
  if(mobilePreviewSaveClip(index)) location.href='mobile-preview-v16.html';
}
openPreview=mobilePreviewOpen;
window.addEventListener('click',(event)=>{
  const btn=event.target.closest('[data-preview],[data-p]');
  if(!btn)return;
  event.preventDefault();
  event.stopPropagation();
  mobilePreviewOpen(btn.dataset.preview??btn.dataset.p);
},true);
window.addEventListener('DOMContentLoaded',()=>{
  localStorage.setItem(LAST_CLIPS_PAGE_STORE,location.pathname.split('/').pop()||'clips-coverr-v16.html');
});