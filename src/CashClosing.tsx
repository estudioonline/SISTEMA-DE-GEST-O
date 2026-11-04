import {useCallback,useEffect,useMemo,useState} from 'react'
import {Banknote,CheckCircle2,FileDown,Landmark,RefreshCw,RotateCcw,WalletCards} from 'lucide-react'
import {supabase} from './lib/supabase'
import {generateCashClosingPdf} from './lib/cashClosingPdf'

type CashSummaryRow={
  diario_id:string
  diario_nome:string
  banco:string|null
  saldo_inicial:number
  entradas:number
  saidas:number
  saldo_esperado:number
}
type CashClosing={
  id:string
  data_caixa:string
  total_saldo_inicial:number
  total_entradas:number
  total_saidas:number
  total_saldo_esperado:number
  total_saldo_conferido:number
  total_diferenca:number
  observacao:string|null
  status:'fechado'|'reaberto'
  fechado_em:string
  reaberto_em:string|null
  reabertura_motivo:string|null
}
type CashClosingItem={
  id:string
  fechamento_id:string
  diario_id:string
  diario_nome:string
  banco:string|null
  saldo_inicial:number
  entradas:number
  saidas:number
  saldo_esperado:number
  saldo_conferido:number
  diferenca:number
}

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0)
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const dateBr=(value:string)=>new Intl.DateTimeFormat('pt-BR').format(new Date(value+'T12:00:00'))
const dateTimeBr=(value:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))

