
const payload=JSON.parse(document.getElementById('design-data').textContent);
const origin='https://www.aivideosugc.com';
const form=document.querySelector('.starter');
function updateEntry(){
 const url=new URL(payload.workspace,origin);
 url.searchParams.set('aspect',form.querySelector('[name=aspect]').value);
 const direction=form.querySelector('[name=direction]');
 if(payload.kind==='feed')url.searchParams.set('prompt','Create a product image for a social feed using my uploaded photo as a reference. Setting: '+direction.value+'. Keep the product clear, with space for a headline I will add after download.');
 else url.searchParams.set('prompt',direction.value==='shadow'?'Create a pure-white product photo from my reference with a light natural contact shadow. Show the full item with clear edges and natural proportions.':'Create a pure-white product photo from my reference. Show the full item with clear edges and natural proportions.');
 document.querySelectorAll('[data-workspace-entry]').forEach(a=>a.href=url.href);
}
form.addEventListener('change',updateEntry);
document.querySelectorAll('.compare').forEach(box=>box.querySelector('input').addEventListener('input',e=>box.style.setProperty('--split',e.target.value+'%')));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.querySelectorAll('.example').forEach(card=>card.hidden=button.dataset.filter!=='all'&&card.dataset.category!==button.dataset.filter);
}));
const dialog=document.querySelector('dialog');let current=0;let opener;
function show(index){current=(index+payload.gallery.length)%payload.gallery.length;const item=payload.gallery[current];dialog.querySelector('h2').textContent=item.title;const img=dialog.querySelector('.dialog-image');img.src='assets/'+item.image;img.alt=item.alt;const use=dialog.querySelector('[data-dialog-use]');use.href=origin+item.href;use.childNodes[0].textContent=payload.kind==='feed'?'Use this scene ':'Use this style ';}
document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{opener=button;show(Number(button.dataset.preview));dialog.showModal();}));
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.querySelector('[data-previous]').addEventListener('click',()=>show(current-1));
dialog.querySelector('[data-next]').addEventListener('click',()=>show(current+1));
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(current+1);if(e.key==='ArrowLeft')show(current-1);});
dialog.addEventListener('close',()=>opener?.focus());
