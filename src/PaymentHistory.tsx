import {useCallback,useEffect,useState} from 'react'
import {supabase} from './lib/supabase'
type Reversal={id:string;data_estorno:string;motivo:string;valor:number}
type Payment={id:string;data_pagamento:string;valor:number;observacao:string|null;forma_pagamento:string|null;estornos_pagamentos:Reversal[]}
const currency=(n:number)=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const paymentLabel=(v:string|null)=>v==='pix'?'PIX':v==='cartao'?'Cartão':v==='boleto'?'Boleto':v==='dinheiro'?'Dinheiro':v==='transferencia'?'Transferência':v==='ajuste'?'Ajuste':v==='outro'?'Outro':v||'Não informada'
export function PaymentHistory({titleId,onChanged,onOpenTransaction}:{titleId:string;onChanged:()=>Promise<void>;onOpenTransaction?:(id:string)=>void}){
 const [rows,setRows]=useState<Payment[]>([]),[error,setError]=useState(''),[selected,setSelected]=useState<string|null>(null),[reason,setReason]=useState(''),[date,setDate]=useState(localDate),[busy,setBusy]=useState(false),[page,setPage]=useState(0),[count,setCount]=useState(0)
 const [journalLinks,setJournalLinks]=useState<Record<string,string[]>>({})
 const load=useCallback(async()=>{
  const r=await supabase.from('pagamentos_titulos').select('id,data_pagamento,valor,observacao,forma_pagamento,estornos_pagamentos(id,data_estorno,motivo,valor)',{count:'exact'}).eq('titulo_id',titleId).order('created_at',{ascending:false}).order('id').range(page*20,page*20+19)
  if(r.error){setError(r.error.message);return}
  setJournalLinks({})
  if(r.data?.length){
   const links=await supabase.from('conciliacoes_bancarias').select('pagamento_id,transacao_id').in('pagamento_id',r.data.map(p=>p.id))
   if(links.error)setError('Não foi possível carregar o vínculo com o diário: '+links.error.message)
   else{
    const mapped:Record<string,string[]>={}
    for(const link of links.data||[])if(link.pagamento_id&&link.transacao_id){
     mapped[link.pagamento_id]=Array.from(new Set([...(mapped[link.pagamento_id]||[]),link.transacao_id]))
    }
    setJournalLinks(mapped)
   }
  }
  const wire=r.data as unknown as (Omit<Payment,'estornos_pagamentos'>&{estornos_pagamentos:Reversal[]|Reversal|null})[]
  setRows(wire.map(p=>({...p,estornos_pagamentos:Array.isArray(p.estornos_pagamentos)?p.estornos_pagamentos:p.estornos_pagamentos?[p.estornos_pagamentos]:[]})));setCount(r.count||0)
 },[titleId,page])
 useEffect(()=>{void load()},[load])
 async function reverse(){
  if(busy||!selected)return
  if(reason.trim().length<5){setError('Informe uma justificativa com pelo menos 5 caracteres.');return}
  setBusy(true);setError('')
  try{
   const r=await supabase.rpc('estornar_pagamento_erp',{p_pagamento:selected,p_data:date,p_motivo:reason})
   if(r.error){setError(r.error.message);return}
   setSelected(null);setReason('');await load();await onChanged()
  }finally{setBusy(false)}
 }
 return <section className="panel"><h4>Pagamentos e estornos</h4><p>O estorno integral corrige o saldo e a comissão, preserva o pagamento original e registra a justificativa. Esta ação não movimenta uma conta bancária.</p>
 {error&&<p role="alert">{error}</p>}
 {rows.map(p=><article key={p.id}><p>{p.data_pagamento} · {currency(p.valor)} · {paymentLabel(p.forma_pagamento)} · {p.observacao||'Pagamento registrado'}</p>
 {onOpenTransaction&&(journalLinks[p.id]||[]).map(id=><button key={id} type="button" className="financeOriginLink" onClick={()=>onOpenTransaction(id)}>Abrir linha do diário ↗</button>)}
 {p.estornos_pagamentos.length?p.estornos_pagamentos.map(e=><p key={e.id}>Estornado em {e.data_estorno}: {currency(e.valor)} · {e.motivo}</p>):<button type="button" className="warningBtn" disabled={busy} onClick={()=>{setSelected(p.id);setReason('');setDate(localDate())}}>Estornar este pagamento</button>}
 {selected===p.id&&<div className="paymentEntry"><label>Data do estorno<input type="date" min={p.data_pagamento} max={localDate()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Justificativa<input value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="button" disabled={busy} className="dangerAction" onClick={()=>void reverse()}>{busy?'Registrando...':'Confirmar estorno integral'}</button><button type="button" className="ghost" disabled={busy} onClick={()=>setSelected(null)}>Voltar</button></div>}
 </article>)}
 {!rows.length&&<p>Nenhum pagamento registrado.</p>}
 <div className="formActions"><button type="button" className="ghost" disabled={!page||busy} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {count} pagamento(s)</span><button type="button" className="ghost" disabled={(page+1)*20>=count||busy} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
 </section>
}
