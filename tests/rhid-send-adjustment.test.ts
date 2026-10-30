import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendAdjustment} from '../supabase/functions/rhid-proxy/send-adjustment.ts';

const id='11111111-1111-4111-8111-111111111111';
function scenario({missingAudit=false,timeout=false,permission=true,changedRead=false,businessError=false,storageFailure=false}={}) {
  const initial={id,funcionario_id:'employee',data:'2026-06-26',entrada_1:'08:01:00',saida_1:'13:00:00',entrada_2:null,saida_2:null,
    observacao:'ajuste',status:'presente',envio_status:'aguardando_envio',rhid_snapshot:{punches:[{time:'08:00'},{time:'13:00'}]},rhid_resposta:null};
  const state:any={row:initial,history:[],writes:0,reads:0,audits:0,remoteSaved:false,requests:0,missingAudit};
  const db={from(table:string){
    let op='select',values:any,filters:Array<(r:any)=>boolean>=[];
    const field=(r:any,key:string)=>key==='rhid_resposta->>attempt_id'?r.rhid_resposta?.attempt_id:r[key];
    const query:any={
      select(){return query;},update(v:any){op='update';values=v;return query;},insert(v:any){op='insert';values=v;return query;},
      eq(k:string,v:any){filters.push(r=>field(r,k)===v);return query;},is(k:string,v:any){filters.push(r=>(field(r,k)??null)===v);return query;},
      single(){return run();},maybeSingle(){return run();},then(a:any,b:any){return run().then(a,b);}
    };
    async function run(){
      if(table==='funcionarios')return {data:{id:'employee',ativo:true,rhid_person_id:7},error:null};
      if(table==='rh_ponto_ajustes_historico'){
        if(storageFailure&&values.acao==='inicio_envio_rhid')return {data:null,error:{message:'failure'}};
        state.history.push(structuredClone(values));return {data:null,error:null};
      }
      if(!filters.every(f=>f(state.row)))return {data:null,error:null};
      if(op==='update')Object.assign(state.row,structuredClone(values));
      return {data:structuredClone(state.row),error:null};
    }
    return query;
  }};
  const fetcher:any=async(url:string,options:any)=>{
    state.requests++;
    if(url.endsWith('/insertlist2')){
      state.writes++;
      const body=JSON.parse(options.body);
      assert.deepEqual(body.idPerson,[7]);
      assert.equal(body.afdChanges.filter((c:any)=>c._typeAfdChange==='I').length,1);
      state.remoteSaved=true;
      if(timeout)throw new Error('transport failure with sensitive upstream details');
      return Response.json(businessError?{success:false}:{success:true});
    }
    if(url.endsWith('/person'))return Response.json([{id:7,pis:12345678901}]);
    if(url.includes('list_alteracoes_ponto')){
      state.audits++;
      return Response.json(state.missingAudit?[]:[
        {idPerson:7,idAfdChange:99,dateTimeStr:'202606260801',reason:'ajuste',excluded:0},
        {idPerson:7,idAfdChange:12,dateTimeStr:'202606260800',excluded:1}
      ]);
    }
    if(url.includes('/apuracao_ponto?')){
      state.reads++;
      return Response.json({afdChanges:[
        {idPerson:7,idAfd:0,idAfdChange:state.remoteSaved?99:12,dateTimeStr:state.remoteSaved?'202606260801':changedRead?'202606260900':'202606260800'},
        {idPerson:7,idAfd:0,idAfdChange:11,dateTimeStr:'202606261300'}
      ]});
    }
    throw new Error('unexpected URL');
  };
  const send=()=>sendAdjustment({adjustment_id:id,person_id:999,entrada_1:'01:00'},
    {db,userId:'actor',canEdit:permission},async()=>'synthetic-session-only',{fetcher});
  return {state,send};
}
test('full flow marks synchronized only after readback, audit and stored history',async()=>{
  const {state,send}=scenario();
  const result=await send();
  assert.equal(result.verified,true);assert.equal(state.writes,1);assert.equal(state.row.envio_status,'enviado');
  assert.equal(state.row.rhid_resposta.audit_verified,true);
  assert.equal(state.history.at(-1).acao,'enviado_rhid');
  assert.ok(!JSON.stringify(state.row).includes('synthetic-session'));
  assert.ok(!JSON.stringify(state.row).includes('12345678901'));
});
test('missing audit refuses synchronization; retry reconciles without resending',async()=>{
  const {state,send}=scenario({missingAudit:true});
  await assert.rejects(send(),(e:any)=>e.code==='RHID_NOT_VERIFIED');
  assert.equal(state.row.envio_status,'erro');assert.equal(state.writes,1);
  state.missingAudit=false;
  const result=await send();
  assert.equal(result.recovered,true);assert.equal(state.writes,1);assert.equal(state.row.envio_status,'enviado');
});
test('timeout after a write is never blindly resent',async()=>{
  const {state,send}=scenario({timeout:true});
  await assert.rejects(send(),(e:any)=>e.code==='RHID_CONNECTION');
  assert.equal(state.row.envio_status,'erro');assert.equal(state.writes,1);
  const result=await send();
  assert.equal(result.recovered,true);assert.equal(state.writes,1);
});
test('read-only user cannot invoke any RHID request',async()=>{
  const {state,send}=scenario({permission:false});
  await assert.rejects(send(),(e:any)=>e.status===403);assert.equal(state.requests,0);
});
test('changed upstream snapshot refuses dispatch',async()=>{
  const {state,send}=scenario({changedRead:true});
  await assert.rejects(send(),(e:any)=>e.code==='STALE_SNAPSHOT');assert.equal(state.writes,0);
});
test('failure to store initial history refuses dispatch',async()=>{
  const {state,send}=scenario({storageFailure:true});
  await assert.rejects(send());assert.equal(state.writes,0);
});
test('HTTP 200 with business failure cannot produce synchronized state',async()=>{
  const {state,send}=scenario({businessError:true});
  await assert.rejects(send(),(e:any)=>e.code==='RHID_REJECTED');assert.equal(state.row.envio_status,'erro');
});
test('concurrent attempts dispatch at most one write',async()=>{
  const {state,send}=scenario();
  const results=await Promise.allSettled([send(),send()]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(state.writes,1);
});



