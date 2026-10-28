import {useCallback,useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {supabase} from './lib/supabase'
type Category={id:string;nome:string;ativo:boolean;tipo?:string}
type Closure={id:string;inicio:string;fim:string;observacao:string|null;reaberto_em:string|null;reabertura_motivo:string|null;resumo:{vendedor_nome:string;total_recebido:number;comissao_apurada:number}[]|null}
export function FinanceAdministration(){
 const [categories,setCategories]=useState<Category[]>([]),[centers,setCenters]=useState<Category[]>([]),[closures,setClosures]=useState<Closure[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(0),[count,setCount]=useState(0)
 const load=useCallback(async()=>{
  const [c,cc,f]=await Promise.all([supabase.from('categorias_financeiras').select('*').order('nome'),supabase.from('centros_custo').select('*').order('nome'),supabase.from('fechamentos_comissao').select('*',{count:'exact'}).order('fechado_em',{ascending:false}).order('id').range(page*20,page*20+19)])
  if(c.error||cc.error||f.error){setError((c.error||cc.error||f.error)!.message);return}
  setCategories(c.data);setCenters(cc.data);setClosures(f.data);setCount(f.count||0)
 },[page])
 useEffect(()=>{void load()},[load])
 async function create(e:FormEvent<HTMLFormElement>,table:'categorias_financeiras'|'centros_custo'){
  e.preventDefault();if(busy)return;const form=e.currentTarget;const f=new FormData(form);const nome=String(f.get('nome')||'').trim()
  if(!nome)return;setBusy(true);setError('')
  try{const r=await supabase.from(table).insert(table==='categorias_financeiras'?{nome,tipo:String(f.get('tipo'))}:{nome});if(r.error){setError(r.error.message);return}form.reset();await load()}finally{setBusy(false)}
 }
 async function toggle(table:'categorias_financeiras'|'centros_custo',item:Category){
  setBusy(true);setError('');try{const r=await supabase.from(table).update({ativo:!item.ativo}).eq('id',item.id);if(r.error)setError(r.error.message);else await load()}finally{setBusy(false)}
 }
 async function close(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);setBusy(true);setError('')
  try{const r=await supabase.rpc('fechar_comissoes_erp',{p_inicio:f.get('inicio'),p_fim:f.get('fim'),p_motivo:f.get('motivo')});if(r.error)setError(r.error.message);else await load()}finally{setBusy(false)}
 }
 async function reopen(id:string){
  const motivo=window.prompt('Justifique a reabertura deste período (mínimo de 5 caracteres):');if(!motivo)return;setBusy(true);setError('')
  try{const r=await supabase.rpc('reabrir_comissoes_erp',{p_id:id,p_motivo:motivo});if(r.error)setError(r.error.message);else await load()}finally{setBusy(false)}
 }
 return <section className="panel"><h3>Administração financeira</h3>{error&&<p role="alert">{error}</p>}
 <h4>Categorias financeiras</h4><form className="paymentEntry" onSubmit={e=>void create(e,'categorias_financeiras')}><label>Nome<input name="nome" required maxLength={100}/></label><label>Aplicação<select name="tipo"><option value="ambos">Receber e pagar</option><option value="receber">Receber</option><option value="pagar">Pagar</option></select></label><button className="primary" disabled={busy}>Adicionar categoria</button></form>
 {categories.map(c=><p key={c.id}>{c.nome} · {c.tipo} · {c.ativo?'Ativa':'Inativa'} <button className="ghost" disabled={busy} onClick={()=>void toggle('categorias_financeiras',c)}>{c.ativo?'Inativar':'Reativar'}</button></p>)}
 <h4>Centros de custo</h4><form className="paymentEntry" onSubmit={e=>void create(e,'centros_custo')}><label>Nome<input name="nome" required maxLength={100}/></label><button className="primary" disabled={busy}>Adicionar centro</button></form>
 {centers.map(c=><p key={c.id}>{c.nome} · {c.ativo?'Ativo':'Inativo'} <button className="ghost" disabled={busy} onClick={()=>void toggle('centros_custo',c)}>{c.ativo?'Inativar':'Reativar'}</button></p>)}
 <h4>Fechamento de comissões</h4><p>O fechamento guarda um resumo do período e bloqueia recebimentos e estornos retroativos. Uma reabertura exige justificativa e preserva o histórico.</p>
 <form className="paymentEntry" onSubmit={e=>void close(e)}><label>Início<input type="date" name="inicio" required/></label><label>Fim<input type="date" name="fim" required/></label><label>Justificativa<input name="motivo" minLength={5} required/></label><button className="primary" disabled={busy}>Fechar período</button></form>
 {closures.map(f=><article key={f.id}><h4>{f.inicio} a {f.fim} · {f.reaberto_em?'Reaberto':'Fechado'}</h4><p>{f.observacao}{f.reabertura_motivo?' · Reabertura: '+f.reabertura_motivo:''}</p>{f.resumo?.map((r,i)=><p key={i}>{r.vendedor_nome} · Recebido líquido: {Number(r.total_recebido).toFixed(2)} · Comissão: {Number(r.comissao_apurada).toFixed(2)}</p>)}{!f.reaberto_em&&<button className="warningBtn" disabled={busy} onClick={()=>void reopen(f.id)}>Reabrir com justificativa</button>}</article>)}
 <div className="formActions"><button className="ghost" disabled={!page||busy} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {count} fechamento(s)</span><button className="ghost" disabled={(page+1)*20>=count||busy} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
 </section>
}
export function FinanceClassifications({category,center}:{category:string|null;center:string|null}){
 const [categories,setCategories]=useState<Category[]>([]),[centers,setCenters]=useState<Category[]>([])
 useEffect(()=>{let cancelled=false;void Promise.all([supabase.from('categorias_financeiras').select('*').eq('ativo',true).order('nome'),supabase.from('centros_custo').select('*').eq('ativo',true).order('nome')]).then(([c,cc])=>{if(!cancelled){setCategories(c.data||[]);setCenters(cc.data||[])}});return()=>{cancelled=true}},[])
 return <><label className="fieldLabel">Categoria<select name="categoria" defaultValue={category||''}><option value="">Sem categoria</option>{category&&!categories.some(c=>c.nome===category)&&<option value={category}>{category} (registro anterior)</option>}{categories.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}</select></label><label className="fieldLabel">Centro de custo<select name="centro_custo" defaultValue={center||''}><option value="">Sem centro</option>{center&&!centers.some(c=>c.nome===center)&&<option value={center}>{center} (registro anterior)</option>}{centers.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}</select></label></>
}
