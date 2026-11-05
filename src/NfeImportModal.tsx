import { purchaseCode } from './lib/purchaseCode'
import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { CheckCircle2, FileText, Link2, Plus, Upload, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import { parseNfeXml } from './lib/nfeXml'
import { ProductLookup } from './ProductLookup'
import type { ParsedNfe, ParsedNfeItem } from './lib/nfeXml'

type ProductOption={
  id:string
  codigo:string
  descricao:string
  unidade:string
  custo:number
  preco_venda:number
  estoque_atual:number
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

const splitInstallments=(total:number,count:number)=>{
  if(count<=0)return []
  const cents=Math.round(Number(total||0)*100)
  const base=Math.floor(cents/count)
  const remainder=cents-(base*count)
  return Array.from({length:count},(_,index)=>((base+(index===count-1?remainder:0))/100).toFixed(2))
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
  const [dueValues,setDueValues]=useState<string[]>([])
  const [documentBank,setDocumentBank]=useState('')
  const [aiNotice,setAiNotice]=useState('')

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
    setDueValues([])
    setDocumentBank('')
    setAiNotice('')
  }

  const close=()=>{
    if(saving)return
    reset()
    onClose()
  }

  async function prepareParsedDocument(parsed:ParsedNfe,file:File,suggestedPayment?:string,bank=''){
    if(parsed.chave_nfe.replace(/\D/g,'').length!==44)throw new Error('Não foi possível identificar a chave de 44 dígitos da NF-e no documento.')
    if(parsed.cnpj_fornecedor.replace(/\D/g,'').length!==14)throw new Error('Não foi possível identificar um CNPJ válido do fornecedor.')
    if(!parsed.numero_nfe.trim())throw new Error('Não foi possível identificar o número da NF-e.')
    if(!parsed.nome_fornecedor.trim())throw new Error('Não foi possível identificar o fornecedor.')
    if(!parsed.data_emissao)throw new Error('Não foi possível identificar a data de emissão.')
    if(!(Number(parsed.valor_total)>0))throw new Error('Não foi possível identificar o valor total da NF-e.')
    if(!parsed.itens.length)throw new Error('Não foi possível identificar os itens da NF-e.')

    const duplicate=await supabase
      .from('compras')
      .select('id,fatura_numero')
      .eq('chave_nfe',parsed.chave_nfe)
      .maybeSingle()

    if(duplicate.error)throw duplicate.error
    if(duplicate.data)throw new Error(`NF-e já importada na compra ${purchaseCode(duplicate.data.fatura_numero)}.`)

    const mappings=await supabase
      .from('de_para_produtos')
      .select('codigo_produto_fornecedor,produto_id')
      .eq('cnpj_fornecedor',parsed.cnpj_fornecedor)

    if(mappings.error)throw mappings.error
    const byCode=new Map((mappings.data||[]).map(m=>[String(m.codigo_produto_fornecedor),String(m.produto_id)]))

    setItems(parsed.itens.map((item,index)=>{
      const normalizedCode=item.codigo_fornecedor||`AI-${String(index+1).padStart(3,'0')}`
      const mappedId=byCode.get(normalizedCode)||''
      const mappedProduct=products.find(p=>p.id===mappedId&&p.ativo)
      return {
        ...item,
        codigo_fornecedor:normalizedCode,
        productId:mappedProduct?.id||'',
        autoMapped:Boolean(mappedProduct),
        createNew:false,
        newCode:`NFE-${parsed.cnpj_fornecedor.slice(-6)}-${safeCode(normalizedCode)}`,
        newDescription:item.descricao,
        newUnit:item.unidade||'UN',
        newSalePrice:(item.valor_unitario*2).toFixed(2)
      }
    }))

    const emissionDate=parsed.data_emissao.slice(0,10)
    const validDates=parsed.vencimentos.filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)).slice(0,24)
    const initialDates=validDates.length?validDates:[emissionDate]
    const values=parsed.valores_vencimentos.length===initialDates.length
      ? parsed.valores_vencimentos.map(value=>Number(value).toFixed(2))
      : splitInstallments(parsed.valor_total,initialDates.length)

    const normalizedPayment=suggestedPayment==='cartao'?'cartao':suggestedPayment==='boleto'?'boleto':'pix'
    setPayment(validDates.length>1?'boleto':normalizedPayment)
    setDueDates(initialDates)
    setDueValues(values)
    setDocumentBank(bank)
    setNfe(parsed)
    setFileName(file.name)
  }

  async function handleFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]
    e.currentTarget.value=''
    if(!file)return
    setError('')
    setAiNotice('')
    if(file.size>12*1024*1024){
      setError('O arquivo é maior que 12 MB.')
      return
    }

    const lower=file.name.toLowerCase()
    const isXml=lower.endsWith('.xml')||file.type.includes('xml')
    const isPdf=lower.endsWith('.pdf')||file.type==='application/pdf'
    const isImage=file.type.startsWith('image/')
    if(!isXml&&!isPdf&&!isImage){
      setError('Selecione XML, PDF ou uma imagem da NF-e/DANFE.')
      return
    }

    setLoading(true)
    try{
      if(isXml){
        const parsed=parseNfeXml(await file.text())
        await prepareParsedDocument(parsed,file)
      }else{
        setAiNotice('Analisando PDF/imagem com IA...')
        const body=new FormData()
        body.append('file',file)
        const {data,error:invokeError}=await supabase.functions.invoke('purchase-document-ai',{body})
        if(invokeError){
          let message=invokeError.message||'Falha ao analisar documento com IA.'
          const context=(invokeError as unknown as {context?:Response}).context
          if(context instanceof Response){
            try{
              const payload=await context.clone().json() as {message?:string;error?:string}
              message=payload?.message||payload?.error||message
            }catch{
              try{message=(await context.clone().text())||message}catch{}
            }
          }
          throw new Error(message)
        }
        if(data?.error)throw new Error(data.message||data.error)
        const ai=data?.data||{}
        const parsed:ParsedNfe={
          chave_nfe:String(ai.chave_nfe||'').replace(/\D/g,''),
          numero_nfe:String(ai.numero_documento||''),
          cnpj_fornecedor:String(ai.cnpj_fornecedor||'').replace(/\D/g,''),
          nome_fornecedor:String(ai.nome_fornecedor||''),
          data_emissao:String(ai.data_emissao||''),
          valor_total:Number(ai.valor_total||0),
          vencimentos:Array.isArray(ai.vencimentos)?ai.vencimentos.map((x:unknown)=>String(x)):[],
          valores_vencimentos:Array.isArray(ai.valores_vencimentos)?ai.valores_vencimentos.map((x:unknown)=>Number(x)||0):[],
          itens:Array.isArray(ai.itens)?ai.itens.map((item:any,index:number)=>({
            item:index+1,
            codigo_fornecedor:String(item?.codigo_fornecedor||`AI-${String(index+1).padStart(3,'0')}`),
            descricao:String(item?.descricao||''),
            unidade:String(item?.unidade||'UN'),
            quantidade:Number(item?.quantidade||0),
            valor_unitario:Number(item?.valor_unitario||0),
            valor_total:Number(item?.valor_total||0)
          })).filter((item:ParsedNfeItem)=>item.descricao&&item.quantidade>0):[]
        }
        await prepareParsedDocument(parsed,file,String(ai.forma_pagamento||''),String(ai.banco||''))
        const confidence=Number(ai.confianca)
        setAiNotice('Leitura por IA concluída'+(Number.isFinite(confidence)?' · confiança '+Math.round(confidence*100)+'%':'')+'. Revise fornecedor, itens, valores e vencimentos antes de importar.')
      }
    }catch(err){
      setNfe(null)
      setItems([])
      setDocumentBank('')
      const message=err instanceof Error?err.message:'Não foi possível ler o documento.'
      setError(message)
      if(message.includes('OPENAI_API_KEY')||message.includes('openai_not_configured'))setAiNotice('A leitura por IA está instalada, mas falta configurar OPENAI_API_KEY nos Secrets do Supabase.')
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
    if(value==='pix'){
      setDueDates([base])
      setDueValues([Number(nfe?.valor_total||0).toFixed(2)])
      return
    }
    const max=value==='cartao'?12:24
    const dates=(dueDates.length?dueDates:[base]).slice(0,max)
    setDueDates(dates)
    setDueValues(splitInstallments(Number(nfe?.valor_total||0),dates.length))
  }

  function updateDue(index:number,value:string){
    setDueDates(old=>old.map((d,i)=>i===index?value:d))
  }

  function updateDueValue(index:number,value:string){
    if(value!==''&&!/^\d*(?:[.,]\d{0,2})?$/.test(value))return
    setDueValues(old=>old.map((amount,i)=>i===index?value.replace(',','.'):amount))
  }

  function addInstallment(){
    const max=payment==='cartao'?12:24
    if(payment==='pix'||dueDates.length>=max)return
    const nextDates=[...dueDates,nextMonth(dueDates[dueDates.length-1]||nfe?.data_emissao.slice(0,10)||new Date().toISOString().slice(0,10))]
    setDueDates(nextDates)
    setDueValues(splitInstallments(Number(nfe?.valor_total||0),nextDates.length))
  }

  function removeInstallment(index:number){
    if(dueDates.length<=1)return
    const nextDates=dueDates.filter((_,i)=>i!==index)
    setDueDates(nextDates)
    setDueValues(splitInstallments(Number(nfe?.valor_total||0),nextDates.length))
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
    if(dueValues.length!==dueDates.length||dueValues.some(value=>!Number.isFinite(Number(value))||Number(value)<=0)){
      setError('Informe um valor maior que zero para cada parcela.')
      return
    }
    const installmentSum=Math.round(dueValues.reduce((sum,value)=>sum+Number(value),0)*100)/100
    if(Math.abs(installmentSum-nfe.valor_total)>0.009){
      setError(`A soma das parcelas é ${money(installmentSum)} e precisa ser igual ao valor da NF-e: ${money(nfe.valor_total)}.`)
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
        valores_parcelas:dueValues.map(value=>Number(value)),
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
      if(result.data?.compra_id){
        await supabase.from('compras').update({
          banco_documento:documentBank||null,
          documento_importado_nome:fileName||null
        }).eq('id',result.data.compra_id)
      }
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
  const installmentTotal=Math.round(dueValues.reduce((sum,value)=>sum+(Number(value)||0),0)*100)/100
  const installmentDifference=nfe?Math.round((nfe.valor_total-installmentTotal)*100)/100:0
  const installmentsValid=Boolean(nfe)&&dueValues.length===dueDates.length&&dueValues.every(value=>Number(value)>0)&&Math.abs(installmentDifference)<0.009

  return <div className="saleModalOverlay nfeModalOverlay" role="dialog" aria-modal="true" aria-label="Importar XML de NF-e">
    <div className="saleModalShell nfeModalShell">
      <div className="panel nfeImportPanel">
        <div className="formTitle saleModalTitle">
          <div>
            <h3>Importar documento de compra</h3>
            <p>Use XML, PDF ou imagem de NF-e/DANFE. PDF e imagem são lidos por IA; depois do De/Para, a compra entra como Pedido aprovado. Estoque e custo só são atualizados ao receber a compra.</p>
          </div>
          <button type="button" className="iconBtn saleModalClose" onClick={close} disabled={saving} aria-label="Fechar importação"><X size={18}/></button>
        </div>

        {!nfe&&<div className="nfeUploadBox">
          <Upload size={36}/>
          <strong>Selecione XML, PDF ou imagem</strong>
          <span>Até 12 MB. XML usa leitura estruturada; PDF e imagem usam IA para reconhecer a NF-e/DANFE.</span>
          <label className="primary nfeFileButton">
            {loading?'Lendo documento...':'Escolher documento'}
            <input type="file" accept=".xml,text/xml,application/xml,.pdf,application/pdf,image/*" onChange={handleFile} disabled={loading}/>
          </label>
        </div>}

        {aiNotice&&<div className="financeImportNotice"><FileText size={16}/><span>{aiNotice}</span></div>}
        {error&&<div className="authorizationInlineError nfeError" role="alert">{error}</div>}

        {nfe&&<>
          <div className="nfeSummary">
            <div><span>NF-e</span><strong>{nfe.numero_nfe}</strong><small>{fileName}</small></div>
            <div><span>Fornecedor</span><strong>{nfe.nome_fornecedor}</strong><small>{nfe.cnpj_fornecedor}</small></div>
            <div><span>Emissão</span><strong>{dateBr(nfe.data_emissao)}</strong><small>Chave {nfe.chave_nfe.slice(0,10)}…{nfe.chave_nfe.slice(-8)}</small></div>
            <div><span>Valor da NF-e</span><strong>{money(nfe.valor_total)}</strong><small>Produtos: {money(itemTotal)}{Math.abs(difference)>.009?` • diferença ${money(difference)}`:''}</small></div>
            {documentBank&&<div><span>Banco identificado</span><strong>{documentBank}</strong><small>Extraído do documento importado</small></div>}
          </div>

          <div className="panel nfePaymentPanel">
            <div><strong>Financeiro da compra</strong><span>A NF-e será importada como Pedido aprovado, aguardando recebimento.</span></div>
            <label>Pagamento
              <select value={payment} onChange={e=>changePayment(e.target.value as 'pix'|'cartao'|'boleto')}>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto / Duplicata</option>
              </select>
            </label>
            <div className="nfeDueDates">
              {dueDates.map((date,index)=><div className="nfeInstallmentCard" key={index}>
                <strong>Parcela {index+1}</strong>
                <label>Vencimento
                  <input type="date" value={date} onChange={e=>updateDue(index,e.target.value)}/>
                </label>
                <label>Valor da parcela
                  <div className="nfeInstallmentValue"><span>R$</span><input type="number" min="0.01" step="0.01" value={dueValues[index]??''} onChange={e=>updateDueValue(index,e.target.value)}/></div>
                </label>
                {dueDates.length>1&&<button type="button" className="iconBtn nfeRemoveInstallment" onClick={()=>removeInstallment(index)} aria-label="Remover parcela"><X size={14}/></button>}
              </div>)}
              {payment!=='pix'&&<button type="button" className="ghost" onClick={addInstallment}><Plus size={15}/>Parcela</button>}
              <div className={installmentsValid?'nfeInstallmentTotal valid':'nfeInstallmentTotal invalid'}>
                <span>Total das parcelas</span>
                <strong>{money(installmentTotal)}</strong>
                {!installmentsValid&&nfe&&<small>{installmentDifference>0?`Falta ${money(installmentDifference)}`:`Excede ${money(Math.abs(installmentDifference))}`}</small>}
              </div>
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
                <ProductLookup
                  products={activeProducts}
                  value={item.createNew?'':item.productId}
                  onSelect={value=>setMapping(index,value)}
                  fullWidth
                />
                <button type="button" className="ghost" onClick={()=>setMapping(index,'__new__')} disabled={item.createNew}>
                  <Plus size={14}/>{item.createNew?'Novo produto selecionado':'Criar novo produto'}
                </button>
                {item.autoMapped&&<small className="nfeAutoMapped"><CheckCircle2 size={13}/>De/Para reconhecido automaticamente</small>}
              </label>

              {item.createNew&&<div className="nfeNewProduct">
                <label>Código interno<input value={item.newCode} onChange={e=>updateNew(index,'newCode',e.target.value)}/></label>
                <label>Descrição<input value={item.newDescription} onChange={e=>updateNew(index,'newDescription',e.target.value)}/></label>
                <label>Unidade<input value={item.newUnit} onChange={e=>updateNew(index,'newUnit',e.target.value)}/></label>
                <label>Preço de venda<input type="number" min="0" step="0.01" value={item.newSalePrice} onChange={e=>updateNew(index,'newSalePrice',e.target.value)}/></label>
                <small>O custo inicial será {money(item.valor_unitario)}. O produto será criado sem estoque; a entrada ocorrerá ao receber a compra.</small>
              </div>}
            </article>)}
          </div>

          <div className="nfeImportFooter">
            <button type="button" className="ghost" onClick={close} disabled={saving}>Cancelar</button>
            <button type="button" className="primary" onClick={()=>void importNfe()} disabled={saving||mappedCount!==items.length||!installmentsValid}>
              <FileText size={16}/>{saving?'Importando NF-e...':'Importar NF-e e criar pedido'}
            </button>
          </div>
        </>}
      </div>
    </div>
  </div>
}
