const {app,BrowserWindow,shell}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {Readable}=require('node:stream');
const {pathToFileURL}=require('node:url');

let server;

function contentType(file){
  return ({'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.wav':'audio/wav','.ico':'image/x-icon','.webp':'image/webp'})[path.extname(file).toLowerCase()]||'application/octet-stream';
}

function readAsset(request,clientRoot){
    let pathname;
    try{pathname=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad request',{status:400});}
    const relative=pathname.replace(/^\/+/, '');
    const file=path.resolve(clientRoot,relative);
    if(!file.startsWith(clientRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});
    return new Response(fs.readFileSync(file),{headers:{'Content-Type':contentType(file),'Cache-Control':'public, max-age=31536000, immutable'}});
}

function assetBinding(clientRoot){return{fetch(request){return Promise.resolve(readAsset(request,clientRoot));}};}

async function startGameServer(){
  const resources=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'..');
  const serverRoot=path.join(resources,'dist','server');
  const clientRoot=path.join(resources,'dist','client');
  const worker=(await import(pathToFileURL(path.join(serverRoot,'index.js')).href)).default;
  const assets=assetBinding(clientRoot);
  server=http.createServer(async(req,res)=>{
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=chunks.length?Buffer.concat(chunks):undefined;
      const origin=`http://${req.headers.host}`;
      const request=new Request(new URL(req.url||'/',origin),{method:req.method,headers:req.headers,body,duplex:body?'half':undefined});
      const directAsset=req.method==='GET'?readAsset(request,clientRoot):null;
      const response=directAsset?.ok?directAsset:await worker.fetch(request,{ASSETS:assets},{waitUntil(){},passThroughOnException(){}});
      res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));
      if(!response.body){res.end();return;}
      Readable.fromWeb(response.body).pipe(res);
    }catch(error){console.error(error);res.statusCode=500;res.end('Game failed to start');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return `http://127.0.0.1:${server.address().port}`;
}

async function createWindow(){
  const url=await startGameServer();
  const window=new BrowserWindow({width:1440,height:900,minWidth:960,minHeight:600,backgroundColor:'#07171b',title:'下一站，讲台',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))void shell.openExternal(url);return{action:'deny'};});
  await window.loadURL(url);
}

app.whenReady().then(createWindow).catch(error=>{console.error(error);app.quit();});
app.on('window-all-closed',()=>{server?.close();if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow();});
