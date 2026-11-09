export function createModals({ view, platform, content }) {
  const { $ }=platform;
  function renderModal(){
    const overlay=$('overlay');overlay.hidden=view.mode==='playing';document.querySelector('.arena').classList.toggle('modal-open',view.mode!=='playing');if(view.mode==='playing')return;
    const html=content.buildModal();if(html===null)return;if(html!==undefined)overlay.innerHTML=html;
    [...overlay.querySelectorAll('[data-action]')].forEach((button,i)=>{if(view.mode!=='levelup'&&!button.closest('.decision-grid'))button.insertAdjacentHTML('afterbegin',`<kbd class="choice-key" aria-hidden="true">${i+1}</kbd>`);});
  }
  return { renderModal };
}