export function CashClosing({canEdit,isAdmin,company}:{canEdit:boolean;isAdmin:boolean;company?:{nome_fantasia?:string|null;razao_social?:string|null;cnpj?:string|null;email?:string|null}|null}){
  const [date,setDate]=useState(today())
  const [summary,setSummary]=useState<CashSummaryRow[]>([])
  const [history,setHistory]=useState<CashClosing[]>([])
  const [items,setItems]=useState<CashClosingItem[]>([])
  const [selectedClosing,setSelectedClosing]=useState<string|null>(null)
  const [checked,setChecked]=useState<Record<string,string>>({})
  const [observation,setObservation]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  const loadHistory=useCallback(async()=>{
    const {data,error}=await supabase.from('fechamentos_caixa_diario').select('*').order('data_caixa',{ascending:false}).limit(45)
    if(error){setMessage(error.message);return}
    setHistory((data||[]) as CashClosing[])
  },[])

  const loadSummary=useCallback(async(selectedDate:string)=>{
    setBusy(true);setMessage('')
    try{
      const {data,error}=await supabase.rpc('resumo_caixa_diario',{p_data:selectedDate})
      if(error)throw error
      const rows=(data||[]) as CashSummaryRow[]
      setSummary(rows)
      setChecked(Object.fromEntries(rows.map(row=>[row.diario_id,String(Number(row.saldo_esperado).toFixed(2))])))
      const existing=history.find(row=>row.data_caixa===selectedDate)
      setObservation(existing?.observacao||'')
    }catch(error){setMessage((error as Error).message)}
    finally{setBusy(false)}
  },[history])

  useEffect(()=>{void loadHistory()},[loadHistory])
  useEffect(()=>{void loadSummary(date)},[date,loadSummary])

  const totals=useMemo(()=>summary.reduce((acc,row)=>{
    const checkedValue=Number(checked[row.diario_id]??row.saldo_esperado)||0
    acc.initial+=Number(row.saldo_inicial)||0
    acc.in+=Number(row.entradas)||0
    acc.out+=Number(row.saidas)||0
    acc.expected+=Number(row.saldo_esperado)||0
    acc.checked+=checkedValue
    return acc
  },{initial:0,in:0,out:0,expected:0,checked:0}),[summary,checked])
  const difference=totals.checked-totals.expected
  const chartRows=useMemo(()=>{
    const rows=summary
      .map((row,index)=>({
        id:row.diario_id,
        name:row.diario_nome,
        value:Math.max(0,Number(row.saldo_esperado)||0),
        color:`hsl(${(index*57+212)%360} 72% 58%)`
      }))
      .filter(row=>row.value>0)
    const total=rows.reduce((sum,row)=>sum+row.value,0)
    let cursor=0
    const slices=rows.map(row=>{
      const start=total?cursor/total*360:0
      cursor+=row.value
      const end=total?cursor/total*360:0
      return {...row,percentage:total?row.value/total*100:0,start,end}
    })
    return {total,slices}
  },[summary])
  const chartGradient=chartRows.slices.length
    ? `conic-gradient(${chartRows.slices.map(row=>`${row.color} ${row.start}deg ${row.end}deg`).join(',')})`
    : 'conic-gradient(#334155 0deg 360deg)'

  async function closeDay(){
    if(!canEdit||busy)return
    if(Math.abs(difference)>.009&&observation.trim().length<5){
      setMessage('Existe diferença no fechamento. Informe uma observação com pelo menos 5 caracteres.')
      return
    }
    if(!window.confirm('Confirmar o fechamento geral de '+dateBr(date)+' com todos os bancos e o dinheiro?'))return
    setBusy(true);setMessage('')
    try{
      const payload=Object.fromEntries(summary.map(row=>[row.diario_id,Number(checked[row.diario_id]??row.saldo_esperado)]))
      const {error}=await supabase.rpc('fechar_caixa_diario',{p_data:date,p_saldos_conferidos:payload,p_observacao:observation.trim()||null})
      if(error)throw error
      setMessage('Fechamento diário concluído com todos os bancos.')
      await loadHistory()
      await loadSummary(date)
    }catch(error){setMessage((error as Error).message)}
    finally{setBusy(false)}
  }

  async function openClosing(row:CashClosing){
    setSelectedClosing(row.id);setItems([]);setMessage('')
    const {data,error}=await supabase.from('fechamentos_caixa_diario_itens').select('*').eq('fechamento_id',row.id).order('diario_nome')
    if(error){setMessage(error.message);return}
    setItems((data||[]) as CashClosingItem[])
  }

  async function exportPdf(row:CashClosing){
    setBusy(true);setMessage('')
    try{
      const {data,error}=await supabase.from('fechamentos_caixa_diario_itens').select('*').eq('fechamento_id',row.id).order('diario_nome')
      if(error)throw error
      const pdfItems=(data||[]) as CashClosingItem[]
      if(!pdfItems.length)throw new Error('Este fechamento não possui contas registradas para gerar o PDF.')
      generateCashClosingPdf({
        data_caixa:row.data_caixa,
        company,
        status:row.status,
        fechado_em:row.fechado_em,
        observacao:row.observacao,
        items:pdfItems
      })
    }catch(error){setMessage((error as Error).message)}
    finally{setBusy(false)}
  }

  async function reopen(row:CashClosing){
    if(!isAdmin||busy)return
    const reason=window.prompt('Motivo para reabrir este fechamento:')
    if(!reason)return
    setBusy(true);setMessage('')
    try{
      const {error}=await supabase.rpc('reabrir_caixa_diario',{p_id:row.id,p_motivo:reason})
      if(error)throw error
      setMessage('Fechamento reaberto.')
      await loadHistory()
    }catch(error){setMessage((error as Error).message)}
    finally{setBusy(false)}
  }

  return <section className="cashClosingPage">
    <div className="cashClosingHero panel">
      <div>
        <span className="cashClosingEyebrow">Fechamento diário</span>
        <h2>Caixa geral</h2>
        <p>Conferência consolidada de Dinheiro e de todos os bancos ativos. Ajustes operacionais não entram como conta.</p>
      </div>
      <div className="cashClosingDate">
        <label>Data do fechamento<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <button className="ghost" disabled={busy} onClick={()=>void loadSummary(date)}><RefreshCw size={15}/>Atualizar</button>
      </div>
    </div>

    {message&&<div className="panel noticePanel" role="status">{message}</div>}

    <div className="cashClosingTotals">
      <article className="card"><span>Saldo inicial</span><strong>{money(totals.initial)}</strong></article>
      <article className="card cashClosingPositive"><span>Entradas do dia</span><strong>{money(totals.in)}</strong></article>
      <article className="card cashClosingNegative"><span>Saídas do dia</span><strong>{money(totals.out)}</strong></article>
      <article className="card cashClosingExpected"><span>Saldo esperado</span><strong>{money(totals.expected)}</strong></article>
      <article className="card"><span>Saldo conferido</span><strong>{money(totals.checked)}</strong></article>
      <article className={'card '+(Math.abs(difference)<.01?'cashClosingOk':'cashClosingWarning')}><span>Diferença</span><strong>{money(difference)}</strong></article>
    </div>

    <article className="panel cashClosingChart">
      <div className="panelHead">
        <div><h3>Distribuição do saldo por conta</h3><p>Participação de cada banco e do dinheiro no saldo esperado do dia.</p></div>
        <span className="badge">{chartRows.slices.length} contas com saldo</span>
      </div>
      {chartRows.total>0?<div className="cashClosingChartBody">
        <div className="cashClosingPieWrap">
          <div className="cashClosingPie" role="img" aria-label="Gráfico de pizza da distribuição do saldo esperado por conta" style={{background:chartGradient}}>
            <div className="cashClosingPieCenter"><span>Total</span><strong>{money(chartRows.total)}</strong></div>
          </div>
        </div>
        <div className="cashClosingLegend">
          {chartRows.slices.map(row=><div className="cashClosingLegendRow" key={row.id}>
            <span className="cashClosingLegendDot" style={{background:row.color}} aria-hidden="true"/>
            <div><strong>{row.name}</strong><small>{money(row.value)}</small></div>
            <b>{row.percentage.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%</b>
          </div>)}
        </div>
      </div>:<div className="cashClosingEmpty"><WalletCards size={28}/><strong>Sem saldo para exibir no gráfico</strong></div>}
    </article>

    <article className="panel cashClosingAccounts">
      <div className="panelHead">
        <div><h3>Conferência por conta</h3><p>Confira cada banco separadamente antes de encerrar o dia.</p></div>
        <span className="badge">{summary.length} contas</span>
      </div>
      <div className="tableWrap"><table>
        <thead><tr><th>Conta</th><th>Saldo inicial</th><th>Entradas</th><th>Saídas</th><th>Esperado</th><th>Saldo conferido</th><th>Diferença</th></tr></thead>
        <tbody>{summary.map(row=>{
          const actual=Number(checked[row.diario_id]??row.saldo_esperado)||0
          const diff=actual-Number(row.saldo_esperado)
          const isCash=row.diario_nome.toLowerCase()==='dinheiro'
          return <tr key={row.diario_id}>
            <td><div className="cashAccountName">{isCash?<Banknote size={18}/>:<Landmark size={18}/>}<div><strong>{row.diario_nome}</strong><span>{row.banco||'Conta financeira'}</span></div></div></td>
            <td>{money(Number(row.saldo_inicial))}</td>
            <td className="cashAmountPositive">{money(Number(row.entradas))}</td>
            <td className="cashAmountNegative">{money(Number(row.saidas))}</td>
            <td><strong>{money(Number(row.saldo_esperado))}</strong></td>
            <td><input className="cashClosingValue" type="number" step="0.01" value={checked[row.diario_id]??''} disabled={!canEdit||busy} onChange={e=>setChecked(prev=>({...prev,[row.diario_id]:e.target.value}))}/></td>
            <td className={Math.abs(diff)<.01?'cashDiffOk':'cashDiffWarn'}>{money(diff)}</td>
          </tr>
        })}</tbody>
      </table></div>
      {summary.length===0&&<div className="cashClosingEmpty"><WalletCards size={28}/><strong>Nenhuma conta ativa encontrada</strong></div>}
      <div className="cashClosingFooter">
        <label>Observação do fechamento<textarea value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Obrigatória quando houver diferença entre esperado e conferido." disabled={!canEdit||busy}/></label>
        {canEdit&&<button className="primary cashClosingButton" disabled={busy||summary.length===0} onClick={()=>void closeDay()}><CheckCircle2 size={17}/>{busy?'Processando…':'Fechar caixa do dia'}</button>}
      </div>
    </article>

    <article className="panel cashClosingHistory">
      <div className="panelHead"><div><h3>Histórico de fechamentos</h3><p>Últimos 45 fechamentos gerais.</p></div></div>
      <div className="tableWrap"><table>
        <thead><tr><th>Data</th><th>Esperado</th><th>Conferido</th><th>Diferença</th><th>Status</th><th>Fechado em</th><th>Ações</th></tr></thead>
        <tbody>{history.map(row=><tr key={row.id}>
          <td><strong>{dateBr(row.data_caixa)}</strong></td>
          <td>{money(Number(row.total_saldo_esperado))}</td>
          <td>{money(Number(row.total_saldo_conferido))}</td>
          <td className={Math.abs(Number(row.total_diferenca))<.01?'cashDiffOk':'cashDiffWarn'}>{money(Number(row.total_diferenca))}</td>
          <td><span className={'status '+(row.status==='fechado'?'approved':'pending')}>{row.status==='fechado'?'Fechado':'Reaberto'}</span></td>
          <td>{dateTimeBr(row.fechado_em)}</td>
          <td><div className="rowActions"><button className="ghost" onClick={()=>void openClosing(row)}>Detalhes</button><button className="ghost" disabled={busy} onClick={()=>void exportPdf(row)}><FileDown size={14}/>PDF</button>{isAdmin&&row.status==='fechado'&&<button className="ghost" disabled={busy} onClick={()=>void reopen(row)}><RotateCcw size={14}/>Reabrir</button>}</div></td>
        </tr>)}</tbody>
      </table></div>
    </article>

    {selectedClosing&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label="Detalhes do fechamento"><div className="saleModalShell cashClosingDetail">
      <div className="formTitle saleModalTitle"><div><h3>Detalhes do fechamento</h3><p>Conferência individual de cada conta no fechamento selecionado.</p></div><div className="rowActions">{history.find(row=>row.id===selectedClosing)&&<button className="ghost" disabled={busy} onClick={()=>void exportPdf(history.find(row=>row.id===selectedClosing)!)}><FileDown size={15}/>Gerar PDF</button>}<button className="iconBtn saleModalClose" onClick={()=>setSelectedClosing(null)}>×</button></div></div>
      <div className="tableWrap"><table><thead><tr><th>Conta</th><th>Inicial</th><th>Entradas</th><th>Saídas</th><th>Esperado</th><th>Conferido</th><th>Diferença</th></tr></thead><tbody>
        {items.map(row=><tr key={row.id}><td><strong>{row.diario_nome}</strong></td><td>{money(Number(row.saldo_inicial))}</td><td>{money(Number(row.entradas))}</td><td>{money(Number(row.saidas))}</td><td>{money(Number(row.saldo_esperado))}</td><td>{money(Number(row.saldo_conferido))}</td><td className={Math.abs(Number(row.diferenca))<.01?'cashDiffOk':'cashDiffWarn'}>{money(Number(row.diferenca))}</td></tr>)}
      </tbody></table></div>
    </div></div>}
  </section>
}
