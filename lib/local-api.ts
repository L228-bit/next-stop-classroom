export const apiJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Each route gets its own modest concurrency and request budget.
export function localPost<T>(validate:(value:unknown)=>T|null,run:(input:T,request:Request)=>Promise<Response>) {
  let start=0,requests=0,running=0;
  return async(request:Request)=>{
    const url=new URL(request.url);
    if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||request.headers.get('origin')!==url.origin)return apiJson({error:'仅接受本机游戏页面的请求'},403);
    if(!request.headers.get('content-type')?.includes('application/json'))return apiJson({error:'无效请求格式'},415);
    let input:T|null;
    try {const raw=await request.text();if(raw.length>20000)return apiJson({error:'输入过长'},413);input=validate(JSON.parse(raw));}catch{return apiJson({error:'输入格式无效'},400);}
    if(!input)return apiJson({error:'输入格式无效'},400);
    if(Date.now()-start>60000){start=Date.now();requests=0;}
    if(requests>=12||running>=2)return apiJson({error:'请稍等片刻再试'},429);
    requests++;running++;
    try{return await run(input,request);}catch{return apiJson({error:'连接暂时中断，可以重试。'},502);}finally{running--;}
  };
}
