import './style.css';
try {
 await import('./scene.js');
} catch (error) {
 console.error('Mud Meals could not start:', error);
 const loading=document.querySelector('#loading');
 loading.replaceChildren();
 const title=document.createElement('strong');title.textContent='Graphics unavailable';
 const message=document.createElement('p');message.textContent='Mud Meals requires WebGL 2. Open this page in a browser with graphics acceleration enabled.';
 const retry=document.createElement('button');retry.className='glass';retry.textContent='Retry';retry.onclick=()=>location.reload();
 loading.append(title,message,retry);
}
