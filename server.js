/*
GLOW SPA COMPLETE SERVER
Node.js 18+
- Serves the web app
- JSON REST API
- Staff accounts (first-run setup)
- Session cookies
- Automatic reminder worker
- WhatsApp Cloud API template sender
- Daily backups
No npm dependency is required.
*/
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),url=require("url");
const ROOT=__dirname,PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||"0.0.0.0",DB=path.join(ROOT,"data.json"),BACK=path.join(ROOT,"backups");
if(!fs.existsSync(BACK))fs.mkdirSync(BACK,{recursive:true});
function env(){let p=path.join(ROOT,".env");if(fs.existsSync(p))for(let l of fs.readFileSync(p,"utf8").split(/\r?\n/)){let m=l.match(/^([^#=\s]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"")}}env();
const hash=s=>crypto.createHash("sha256").update(String(s)).digest("hex");
function db(){try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch{return {users:[],sessions:{},appointments:[],services:[]}}}
function save(x){fs.writeFileSync(DB,JSON.stringify(x,null,2))}
function json(res,c,x){res.writeHead(c,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Credentials":"true","Cache-Control":"no-store"});res.end(JSON.stringify(x))}
function parseBody(req){return new Promise((ok,no)=>{let b="";req.on("data",c=>{b+=c;if(b.length>3e6)req.destroy()});req.on("end",()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(e)}})})}
function cookies(req){let o={};(req.headers.cookie||"").split(";").forEach(x=>{let [k,v]=x.trim().split("=");if(k)o[k]=decodeURIComponent(v||"")});return o}
function user(req){let s=db(),sid=cookies(req).glow_sid;return sid&&s.sessions&&s.sessions[sid]?s.sessions[sid]:null}
function session(res,u){let id=crypto.randomBytes(24).toString("hex"),s=db();s.sessions=s.sessions||{};s.sessions[id]={id:u.id,name:u.name,role:u.role,created:Date.now()};save(s);res.setHeader("Set-Cookie",`glow_sid=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`)}
function clearSession(res){res.setHeader("Set-Cookie","glow_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")}
function phone(p){let x=String(p||"").replace(/\D/g,"");if(x.startsWith("00"))x=x.slice(2);if(x.startsWith("0"))x="20"+x.slice(1);return x.startsWith("20")?x:"20"+x}
async function wa(to,name,service,date,time){
 const token=process.env.WHATSAPP_ACCESS_TOKEN,id=process.env.WHATSAPP_PHONE_NUMBER_ID,v=process.env.WHATSAPP_GRAPH_VERSION||"v23.0",tpl=process.env.WHATSAPP_TEMPLATE_NAME,lang=process.env.WHATSAPP_TEMPLATE_LANGUAGE||"ar";
 if(!token||!id||!tpl)throw Error("WhatsApp is not configured");
 const r=await fetch(`https://graph.facebook.com/${v}/${id}/messages`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:phone(to),type:"template",template:{name:tpl,language:{code:lang},components:[{type:"body",parameters:[name,service,date,time].map(text=>({type:"text",text:String(text||"")}))}]}})});
 const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j
}
function due(a,now){if(!a.nextDate||!a.phone||a.channel!=="whatsapp"||a.whatsappSent)return false;let time=process.env.REMINDER_SEND_TIME||"10:00",d=new Date(`${a.nextDate}T${time}:00`);d.setDate(d.getDate()-(Number(a.reminder)||0));return Math.abs(now-d)<60000}
async function worker(){let s=db(),now=new Date(),changed=false;for(let a of s.appointments||[])if(due(a,now))try{let r=await wa(a.phone,a.name,a.service,a.nextDate,a.time);a.whatsappSent=true;a.whatsappSentAt=new Date().toISOString();a.whatsappMessageId=r?.messages?.[0]?.id||"";changed=true;console.log("Reminder sent",a.name)}catch(e){console.error("Reminder error",e.message)}if(changed)save(s)}
setInterval(worker,60000);
setInterval(()=>{let s=db();fs.writeFileSync(path.join(BACK,`backup-${new Date().toISOString().slice(0,10)}.json`),JSON.stringify(s,null,2))},86400000);

const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".jpg":"image/jpeg",".png":"image/png",".json":"application/json"};
const srv=http.createServer(async(req,res)=>{
 try{
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Credentials":"true"});return res.end()}
  let u=new URL(req.url,"http://localhost"),s=db(),me=user(req);
  if(u.pathname==="/api/setup"&&req.method==="POST"){if((s.users||[]).length)return json(res,409,{error:"Already initialized"});let b=await parseBody(req);if(!b.name||!b.password)return json(res,400,{error:"name/password required"});s.users=[{id:1,name:b.name,role:"admin",passwordHash:hash(b.password)}];s.sessions={};save(s);session(res,s.users[0]);return json(res,200,{ok:true})}
  if(u.pathname==="/api/login"&&req.method==="POST"){let b=await parseBody(req),x=(s.users||[]).find(x=>x.name===b.name&&x.passwordHash===hash(b.password));if(!x)return json(res,401,{error:"بيانات الدخول غير صحيحة"});session(res,x);return json(res,200,{ok:true,user:{name:x.name,role:x.role}})}
  if(u.pathname==="/api/logout"){clearSession(res);return json(res,200,{ok:true})}
  if(u.pathname==="/api/health")return json(res,200,{ok:true,whatsappConfigured:Boolean(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.WHATSAPP_TEMPLATE_NAME),users:(s.users||[]).length});
  if(u.pathname==="/webhook"&&req.method==="GET"){
    const mode=u.searchParams.get("hub.mode"),token=u.searchParams.get("hub.verify_token"),challenge=u.searchParams.get("hub.challenge");
    if(mode==="subscribe"&&token&&token===process.env.WHATSAPP_VERIFY_TOKEN){res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});return res.end(challenge||"")}
    res.writeHead(403,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Forbidden")
  }
  if(u.pathname==="/webhook"&&req.method==="POST"){
    const body=await parseBody(req);
    console.log("WhatsApp webhook:",JSON.stringify(body));
    return json(res,200,{ok:true});
  }
  if(u.pathname.startsWith("/api/")&&!me)return json(res,401,{error:"تسجيل الدخول مطلوب"});
  if(u.pathname==="/api/data")return json(res,200,{appointments:s.appointments||[],services:s.services||[],users:(s.users||[]).map(x=>({id:x.id,name:x.name,role:x.role}))});
  if(u.pathname==="/api/appointments"&&req.method==="POST"){let b=await parseBody(req);if(!b.name||!b.phone||!b.date||!b.time)return json(res,400,{error:"بيانات الحجز ناقصة"});b.id=Date.now();b.createdAt=new Date().toISOString();s.appointments=s.appointments||[];s.appointments.push(b);save(s);return json(res,201,b)}
  let ma=u.pathname.match(/^\/api\/appointments\/(\d+)$/);
  if(ma&&req.method==="DELETE"){s.appointments=(s.appointments||[]).filter(x=>x.id!==Number(ma[1]));save(s);return json(res,200,{ok:true})}
  if(u.pathname==="/api/services"&&req.method==="POST"){let b=await parseBody(req);b.id=Date.now();s.services=s.services||[];s.services.push(b);save(s);return json(res,201,b)}
  if(u.pathname==="/api/whatsapp/test"&&req.method==="POST"){let b=await parseBody(req),r=await wa(b.phone,b.name||"عميلتنا",b.service||"تذكير",b.date||"",b.time||"");return json(res,200,{ok:true,result:r})}
  if(u.pathname==="/api/backup"){let f=path.join(BACK,`manual-${Date.now()}.json`);fs.writeFileSync(f,JSON.stringify(s,null,2));return json(res,200,{ok:true,file:f})}
  let fp=path.join(ROOT,u.pathname==="/"?"index.html":u.pathname.replace(/^\/+/,""));if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory())return json(res,404,{error:"Not found"});res.writeHead(200,{"Content-Type":MIME[path.extname(fp)]||"application/octet-stream"});fs.createReadStream(fp).pipe(res)
 }catch(e){json(res,500,{error:e.message})}
});
srv.listen(PORT,HOST,()=>console.log(`GLOW SPA: http://${HOST}:${PORT}`));
