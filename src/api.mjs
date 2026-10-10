export async function api(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
 return data;
}
