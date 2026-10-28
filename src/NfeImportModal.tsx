import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { CheckCircle2, FileText, Link2, Plus, Upload, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import { parseNfeXml } from './lib/nfeXml'
import type { ParsedNfe, ParsedNfeItem } from './lib/nfeXml'

type ProductOption={
  id:string
  codigo:string
  descricao:string
  unidade:string
  ativo:boolean
}

type MappingItem=ParsedNfeItem&{
  productId:string
  autoMapped:boolean
  createNew:boolean
  newCode:string
  newDescription:string
  newUnit:string
  newSalePrice:string
}

type ImportResult={
  compra_id:string
  fatura_numero:number
  fornecedor_id:string
  total:number
  produtos_criados:number
}

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value||0)
const dateBr=(value:string)=>value?new Intl.DateTimeFormat('pt-BR').format(new Date(value.length===10?value+'T12:00:00':value)):'—'
const safeCode=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20)||'ITEM'

const nextMonth=(base:string)=>{
  const [y,m,d]=base.split('-').map(Number)
  const first=new Date(y,m,1,12)
  const last=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate()
  const result=new Date(first.getFullYear(),first.getMonth(),Math.min(d||1,last),12)
  return `${result.getFullYear()}-${String(result.getMonth()+1).padStart(2,'0')}-${String(result.getDate()).padStart(2,'0')}`
}

