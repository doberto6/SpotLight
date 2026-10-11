export async function api(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
 const mode=response.headers.get('X-SPOTlight-Data-Mode');
 if(mode){
  if(data&&typeof data==='object')data.data_mode=mode;
  window.dispatchEvent(new CustomEvent('spotlight-data-mode',{detail:mode}));
 }
 return data;
}
