export const DASH_SCOPE_KEY_STORAGE='next-stop-classroom-dashscope-key';
export const DASH_SCOPE_KEY_HEADER='X-DashScope-Api-Key';

export function savedDashScopeKey(){
  try{return localStorage.getItem(DASH_SCOPE_KEY_STORAGE)?.trim()??'';}catch{return '';}
}

export function apiHeaders(json=true){
  const headers:Record<string,string>={};
  if(json)headers['Content-Type']='application/json';
  const apiKey=savedDashScopeKey();
  if(apiKey)headers[DASH_SCOPE_KEY_HEADER]=apiKey;
  return headers;
}