export function NfeImportModal({
  open,
  products,
  onClose,
  onImported
}:{
  open:boolean
  products:ProductOption[]
  onClose:()=>void
  onImported:(result:ImportResult)=>Promise<void>|void
}){
  const [nfe,setNfe]=useState<ParsedNfe|null>(null)
  const [items,setItems]=useState<MappingItem[]>([])
  const [fileName,setFileName]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [payment,setPayment]=useState<'pix'|'cartao'|'boleto'>('pix')
  const [dueDates,setDueDates]=useState<string[]>([])

  const activeProducts=useMemo(
    ()=>products.filter(p=>p.ativo).sort((a,b)=>a.descricao.localeCompare(b.descricao,'pt-BR')),
    [products]
  )

  if(!open)return null

  const reset=()=>{
    setNfe(null)
    setItems([])
    setFileName('')
    setError('')
    setLoading(false)
    setSaving(false)
    setPayment('pix')
    setDueDates([])
  }

  const close=()=>{
    if(saving)return
    reset()
    onClose()
  }

  async function handleFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]
    e.currentTarget.value=''
    if(!file)return
    setError('')
    if(!file.name.toLowerCase().endsWith('.xml')){
      setError('Selecione um arquivo com extensão .xml.')
      return
    }
    if(file.size>6*1024*1024){
      setError('O XML é maior que 6 MB.')
      return
    }

    setLoading(true)
    try{
      const parsed=parseNfeXml(await file.text())

      const duplicate=await supabase
        .from('compras')
        .select('id,fatura_numero')
        .eq('chave_nfe',parsed.chave_nfe)
        .maybeSingle()

      if(duplicate.error)throw duplicate.error
      if(duplicate.data){
        throw new Error(`NF-e já importada na compra #${String(duplicate.data.fatura_numero||0).padStart(7,'0')}.`)
      }

      const mappings=await supabase
        .from('de_para_produtos')
        .select('codigo_produto_fornecedor,produto_id')
        .eq('cnpj_fornecedor',parsed.cnpj_fornecedor)

      if(mappings.error)throw mappings.error
      const byCode=new Map((mappings.data||[]).map(m=>[String(m.codigo_produto_fornecedor),String(m.produto_id)]))

      setItems(parsed.itens.map(item=>{
        const mappedId=byCode.get(item.codigo_fornecedor)||''
        const mappedProduct=products.find(p=>p.id===mappedId&&p.ativo)
        return {
          ...item,
          productId:mappedProduct?.id||'',
          autoMapped:Boolean(mappedProduct),
          createNew:false,
          newCode:`NFE-${parsed.cnpj_fornecedor.slice(-6)}-${safeCode(item.codigo_fornecedor)}`,
          newDescription:item.descricao,
          newUnit:item.unidade||'UN',
          newSalePrice:(item.valor_unitario*2).toFixed(2)
        }
      }))

      const emissionDate=parsed.data_emissao.slice(0,10)
      const xmlDueDates=parsed.vencimentos.filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)).slice(0,24)
      setPayment(xmlDueDates.length?'boleto':'pix')
      setDueDates(xmlDueDates.length?xmlDueDates:[emissionDate])
      setNfe(parsed)
      setFileName(file.name)
    }catch(err){
      setNfe(null)
      setItems([])
      setError(err instanceof Error?err.message:'Não foi possível ler o XML.')
    }finally{
      setLoading(false)
    }
  }

  function setMapping(index:number,value:string){
    setItems(old=>old.map((item,i)=>{
      if(i!==index)return item
      if(value==='__new__')return {...item,productId:'',createNew:true,autoMapped:false}
      return {...item,productId:value,createNew:false,autoMapped:false}
    }))
  }

  function updateNew(index:number,field:'newCode'|'newDescription'|'newUnit'|'newSalePrice',value:string){
    setItems(old=>old.map((item,i)=>i===index?{...item,[field]:value}:item))
  }

  function changePayment(value:'pix'|'cartao'|'boleto'){
    setPayment(value)
    const base=dueDates[0]||nfe?.data_emissao.slice(0,10)||new Date().toISOString().slice(0,10)
    if(value==='pix')setDueDates([base])
    else setDueDates(old=>(old.length?old:[base]).slice(0,value==='cartao'?12:24))
  }

  function updateDue(index:number,value:string){
    setDueDates(old=>old.map((d,i)=>i===index?value:d))
  }

  function addInstallment(){
    const max=payment==='cartao'?12:24
    if(payment==='pix'||dueDates.length>=max)return
    setDueDates(old=>[...old,nextMonth(old[old.length-1]||nfe?.data_emissao.slice(0,10)||new Date().toISOString().slice(0,10))])
  }

  function removeInstallment(index:number){
    if(dueDates.length<=1)return
    setDueDates(old=>old.filter((_,i)=>i!==index))
  }

  async function importNfe(){
    if(!nfe||saving)return
    setError('')

    const invalid=items.find(item=>
      item.createNew
        ? !item.newCode.trim()||!item.newDescription.trim()||!item.newUnit.trim()||Number(item.newSalePrice)<0
        : !item.productId
    )
    if(invalid){
      setError(`Vincule o item "${invalid.descricao}" a um produto interno ou crie um novo produto.`)
      return
    }
    if(!dueDates.length||dueDates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d))){
      setError('Informe corretamente as datas de vencimento.')
      return
    }

    setSaving(true)
    try{
      const payload={
        chave_nfe:nfe.chave_nfe,
        numero_nfe:nfe.numero_nfe,
        cnpj_fornecedor:nfe.cnpj_fornecedor,
        nome_fornecedor:nfe.nome_fornecedor,
        data_emissao:nfe.data_emissao,
        valor_total:nfe.valor_total,
        forma_pagamento:payment,
        vencimentos:dueDates,
        itens:items.map(item=>({
          codigo_fornecedor:item.codigo_fornecedor,
          descricao:item.descricao,
          unidade:item.unidade,
          quantidade:item.quantidade,
          valor_unitario:item.valor_unitario,
          produto_id:item.createNew?null:item.productId,
          novo_produto:item.createNew?{
            codigo:item.newCode.trim(),
            descricao:item.newDescription.trim(),
            unidade:item.newUnit.trim().toUpperCase()||'UN',
            preco_venda:Number(item.newSalePrice||0)
          }:null
        }))
      }

      const result=await supabase.rpc('importar_compra_nfe',{p_payload:payload})
      if(result.error)throw result.error
      await onImported(result.data as ImportResult)
      reset()
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível importar a NF-e.')
    }finally{
      setSaving(false)
    }
  }

  const mappedCount=items.filter(i=>i.productId||i.createNew).length
  const autoCount=items.filter(i=>i.autoMapped).length
  const itemTotal=items.reduce((sum,item)=>sum+Number(item.valor_total||0),0)
  const difference=nfe?nfe.valor_total-itemTotal:0
  const installmentValues=useMemo(()=>{
    if(!nfe||dueDates.length===0)return []
    const total=Math.round(Number(nfe.valor_total||0)*100)/100
    const base=Math.floor((total/dueDates.length)*100)/100
    return dueDates.map((_,index)=>index===dueDates.length-1
      ? Math.round((total-base*(dueDates.length-1))*100)/100
      : base
    )
  },[nfe,dueDates])

  return <div className="saleModalOverlay nfeModalOverlay" role="dialog" aria-modal="true" aria-label="Importar XML de NF-e">
    <div className="saleModalShell nfeModalShell">
      <div className="panel nfeImportPanel">
        <div className="formTitle saleModalTitle">
          <div>
            <h3>Entrada de compra via XML da NF-e</h3>
            <p>O XML é processado no navegador. Depois do De/Para, a compra entra como recebida e atualiza estoque, custo e financeiro.</p>
          </div>
          <button type="button" className="iconBtn saleModalClose" onClick={close} disabled={saving} aria-label="Fechar importação"><X size={18}/></button>
        </div>

        {!nfe&&<div className="nfeUploadBox">
          <Upload size={36}/>
          <strong>Selecione o XML da NF-e</strong>
          <span>Arquivo .xml de até 6 MB. Nenhum XML bruto é armazenado no navegador após fechar esta tela.</span>
          <label className="primary nfeFileButton">
            {loading?'Lendo XML...':'Escolher arquivo XML'}
            <input type="file" accept=".xml,text/xml,application/xml" onChange={handleFile} disabled={loading}/>
          </label>
        </div>}

        {error&&<div className="authorizationInlineError nfeError" role="alert">{error}</div>}

        {nfe&&<>
          <div className="nfeSummary">
            <div><span>NF-e</span><strong>{nfe.numero_nfe}</strong><small>{fileName}</small></div>
            <div><span>Fornecedor</span><strong>{nfe.nome_fornecedor}</strong><small>{nfe.cnpj_fornecedor}</small></div>
            <div><span>Emissão</span><strong>{dateBr(nfe.data_emissao)}</strong><small>Chave {nfe.chave_nfe.slice(0,10)}…{nfe.chave_nfe.slice(-8)}</small></div>
            <div><span>Valor da NF-e</span><strong>{money(nfe.valor_total)}</strong><small>Produtos: {money(itemTotal)}{Math.abs(difference)>.009?` • diferença ${money(difference)}`:''}</small></div>
          </div>

          <div className="panel nfePaymentPanel">
            <div><strong>Financeiro da compra</strong><span>A NF-e será importada como Pedido recebido.</span></div>
            <label>Pagamento
              <select value={payment} onChange={e=>changePayment(e.target.value as 'pix'|'cartao'|'boleto')}>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto / Duplicata</option>
              </select>
            </label>
            <div className="nfeDueDates">
              {dueDates.map((date,index)=><label key={index}>
                <span className="nfeDueLabel"><span>Vencimento {index+1}</span><strong>{money(installmentValues[index]||0)}</strong></span>
                <span><input type="date" value={date} onChange={e=>updateDue(index,e.target.value)}/>{dueDates.length>1&&<button type="button" className="iconBtn" onClick={()=>removeInstallment(index)} aria-label="Remover parcela"><X size={14}/></button>}</span>
              </label>)}
              {payment!=='pix'&&<button type="button" className="ghost" onClick={addInstallment}><Plus size={15}/>Parcela</button>}
            </div>
          </div>

          <div className="nfeMappingHead">
            <div><h4>De/Para dos produtos</h4><p>{mappedCount}/{items.length} vinculados • {autoCount} reconhecido(s) automaticamente.</p></div>
            <div className={mappedCount===items.length?'nfeMappingReady':'nfeMappingPending'}><Link2 size={16}/>{mappedCount===items.length?'Pronto para importar':'Vínculos pendentes'}</div>
          </div>

          <div className="nfeItems">
            {items.map((item,index)=><article className="nfeItemCard" key={item.item+'-'+item.codigo_fornecedor}>
              <div className="nfeItemData">
                <strong>{item.codigo_fornecedor} — {item.descricao}</strong>
                <span>{item.quantidade.toLocaleString('pt-BR')} {item.unidade} × {money(item.valor_unitario)} = {money(item.valor_total)}</span>
              </div>
              <label className="nfeMappingSelect">Produto interno
                <select value={item.createNew?'__new__':item.productId} onChange={e=>setMapping(index,e.target.value)}>
                  <option value="">Selecione o produto correspondente</option>
                  {activeProducts.map(product=><option key={product.id} value={product.id}>{product.codigo} — {product.descricao}</option>)}
                  <option value="__new__">+ Criar novo produto</option>
                </select>
                {item.autoMapped&&<small className="nfeAutoMapped"><CheckCircle2 size={13}/>De/Para reconhecido automaticamente</small>}
              </label>

              {item.createNew&&<div className="nfeNewProduct">
                <label>Código interno<input value={item.newCode} onChange={e=>updateNew(index,'newCode',e.target.value)}/></label>
                <label>Descrição<input value={item.newDescription} onChange={e=>updateNew(index,'newDescription',e.target.value)}/></label>
                <label>Unidade<input value={item.newUnit} onChange={e=>updateNew(index,'newUnit',e.target.value)}/></label>
                <label>Preço de venda<input type="number" min="0" step="0.01" value={item.newSalePrice} onChange={e=>updateNew(index,'newSalePrice',e.target.value)}/></label>
                <small>O custo inicial será {money(item.valor_unitario)} e o estoque inicial será lançado pela própria NF-e.</small>
              </div>}
            </article>)}
          </div>

          <div className="nfeImportFooter">
            <button type="button" className="ghost" onClick={close} disabled={saving}>Cancelar</button>
            <button type="button" className="primary" onClick={()=>void importNfe()} disabled={saving||mappedCount!==items.length}>
              <FileText size={16}/>{saving?'Importando NF-e...':'Importar NF-e e receber compra'}
            </button>
          </div>
        </>}
      </div>
    </div>
  </div>
}
