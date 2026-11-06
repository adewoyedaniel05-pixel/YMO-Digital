import express from "express";
import nodemailer from "nodemailer";
import fs from "fs";
const {PORT=3000,ADMIN_KEY,COMPANY_EMAIL,SMTP_HOST,SMTP_PORT=587,SMTP_USER,SMTP_PASS,PAYSTACK_SECRET,BASE_URL="http://localhost:3000"}=process.env;
const FILE=process.env.DATA_FILE||"orders.json",app=express();
const load=()=>fs.existsSync(FILE)?JSON.parse(fs.readFileSync(FILE,"utf8")):[];
const save=o=>fs.writeFileSync(FILE,JSON.stringify(o,null,1));
const mailer=nodemailer.createTransport({host:SMTP_HOST,port:+SMTP_PORT,auth:{user:SMTP_USER,pass:SMTP_PASS}});
const ngn=n=>"₦"+Math.round(n).toLocaleString("en-NG");
const STAGES=["Order received","Preparing your food","Rider picked it up","Arriving at your door","Delivered"];
const isAdmin=(q,s,next)=>ADMIN_KEY&&q.get("x-admin-key")===ADMIN_KEY?next():s.sendStatus(401);
async function notify(o){
  const lines=o.items.map(i=>`${i.q} x ${i.n} (${ngn(i.p*i.q)})`).join("\n");
  const text=`Order ${o.id} from ${o.restaurant}\n\n${lines}\n\nTotal: ${ngn(o.total)} (${o.paid?"paid online by card":o.pay})\nName: ${o.name}\nPhone: ${o.phone}\nAddress: ${o.addr}`;
  const from=`Ymo Express <${SMTP_USER}>`;
  try{
    await mailer.sendMail({from,to:COMPANY_EMAIL,subject:`New order ${o.id}`,text});
    if(o.email)await mailer.sendMail({from,to:o.email,subject:`Your Ymo Express order ${o.id}`,text:"Thank you for your order!\n\n"+text});
  }catch(e){console.error("Email failed:",e.message)}
}
app.use(express.json({limit:"50kb"}));
app.use(express.static("public"));
app.get("/api/health",(q,s)=>s.json({ok:true}));
app.post("/api/orders",async(q,s)=>{
  const b=q.body||{};
  const ok=["name","phone","addr","restaurant"].every(k=>typeof b[k]==="string"&&b[k].trim()&&b[k].length<200)
    &&Array.isArray(b.items)&&b.items.length>0&&b.items.length<=30&&Number.isFinite(b.total);
  if(!ok)return s.status(400).json({error:"Invalid order"});
  if(b.pay==="Card"&&!PAYSTACK_SECRET)return s.status(503).json({error:"Card payment is not set up"});
  const orders=load();
  const o={id:"YMO-"+(1001+orders.length),stage:0,paid:false,createdAt:new Date().toISOString(),
    restaurant:b.restaurant,name:b.name,phone:b.phone,email:String(b.email||"").slice(0,120),addr:b.addr,pay:String(b.pay||""),total:b.total,
    items:b.items.map(i=>({n:String(i.n).slice(0,80),q:Math.max(1,Math.min(50,+i.q||1)),p:+i.p||0}))};
  orders.push(o);save(orders);
  if(o.pay==="Card"){
    try{
      const r=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:"Bearer "+PAYSTACK_SECRET,"Content-Type":"application/json"},
        body:JSON.stringify({email:o.email,amount:Math.round(o.total*100),currency:"NGN",reference:o.id+"-"+Date.now(),callback_url:`${BASE_URL}/?order=${o.id}`})});
      const d=(await r.json()).data;
      if(!d?.authorization_url)throw new Error("initialize failed");
      o.ref=d.reference;save(orders);
      return s.status(201).json({id:o.id,payUrl:d.authorization_url});
    }catch(e){console.error("Paystack:",e.message);return s.status(502).json({error:"Payment unavailable"})}
  }
  await notify(o);
  s.status(201).json({id:o.id});
});
app.get("/api/orders/:id",(q,s)=>{const o=load().find(x=>x.id===q.params.id);o?s.json({stage:o.stage,paid:!!o.paid}):s.sendStatus(404)});
app.get("/api/orders/:id/verify",async(q,s)=>{
  const all=load(),o=all.find(x=>x.id===q.params.id);
  if(!o)return s.sendStatus(404);
  if(!o.paid&&o.ref&&PAYSTACK_SECRET){
    try{
      const r=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(o.ref),{headers:{Authorization:"Bearer "+PAYSTACK_SECRET}});
      const d=(await r.json()).data;
      if(d?.status==="success"&&d.amount===Math.round(o.total*100)){o.paid=true;save(all);await notify(o)}
    }catch(e){console.error("Verify:",e.message)}
  }
  s.json({paid:!!o.paid,stage:o.stage,restaurant:o.restaurant,total:o.total});
});
app.get("/api/orders",(q,s)=>isAdmin(q,s,()=>s.json(load().reverse())));
app.patch("/api/orders/:id",(q,s)=>isAdmin(q,s,()=>{
  const all=load(),o=all.find(x=>x.id===q.params.id),st=q.body?.stage;
  if(!o||!Number.isInteger(st)||st<0||st>=STAGES.length)return s.sendStatus(400);
  o.stage=st;save(all);s.json({ok:true});
}));
app.listen(PORT,()=>console.log("Ymo Express running on port "+PORT));
