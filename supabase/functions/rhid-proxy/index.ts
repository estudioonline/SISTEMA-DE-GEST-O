import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
import {sendAdjustment} from './send-adjustment.ts';
import {AdjustmentError} from './adjustment.ts';

const RHID_BASE="https://www.rhid.com.br/v2/api.svc";
const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}})}
const normalize=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toUpperCase();

async function requireRhAccess(req:Request){
  const auth=req.headers.get("Authorization")||"";
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
  if(!auth||!url||!key)throw new Error("Sessão inválida.");
  const sb=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data,error}=await sb.rpc("minhas_permissoes_erp");
  if(error)throw new Error("Não foi possível validar o acesso ao RH.");
  const finance=(Array.isArray(data)?data:[]).find((r)=>r?.modulo==="financeiro");
  if(!finance||!["visualizar","editar"].includes(String(finance.nivel)))throw new Error("Sem acesso ao RH.");
  const {data:userData,error:userError}=await sb.auth.getUser();
  if(userError||!userData.user)throw new Error("Sessão inválida.");
  return {db:sb,userId:userData.user.id,canEdit:finance.nivel==="editar"};
}

async function loginRequest(email:string,password:string,domain?:string){
  const body:Record<string,string>={email,password,system:"rhid"};
  if(domain)body.domain=domain;
  const res=await fetch(`${RHID_BASE}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const text=await res.text();
  let parsed:any=null; try{parsed=text?JSON.parse(text):null}catch{parsed={error:text}}
  return {res,parsed};
}

async function rhidLogin(){
  const email=Deno.env.get("RHID_EMAIL"),password=Deno.env.get("RHID_PASSWORD"),configuredDomain=Deno.env.get("RHID_DOMAIN")||undefined;
  if(!email||!password)throw new Error("Integração RHID não configurada.");

  let attempt=await loginRequest(email,password,configuredDomain);
  if(attempt.res.ok&&attempt.parsed?.accessToken)return attempt.parsed.accessToken;

  const customers=Array.isArray(attempt.parsed?.listCustomer)?attempt.parsed.listCustomer:[];
  if(!configuredDomain&&customers.length===1&&customers[0]?.domain){
    attempt=await loginRequest(email,password,String(customers[0].domain));
    if(attempt.res.ok&&attempt.parsed?.accessToken)return attempt.parsed.accessToken;
  }

  if(!configuredDomain&&customers.length>1){
    const domains=customers.map((c:any)=>String(c?.domain||c?.name||"")).filter(Boolean);
    throw new Error("RHID exige seleção de domínio. Cadastre RHID_DOMAIN com um destes valores: "+domains.join(", "));
  }

  const safeError=String(attempt.parsed?.error||attempt.parsed?.message||attempt.parsed?.data||"").trim();
  const err=new Error(`Falha ao autenticar no RHID (HTTP ${attempt.res.status})${safeError?": "+safeError:""}.`) as Error & {status?:number};err.status=attempt.res.status;throw err;
}

async function rhidData(path:string){
  const token=await rhidLogin();
  const res=await fetch(`${RHID_BASE}${path}`,{headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"}});
  const text=await res.text();let body:unknown;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!res.ok)throw new Error(`RHID respondeu HTTP ${res.status}`);
  return body;
}
function extractPeople(value:unknown,depth=0):Record<string,unknown>[]{
  if(depth>5||value==null)return [];
  if(Array.isArray(value)){
    const direct=value.filter(v=>v&&typeof v==="object") as Record<string,unknown>[];
    if(direct.some(v=>("id" in v||"idPerson" in v)&&("name" in v||"nome" in v)))return direct;
    for(const item of value){const nested=extractPeople(item,depth+1);if(nested.length)return nested}
    return [];
  }
  if(typeof value==="string"){
    try{return extractPeople(JSON.parse(value),depth+1)}catch{return []}
  }
  if(typeof value==="object"){
    const o=value as Record<string,unknown>;
    for(const key of ["records","data","items","results","persons","pessoas","listPerson","success"]){
      if(key in o){const nested=extractPeople(o[key],depth+1);if(nested.length)return nested}
    }
    for(const nestedValue of Object.values(o)){const nested=extractPeople(nestedValue,depth+1);if(nested.length)return nested}
  }
  return [];
}
function personId(p:Record<string,unknown>){const v=p.idPerson??p.id_person??p.personId??p.id;return v==null?null:Number(v)}
function personName(p:Record<string,unknown>){return String(p.name??p.nome??p.fullName??p.full_name??p.description??"")}
async function autoLinkPeople(peoplePayload:unknown,req:Request){
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY"),auth=req.headers.get("Authorization")||"";
  if(!url||!key||!auth)return {linked:0,unmatched:0,people:0};
  const db=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data:employees,error}=await db.from("funcionarios").select("id,nome,rhid_person_id").eq("ativo",true);if(error)throw error;
  const people=extractPeople(peoplePayload);let linked=0,unmatched=0;
  for(const employee of employees||[]){
    if(employee.rhid_person_id)continue;
    const target=normalize(employee.nome);
    let matches=people.filter(p=>normalize(personName(p))===target);
    if(!matches.length){
      matches=people.filter(p=>{
        const n=normalize(personName(p));
        return n.length>=8&&(n.includes(target)||target.includes(n));
      });
    }
    if(matches.length===1){
      const id=personId(matches[0]);
      if(Number.isFinite(id)){
        const {error:updateError}=await db.from("funcionarios").update({rhid_person_id:id}).eq("id",employee.id).is("rhid_person_id",null);
        if(!updateError)linked++; else unmatched++;
      }else unmatched++;
    }else unmatched++;
  }
  console.log("RHID_LINK_SUMMARY",JSON.stringify({people:people.length,linked,unmatched}));
  return {linked,unmatched,people:people.length};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:corsHeaders});
  try{
    const access=await requireRhAccess(req);
    let payload:Record<string,unknown>={};if(req.method!=="GET"){try{payload=await req.json()}catch{}}
    const url=new URL(req.url),action=String(payload.action||url.searchParams.get("action")||"status");
    if(action==="status"){const configured=Boolean(Deno.env.get("RHID_EMAIL")&&Deno.env.get("RHID_PASSWORD"));if(!configured)return json({configured:false});const people=await rhidData("/person");const result=await autoLinkPeople(people,req);return json({configured:true,connected:true,...result})}
    if(action==="people"){const people=await rhidData("/person");const result=await autoLinkPeople(people,req);return json({people,linking:result})}
    if(action==="attendance"){
      const personIdValue=String(payload.person_id||url.searchParams.get("person_id")||""),start=String(payload.start||url.searchParams.get("start")||""),end=String(payload.end||url.searchParams.get("end")||"");
      if(!personIdValue||!start||!end)return json({error:"person_id, start e end são obrigatórios"},400);
      return json(await rhidData(`/apuracao_ponto?idPerson=${encodeURIComponent(personIdValue)}&dataIni=${encodeURIComponent(start)}&dataFinal=${encodeURIComponent(end)}`));
    }
    if(action==="shifts"){
      const token=await rhidLogin();
      const res=await fetch(`${RHID_BASE}/customerdb/shift.svc/a_escalas?start=0&length=200`,{
        headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Accept":"application/json"}
      });
      const text=await res.text();let body:unknown;try{body=text?JSON.parse(text):null}catch{body=text}
      if(!res.ok)return json({error:`RHID respondeu HTTP ${res.status} ao listar escalas.`},res.status);
      return json(body);
    }
    if(action==="assign_saturday_shift"){
      const personIdValue=Number(payload.person_id||0),shiftId=Number(payload.shift_id||0),date=String(payload.date||"");
      if(!Number.isFinite(personIdValue)||personIdValue<=0||!Number.isFinite(shiftId)||shiftId<=0||!/^(20\\d{2})-(\\d{2})-(\\d{2})$/.test(date)){
        return json({error:"person_id, shift_id e date válidos são obrigatórios."},400);
      }
      const token=await rhidLogin();
      const compact=date.replace(/-/g,"");
      const assignment=[{idPerson:personIdValue,idShift:shiftId,startStr:compact+"0000",endStr:compact+"2359"}];
      const res=await fetch(`${RHID_BASE}/customerdb/shift.svc/insertlist`,{
        method:"POST",
        headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(assignment)
      });
      const text=await res.text();let body:unknown;try{body=text?JSON.parse(text):null}catch{body=text}
      if(!res.ok)return json({error:`RHID respondeu HTTP ${res.status} ao atribuir a escala.`,details:body},res.status);
      return json({ok:true,response:body});
    }
    if(action==="probe_point_write"){
      const token=await rhidLogin();
      const candidates=[
        "/customerdb/afdt.svc",
        "/customerdb/afdtmanutencao.svc",
        "/customerdb/afdt_manutencao.svc",
        "/customerdb/ponto.svc",
        "/customerdb/pontomanutencao.svc"
      ];
      const results=[];
      for(const path of candidates){
        try{
          const res=await fetch(`${RHID_BASE}${path}`,{method:"OPTIONS",headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json"}});
          results.push({path,status:res.status,allow:res.headers.get("allow")});
        }catch(e){results.push({path,status:0,error:e instanceof Error?e.message:"erro"})}
      }
      return json({results});
    }
    if(action==="adjustments"){
      const personIdValue=Number(payload.person_id||0),start=String(payload.start||""),end=String(payload.end||"");
      if(!Number.isFinite(personIdValue)||personIdValue<=0||!start||!end)return json({error:"person_id, start e end são obrigatórios"},400);
      const token=await rhidLogin();
      const body={
        approvalStatus:[],departments:[],companies:[],people:[personIdValue],
        ini:start.replace(/-/g,""),fim:end.replace(/-/g,""),
        insertedIni:"",insertedFim:"",classification:"any",pendenciesOnly:false
      };
      const res=await fetch(`${RHID_BASE}/report.svc/list_alteracoes_ponto`,{
        method:"POST",
        headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(body)
      });
      const text=await res.text();let parsed:unknown;try{parsed=text?JSON.parse(text):null}catch{parsed=text}
      if(!res.ok)return json({error:`RHID respondeu HTTP ${res.status} ao consultar alterações.`,details:parsed},res.status);
      return json(parsed);
    }
    if(action==="send_adjustment"){
      if(req.method!=="POST")return json({error:"Use POST para enviar ajustes."},405);
      try{return json(await sendAdjustment(payload,access,rhidLogin))}
      catch(error){if(error instanceof AdjustmentError)return json({error:error.message,code:error.code},error.status);throw error}
    }
    return json({error:"Ação inválida"},400);
  }catch(error){const message=error instanceof Error?error.message:"Erro inesperado";const status=typeof (error as {status?:unknown})?.status==="number"?Number((error as {status:number}).status):500;console.error("RHID_PROXY_ERROR",JSON.stringify({message,status}));return json({error:message,upstream_status:status},status)}
});

