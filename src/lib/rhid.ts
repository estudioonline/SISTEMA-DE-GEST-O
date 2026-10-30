export type RhidPunch={date:string;time:string;kind:'E'|'S'|'';raw:Record<string,unknown>}
export type RhidDay={date:string;entrada_1:string|null;saida_1:string|null;entrada_2:string|null;saida_2:string|null;punches:RhidPunch[]}

function parseMaybe(value:unknown):unknown{
 if(typeof value==='string'){
  const t=value.trim()
  if((t.startsWith('{')&&t.endsWith('}'))||(t.startsWith('[')&&t.endsWith(']'))){
   try{return parseMaybe(JSON.parse(t))}catch{return value}
  }
 }
 if(Array.isArray(value))return value.map(parseMaybe)
 if(value&&typeof value==='object'){
  const out:Record<string,unknown>={}
  for(const [k,v] of Object.entries(value as Record<string,unknown>))out[k]=parseMaybe(v)
  return out
 }
 return value
}

function collect(value:unknown,out:Record<string,unknown>[]=[]){
 if(Array.isArray(value)){for(const v of value)collect(v,out);return out}
 if(value&&typeof value==='object'){
  const o=value as Record<string,unknown>;out.push(o)
  for(const v of Object.values(o))collect(v,out)
 }
 return out
}

function normDate(o:Record<string,unknown>){
 const vals=[o.dateTime,o.datetime,o.dateTimeStr,o.dataHora,o.date,o.data]
 for(const v of vals){
  const s=String(v??'')
  const compact=s.match(/^(20\d{2})(\d{2})(\d{2})\d{4}$/)
  if(compact)return compact[1]+'-'+compact[2]+'-'+compact[3]
  const m=s.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if(m)return m[1]+'-'+m[2]+'-'+m[3]
 }
 return ''
}
function normTime(o:Record<string,unknown>){
 for(const k of ['dateTime','datetime','dateTimeStr','dataHora']){
  const s=String(o[k]??'')
  if(/^20\d{10}$/.test(s))return s.slice(8,10)+':'+s.slice(10,12)
  const m=s.match(/T(\d{2}):(\d{2})/)
  if(m)return m[1]+':'+m[2]
 }
 const h=o.hora??o.hour
 if(h!=null){
  const digits=String(h).replace(/\D/g,'').padStart(4,'0').slice(-4)
  return digits.slice(0,2)+':'+digits.slice(2)
 }
 return ''
}
function kind(o:Record<string,unknown>):'E'|'S'|''{
 const v=String(o.typeEntradaSaida??o.tipoEntradaSaida??o.type??'').toUpperCase()
 return v==='E'||v.includes('ENTRADA')?'E':v==='S'||v.includes('SAIDA')?'S':''
}

export function parseRhidAttendance(payload:unknown):RhidDay[]{
 const root=parseMaybe(payload)
 const objects=collect(root)
 const punches:RhidPunch[]=[]
 for(const o of objects){
  if(o.excluded===true||o.excluded===1||o.excluded==='1'||o._typeAfdChange==='X')continue
  const date=normDate(o),time=normTime(o),k=kind(o)
  if(date&&time&&(k||'hora' in o||'dateTime' in o||'dateTimeStr' in o)){
   if(!punches.some(p=>p.date===date&&p.time===time&&p.kind===k))punches.push({date,time,kind:k,raw:o})
  }
 }
 const map=new Map<string,RhidPunch[]>()
 for(const p of punches){const arr=map.get(p.date)||[];arr.push(p);map.set(p.date,arr)}
 return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,list])=>{
  list.sort((a,b)=>a.time.localeCompare(b.time))
  const ordered=list.slice(0,4)
  const entries=list.filter(p=>p.kind==='E'),exits=list.filter(p=>p.kind==='S')
  const useKinds=entries.length>0&&exits.length>0
  return {
   date,
   entrada_1:(useKinds?entries[0]?.time:ordered[0]?.time)||null,
   saida_1:(useKinds?exits[0]?.time:ordered[1]?.time)||null,
   entrada_2:(useKinds?entries[1]?.time:ordered[2]?.time)||null,
   saida_2:(useKinds?exits[1]?.time:ordered[3]?.time)||null,
   punches:list
  }
 })
}


