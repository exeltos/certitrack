const KEY = 'certitrack.demo.role';
export function getDemoRole(){return localStorage.getItem(KEY)==='admin'?'admin':null;}
export function isDemo(role=null){const current=getDemoRole();return Boolean(current&&(!role||current===role));}
export function enterDemo(role){if(role!=='admin')return;localStorage.setItem(KEY,'admin');window.location.href='/pages/admin/dashboard.html';}
export function exitDemo(){localStorage.removeItem(KEY);window.location.href='/index.html';}
export function protectDemoWrites(){return Swal.fire({icon:'info',title:'Demo mode',text:'Η ενέργεια είναι απενεργοποιημένη στο demo και δεν αλλάζει πραγματικά δεδομένα.',confirmButtonText:'ΟΚ'});}
export function installDemoBanner(role){if(!isDemo(role)||document.getElementById('ct-demo-banner'))return;const banner=document.createElement('div');banner.id='ct-demo-banner';banner.className='ct-demo-banner';banner.innerHTML='<div><strong>DEMO MODE</strong><span>Ενδεικτικά δεδομένα · καμία αλλαγή δεν αποθηκεύεται</span></div><div class="ct-demo-banner__actions"><button id="ct-exit-demo">Έξοδος demo</button></div>';document.getElementById('app-header')?.insertAdjacentElement('afterend',banner);banner.querySelector('#ct-exit-demo')?.addEventListener('click',exitDemo);}
