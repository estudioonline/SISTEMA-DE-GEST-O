import { financeOriginLabel, financeOriginDocuments } from './lib/financeOrigin'
import { purchaseCode } from './lib/purchaseCode'
import { financialInvoiceCode } from './lib/invoiceCode'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards,
  BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut, Trash2, FileDown,
  Pencil, Ban, MoreVertical, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, Grid2X2,
  Upload, Download, FileSpreadsheet, BadgeDollarSign, UserPlus, Paperclip, ExternalLink, Search, X, ShieldCheck, TrendingUp, Printer, Truck, SlidersHorizontal, MapPin, MonitorDown, ChevronDown, FolderOpen, Info, Database, KeyRound, GripVertical,
  Layers3, Mail, LockKeyhole, Eye, EyeOff, LogIn, Bell, CircleUserRound
} from 'lucide-react'
import { supabase, supabaseConfigured, supabasePublishableKey, supabaseUrl } from './lib/supabase'
import type { CommissionReportRow } from './lib/commissionReportPdf'
import { recordRow } from './lib/recordRow'
import { buildStatement } from './lib/entityStatement'
import type { StatementKind, StatementWire } from './lib/entityStatement'
import { readAllRows } from './lib/readAllRows'
import { readSettings } from './lib/erpSettings'
import { titlesForSale, validateBilling } from './lib/billing'
import { sessionExpired } from './lib/sessionPolicy'
import { IntegrationSettings } from './IntegrationSettings'
import { AuthorizationCenter } from './AuthorizationCenter'
import { PaymentHistory } from './PaymentHistory'
import { FinanceAdministration, FinanceClassifications } from './FinanceAdministration'
import { NfeImportModal } from './NfeImportModal'
import { ProductLookup } from './ProductLookup'
import { FocusNfeSettings, FocusNfeSale } from './FocusNfe'
import { AppLauncher } from './AppLauncher'
import { HumanResources } from './HumanResources'
import { appPermission } from './lib/hr'
import type { AppModule } from './lib/hr'
import { BankReconciliation } from './BankReconciliation'
import { CashClosing } from './CashClosing'
import { DocumentsLibrary } from './DocumentsLibrary'
import { InfrastructureUsage } from './InfrastructureUsage'
import { DeliveryWorkspace } from './DeliveryWorkspace'
import { ProductGroupsManager } from './ProductGroupsManager'
import { SearchableSelect } from './SearchableSelect'
import { PartyLookup } from './PartyLookup'
import type { ProductGroup, ProductSubgroup } from './ProductGroupsManager'
import { useTheme } from './lib/useTheme'
import type { EmployeeTitle } from './EmployeeFinance'
import { canEditPermission, canViewPermission, defaultPermissionsForRole, normalizePermissions, permissionModules, emptyPermissions, parseEffectivePermissions } from './lib/permissions'
import type { AccessLevel, PermissionMap, PermissionModule } from './lib/permissions'

type ModuleKey=AppModule
type PerfilRole='administrador'|'financeiro'|'vendas'|'estoque'|'visualizador'
type PaymentMethod='dinheiro'|'pix'|'cartao'|'boleto'
type PurchasePaymentMethod='pix'|'cartao'|'boleto'
type DeliveryRoute='norte'|'sul'|'leste'|'interestadual'|'retirada'
type BeforeInstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed';platform:string}>}

type Cliente={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;limite_credito:number;ativo:boolean;logradouro?:string|null;numero?:string|null;bairro?:string|null;municipio?:string|null;codigo_municipio?:string|null;uf?:string|null;cep?:string|null;indicador_ie?:string|null;inscricao_estadual?:string|null;consumidor_final?:boolean|null;presenca_comprador?:number|null;latitude?:number|null;longitude?:number|null}
type Fornecedor={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;ativo:boolean}
type Produto={id:string;codigo:string;descricao:string;unidade:string;custo:number;custo_medio?:number|null;preco_venda:number;estoque_atual:number;estoque_minimo:number;estoque_reposicao?:number|null;percentual_minimo_custo_venda?:number|null;ativo:boolean;tipo_produto?:'insumo'|'produto_final'|'servico';rastrear_estoque?:boolean;grupo_id?:string|null;subgrupo_id?:string|null;ncm?:string|null;cfop_interno?:string|null;cfop_interestadual?:string|null;origem?:number|null;cst_icms?:string|null;cst_pis?:string|null;cst_cofins?:string|null;complemento_tributario?:Record<string,unknown>|null;peso_kg?:number|null;volume_m3?:number|null}
type ProdutoComponente={id:string;produto_final_id:string;componente_id:string;quantidade:number;perda_percentual?:number}
type ProdutoComponenteDraft={key:string;componente_id:string;quantidade:number}
type SaleLayoutStoredEntry={tipo:'section';titulo:string}|{tipo:'item';produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number}
type Venda={id:string;cliente_id:string|null;vendedor_id:string|null;vendedor_cadastro_id:string|null;percentual_comissao?:number|null;status:string;subtotal:number;desconto:number;total:number;observacoes:string|null;rota_entrega:DeliveryRoute|null;created_at:string;forma_pagamento:PaymentMethod;parcelas:number;primeiro_vencimento:string;vencimentos_parcelas?:string[]|null;venda_numero:number;fatura_numero:number|null;fatura_gerada_em:string|null;estoque_negativo_autorizado_por?:string|null;estoque_negativo_autorizado_em?:string|null;layout_itens?:SaleLayoutStoredEntry[]|null}
type SaleRecipeDraft={key:string;componente_id:string;quantidade:number;valor_unitario:number}
type VendaItem={produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number;observacao_item?:string|null;receita_producao?:Array<{componente_id:string;quantidade:number;valor_unitario?:number}>|null}
type SaleItemDraft={key:string;produto_id:string;quantidade:number;valor_unitario:number;desconto:number;observacao_item:string;receita_producao:SaleRecipeDraft[]}
type Compra={id:string;fornecedor_id:string|null;status:string;total:number;observacoes:string|null;created_at:string;forma_pagamento:PurchasePaymentMethod;parcelas:number;primeiro_vencimento:string;vencimentos_parcelas:string[];fatura_numero:number|null;fatura_gerada_em:string|null;chave_nfe?:string|null;numero_nfe?:string|null;cnpj_fornecedor?:string|null;nome_fornecedor?:string|null;data_emissao?:string|null;valor_total_nfe?:number|null}
type CompraItem={produto_id:string;quantidade:number;custo_unitario:number;total:number}
type PurchaseItemDraft={key:string;produto_id:string;quantidade:number;custo_unitario:number}
type Titulo=EmployeeTitle&{id:string;tipo:'pagar'|'receber';descricao:string;entidade_nome:string|null;vencimento:string;valor:number;valor_pago:number;status:'aberto'|'parcial'|'pago'|'cancelado';categoria:string|null;centro_custo:string|null;venda_id:string|null;compra_id:string|null;parcela_numero:number|null;forma_pagamento:string|null;banco?:string|null;documento_importado_nome?:string|null;created_at:string;fatura_venda_id?:string|null}
type SaleApproval={id:string;entidade_id:string|null;status:string;solicitado_em:string;payload:Record<string,unknown>|null}
type FinancePayment={id:string;titulo_id:string;data_pagamento:string;valor:number}
type FinanceReversal={id:string;pagamento_id:string;valor:number;data_estorno:string}
type FaturaVenda={id:string;numero:number;venda_id:string;status:'ativa'|'cancelada';forma_pagamento:string;parcelas:number;valor_total:number;criada_em:string;criada_por:string|null;cancelada_em:string|null;cancelada_por:string|null;motivo_cancelamento:string|null}
type FaturaVendaItem={fatura_id:string;venda_id:string;valor_venda:number}
type InvoiceDraftLine={key:string;vencimento:string;valor:number}
type EmpresaConfig={id:number;updated_at?:string;razao_social:string;nome_fantasia:string;cnpj:string|null;email:string|null;telefone:string|null;endereco:string|null;cidade:string|null;uf:string|null;cep:string|null;pix_chave:string|null;banco:string|null;agencia:string|null;conta:string|null;condicoes_gerais:string|null;desconto_max_vendedor?:number;margem_minima_percentual?:number;validade_orcamento_dias?:number;bloquear_cliente_inadimplente?:boolean;exigir_aprovacao_limite_credito?:boolean;reservar_estoque_pedido?:boolean;sessao_inatividade_minutos?:number;campos_obrigatorios?:Record<string,unknown>}
type Vendedor={id:string;nome:string;email:string|null;telefone:string|null;percentual_comissao:number;ativo:boolean;created_at:string}
type ManagedUser={user_id:string;nome:string;email:string;perfil:PerfilRole;ativo:boolean;criado_em:string;ultimo_acesso:string|null;usuario_atual:boolean;avatar_path:string|null;permissoes:PermissionMap;availablePermissions:PermissionModule[]}
type ComissaoResumo={vendedor_id:string;vendedor_nome:string;percentual_comissao:number;total_recebido:number;comissao_apurada:number;pagamentos:number;vendas:number}
type Comprovante={id:string;venda_id:string|null;compra_id:string|null;storage_path:string;nome_arquivo:string;mime_type:string|null;tamanho:number|null;created_at:string;data_vencimento?:string|null;alerta_dias?:number}
type MovimentoEstoque={id:string;produto_id:string;tipo:string;quantidade:number;referencia:string|null;created_at:string}
type SaleHistoryEvent={evento_id:string;fonte:string;acao:string;usuario_id:string|null;usuario_nome:string;usuario_perfil:string|null;ocorrido_em:string;dados_antes:Record<string,unknown>|null;dados_depois:Record<string,unknown>|null}

const menu=[
  ['vendas','Vendas',ReceiptText],['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos / Estoque',Package],['compras','Compras',ShoppingCart],
  ['comissoes','Comissões',BadgeDollarSign],['financeiro','Financeiro',WalletCards],['fechamento','Fechamento de Caixa',CheckCircle2],['documentos','Documentos',FolderOpen],['rh','RH',Users],['entregas','Logística',Truck],['autorizacoes','Autorizações',ShieldCheck],['relatorios','Relatórios',BarChart3],['infra','GitHub & Supabase',Database],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const addDaysIso=(base:string,days:number)=>{const [y,m,d]=base.split('-').map(Number);const x=new Date(y,m-1,d+days,12);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
const monthStartIso=(base=today())=>base.slice(0,8)+'01'
const monthEndIso=(base=today())=>addDaysIso(addMonthsIso(base.slice(0,8)+'01',1),-1)
const dateBr=(v:string)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v.length===10?v+'T12:00:00':v)):'—'
const saleCode=(n:number|null|undefined)=>`S${String(n||0).padStart(5,'0')}`
const deliveryRouteLabel=(v:string|null|undefined)=>v==='norte'?'Norte':v==='sul'?'Sul':v==='leste'?'Leste':v==='interestadual'?'Interestadual':v==='retirada'?'Retirada':'—'
const purchaseStatusLabel=(v:string|null|undefined)=>v==='cotacao'?'Cotação':v==='pedido_aprovado'?'Pedido aprovado':v==='pedido_recebido'?'Pedido recebido':v==='cancelada'?'Cancelada':String(v||'—')
const financeStatusLabel=(v:string)=>v==='aberto'?'Em aberto':v==='parcial'?'Parcial':v==='pago'?'Pago':v==='cancelado'?'Cancelado':v
const financeStatusClass=(v:string)=>v==='pago'?'payment-pago':v==='parcial'?'payment-parcial':v==='cancelado'?'payment-cancelado':'payment-pendente'
const profileLabel=(v:PerfilRole)=>v==='administrador'?'Administrador':v==='financeiro'?'Financeiro':v==='vendas'?'Vendedor':v==='visualizador'?'Usuário normal':'Estoque'
const onlyDigits=(value:string,max:number)=>value.replace(/\D/g,'').slice(0,max)
const maskDocument=(value:string)=>{
  const d=onlyDigits(value,14)
  if(d.length<=11){
    return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
  }
  return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
const maskCnpj=(value:string)=>{
  const d=onlyDigits(value,14)
  return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
const maskPhone=(value:string)=>{
  const d=onlyDigits(value,11)
  if(d.length<=10)return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d{1,4})$/,'$1-$2')
  return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{1,4})$/,'$1-$2')
}
const maskCep=(value:string)=>{
  const d=onlyDigits(value,8)
  return d.replace(/(\d{5})(\d{1,3})$/,'$1-$2')
}
const newSaleItem=():SaleItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,valor_unitario:0,desconto:0,observacao_item:'',receita_producao:[]})
const newPurchaseItem=():PurchaseItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,custo_unitario:0})

const protectedAppPasswordHash='f86a4e4642f8d899a5f1aba77a4a44943c4484269e5b2e84a659e24cf8a3058f'

async function sha256Hex(value:string){
  const data=new TextEncoder().encode(value)
  const digest=await crypto.subtle.digest('SHA-256',data)
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('')
}

function themedPasswordPrompt(title:string){
  return new Promise<string|null>(resolve=>{
    const overlay=document.createElement('div')
    overlay.className='sgPromptOverlay'
    overlay.setAttribute('role','presentation')

    const dialog=document.createElement('div')
    dialog.className='sgPromptDialog'
    dialog.setAttribute('role','dialog')
    dialog.setAttribute('aria-modal','true')
    dialog.setAttribute('aria-labelledby','sg-password-title')

    const head=document.createElement('div')
    head.className='sgPromptHead'
    const icon=document.createElement('div')
    icon.className='sgPromptIcon'
    icon.textContent='🔒'
    const heading=document.createElement('div')
    const h=document.createElement('strong')
    h.id='sg-password-title'
    h.textContent=title
    const p=document.createElement('p')
    p.textContent='Digite a senha para acessar este aplicativo.'
    heading.append(h,p)
    head.append(icon,heading)

    const input=document.createElement('input')
    input.className='sgPromptInput'
    input.type='text'
    input.autocomplete='off'
    input.name='sg-protected-app-access'
    input.value=''
    input.spellcheck=false
    input.placeholder='Senha de acesso'
    input.setAttribute('aria-label','Senha de acesso')
    input.setAttribute('data-lpignore','true')
    input.setAttribute('data-1p-ignore','true')
    input.style.setProperty('-webkit-text-security','disc')

    const error=document.createElement('div')
    error.className='formHint'
    error.setAttribute('role','alert')

    const actions=document.createElement('div')
    actions.className='sgPromptActions'
    const cancel=document.createElement('button')
    cancel.type='button'
    cancel.className='ghost'
    cancel.textContent='Cancelar'
    const confirm=document.createElement('button')
    confirm.type='button'
    confirm.className='primary'
    confirm.textContent='Entrar'
    actions.append(cancel,confirm)

    dialog.append(head,input,error,actions)
    overlay.append(dialog)
    document.body.append(overlay)

    const finish=(value:string|null)=>{
      input.value=''
      input.setAttribute('value','')
      document.removeEventListener('keydown',onKey)
      overlay.remove()
      resolve(value)
    }
    const submit=()=>{
      if(!input.value){error.textContent='Informe a senha.';input.focus();return}
      finish(input.value)
    }
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')finish(null)
      if(event.key==='Enter')submit()
    }
    cancel.addEventListener('click',()=>finish(null))
    confirm.addEventListener('click',submit)
    overlay.addEventListener('mousedown',event=>{if(event.target===overlay)finish(null)})
    document.addEventListener('keydown',onKey)
    requestAnimationFrame(()=>input.focus())
  })
}

function themedPrompt(message:string,title='Solicitar autorização',blockers:Array<{tipo?:string;label:string;detalhe:string}>=[]){
  return new Promise<string|null>(resolve=>{
    const overlay=document.createElement('div')
    overlay.className='sgPromptOverlay'
    overlay.setAttribute('role','presentation')

    const dialog=document.createElement('div')
    dialog.className='sgPromptDialog'
    dialog.setAttribute('role','dialog')
    dialog.setAttribute('aria-modal','true')
    dialog.setAttribute('aria-labelledby','sg-prompt-title')

    const head=document.createElement('div')
    head.className='sgPromptHead'
    const icon=document.createElement('div')
    icon.className='sgPromptIcon'
    icon.textContent='!'
    const heading=document.createElement('div')
    const h=document.createElement('strong')
    h.id='sg-prompt-title'
    h.textContent=title
    const p=document.createElement('p')
    p.textContent=message
    heading.append(h,p)
    head.append(icon,heading)

    let blockerBox:HTMLDivElement|null=null
    if(blockers.length){
      blockerBox=document.createElement('div')
      blockerBox.className='sgPromptBlockers'
      const blockerTitle=document.createElement('div')
      blockerTitle.className='sgPromptBlockersTitle'
      const blockerTitleStrong=document.createElement('strong')
      blockerTitleStrong.textContent=blockers.length===1?'Bloqueio identificado':'Bloqueios identificados'
      const blockerTitleCount=document.createElement('span')
      blockerTitleCount.textContent=String(blockers.length)
      blockerTitle.append(blockerTitleStrong,blockerTitleCount)
      const blockerList=document.createElement('div')
      blockerList.className='sgPromptBlockerList'
      blockers.forEach((blocker,index)=>{
        const item=document.createElement('div')
        item.className='sgPromptBlockerItem'
        const number=document.createElement('span')
        number.className='sgPromptBlockerIndex'
        number.textContent=String(index+1)
        const content=document.createElement('div')
        const label=document.createElement('strong')
        label.textContent=blocker.label
        const detail=document.createElement('span')
        detail.textContent=blocker.detalhe
        content.append(label,detail)
        item.append(number,content)
        blockerList.append(item)
      })
      blockerBox.append(blockerTitle,blockerList)
    }

    const input=document.createElement('textarea')
    input.className='sgPromptInput'
    input.rows=3
    input.placeholder='Informe o motivo da solicitação...'
    input.setAttribute('aria-label','Motivo da solicitação')

    const actions=document.createElement('div')
    actions.className='sgPromptActions'
    const cancel=document.createElement('button')
    cancel.type='button'
    cancel.className='ghost'
    cancel.textContent='Cancelar'
    const confirm=document.createElement('button')
    confirm.type='button'
    confirm.className='primary'
    confirm.textContent='Solicitar autorização'
    confirm.disabled=true
    actions.append(cancel,confirm)

    if(blockerBox)dialog.append(head,blockerBox,input,actions)
    else dialog.append(head,input,actions)
    overlay.append(dialog)
    document.body.append(overlay)

    const finish=(value:string|null)=>{
      document.removeEventListener('keydown',onKey)
      overlay.remove()
      resolve(value)
    }
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')finish(null)
      if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!confirm.disabled)finish(input.value.trim())
    }
    input.addEventListener('input',()=>{confirm.disabled=input.value.trim().length<5})
    cancel.addEventListener('click',()=>finish(null))
    confirm.addEventListener('click',()=>finish(input.value.trim()))
    overlay.addEventListener('mousedown',event=>{if(event.target===overlay)finish(null)})
    document.addEventListener('keydown',onKey)
    requestAnimationFrame(()=>input.focus())
  })
}
function themedConfirm(message:string,title='Confirmar ação',confirmLabel='Confirmar',tone:'default'|'danger'='default'){
  return new Promise<boolean>(resolve=>{
    const overlay=document.createElement('div')
    overlay.className='sgConfirmOverlay'
    overlay.setAttribute('role','presentation')

    const dialog=document.createElement('div')
    dialog.className='sgConfirmDialog'
    dialog.setAttribute('role','dialog')
    dialog.setAttribute('aria-modal','true')
    dialog.setAttribute('aria-labelledby','sg-confirm-title')

    const head=document.createElement('div')
    head.className='sgConfirmHead'
    const icon=document.createElement('div')
    icon.className='sgConfirmIcon'+(tone==='danger'?' danger':'')
    icon.textContent=tone==='danger'?'!':'?'
    const heading=document.createElement('div')
    const h=document.createElement('strong')
    h.id='sg-confirm-title'
    h.textContent=title
    const p=document.createElement('p')
    p.textContent=message
    heading.append(h,p)
    head.append(icon,heading)

    const actions=document.createElement('div')
    actions.className='sgConfirmActions'
    const cancel=document.createElement('button')
    cancel.type='button'
    cancel.className='ghost'
    cancel.textContent='Cancelar'
    const confirm=document.createElement('button')
    confirm.type='button'
    confirm.className=tone==='danger'?'dangerAction sgConfirmDanger':'primary'
    confirm.textContent=confirmLabel
    actions.append(cancel,confirm)

    dialog.append(head,actions)
    overlay.append(dialog)
    document.body.append(overlay)

    const finish=(value:boolean)=>{
      document.removeEventListener('keydown',onKey)
      overlay.remove()
      resolve(value)
    }
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')finish(false)
      if(event.key==='Enter')finish(true)
    }
    cancel.addEventListener('click',()=>finish(false))
    confirm.addEventListener('click',()=>finish(true))
    overlay.addEventListener('mousedown',event=>{if(event.target===overlay)finish(false)})
    document.addEventListener('keydown',onKey)
    requestAnimationFrame(()=>confirm.focus())
  })
}

const addMonthsIso=(base:string,months:number)=>{
  const [y,m,d]=base.split('-').map(Number)
  const first=new Date(y,m-1+months,1,12)
  const lastDay=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate()
  const result=new Date(first.getFullYear(),first.getMonth(),Math.min(d,lastDay),12)
  return `${result.getFullYear()}-${String(result.getMonth()+1).padStart(2,'0')}-${String(result.getDate()).padStart(2,'0')}`
}
const buildInstallmentDates=(base:string,count:number)=>Array.from({length:count},(_,i)=>addMonthsIso(base,i))

function App(){
  const [session,setSession]=useState<Session|null>(null)
  const currentSessionUser=useRef<string|null>(null)
  currentSessionUser.current=session?.user.id??null
  const [loading,setLoading]=useState(true)
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const {dark,toggleTheme,preference,setPreference}=useTheme()
  const [showApps,setShowApps]=useState(true)
  const [accountMenuOpen,setAccountMenuOpen]=useState(false)
  const [installPrompt,setInstallPrompt]=useState<BeforeInstallPromptEvent|null>(null)
  const [appInstalled,setAppInstalled]=useState(false)
  const [permissionsReady,setPermissionsReady]=useState(false)
  const [dataReady,setDataReady]=useState(false)
  const [accessError,setAccessError]=useState('')
  const [loginBusy,setLoginBusy]=useState(false)
  const [showLoginPassword,setShowLoginPassword]=useState(false)
  const [rememberLogin,setRememberLogin]=useState(()=>{try{return localStorage.getItem('sg-auth-remember')==='1'}catch{return false}})
  const [resetBusy,setResetBusy]=useState(false)
  const [resetModalOpen,setResetModalOpen]=useState(false)
  const [resetEmail,setResetEmail]=useState('')
  const [resetSent,setResetSent]=useState(false)
  const [recoveryMode,setRecoveryMode]=useState(false)
  const [newPassword,setNewPassword]=useState('')
  const [confirmNewPassword,setConfirmNewPassword]=useState('')
  const [passwordUpdateBusy,setPasswordUpdateBusy]=useState(false)
  const [savingCompany,setSavingCompany]=useState(false)
  const [configSection,setConfigSection]=useState<'empresa'|'usuarios'|'integracoes'|'financeiro'>('empresa')
  const dataLoadSequence=useRef(0)
  const accessSignature=useRef('')
  const moduleHeading=useRef<HTMLHeadingElement>(null)
  const [profileRole,setProfileRole]=useState<PerfilRole>('visualizador')
  const [currentAvatarPath,setCurrentAvatarPath]=useState<string|null>(null)
  const [userPermissions,setUserPermissions]=useState<PermissionMap>(emptyPermissions)
  const [msg,setMsg]=useState('')
  const [saleNotice,setSaleNotice]=useState('')
  useEffect(()=>{
    if(active!=='vendas'||!msg)return
    setSaleNotice(msg)
    const timer=window.setTimeout(()=>setSaleNotice(''),10000)
    return ()=>window.clearTimeout(timer)
  },[msg,active])
  const [tableSearch,setTableSearch]=useState<Record<string,string>>({})
  const [tableSort,setTableSort]=useState<Record<string,{key:string;dir:'asc'|'desc'}>>({})

  const [clientes,setClientes]=useState<Cliente[]>([])
  const [fornecedores,setFornecedores]=useState<Fornecedor[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [vendas,setVendas]=useState<Venda[]>([])
  const [compras,setCompras]=useState<Compra[]>([])
  const [titulos,setTitulos]=useState<Titulo[]>([])
  const [saleApprovals,setSaleApprovals]=useState<SaleApproval[]>([])
  const [empresa,setEmpresa]=useState<EmpresaConfig|null>(null)
  const [vendedores,setVendedores]=useState<Vendedor[]>([])
  const [comprovantes,setComprovantes]=useState<Comprovante[]>([])
  const [commissionsLoading,setCommissionsLoading]=useState(true)
  const [comissoes,setComissoes]=useState<ComissaoResumo[]>([])
  const [movimentosEstoque,setMovimentosEstoque]=useState<MovimentoEstoque[]>([])
  const [produtoComponentes,setProdutoComponentes]=useState<ProdutoComponente[]>([])
  const [gruposProdutos,setGruposProdutos]=useState<ProductGroup[]>([])
  const [subgruposProdutos,setSubgruposProdutos]=useState<ProductSubgroup[]>([])

  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [viewerName,setViewerName]=useState('Visualizador')
  const [viewerEmail,setViewerEmail]=useState('')
  const [viewerPassword,setViewerPassword]=useState('')
  const [creatingViewer,setCreatingViewer]=useState(false)
  const [newUserRole,setNewUserRole]=useState<PerfilRole>('visualizador')
  const [managedUsers,setManagedUsers]=useState<ManagedUser[]>([])
  const [managedUserCard,setManagedUserCard]=useState<string|null>(null)
  const [userEdits,setUserEdits]=useState<Record<string,{nome:string;perfil:PerfilRole;ativo:boolean}>>({})
  const [userPermissionEdits,setUserPermissionEdits]=useState<Record<string,PermissionMap>>({})
  const [savingUserId,setSavingUserId]=useState<string|null>(null)
  const [passwordUserId,setPasswordUserId]=useState<string|null>(null)
  const [newManagedPassword,setNewManagedPassword]=useState('')
  const [confirmManagedPassword,setConfirmManagedPassword]=useState('')
  const [savingPasswordUserId,setSavingPasswordUserId]=useState<string|null>(null)
  const [savingPermissionUserId,setSavingPermissionUserId]=useState<string|null>(null)
  const [savingAvatarUserId,setSavingAvatarUserId]=useState<string|null>(null)
  const [profilePermissions,setProfilePermissions]=useState<Record<PerfilRole,Record<PermissionModule,boolean>>|null>(null)
  const [savingProfileRole,setSavingProfileRole]=useState<PerfilRole|null>(null)

  const [showForm,setShowForm]=useState(false)
  const [editingClient,setEditingClient]=useState<Cliente|null>(null)
  const [clientLookupBusy,setClientLookupBusy]=useState(false)
  const [clientPanel,setClientPanel]=useState<string|null>(null)
  const [editingSupplier,setEditingSupplier]=useState<Fornecedor|null>(null)
  const [supplierPanel,setSupplierPanel]=useState<string|null>(null)
  const [statementBusy,setStatementBusy]=useState<string|null>(null)

  const [editingProduct,setEditingProduct]=useState<Produto|null>(null)
  const [duplicatingProduct,setDuplicatingProduct]=useState(false)
  const [productReturnSaleId,setProductReturnSaleId]=useState<string|null>(null)
  const [productType,setProductType]=useState<'insumo'|'produto_final'|'servico'>('insumo')
  const [productTrackStock,setProductTrackStock]=useState(true)
  const [productGroupId,setProductGroupId]=useState('')
  const [productSubgroupId,setProductSubgroupId]=useState('')
  const [productComponentDrafts,setProductComponentDrafts]=useState<ProdutoComponenteDraft[]>([])
  const [productComponentPicker,setProductComponentPicker]=useState<string|null>(null)
  const [productComponentPickerSearch,setProductComponentPickerSearch]=useState('')
  const [productPanel,setProductPanel]=useState<string|null>(null)
  const [adjustingProduct,setAdjustingProduct]=useState<Produto|null>(null)
  const [stockNew,setStockNew]=useState('')
  const [stockReason,setStockReason]=useState('Ajuste manual')
  const [productSubtab,setProductSubtab]=useState<'cadastro'|'movimentos'|'grupos'|'producao'|'servicos'|'massa'>('cadastro')
  const [excelToolsOpen,setExcelToolsOpen]=useState(false)
  const [bulkProductEdits,setBulkProductEdits]=useState<Record<string,Partial<{descricao:string;unidade:string;custo:number;preco_venda:number;estoque_minimo:number;estoque_atual:number;ativo:boolean}>>>({})
  const [savingBulkProducts,setSavingBulkProducts]=useState(false)
  const [bulkAdjustmentOpen,setBulkAdjustmentOpen]=useState(false)
  const [bulkAdjustmentItems,setBulkAdjustmentItems]=useState<string[]>([])
  const [bulkAdjustmentPicker,setBulkAdjustmentPicker]=useState('')
  const [bulkAdjustmentEditingId,setBulkAdjustmentEditingId]=useState<string|null>(null)

  const [editingSale,setEditingSale]=useState<Venda|null>(null)
  const [salePanel,setSalePanel]=useState<string|null>(null)
  const [saleDetailItems,setSaleDetailItems]=useState<VendaItem[]>([])
  const [saleDetailTab,setSaleDetailTab]=useState<'itens'|'informacoes'|'documentos'|'historico'>('itens')
  const [saleHistory,setSaleHistory]=useState<SaleHistoryEvent[]>([])
  const [saleHistoryBusy,setSaleHistoryBusy]=useState(false)
  const [saleClient,setSaleClient]=useState('')
  const [saleSeller,setSaleSeller]=useState('')
  const [saleCommissionPercent,setSaleCommissionPercent]=useState('')
  const [saleStatus,setSaleStatus]=useState('orcamento')
  const [saleNotes,setSaleNotes]=useState('')
  const [saleRoute,setSaleRoute]=useState<DeliveryRoute|''>('')
  const [salePayment,setSalePayment]=useState<PaymentMethod>('pix')
  const [saleInstallments,setSaleInstallments]=useState(1)
  const [saleDueDate,setSaleDueDate]=useState(today())
  const [saleInstallmentDates,setSaleInstallmentDates]=useState<string[]>([today()])
  const [saleItems,setSaleItems]=useState<SaleItemDraft[]>([newSaleItem()])
  const [saleSections,setSaleSections]=useState<Array<{key:string;titulo:string}>>([])
  const [saleOrder,setSaleOrder]=useState<string[]>([])
  const [quoteModelPicker,setQuoteModelPicker]=useState(false)
  const [quoteModelSearch,setQuoteModelSearch]=useState('')
  const [globalDiscountOpen,setGlobalDiscountOpen]=useState(false)
  const [globalDiscountPercent,setGlobalDiscountPercent]=useState('')
  const [originalSaleItems,setOriginalSaleItems]=useState<VendaItem[]>([])
  const [saleCreditState,setSaleCreditState]=useState<{em_aberto:number;vencido:number}|null>(null)
  const [savingSale,setSavingSale]=useState(false)
  const [saleRequestId,setSaleRequestId]=useState(()=>crypto.randomUUID())
  const [salePage,setSalePage]=useState(1)
  const [salePageSize]=useState(12)
  const [saleFiltersOpen,setSaleFiltersOpen]=useState(false)
  const [saleStatusFilter,setSaleStatusFilter]=useState('todos')
  const [salePaymentFilter,setSalePaymentFilter]=useState('todos')
  const [salePaymentStateFilter,setSalePaymentStateFilter]=useState('todos')
  const [saleRouteFilter,setSaleRouteFilter]=useState('todos')
  const [saleActionMenu,setSaleActionMenu]=useState<string|null>(null)
  const productsRef=useRef<Produto[]>(produtos)
  const saleItemsRef=useRef<SaleItemDraft[]>(saleItems)
  const saleUiRef=useRef({active,showForm})
  productsRef.current=produtos
  saleItemsRef.current=saleItems
  saleUiRef.current={active,showForm}


  const [editingPurchase,setEditingPurchase]=useState<Compra|null>(null)
  const [purchasePanel,setPurchasePanel]=useState<string|null>(null)
  const [purchaseDetailItems,setPurchaseDetailItems]=useState<CompraItem[]>([])
  const [purchaseDetailBusy,setPurchaseDetailBusy]=useState(false)
  const [selectedPurchaseSuggestions,setSelectedPurchaseSuggestions]=useState<Record<string,boolean>>({})
  const [purchaseTab,setPurchaseTab]=useState<'todas'|'a_receber'>('todas')
  const [purchaseSupplier,setPurchaseSupplier]=useState('')
  const [purchaseStatus,setPurchaseStatus]=useState('cotacao')
  const [purchaseNotes,setPurchaseNotes]=useState('')
  const [purchasePayment,setPurchasePayment]=useState<PurchasePaymentMethod>('pix')
  const [purchaseInstallments,setPurchaseInstallments]=useState(1)
  const [purchaseDueDate,setPurchaseDueDate]=useState(today())
  const [purchaseInstallmentDates,setPurchaseInstallmentDates]=useState<string[]>([today()])
  const [purchaseItems,setPurchaseItems]=useState<PurchaseItemDraft[]>([newPurchaseItem()])
  const [savingPurchase,setSavingPurchase]=useState(false)
  const [showNfeImport,setShowNfeImport]=useState(false)

  const [editingTitle,setEditingTitle]=useState<Titulo|null>(null)
  const [financePanel,setFinancePanel]=useState<string|null>(null)
  const [financePanelReturnModule,setFinancePanelReturnModule]=useState<ModuleKey|null>(null)
  const [financePanelReturnSubtab,setFinancePanelReturnSubtab]=useState<'faturamento'|'conciliacao'|null>(null)
  const [financeTransactionId,setFinanceTransactionId]=useState<string|null>(null)
  const [financePanelTab,setFinancePanelTab]=useState<'detalhes'|'pagamentos'|'comprovantes'>('detalhes')
  const [financeSubtab,setFinanceSubtab]=useState<'geral'|'vencidos'|'receber'|'pagar'|'faturamento'|'conciliacao'>('geral')
  const [financeStatusFilter,setFinanceStatusFilter]=useState<'todos'|'aberto'|'parcial'|'pago'|'cancelado'>('todos')
  const [financeStart,setFinanceStart]=useState('')
  const [financeEnd,setFinanceEnd]=useState('')
  const [financeCategory,setFinanceCategory]=useState('todos')
  const [financeCenter,setFinanceCenter]=useState('todos')
  const [financeTitleType,setFinanceTitleType]=useState<'receber'|'pagar'>('receber')
  const [financeTitleEntity,setFinanceTitleEntity]=useState('')
  const [financeImportNotice,setFinanceImportNotice]=useState('')
  const financeTitleFormRef=useRef<HTMLFormElement|null>(null)
  const financeImportInputRef=useRef<HTMLInputElement|null>(null)
  const [financeActivityState,setFinanceActivityState]=useState<'loading'|'ready'|'error'>('loading')
  const [financePayments,setFinancePayments]=useState<FinancePayment[]>([])
  const [financeReversals,setFinanceReversals]=useState<FinanceReversal[]>([])
  const [faturasVendas,setFaturasVendas]=useState<FaturaVenda[]>([])
  const [faturaVendaItens,setFaturaVendaItens]=useState<FaturaVendaItem[]>([])
  const [billingSelectedSales,setBillingSelectedSales]=useState<string[]>([])
  const [billingSale,setBillingSale]=useState<Venda|null>(null)
  const [billingInvoiceSaleIds,setBillingInvoiceSaleIds]=useState<string[]>([])
  const [billingError,setBillingError]=useState('')
  const [billingPayment,setBillingPayment]=useState<PaymentMethod>('pix')
  const [billingLines,setBillingLines]=useState<InvoiceDraftLine[]>([])
  const [billingStatusFilter,setBillingStatusFilter]=useState<'todos'|'nao-faturado'|'faturado'|'cancelado'>('todos')
  const [billingSearch,setBillingSearch]=useState('')
  const [billingBusy,setBillingBusy]=useState(false)
  const [paymentDate,setPaymentDate]=useState(today())
  const [paymentAmount,setPaymentAmount]=useState('')
  const [changePaymentMethod,setChangePaymentMethod]=useState(false)
  const [effectivePaymentMethod,setEffectivePaymentMethod]=useState<PaymentMethod|'transferencia'|'ajuste'|'outro'>('pix')

  const [editingSeller,setEditingSeller]=useState<Vendedor|null>(null)
  const [sellerPanel,setSellerPanel]=useState<string|null>(null)
  const [commissionStart,setCommissionStart]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10))
  const [commissionEnd,setCommissionEnd]=useState(today())
  const [commissionReportSeller,setCommissionReportSeller]=useState('todos')

  const [reportStart,setReportStart]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10))
  const [reportEnd,setReportEnd]=useState(today())
  const [reportStatus,setReportStatus]=useState('todos')

  const title=useMemo(()=>menu.find(m=>m[0]===active)?.[1]||'Dashboard',[active])
  const isAdmin=profileRole==='administrador'
  const canViewModule=(module:AppModule)=>canViewPermission(userPermissions,appPermission(module))
  const canEditModule=(module:AppModule)=>canEditPermission(userPermissions,appPermission(module))
  const canManageSales=canEditModule('vendas')
  const canManageClients=canEditModule('clientes')
  const canManageSuppliers=canEditModule('fornecedores')
  const canManageProducts=canEditModule('produtos')
  const canManagePurchases=canEditModule('compras')
  const canViewFinance=canViewModule('financeiro')
  const canManageFinance=canEditModule('financeiro')
  const canManageCommissions=canEditModule('comissoes')
  const canViewAuthorizations=canViewModule('autorizacoes')
  const canManageAuthorizations=canEditModule('autorizacoes')
  const canManageConfig=isAdmin&&canEditModule('config')
  const visibleMenu=menu.filter(([k])=>canViewModule(k))

  useEffect(()=>{if(!showApps)moduleHeading.current?.focus()},[showApps,active])

  useEffect(()=>{
    const onBeforeInstall=(event:Event)=>{
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled=()=>{setAppInstalled(true);setInstallPrompt(null);setAccountMenuOpen(false);setMsg('SG Sistema de Gestão instalado com sucesso.')}
    window.addEventListener('beforeinstallprompt',onBeforeInstall)
    window.addEventListener('appinstalled',onInstalled)
    const standalone=window.matchMedia('(display-mode: standalone)').matches
    setAppInstalled(standalone)
    return ()=>{
      window.removeEventListener('beforeinstallprompt',onBeforeInstall)
      window.removeEventListener('appinstalled',onInstalled)
    }
  },[])

  useEffect(()=>{
    if(!supabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data,error})=>{if(error)setMsg('Não foi possível recuperar a sessão. Entre novamente.');setSession(data.session);setLoading(false)}).catch(()=>{setMsg('Não foi possível recuperar a sessão.');setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{if(event==='PASSWORD_RECOVERY')setRecoveryMode(true);setSession(s)})
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session||!permissionsReady)return

    const notifySaleProductChange=(before:Produto|undefined,after:Produto)=>{
      const ui=saleUiRef.current
      if(ui.active!=='vendas'||!ui.showForm||!saleItemsRef.current.some(item=>item.produto_id===after.id))return

      const notices:string[]=[]
      if(before&&Number(before.estoque_atual)!==Number(after.estoque_atual)){
        notices.push(`${after.descricao}: estoque atualizado para ${Number(after.estoque_atual).toLocaleString('pt-BR')} ${after.unidade}.`)
      }
      if(before&&Number(before.preco_venda)!==Number(after.preco_venda)){
        notices.push(`${after.descricao}: preço cadastrado mudou de ${money(Number(before.preco_venda))} para ${money(Number(after.preco_venda))}. O preço já digitado nesta venda foi mantido.`)
      }
      if(before?.ativo!==false&&after.ativo===false){
        notices.push(`${after.descricao} foi desativado enquanto esta venda estava aberta.`)
      }
      if(notices.length)setSaleNotice('Atualização em tempo real: '+notices.join(' '))
    }

    const channel=supabase
      .channel(`erp-live-${session.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'produtos'},payload=>{
        if(payload.eventType==='DELETE'){
          const deleted=payload.old as {id?:string}
          if(!deleted.id)return
          const used=saleItemsRef.current.some(item=>item.produto_id===deleted.id)
          const next=productsRef.current.filter(row=>row.id!==deleted.id)
          productsRef.current=next
          setProdutos(next)
          if(used&&saleUiRef.current.active==='vendas'&&saleUiRef.current.showForm){
            setSaleNotice('Atualização em tempo real: um produto desta venda foi removido. Revise os itens antes de continuar.')
          }
          return
        }

        const nextProduct=payload.new as Produto
        if(!nextProduct?.id)return
        const before=productsRef.current.find(row=>row.id===nextProduct.id)
        notifySaleProductChange(before,nextProduct)
        const next=before
          ? productsRef.current.map(row=>row.id===nextProduct.id?nextProduct:row)
          : [...productsRef.current,nextProduct]
        next.sort((a,b)=>a.descricao.localeCompare(b.descricao,'pt-BR'))
        productsRef.current=next
        setProdutos(next)
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'produto_componentes'},async()=>{
        const result=await readAllRows((from,to)=>supabase.from('produto_componentes').select('*').order('created_at').order('id').range(from,to))
        if(!result.error)setProdutoComponentes((result.data||[]) as ProdutoComponente[])
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'movimentos_estoque'},payload=>{
        if(payload.eventType==='INSERT'){
          const row=payload.new as MovimentoEstoque
          if(row?.id)setMovimentosEstoque(rows=>[row,...rows.filter(item=>item.id!==row.id)])
        }else if(payload.eventType==='UPDATE'){
          const row=payload.new as MovimentoEstoque
          if(row?.id)setMovimentosEstoque(rows=>rows.map(item=>item.id===row.id?row:item))
        }else if(payload.eventType==='DELETE'){
          const row=payload.old as {id?:string}
          if(row.id)setMovimentosEstoque(rows=>rows.filter(item=>item.id!==row.id))
        }
      })
      .subscribe()

    const refreshProducts=async()=>{
      if(document.visibilityState!=='visible')return
      const result=await readAllRows((from,to)=>supabase.from('produtos').select('*').order('descricao',{ascending:true}).order('id').range(from,to))
      if(result.error)return
      const next=(result.data||[]) as Produto[]
      productsRef.current=next
      setProdutos(next)
    }

    const onVisibility=()=>{if(document.visibilityState==='visible')void refreshProducts()}
    const onFocus=()=>void refreshProducts()
    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('focus',onFocus)

    return ()=>{
      document.removeEventListener('visibilitychange',onVisibility)
      window.removeEventListener('focus',onFocus)
      void supabase.removeChannel(channel)
    }
  },[session?.user.id,permissionsReady])

  useEffect(()=>{
    setProfileRole('visualizador');setUserPermissions(emptyPermissions());setActive('dashboard');setShowApps(true);setPermissionsReady(false);setDataReady(false);setAccessError('');accessSignature.current='';dataLoadSequence.current++;closeForms()
    setClientes([]);setFornecedores([]);setProdutos([]);setVendas([]);setCompras([]);setTitulos([]);setSaleApprovals([])
    setEmpresa(null);setVendedores([]);setComprovantes([]);setMovimentosEstoque([]);setProdutoComponentes([]);setGruposProdutos([]);setSubgruposProdutos([]);setComissoes([])
    setManagedUsers([]);setManagedUserCard(null);setUserEdits({});setUserPermissionEdits({});setFinancePayments([]);setFinanceReversals([]);setFaturasVendas([]);setFaturaVendaItens([]);setBillingSelectedSales([]);setBillingSale(null);setEmail('');setPassword('')
  },[session?.user.id])
  useEffect(()=>{if(session)void loadData()},[session])
  useEffect(()=>{
    if(session&&active==='comissoes')void loadCommissions()
  },[session,active,commissionStart,commissionEnd])
  useEffect(()=>{
    if(session&&active==='config'&&canManageConfig)void loadManagedUsers()
  },[session,active,userPermissions])

  useEffect(()=>{
    if(!session||!permissionsReady||canViewModule(active))return
    setShowApps(true);closeForms()
    const first=visibleMenu[0]?.[0]
    if(first)setActive(first)
  },[session,userPermissions,active,permissionsReady])

  useEffect(()=>{
    if(session&&active==='financeiro'&&canViewFinance)void loadFinanceActivity()
  },[session?.user.id,active,profileRole,canViewFinance])

  useEffect(()=>{
    if(!session||!showForm||active!=='vendas'||saleStatus==='orcamento'||!saleClient){
      setSaleCreditState(null)
      return
    }
    let cancelled=false
    void supabase.rpc('situacao_credito_cliente',{p_cliente_id:saleClient,p_excluir_venda_id:editingSale?.id||null}).then(({data,error})=>{
      if(cancelled||error)return
      const row=Array.isArray(data)?data[0]:data
      setSaleCreditState({em_aberto:Number(row?.em_aberto||0),vencido:Number(row?.vencido||0)})
    })
    return ()=>{cancelled=true}
  },[session?.user.id,showForm,active,saleStatus,saleClient,editingSale?.id])

  useEffect(()=>{
    if(!session)return
    const key=`sg-erp-activity:${session.user.id}`
    let lastActivity=Date.now()
    try{lastActivity=Number(sessionStorage.getItem(key)||Date.now())}catch{/* mantém o controle em memória */}
    const storeActivity=(value:string|null)=>{try{if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,value)}catch{/* memória continua sendo verificada */}}
    let expiring=false
    const expire=()=>{
      if(expiring)return
      expiring=true;setPermissionsReady(false);setDataReady(false);setUserPermissions(emptyPermissions());closeForms()
      setMsg('Sessão encerrada por inatividade. Entre novamente para continuar.')
      storeActivity(null)
      void supabase.auth.signOut({scope:'local'}).finally(()=>setSession(null))
    }
    const check=()=>{if(sessionExpired(lastActivity,Date.now(),empresa?.sessao_inatividade_minutos))expire()}
    const activity=()=>{
      if(sessionExpired(lastActivity,Date.now(),empresa?.sessao_inatividade_minutos)){expire();return}
      lastActivity=Date.now();storeActivity(String(lastActivity))
    }
    storeActivity(String(lastActivity));check()
    const timer=window.setInterval(check,1000)
    const events=['pointerdown','keydown','scroll','touchstart'] as const
    events.forEach(ev=>window.addEventListener(ev,activity,{passive:true}))
    window.addEventListener('focus',check)
    document.addEventListener('visibilitychange',check)
    return ()=>{window.clearInterval(timer);events.forEach(ev=>window.removeEventListener(ev,activity));window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)}
  },[session?.user.id,empresa?.sessao_inatividade_minutos])

  useEffect(()=>{
    if(!session)return
    let cancelled=false,running=false
    const verify=async()=>{
      if(document.visibilityState!=='visible'||running)return
      running=true
      const sequence=dataLoadSequence.current
      try{
        const access=await fetchAccess(session.user.id)
        if(cancelled||currentSessionUser.current!==session.user.id||sequence!==dataLoadSequence.current)return
        if(JSON.stringify(access)!==accessSignature.current){setPermissionsReady(false);setDataReady(false);closeForms();await loadData()}
      }catch(error){if(!cancelled&&sequence===dataLoadSequence.current)blockAccess(error)}
      finally{running=false}
    }
    const timer=window.setInterval(()=>void verify(),30000)
    const onFocus=()=>void verify()
    window.addEventListener('focus',onFocus)
    document.addEventListener('visibilitychange',onFocus)
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus)}
  },[session?.user.id])

  async function fetchAccess(userId:string){
    const [profile,permissions]=await Promise.all([
      supabase.from('profiles').select('perfil,ativo,avatar_path').eq('id',userId).maybeSingle(),
      supabase.rpc('minhas_permissoes_erp')
    ])
    if(profile.error||permissions.error)throw new Error('Não foi possível validar seus acessos. Tente novamente.')
    if(!profile.data?.ativo||!['administrador','financeiro','vendas','estoque','visualizador'].includes(profile.data.perfil))throw new Error('Acesso não liberado. Procure um administrador do sistema.')
    return {role:profile.data.perfil as PerfilRole,avatarPath:profile.data.avatar_path||null,permissions:parseEffectivePermissions(permissions.data)}
  }
  function blockAccess(error:unknown){
    dataLoadSequence.current++
    setPermissionsReady(false);setCurrentAvatarPath(null);setUserPermissions(emptyPermissions());closeForms()
    setClientes([]);setFornecedores([]);setProdutos([]);setVendas([]);setCompras([]);setTitulos([]);setEmpresa(null);setVendedores([]);setComprovantes([]);setMovimentosEstoque([]);setProdutoComponentes([]);setGruposProdutos([]);setSubgruposProdutos([]);setSaleApprovals([]);setFaturasVendas([]);setFaturaVendaItens([]);setManagedUsers([]);setFinancePayments([]);setFinanceReversals([]);setComissoes([])
    setAccessError(error instanceof Error?error.message:'Não foi possível validar seus acessos.')
  }

  async function loadData(){
    if(!session)return
    const sequence=++dataLoadSequence.current
    const userId=session.user.id
    try{
    const access=await fetchAccess(userId)
    if(currentSessionUser.current!==userId||sequence!==dataLoadSequence.current)return
    const signature=JSON.stringify(access)
    if(accessSignature.current&&accessSignature.current!==signature){setPermissionsReady(false);closeForms();setMsg('Seus acessos foram atualizados. Revise a operação antes de continuar.')}
    accessSignature.current=signature
    setProfileRole(access.role);setCurrentAvatarPath(access.avatarPath);setUserPermissions(access.permissions);setAccessError('');setPermissionsReady(true)
    const [c,f,p,v,cp,t,ec,vd,cv,me,sa,pc,fv,fvi,gp,sgp]=await Promise.all([
      readAllRows((from,to)=>supabase.from('clientes').select('*').order('nome',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('fornecedores').select('*').order('nome',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('produtos').select('*').order('descricao',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('vendas').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('compras').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('titulos_financeiros').select('*').order('vencimento',{ascending:true}).order('id').range(from,to)),
      supabase.from('empresa_config').select('*').eq('id',1).maybeSingle(),
      readAllRows((from,to)=>supabase.from('vendedores').select('*').order('nome',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('comprovantes_pagamento').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('movimentos_estoque').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('aprovacoes_operacoes').select('id,entidade_id,status,solicitado_em,payload').eq('entidade_tipo','venda').eq('status','pendente').order('solicitado_em',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('produto_componentes').select('*').order('created_at').order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('faturas_vendas').select('*').order('criada_em',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('fatura_venda_itens').select('*').order('created_at').order('venda_id').range(from,to)),
      readAllRows((from,to)=>supabase.from('grupos_produtos').select('*').order('ordem').order('nome').range(from,to)),
      readAllRows((from,to)=>supabase.from('subgrupos_produtos').select('*').order('ordem').order('nome').range(from,to))
    ])
    if(currentSessionUser.current!==userId||sequence!==dataLoadSequence.current)return
    setClientes((c.data||[]) as Cliente[])
    setFornecedores((f.data||[]) as Fornecedor[])
    setProdutos((p.data||[]) as Produto[])
    setVendas((v.data||[]) as Venda[])
    setCompras((cp.data||[]) as Compra[])
    setTitulos((t.data||[]) as Titulo[])
    if(ec.error||!ec.data)throw new Error('Não foi possível carregar as configurações da empresa. Tente novamente.');
    setEmpresa(ec.data as EmpresaConfig)
    setVendedores((vd.data||[]) as Vendedor[])
    setComprovantes((cv.data||[]) as Comprovante[])
    setMovimentosEstoque((me.data||[]) as MovimentoEstoque[])
    setProdutoComponentes((pc.data||[]) as ProdutoComponente[])
    setGruposProdutos((gp.data||[]) as ProductGroup[])
    setSubgruposProdutos((sgp.data||[]) as ProductSubgroup[])
    setFaturasVendas((fv.data||[]) as FaturaVenda[])
    setFaturaVendaItens((fvi.data||[]) as FaturaVendaItem[])
    setSaleApprovals((sa.data||[]) as SaleApproval[])
    const failed=[c,f,p,v,cp,t,vd,cv,me,sa,pc,fv,fvi,gp,sgp].filter(result=>result.error)
    if(failed.length)throw new Error('Não foi possível carregar todos os vínculos do ERP. Atualize para continuar com os dados completos.')
    setDataReady(true)
    }catch(error){
      if(currentSessionUser.current!==userId||sequence!==dataLoadSequence.current)return
      blockAccess(error)
    }
  }

  async function loadFinanceActivity(){
    if(!session||!canViewFinance)return
    setFinanceActivityState('loading')
    const [p,e]=await Promise.all([
      readAllRows((from,to)=>supabase.from('pagamentos_titulos').select('id,titulo_id,data_pagamento,valor').order('data_pagamento',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('estornos_pagamentos').select('id,pagamento_id,valor,data_estorno').order('data_estorno',{ascending:false}).order('id').range(from,to))
    ])
    if(currentSessionUser.current!==session.user.id)return
    setFinanceActivityState(p.error||e.error?'error':'ready')
    if(p.error||e.error)setMsg('Não foi possível carregar os recebimentos: '+(p.error||e.error)?.message)
    if(!p.error)setFinancePayments((p.data||[]) as FinancePayment[])
    if(!e.error)setFinanceReversals((e.data||[]) as FinanceReversal[])
  }

  async function refreshFinance(){
    await Promise.all([loadData(),loadFinanceActivity()])
  }

  async function loadCommissions(){
    setCommissionsLoading(true)
    const {data,error}=await readAllRows((from,to)=>supabase.rpc('comissoes_por_periodo',{
      p_inicio:commissionStart,
      p_fim:commissionEnd
    }).order('vendedor_nome').order('vendedor_id').range(from,to))
    setCommissionsLoading(false)
    if(error){setMsg('Não foi possível calcular as comissões: '+error.message);return}
    setComissoes((data||[]) as ComissaoResumo[])
  }

  async function downloadCommissionReport(){
    setMsg('')
    const {data,error}=await readAllRows((from,to)=>supabase.rpc('relatorio_comissoes_vendas',{
      p_inicio:commissionStart,
      p_fim:commissionEnd
    }).order('data_pagamento').order('pagamento_id').range(from,to))
    if(error){
      setMsg('Não foi possível gerar o relatório de comissões: '+error.message)
      return
    }

    const allRows=(data||[]) as CommissionReportRow[]
    const rows=commissionReportSeller==='todos'
      ? allRows
      : allRows.filter(r=>r.vendedor_id===commissionReportSeller)
    const sellerName=commissionReportSeller==='todos'
      ? null
      : vendedores.find(v=>v.id===commissionReportSeller)?.nome||'Vendedor'

    ;(await import('./lib/commissionReportPdf')).generateCommissionReportPdf({
      inicio:commissionStart,
      fim:commissionEnd,
      company:empresa,
      vendedorFiltro:sellerName,
      rows
    })
    setMsg(`Relatório PDF gerado para ${sellerName||'todos os vendedores'} com ${rows.length} recebimento(s) apurado(s).`)
  }

  function startNewSeller(){
    if(!canManageCommissions){setMsg('Você possui somente visualização em Comissões.');return}
    setEditingSeller(null)
    setShowForm(true)
    setMsg('')
  }

  function startEditSeller(v:Vendedor){
    if(!canManageCommissions){setMsg('Você possui somente visualização em Comissões.');return}
    // Feche primeiro o painel de ações; caso contrário, o modal fica por cima do formulário de edição.
    setSellerPanel(null)
    setEditingSeller(v)
    setShowForm(true)
    setMsg('')
  }

  async function saveSeller(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageCommissions){setMsg('Sem permissão para editar vendedores e comissões.');return}
    const f=new FormData(e.currentTarget)
    const payload={
      nome:String(f.get('nome')||'').trim(),
      email:String(f.get('email')||'').trim()||null,
      telefone:String(f.get('telefone')||'').trim()||null,
      percentual_comissao:Number(f.get('percentual_comissao')||0),
      ativo:String(f.get('ativo')||'true')==='true',
      updated_at:new Date().toISOString()
    }
    const r=editingSeller
      ? await supabase.from('vendedores').update(payload).eq('id',editingSeller.id)
      : await supabase.from('vendedores').insert(payload)
    setMsg(r.error?r.error.message:editingSeller?'Vendedor atualizado.':'Vendedor cadastrado.')
    if(!r.error){
      setEditingSeller(null)
      setShowForm(false)
      await loadData()
      await loadCommissions()
    }
  }

  async function deactivateSeller(v:Vendedor){
    if(!canManageCommissions)return
    const {error}=await supabase.from('vendedores').update({ativo:false,updated_at:new Date().toISOString()}).eq('id',v.id)
    setMsg(error?error.message:'Vendedor desativado.')
    if(!error){await loadData();await loadCommissions()}
  }

  function proofsFor(kind:'venda'|'compra',id:string){
    return comprovantes.filter(p=>kind==='venda'?p.venda_id===id:p.compra_id===id)
  }

  async function uploadProof(kind:'venda'|'compra',id:string,e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file)return
    if(kind==='venda'?!canManageSales:!canManagePurchases){setMsg('Você possui somente visualização neste módulo e não pode anexar comprovantes.');return}
    const allowed=['application/pdf','image/jpeg','image/png','image/webp']
    if(!allowed.includes(file.type)){setMsg('Envie um comprovante em PDF, JPG, PNG ou WEBP.');return}
    if(file.size>10*1024*1024){setMsg('O comprovante deve ter no máximo 10 MB.');return}

    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')
    const folder=kind==='venda'?'vendas':'compras'
    const path=`${folder}/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const upload=await supabase.storage.from('comprovantes-pagamento').upload(path,file,{
      contentType:file.type,
      upsert:false
    })
    if(upload.error){setMsg('Falha ao enviar comprovante: '+upload.error.message);return}

    const payload={
      venda_id:kind==='venda'?id:null,
      compra_id:kind==='compra'?id:null,
      storage_path:path,
      nome_arquivo:file.name,
      mime_type:file.type,
      tamanho:file.size
    }
    const meta=await supabase.from('comprovantes_pagamento').insert(payload)
    if(meta.error){
      await supabase.storage.from('comprovantes-pagamento').remove([path])
      setMsg('Falha ao registrar comprovante: '+meta.error.message)
      return
    }

    setMsg('Comprovante anexado à fatura.')
    await loadData()
  }

  async function openProof(p:Comprovante){
    const {data,error}=await supabase.storage.from('comprovantes-pagamento').createSignedUrl(p.storage_path,300)
    if(error||!data?.signedUrl){setMsg('Não foi possível abrir o comprovante.');return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }

  async function deleteProof(p:Comprovante){
    if(!canManageFinance){setMsg('Sem permissão para excluir comprovantes.');return}
    if(!await themedConfirm('Excluir este comprovante?'))return
    const storage=await supabase.storage.from('comprovantes-pagamento').remove([p.storage_path])
    if(storage.error){setMsg(storage.error.message);return}
    const meta=await supabase.from('comprovantes_pagamento').delete().eq('id',p.id)
    setMsg(meta.error?meta.error.message:'Comprovante excluído.')
    if(!meta.error)await loadData()
  }

  async function login(e:FormEvent){
    e.preventDefault();if(loginBusy)return;setMsg('');setLoginBusy(true)
    try{
      try{
        if(rememberLogin)localStorage.setItem('sg-auth-remember','1')
        else localStorage.removeItem('sg-auth-remember')
      }catch{/* armazenamento indisponível */}
      const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
      if(error)setMsg('Não foi possível entrar. Verifique e-mail e senha.')
      else if(data.user){try{sessionStorage.setItem(`sg-erp-activity:${data.user.id}`,String(Date.now()))}catch{/* controle em memória */}}
    }catch{setMsg('Não foi possível conectar. Tente novamente.')}finally{setLoginBusy(false)}
  }

  function openPasswordRecovery(){
    setResetEmail(email.trim())
    setResetSent(false)
    setMsg('')
    setResetModalOpen(true)
  }

  async function recoverPassword(e?:FormEvent){
    e?.preventDefault()
    if(resetBusy)return
    const target=resetEmail.trim()
    if(!target){setMsg('Informe seu e-mail para receber o link de recuperação.');return}
    setResetBusy(true);setMsg('')
    try{
      const redirectTo=`${window.location.origin}${window.location.pathname}`
      const {error}=await supabase.auth.resetPasswordForEmail(target,{redirectTo})
      if(error)throw error
      setResetSent(true)
      setMsg('')
    }catch(error){
      setMsg((error as {message?:string}).message||'Não foi possível enviar o e-mail de recuperação.')
    }finally{setResetBusy(false)}
  }

  async function updateRecoveredPassword(e:FormEvent){
    e.preventDefault()
    if(passwordUpdateBusy)return
    if(newPassword.length<6){setMsg('A nova senha deve ter pelo menos 6 caracteres.');return}
    if(newPassword!==confirmNewPassword){setMsg('As senhas não coincidem.');return}
    setPasswordUpdateBusy(true);setMsg('')
    try{
      const {error}=await supabase.auth.updateUser({password:newPassword})
      if(error)throw error
      await supabase.auth.signOut()
      setRecoveryMode(false)
      setNewPassword('')
      setConfirmNewPassword('')
      try{window.history.replaceState({},document.title,window.location.pathname)}catch{/* sem suporte */}
      setMsg('Senha alterada com sucesso. Entre novamente com sua nova senha.')
    }catch(error){
      setMsg((error as {message?:string}).message||'Não foi possível alterar a senha.')
    }finally{setPasswordUpdateBusy(false)}
  }

  function closeForms(){
    setBillingSale(null);setBillingLines([]);setBillingInvoiceSaleIds([]);setBillingError('');setManagedUserCard(null)
    setShowForm(false)
    setEditingClient(null)
    setEditingSupplier(null)
    setEditingProduct(null)
    setAdjustingProduct(null)
    setEditingTitle(null)
    setEditingSeller(null)
    setShowNfeImport(false)
    resetSaleForm()
    resetPurchaseForm()
  }

  // CLIENTES
  async function downloadEntityStatement(kind:StatementKind,entity:Cliente|Fornecedor){
    if(!canViewFinance||statementBusy)return
    setStatementBusy(kind+':'+entity.id);setMsg('')
    const asOf=today()
    try{
      const columns='id,tipo,descricao,vencimento,valor,valor_pago,status,parcela_numero,'+(kind==='cliente'?'vendas!inner(cliente_id,fatura_numero,status)':'compras!inner(fornecedor_id,fatura_numero,status)')
      const result=await readAllRows((from,to)=>{
        let query=supabase.from('titulos_financeiros').select(columns).eq('tipo',kind==='cliente'?'receber':'pagar').in('status',['aberto','parcial'])
        query=kind==='cliente'?query.eq('vendas.cliente_id',entity.id).in('vendas.status',['pedido','faturado']):query.eq('compras.fornecedor_id',entity.id).in('compras.status',['pedido_aprovado','pedido_recebido'])
        return query.order('vencimento').order('id').range(from,to)
      })
      if(result.error)throw new Error(result.error.message)
      const statement=buildStatement(result.data as unknown as StatementWire[],kind,entity.id,asOf)
      ;(await import('./lib/entityStatementPdf')).downloadEntityStatementPdf({kind,entity,company:empresa,statement})
      setMsg('Relatório de faturas vencidas e a vencer gerado para '+entity.nome+'.')
    }catch(error){setMsg('Não foi possível gerar o relatório: '+(error instanceof Error?error.message:'erro desconhecido'))}
    finally{setStatementBusy(null)}
  }

  function startNewClient(){if(!canManageClients){setMsg('Você possui apenas permissão de visualização em Clientes.');return}setEditingClient(null);setShowForm(true);setMsg('')}
  function startEditClient(c:Cliente){if(!canManageClients){setMsg('Você possui apenas permissão de visualização em Clientes.');return}setEditingClient(c);setShowForm(true);setMsg('')}
  async function lookupClientCnpj(form:HTMLFormElement|null){
    if(!form||clientLookupBusy)return
    const documentInput=form.elements.namedItem('documento') as HTMLInputElement|null
    const cnpj=onlyDigits(documentInput?.value||'',14)
    if(cnpj.length!==14){setMsg('Informe um CNPJ com 14 dígitos antes de consultar.');return}
    setClientLookupBusy(true);setMsg('')
    try{
      const {data,error}=await supabase.functions.invoke('cnpj-lookup',{body:{cnpj}})
      if(error){
        let message='Não foi possível consultar o CNPJ.'
        try{const detail=await error.context?.json();if(detail?.error)message=detail.error}catch{/* mantém mensagem segura */}
        throw new Error(message)
      }
      if(data?.error)throw new Error(data.error)
      const set=(name:string,value:unknown,transform?:(v:string)=>string)=>{
        const el=form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement|null
        const raw=String(value??'').trim()
        if(!el||!raw)return
        el.value=transform?transform(raw):raw
        el.dispatchEvent(new Event('input',{bubbles:true}))
        el.dispatchEvent(new Event('change',{bubbles:true}))
      }
      set('documento',data.cnpj,maskDocument)
      set('nome',data.razao_social||data.nome_fantasia)
      set('email',data.email)
      set('telefone',data.telefone,maskPhone)
      set('logradouro',data.logradouro)
      set('numero',data.numero)
      set('bairro',data.bairro)
      set('municipio',data.municipio)
      set('codigo_municipio',data.codigo_ibge)
      set('uf',data.uf)
      set('cep',data.cep,maskCep)
      const status=String(data.situacao_cadastral||'').trim()
      setMsg(status?'CNPJ consultado com sucesso. Situação cadastral: '+status+'.':'CNPJ consultado com sucesso.')
    }catch(error){
      setMsg(error instanceof Error?error.message:'Não foi possível consultar o CNPJ.')
    }finally{
      setClientLookupBusy(false)
    }
  }

  async function saveClient(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageClients){setMsg('Sem permissão para editar Clientes.');return}
    const f=new FormData(e.currentTarget)
    const payload={
      nome:String(f.get('nome')||'').trim(),
      documento:String(f.get('documento')||'').trim()||null,
      email:String(f.get('email')||'').trim()||null,
      telefone:String(f.get('telefone')||'').trim()||null,
      limite_credito:Number(f.get('limite_credito')||0),
      logradouro:String(f.get('logradouro')||'').trim()||null,
      numero:String(f.get('numero')||'').trim()||null,
      bairro:String(f.get('bairro')||'').trim()||null,
      municipio:String(f.get('municipio')||'').trim()||null,
      codigo_municipio:onlyDigits(String(f.get('codigo_municipio')||''),7)||null,
      uf:String(f.get('uf')||'').trim().toUpperCase()||null,
      cep:onlyDigits(String(f.get('cep')||''),8)||null,
      indicador_ie:String(f.get('indicador_ie')||'').trim()||null,
      inscricao_estadual:String(f.get('inscricao_estadual')||'').trim()||null,
      consumidor_final:String(f.get('consumidor_final')||'true')==='true',
      presenca_comprador:Number(f.get('presenca_comprador')||0)||null,
      latitude:String(f.get('latitude')||'').trim()===''?null:Number(f.get('latitude')),
      longitude:String(f.get('longitude')||'').trim()===''?null:Number(f.get('longitude')),
      ativo:String(f.get('ativo')||'true')==='true'
    }
    const r=editingClient?await supabase.from('clientes').update(payload).eq('id',editingClient.id):await supabase.from('clientes').insert(payload)
    setMsg(r.error?r.error.message:editingClient?'Cliente atualizado.':'Cliente cadastrado.')
    if(!r.error){setShowForm(false);setEditingClient(null);await loadData()}
  }
  async function deleteClient(c:Cliente){
    if(!(isAdmin&&canManageClients)){setMsg('Sem permissão para excluir clientes.');return}
    if(!await themedConfirm(`Excluir o cliente "${c.nome}"?`))return
    const r=await supabase.from('clientes').delete().eq('id',c.id).select('id')
    if(r.error?.code==='23503'){
      const d=await supabase.from('clientes').update({ativo:false}).eq('id',c.id)
      setMsg(d.error?d.error.message:'Cliente com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:r.data?.length?'Cliente excluído.':'Cliente não foi excluído. Atualize a tela e tente novamente.')
    await loadData()
  }

  // FORNECEDORES
  function startNewSupplier(){if(!canManageSuppliers){setMsg('Você possui apenas permissão de visualização em Fornecedores.');return}setEditingSupplier(null);setShowForm(true);setMsg('')}
  function startEditSupplier(f:Fornecedor){if(!canManageSuppliers){setMsg('Você possui apenas permissão de visualização em Fornecedores.');return}setEditingSupplier(f);setShowForm(true);setMsg('')}
  async function saveSupplier(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageSuppliers){setMsg('Sem permissão para editar Fornecedores.');return}
    const f=new FormData(e.currentTarget)
    const payload={
      nome:String(f.get('nome')||''),documento:String(f.get('documento')||'')||null,
      email:String(f.get('email')||'')||null,telefone:String(f.get('telefone')||'')||null,
      ativo:String(f.get('ativo')||'true')==='true'
    }
    const r=editingSupplier?await supabase.from('fornecedores').update(payload).eq('id',editingSupplier.id):await supabase.from('fornecedores').insert(payload)
    setMsg(r.error?r.error.message:editingSupplier?'Fornecedor atualizado.':'Fornecedor cadastrado.')
    if(!r.error){setShowForm(false);setEditingSupplier(null);await loadData()}
  }
  async function deleteSupplier(f:Fornecedor){
    if(!(isAdmin&&canManageSuppliers)){setMsg('Sem permissão para excluir fornecedores.');return}
    if(!await themedConfirm(`Excluir o fornecedor "${f.nome}"?`))return
    const r=await supabase.from('fornecedores').delete().eq('id',f.id).select('id')
    if(r.error?.code==='23503'){
      const d=await supabase.from('fornecedores').update({ativo:false}).eq('id',f.id)
      setMsg(d.error?d.error.message:'Fornecedor com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:r.data?.length?'Fornecedor excluído.':'Fornecedor não foi excluído. Atualize a tela e tente novamente.')
    await loadData()
  }

  // PRODUTOS / ESTOQUE
  function componentDraftsForProduct(productId:string):ProdutoComponenteDraft[]{
    return produtoComponentes.filter(row=>row.produto_final_id===productId).map(row=>({
      key:row.id,
      componente_id:row.componente_id,
      quantidade:Number(row.quantidade)
    }))
  }
  function startNewProduct(){
    if(!canManageProducts){setMsg('Você possui somente visualização em Produtos / Estoque.');return}
    setProductReturnSaleId(null);setEditingProduct(null);setDuplicatingProduct(false);setProductType('insumo');setProductTrackStock(true);setProductGroupId('');setProductSubgroupId('');setProductComponentDrafts([]);setAdjustingProduct(null);setShowForm(true);setMsg('')
  }
  function startEditProduct(p:Produto,returnSaleId:string|null=null){
    if(!canManageProducts){setMsg('Você possui somente visualização em Produtos / Estoque.');return}
    setProductReturnSaleId(returnSaleId);setEditingProduct(p);setDuplicatingProduct(false);setProductType(p.tipo_produto==='produto_final'?'produto_final':p.tipo_produto==='servico'?'servico':'insumo');setProductTrackStock(p.tipo_produto==='insumo'?p.rastrear_estoque!==false:false);setProductGroupId(p.grupo_id||'');setProductSubgroupId(p.subgrupo_id||'');setProductComponentDrafts(componentDraftsForProduct(p.id));setAdjustingProduct(null);setShowForm(true);setMsg('')
  }
  function startDuplicateProduct(p:Produto){
    if(!canManageProducts){setMsg('Você possui somente visualização em Produtos / Estoque.');return}
    setProductReturnSaleId(null)
    setEditingProduct(p)
    setDuplicatingProduct(true)
    setProductType(p.tipo_produto==='produto_final'?'produto_final':p.tipo_produto==='servico'?'servico':'insumo')
    setProductTrackStock(p.tipo_produto==='insumo'?p.rastrear_estoque!==false:false)
    setProductGroupId(p.grupo_id||'')
    setProductSubgroupId(p.subgrupo_id||'')
    setProductComponentDrafts(componentDraftsForProduct(p.id).map(row=>({...row,key:crypto.randomUUID()})))
    setAdjustingProduct(null)
    setShowForm(true)
    setMsg('Produto duplicado em modo de cópia. Altere o código e o nome antes de salvar.')
  }
  function addProductComponent(){
    const key=crypto.randomUUID()
    setProductComponentDrafts(rows=>[...rows,{key,componente_id:'',quantidade:1}])
    setProductComponentPicker(key)
    setProductComponentPickerSearch('')
  }
  function updateProductComponent(key:string,field:'componente_id'|'quantidade',value:string|number){
    setProductComponentDrafts(rows=>rows.map(row=>row.key===key?{...row,[field]:field==='componente_id'?String(value):Math.max(0,Number(value)||0)}:row))
  }
  function removeProductComponent(key:string){
    setProductComponentDrafts(rows=>rows.filter(row=>row.key!==key))
    if(productComponentPicker===key)setProductComponentPicker(null)
  }
  async function saveProduct(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageProducts){setMsg('Sem permissão para editar Produtos / Estoque.');return}
    const f=new FormData(e.currentTarget)
    const complemento:Record<string,unknown>=editingProduct?.complemento_tributario&&typeof editingProduct.complemento_tributario==='object'&&!Array.isArray(editingProduct.complemento_tributario)
      ? editingProduct.complemento_tributario as Record<string,unknown>
      : {}
    const base={
      codigo:String(f.get('codigo')||'').trim(),
      descricao:String(f.get('descricao')||'').trim(),
      unidade:String(f.get('unidade')||'UN').trim(),
      custo:Number(f.get('custo')||0),
      preco_venda:Number(f.get('preco_venda')||0),
      percentual_minimo_custo_venda:Number(f.get('percentual_minimo_custo_venda')??100),
      estoque_minimo:Number(f.get('estoque_minimo')||0),
      peso_kg:Number(f.get('peso_kg')||0),
      volume_m3:Number(f.get('volume_m3')||0),
      ncm:onlyDigits(String(f.get('ncm')||''),8)||null,
      cfop_interno:onlyDigits(String(f.get('cfop_interno')||''),4)||null,
      cfop_interestadual:onlyDigits(String(f.get('cfop_interestadual')||''),4)||null,
      origem:String(f.get('origem')||'')===''?null:Number(f.get('origem')),
      cst_icms:onlyDigits(String(f.get('cst_icms')||''),3)||null,
      cst_pis:onlyDigits(String(f.get('cst_pis')||''),2)||null,
      cst_cofins:onlyDigits(String(f.get('cst_cofins')||''),2)||null,
      complemento_tributario:complemento,
      grupo_id:productGroupId||null,
      subgrupo_id:productSubgroupId&&subgruposProdutos.some(row=>row.id===productSubgroupId&&row.grupo_id===productGroupId)?productSubgroupId:null,
      tipo_produto:productType,
      rastrear_estoque:productType==='insumo'?productTrackStock:false,
      ativo:String(f.get('ativo')||'true')==='true'
    }
    if(productType==='produto_final'&&productComponentDrafts.some(row=>!row.componente_id||Number(row.quantidade)<=0)){
      setMsg('Preencha produto e quantidade de todos os componentes da ficha técnica.')
      return
    }
    const componentIds=productComponentDrafts.filter(row=>row.componente_id).map(row=>row.componente_id)
    if(new Set(componentIds).size!==componentIds.length){
      setMsg('A ficha técnica possui o mesmo material mais de uma vez. Una as quantidades em uma única linha.')
      return
    }
    const isDuplicate=Boolean(editingProduct&&duplicatingProduct)
    const r=editingProduct&&!isDuplicate
      ? await supabase.from('produtos').update(base).eq('id',editingProduct.id).select('id').single()
      : await supabase.from('produtos').insert({...base,estoque_atual:Number(f.get('estoque_atual')||0)}).select('id').single()
    if(r.error){setMsg(r.error.message);return}
    const productId=editingProduct&&!duplicatingProduct?editingProduct.id:String(r.data?.id||'')
    if(!productId){setMsg('Produto salvo, mas não foi possível identificar o cadastro para gravar a ficha técnica.');await loadData();return}
    if(productType==='produto_final'){
      const composition=productComponentDrafts.map(row=>({
        componente_id:row.componente_id,
        quantidade:Number(row.quantidade),
        perda_percentual:0
      }))
      const savedComposition=await supabase.rpc('salvar_ficha_tecnica_produto',{p_produto_final_id:productId,p_componentes:composition})
      if(savedComposition.error){setMsg('Produto salvo, mas houve erro na ficha técnica: '+savedComposition.error.message);await loadData();return}
      if(componentIds.length){
        const tracked=await supabase.from('produtos').update({rastrear_estoque:true}).in('id',componentIds)
        if(tracked.error){setMsg('Ficha técnica salva, mas não foi possível ativar o rastreamento dos materiais: '+tracked.error.message);await loadData();return}
      }
    }else{
      const clearComposition=await supabase.from('produto_componentes').delete().eq('produto_final_id',productId)
      if(clearComposition.error){setMsg('Produto salvo, mas não foi possível limpar a ficha técnica antiga: '+clearComposition.error.message);await loadData();return}
    }
    const returnSaleId=productReturnSaleId
    setMsg(editingProduct&&!duplicatingProduct?'Produto atualizado.':duplicatingProduct?'Produto duplicado e cadastrado com sucesso.':'Produto cadastrado.')
    setEditingProduct(null);setDuplicatingProduct(false);setProductComponentDrafts([]);setShowForm(false);await loadData()
    if(returnSaleId){
      setProductReturnSaleId(null)
      setActive('vendas')
      const returnSale=vendas.find(v=>v.id===returnSaleId)
      if(returnSale)await openSaleDetail(returnSale)
    }
  }
  function setBulkProductField(id:string,field:'descricao'|'unidade'|'custo'|'preco_venda'|'estoque_minimo'|'estoque_atual'|'ativo',value:string|number|boolean){
    setBulkProductEdits(current=>({...current,[id]:{...(current[id]||{}),[field]:value}}))
  }
  async function saveBulkProductAdjustments(){
    if(!canManageProducts){setMsg('Sem permissão para editar Produtos / Estoque.');return false}
    const entries=Object.entries(bulkProductEdits).filter(([id])=>bulkAdjustmentItems.includes(id))
    if(!entries.length){setMsg('Nenhuma alteração foi feita neste ajuste.');return false}
    setSavingBulkProducts(true)
    try{
      for(const [id,changes] of entries){
        const current=produtos.find(p=>p.id===id)
        const payload={...changes}
        const nextStock=typeof payload.estoque_atual==='number'?payload.estoque_atual:undefined
        delete payload.estoque_atual
        if(typeof payload.descricao==='string')payload.descricao=payload.descricao.trim()
        if(typeof payload.unidade==='string')payload.unidade=payload.unidade.trim()||'UN'
        if(Object.keys(payload).length){
          const result=await supabase.from('produtos').update(payload).eq('id',id)
          if(result.error)throw result.error
        }
        if(nextStock!==undefined&&current&&Number(current.estoque_atual)!==Number(nextStock)){
          const stockResult=await supabase.rpc('ajustar_estoque_produto',{p_produto_id:id,p_novo_estoque:Number(nextStock),p_motivo:'Ajuste em massa'})
          if(stockResult.error)throw stockResult.error
        }
      }
      setBulkProductEdits({})
      setMsg(entries.length===1?'Ajuste confirmado: 1 produto/serviço atualizado.':'Ajuste confirmado: '+entries.length+' produtos/serviços atualizados.')
      await loadData()
      return true
    }catch(error){
      setMsg(error instanceof Error?error.message:String(error))
      return false
    }finally{
      setSavingBulkProducts(false)
    }
  }
  function startBulkAdjustment(){
    if(!canManageProducts){setMsg('Sem permissão para editar Produtos / Estoque.');return}
    setBulkProductEdits({})
    setBulkAdjustmentItems([])
    setBulkAdjustmentPicker('')
    setBulkAdjustmentOpen(true)
    setMsg('')
  }
  function addBulkAdjustmentProduct(id:string){
    if(!id)return
    setBulkAdjustmentItems(current=>current.includes(id)?current:[...current,id])
    setBulkAdjustmentPicker('')
    setBulkAdjustmentEditingId(id)
  }
  function removeBulkAdjustmentProduct(id:string){
    setBulkAdjustmentItems(current=>current.filter(item=>item!==id))
    setBulkProductEdits(current=>{const next={...current};delete next[id];return next})
    setBulkAdjustmentEditingId(current=>current===id?null:current)
  }
  async function confirmBulkAdjustment(){
    const saved=await saveBulkProductAdjustments()
    if(saved){
      setBulkAdjustmentOpen(false)
      setBulkAdjustmentItems([])
      setBulkAdjustmentPicker('')
    }
  }
  function startAdjustStock(p:Produto){if(!canManageProducts){setMsg('Sem permissão para ajustar estoque.');return}setAdjustingProduct(p);setStockNew(String(p.estoque_atual));setStockReason('Ajuste manual');setMsg('')}
  async function adjustStock(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageProducts){setMsg('Sem permissão para ajustar estoque.');return}
    if(!adjustingProduct)return
    const returnToEdit=editingProduct?.id===adjustingProduct.id
    const {error}=await supabase.rpc('ajustar_estoque_produto',{p_produto_id:adjustingProduct.id,p_novo_estoque:Number(stockNew),p_motivo:stockReason})
    setMsg(error?error.message:'Estoque ajustado e movimento registrado.')
    if(!error){
      if(returnToEdit){
        setEditingProduct(current=>current?.id===adjustingProduct.id?{...current,estoque_atual:Number(stockNew)}:current)
        setShowForm(true)
      }
      setAdjustingProduct(null)
      await loadData()
    }
  }
  async function deleteProduct(p:Produto){
    if(!(isAdmin&&canManageProducts)){setMsg('Sem permissão para excluir produtos.');return false}
    if(!await themedConfirm(`Excluir o produto "${p.descricao}"?`,'Excluir produto','Excluir','danger'))return false
    const r=await supabase.from('produtos').delete().eq('id',p.id).select('id')
    if(r.error?.code==='23503'){
      const d=await supabase.from('produtos').update({ativo:false}).eq('id',p.id)
      if(d.error){setMsg(d.error.message);return false}
      setMsg('Produto com histórico foi desativado.')
    }else if(r.error){setMsg(r.error.message);return false}
    else if(!r.data?.length){setMsg('Produto não foi excluído. Atualize a tela e tente novamente.');return false}
    else setMsg('Produto excluído.')
    await loadData()
    return true
  }

  async function exportProducts(){
    try{
      (await import('./lib/productsExcel')).exportProductsExcel(produtos,gruposProdutos,subgruposProdutos)
      setMsg(`Relatório Excel exportado com ${produtos.length} produto(s).`)
    }catch{
      setMsg('Não foi possível exportar o relatório Excel.')
    }
  }

  async function exportSelectedProducts(ids:string[]){
    const selected=produtos.filter(p=>ids.includes(p.id))
    if(!selected.length){setMsg('Selecione pelo menos um produto para exportar.');return}
    try{
      (await import('./lib/productsExcel')).exportProductsExcel(selected,gruposProdutos,subgruposProdutos)
      setMsg('Excel exportado com '+selected.length+' produto(s) selecionado(s).')
    }catch{
      setMsg('Não foi possível exportar os produtos selecionados.')
    }
  }

  async function deleteSelectedProducts(ids:string[]):Promise<boolean>{
    if(!(isAdmin&&canManageProducts)){setMsg('Sem permissão para excluir produtos.');return false}
    const selected=produtos.filter(p=>ids.includes(p.id))
    if(!selected.length){setMsg('Selecione pelo menos um produto para excluir.');return false}
    if(!await themedConfirm('Excluir '+selected.length+' produto(s) selecionado(s)? Produtos com histórico serão apenas desativados.'))return false
    let deleted=0,deactivated=0,failed=0
    for(const p of selected){
      const r=await supabase.from('produtos').delete().eq('id',p.id).select('id')
      if(r.error?.code==='23503'){
        const d=await supabase.from('produtos').update({ativo:false}).eq('id',p.id)
        if(d.error)failed++;else deactivated++
      }else if(r.error||!r.data?.length)failed++
      else deleted++
    }
    setMsg('Ação concluída: '+deleted+' excluído(s), '+deactivated+' desativado(s)'+(failed?', '+failed+' com erro':'')+'.')
    await loadData()
    return true
  }

  async function downloadProductModel(){
    try{
      (await import('./lib/productsExcel')).downloadProductsTemplate()
      setMsg('Modelo Excel de importação gerado.')
    }catch{
      setMsg('Não foi possível gerar o modelo Excel.')
    }
  }

  async function importProducts(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file)return

    if(!canManageProducts){
      setMsg('Sem permissão para importar produtos ou ajustar estoque.')
      return
    }

    try{
      setMsg('Validando planilha...')
      const rows=await (await import('./lib/productsExcel')).parseProductsExcel(file)
      const normalizeName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
      const groupByName=new Map(gruposProdutos.map(g=>[normalizeName(g.nome),g]))
      const subgroupByGroupAndName=new Map(subgruposProdutos.map(s=>[s.grupo_id+'|'+normalizeName(s.nome),s]))
      const invalid:string[]=[]
      const prepared=rows.map((row,index)=>{
        const groupName=row.grupo.trim()
        const subgroupName=row.subgrupo.trim()
        if(!groupName){
          if(subgroupName)invalid.push(`Linha ${index+2}: Subgrupo "${subgroupName}" informado sem Grupo.`)
          return {...row,grupo_id:null,subgrupo_id:null}
        }
        const group=groupByName.get(normalizeName(groupName))
        if(!group){
          invalid.push(`Linha ${index+2}: Grupo "${groupName}" não existe no SG.`)
          return {...row,grupo_id:null,subgrupo_id:null}
        }
        if(!subgroupName)return {...row,grupo_id:group.id,subgrupo_id:null}
        const subgroup=subgroupByGroupAndName.get(group.id+'|'+normalizeName(subgroupName))
        if(!subgroup){
          invalid.push(`Linha ${index+2}: Subgrupo "${subgroupName}" não existe dentro do grupo "${group.nome}".`)
          return {...row,grupo_id:group.id,subgrupo_id:null}
        }
        return {...row,grupo_id:group.id,subgrupo_id:subgroup.id}
      })
      if(invalid.length)throw new Error(invalid.slice(0,8).join('\n'))

      const confirmed=await themedConfirm(
        `Importar ${rows.length} linha(s)?\n\nProdutos com o mesmo código serão atualizados. Grupo e Subgrupo também serão atualizados pelos nomes da planilha. O valor da coluna "Estoque Atual" substituirá o saldo atual e a diferença ficará registrada no histórico.`
      )
      if(!confirmed){
        setMsg('Importação cancelada.')
        return
      }

      const {data,error}=await supabase.rpc('importar_produtos_estoque',{p_linhas:prepared})
      if(error){
        setMsg('Falha na importação: '+error.message)
        return
      }

      const result=(data||{}) as {inseridos?:number;atualizados?:number;ajustes_estoque?:number;total_linhas?:number}
      setMsg(
        `Importação concluída: ${result.inseridos||0} novo(s), ${result.atualizados||0} atualizado(s) e ${result.ajustes_estoque||0} ajuste(s) de estoque.`
      )
      await loadData()
    }catch(error){
      setMsg(error instanceof Error?error.message:'Não foi possível ler a planilha Excel.')
    }
  }

  // VENDAS
  function resetSaleForm(){setSaleRequestId(crypto.randomUUID());setSaleNotice('');setEditingSale(null);setOriginalSaleItems([]);setSaleCreditState(null);setSaleClient('');setSaleSeller('');setSaleCommissionPercent('');setSaleStatus('orcamento');setSaleNotes('');setSaleRoute('');setSalePayment('pix');setSaleInstallments(1);setSaleDueDate(today());setSaleInstallmentDates([today()]);setSaleItems([newSaleItem()]);setSaleSections([]);setSaleOrder([]);setQuoteModelPicker(false);setQuoteModelSearch('')}
  function startNewSale(){if(!canManageSales){setMsg('Seu perfil não tem permissão para criar vendas.');return}setSalePanel(null);setSaleDetailItems([]);resetSaleForm();setShowForm(true);setMsg('')}
  async function openSaleDetail(v:Venda){
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total,observacao_item,receita_producao').eq('venda_id',v.id)
    if(error){setMsg('Não foi possível abrir os detalhes da venda: '+error.message);return}
    setSaleDetailItems((data||[]) as VendaItem[])
    setSaleDetailTab('itens')
    setSalePanel(v.id)
    setMsg('')
  }
  function closeSaleDetail(){
    setSalePanel(null)
    setSaleDetailItems([])
    setSaleHistory([])
    setSaleDetailTab('itens')
  }
  async function loadSaleHistory(v:Venda){
    setSaleHistoryBusy(true);setMsg('')
    try{
      const {data,error}=await supabase.rpc('historico_venda',{p_venda_id:v.id})
      if(error)throw error
      setSaleHistory((data||[]) as SaleHistoryEvent[])
      setSaleDetailTab('historico')
    }catch(error){setMsg(error instanceof Error?error.message:(error as {message?:string})?.message||'Não foi possível carregar o histórico da venda.')}
    finally{setSaleHistoryBusy(false)}
  }
  function historyLabel(event:SaleHistoryEvent){
    const after=event.dados_depois||{}
    if(event.fonte==='vendas')return event.acao==='INSERT'?'Venda criada':event.acao==='DELETE'?'Venda excluída':'Venda alterada'
    if(event.fonte==='venda_itens')return event.acao==='INSERT'?'Item adicionado':event.acao==='DELETE'?'Item removido':'Item alterado'
    if(event.fonte==='titulos_financeiros')return event.acao==='INSERT'?'Fatura financeira criada':event.acao==='DELETE'?'Fatura financeira removida':'Fatura financeira alterada'
    if(event.fonte==='pagamentos_titulos')return event.acao==='INSERT'?'Pagamento registrado':event.acao==='DELETE'?'Pagamento removido':'Pagamento alterado'
    if(event.fonte==='estornos_pagamentos')return 'Pagamento estornado'
    if(event.fonte==='comprovantes_pagamento')return event.acao==='DELETE'?'Comprovante removido':'Comprovante anexado'
    if(event.fonte==='notas_fiscais_teste')return event.acao==='DELETE'?'NF-e removida':event.acao==='UPDATE'?'NF-e atualizada':'NF-e registrada'
    if(event.fonte==='autorizacoes')return event.acao==='REQUEST'?'Autorização solicitada':event.acao==='APROVADO'?'Autorização aprovada':event.acao==='REJEITADO'?'Autorização rejeitada':'Autorização atualizada'
    if(event.fonte==='estoque')return event.acao==='SAIDA'?'Saída de estoque':event.acao==='ENTRADA'?'Entrada de estoque':'Ajuste de estoque'
    return String(after.descricao||event.fonte)
  }
  function historyChanges(event:SaleHistoryEvent){
    const before=event.dados_antes||{},after=event.dados_depois||{}
    const ignored=new Set(['id','created_at','updated_at','fatura_gerada_em'])
    return Array.from(new Set([...Object.keys(before),...Object.keys(after)])).filter(key=>!ignored.has(key)&&JSON.stringify(before[key])!==JSON.stringify(after[key])).slice(0,8).map(key=>({key,before:before[key],after:after[key]}))
  }
  function historyValue(value:unknown){
    if(value===null||value===undefined||value==='')return '—'
    if(typeof value==='boolean')return value?'Sim':'Não'
    if(typeof value==='object')return '[detalhes]'
    return String(value)
  }
  function historyFieldLabel(key:string){
    const labels:Record<string,string>={
      status:'Status',total:'Total',subtotal:'Subtotal',desconto:'Desconto',forma_pagamento:'Pagamento',parcelas:'Parcelas',
      primeiro_vencimento:'1º vencimento',rota_entrega:'Rota',cliente_id:'Cliente',vendedor_cadastro_id:'Vendedor',
      quantidade:'Quantidade',valor_unitario:'Valor unitário',valor_pago:'Valor pago',vencimento:'Vencimento',
      categoria:'Categoria',centro_custo:'Centro de custo',ambiente:'Ambiente',referencia:'Referência'
    }
    return labels[key]||key.replaceAll('_',' ')
  }
  async function startEditSale(v:Venda){
    if(!canManageSales){setMsg('Seu perfil não tem permissão para editar vendas.');return}
    const saleHasActiveInvoice=faturasVendas.some(f=>f.venda_id===v.id&&f.status==='ativa')
    if(saleHasActiveInvoice||v.status==='faturado'){setMsg('Venda faturada não pode ser alterada. Cancele a fatura pelo fluxo financeiro antes de editar a venda.');return}
    if(v.status==='cancelado'){setMsg('Venda cancelada não pode ser editada.');return}
    if(saleApprovals.some(a=>a.entidade_id===v.id)){setMsg('Este orçamento está aguardando aprovação e não pode ser alterado até a decisão do administrador.');return}
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total,observacao_item').eq('venda_id',v.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as VendaItem[]
    setSaleRequestId(crypto.randomUUID())
    setOriginalSaleItems(items)
    const saleCount=Number(v.parcelas)||1;const saleBase=v.primeiro_vencimento||today();const saleDates=Array.isArray(v.vencimentos_parcelas)&&v.vencimentos_parcelas.length===saleCount?v.vencimentos_parcelas:buildInstallmentDates(saleBase,saleCount);setEditingSale(v);setSaleClient(v.cliente_id||'');setSaleSeller(v.vendedor_cadastro_id||'');setSaleCommissionPercent(v.percentual_comissao==null?'':String(Number(v.percentual_comissao)));setSaleStatus(v.status);setSaleNotes(v.observacoes||'');setSaleRoute(v.rota_entrega||'');setSalePayment(v.forma_pagamento||'pix');setSaleInstallments(saleCount);setSaleDueDate(saleDates[0]||saleBase);setSaleInstallmentDates(saleDates)
    setSaleItems(items.map(i=>{
      const product=produtos.find(p=>p.id===i.produto_id)
      const saved=Array.isArray(i.receita_producao)&&i.receita_producao.length?i.receita_producao:null
      const recipe:Array<{componente_id:string;quantidade:number;valor_unitario?:number}>=saved||((product?.tipo_produto==='produto_final'||produtoComponentes.some(row=>row.produto_final_id===i.produto_id))
        ? produtoComponentes.filter(row=>row.produto_final_id===i.produto_id).map(row=>({componente_id:row.componente_id,quantidade:Number(row.quantidade),valor_unitario:produtos.find(p=>p.id===row.componente_id)?.preco_venda}))
        : [])
      return {key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto),observacao_item:i.observacao_item||'',receita_producao:recipe.map(row=>{const componente=produtos.find(p=>p.id===row.componente_id);return {key:crypto.randomUUID(),componente_id:row.componente_id,quantidade:Number(row.quantidade),valor_unitario:Number(row.valor_unitario??componente?.preco_venda??0)}})}
    }))
    setSalePanel(null);setSaleDetailItems([]);setShowForm(true);setMsg('')
  }
  function defaultSaleRecipe(productId:string):SaleRecipeDraft[]{
    return produtoComponentes.filter(row=>row.produto_final_id===productId).map(row=>{
      const componente=produtos.find(p=>p.id===row.componente_id)
      return {key:crypto.randomUUID(),componente_id:row.componente_id,quantidade:Number(row.quantidade),valor_unitario:Number(componente?.preco_venda??0)}
    })
  }
  function chooseProduct(key:string,id:string){
    const p=produtos.find(x=>x.id===id)
    setSaleItems(items=>items.map(i=>i.key===key?{
      ...i,
      produto_id:id,
      valor_unitario:p?Number(p.preco_venda):0,
      receita_producao:(p?.tipo_produto==='produto_final'||produtoComponentes.some(row=>row.produto_final_id===id))?defaultSaleRecipe(id):[]
    }:i))
  }
  function updateSaleItem(key:string,field:'quantidade'|'valor_unitario'|'desconto',value:number){setSaleItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function applyGlobalDiscount(){
    const pct=Math.max(0,Math.min(100,Number(globalDiscountPercent.replace(',','.'))||0))
    setSaleItems(items=>items.map(item=>{
      const gross=Math.max(0,Number(item.quantidade||0)*Number(item.valor_unitario||0))
      const discount=Math.round(gross*(pct/100)*100)/100
      return {...item,desconto:discount}
    }))
    setGlobalDiscountPercent(String(pct).replace('.',','))
    setGlobalDiscountOpen(false)
  }
  function updateSaleItemNote(key:string,value:string){setSaleItems(items=>items.map(i=>i.key===key?{...i,observacao_item:value.slice(0,240)}:i))}
  function updateSaleRecipeItem(itemKey:string,recipeKey:string,field:'componente_id'|'quantidade'|'valor_unitario',value:string|number){
    setSaleItems(items=>items.map(item=>item.key===itemKey?{...item,receita_producao:item.receita_producao.map(row=>{
      if(row.key!==recipeKey)return row
      if(field==='componente_id'){
        const componente=produtos.find(p=>p.id===String(value))
        return {...row,componente_id:String(value),valor_unitario:Number(componente?.preco_venda??row.valor_unitario??0)}
      }
      return {...row,[field]:Math.max(0,Number(value)||0)}
    })}:item))
  }
  function addSaleRecipeItem(itemKey:string){
    setSaleItems(items=>items.map(item=>item.key===itemKey?{...item,receita_producao:[...item.receita_producao,{key:crypto.randomUUID(),componente_id:'',quantidade:1,valor_unitario:0}]}:item))
  }
  function removeSaleRecipeItem(itemKey:string,recipeKey:string){
    setSaleItems(items=>items.map(item=>item.key===itemKey?{...item,receita_producao:item.receita_producao.filter(row=>row.key!==recipeKey)}:item))
  }
  function resetSaleRecipe(itemKey:string,productId:string){
    setSaleItems(items=>items.map(item=>item.key===itemKey?{...item,receita_producao:defaultSaleRecipe(productId)}:item))
  }
  function saleLayoutEntriesFor(order:string[]){
    const valid=new Set([
      ...saleItems.map(item=>'item:'+item.key),
      ...saleSections.map(section=>'section:'+section.key)
    ])
    const current=order.filter(key=>valid.has(key))
    for(const item of saleItems){const key='item:'+item.key;if(!current.includes(key))current.push(key)}
    for(const section of saleSections){const key='section:'+section.key;if(!current.includes(key))current.push(key)}
    return current
  }
  function addSaleItem(){
    const item=newSaleItem()
    setSaleItems(items=>[...items,item])
    setSaleOrder(order=>[...saleLayoutEntriesFor(order),'item:'+item.key])
  }
  function removeSaleItem(key:string){
    setSaleItems(items=>items.length===1?items:items.filter(i=>i.key!==key))
    setSaleOrder(order=>order.filter(entry=>entry!=='item:'+key))
  }
  async function addSaleSection(){
    const title=await themedPrompt('Nome da seção:','Adicionar seção')
    if(title===null)return
    const clean=title.trim()
    if(!clean)return
    const section={key:crypto.randomUUID(),titulo:clean}
    setSaleSections(rows=>[...rows,section])
    setSaleOrder(order=>[...saleLayoutEntriesFor(order),'section:'+section.key])
  }
  function updateSaleSection(key:string,titulo:string){setSaleSections(rows=>rows.map(row=>row.key===key?{...row,titulo}:row))}
  function removeSaleSection(key:string){
    setSaleSections(rows=>rows.filter(row=>row.key!==key))
    setSaleOrder(order=>order.filter(entry=>entry!=='section:'+key))
  }
  function moveSaleLayout(source:string,target:string){
    if(source===target)return
    setSaleOrder(order=>{
      const entries=saleLayoutEntriesFor(order)
      const from=entries.indexOf(source),to=entries.indexOf(target)
      if(from<0||to<0)return entries
      const next=[...entries]
      const [moved]=next.splice(from,1)
      next.splice(to,0,moved)
      return next
    })
  }
  function addQuoteModelProduct(productId:string){
    const product=produtos.find(p=>p.id===productId)
    if(!product)return
    const item=newSaleItem()
    item.produto_id=product.id
    item.valor_unitario=Number(product.preco_venda||0)
    item.receita_producao=defaultSaleRecipe(product.id)
    setSaleItems(rows=>{
      const reusable=rows.length===1&&!rows[0].produto_id&&Number(rows[0].valor_unitario||0)===0
      if(reusable)return [{...item,key:rows[0].key}]
      setSaleOrder(order=>[...saleLayoutEntriesFor(order),'item:'+item.key])
      return [...rows,item]
    })
    setQuoteModelPicker(false)
    setQuoteModelSearch('')
  }

  function resizeSaleDates(count:number){
    const next=Math.max(1,count)
    setSaleInstallments(next)
    setSaleInstallmentDates(buildInstallmentDates(today(),next))
  }
  function changePayment(v:PaymentMethod){
    setSalePayment(v)
    if(v==='dinheiro'||v==='pix')resizeSaleDates(1)
    if(v==='cartao')resizeSaleDates(Math.min(Math.max(saleInstallments,1),12))
    if(v==='boleto')resizeSaleDates(Math.min(Math.max(saleInstallments,1),24))
  }
  function invoiceItems(items:SaleItemDraft[]){return items.map(i=>{const p=produtos.find(x=>x.id===i.produto_id);const d=Math.min(i.desconto,i.quantidade*i.valor_unitario);return{codigo:p?.codigo,descricao:p?.descricao||'Produto',unidade:p?.unidade||'UN',quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:d,total:Math.max(0,i.quantidade*i.valor_unitario-d)}})}
  async function saveSale(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!session)return
    if(savingSale)return
    if(!canManageSales){setMsg('Seu perfil não tem permissão para criar ou editar vendas.');return}
    if(editingSale&&(editingSale.status==='faturado'||faturasVendas.some(f=>f.venda_id===editingSale.id&&f.status==='ativa'))){setMsg('Venda faturada não pode ser alterada. Cancele a fatura pelo fluxo financeiro antes de editar a venda.');return}
    setMsg('');setSaleNotice('')

    const items=saleItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length||saleHasStructuralError){
      setMsg('Corrija os itens da venda antes de continuar: produto ativo, quantidade maior que zero e preço válido.')
      return
    }

    if(saleStatus!=='orcamento'&&saleHasAuthorizationBlocker){
      setMsg('Esta venda possui bloqueios que exigem autorização: '+saleApprovalBlockers.map(b=>b.label).join(', ')+'. Use o botão destacado “Solicitar autorização”.')
      return
    }

    setSavingSale(true);setMsg('')
    const currentItemEntry=(item:SaleItemDraft):SaleLayoutStoredEntry=>({tipo:'item',produto_id:item.produto_id,quantidade:Number(item.quantidade),valor_unitario:Number(item.valor_unitario),desconto:Number(item.desconto),total:Math.max(0,Number(item.quantidade)*Number(item.valor_unitario)-Number(item.desconto))})
    let storedLayout:SaleLayoutStoredEntry[]=saleLayoutEntries.flatMap(entry=>{
      if(entry.startsWith('section:')){
        const section=saleSections.find(row=>'section:'+row.key===entry)
        return section?[{tipo:'section' as const,titulo:section.titulo}]:[]
      }
      const item=saleItems.find(row=>'item:'+row.key===entry)
      return item&&item.produto_id&&item.quantidade>0?[currentItemEntry(item)]:[]
    })
    if(editingSale&&Array.isArray(editingSale.layout_itens)&&editingSale.layout_itens.some(entry=>entry.tipo==='section')&&saleSections.length===0){
      const unused=[...saleItems]
      storedLayout=editingSale.layout_itens.flatMap(entry=>{
        if(entry.tipo==='section')return [{tipo:'section' as const,titulo:entry.titulo}]
        const matchIndex=unused.findIndex(item=>item.produto_id===entry.produto_id)
        if(matchIndex<0)return []
        const [match]=unused.splice(matchIndex,1)
        return [currentItemEntry(match)]
      })
      storedLayout.push(...unused.filter(item=>item.produto_id&&item.quantidade>0).map(currentItemEntry))
    }
    const args={
      p_layout_itens:storedLayout,
      p_cliente_id:saleClient||null,
      p_vendedor_cadastro_id:saleSeller||null,
      p_percentual_comissao:saleCommissionPercent.trim()===''?null:Number(saleCommissionPercent),
      p_status:saleStatus,
      p_forma_pagamento:salePayment,
      p_parcelas:saleInstallments,
      p_primeiro_vencimento:today(),
      p_vencimentos:buildInstallmentDates(today(),saleInstallments),
      p_observacoes:saleNotes,
      p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:i.desconto,observacao_item:i.observacao_item.trim()||null,receita_producao:i.receita_producao.map(row=>({componente_id:row.componente_id,quantidade:row.quantidade,valor_unitario:row.valor_unitario}))}))
    }
    const r=await supabase.rpc('salvar_venda_erp',{
      p_requisicao:saleRequestId,
      p_payload:{...args,p_venda_id:editingSale?.id||null,p_rota_entrega:saleRoute||null},
      p_autorizar_sem_estoque:false
    })
    if(r.error||!r.data){
      setSavingSale(false)
      setMsg('Não foi possível salvar a venda: '+(r.error?.message||'erro desconhecido'))
      return
    }

    const saved=(Array.isArray(r.data)?r.data[0]:r.data) as Venda
    void saved
    setMsg(editingSale?'Venda atualizada.':saleStatus==='orcamento'?'Orçamento salvo.':'Venda aprovada. O Financeiro fará o faturamento e definirá os vencimentos.')

    setSavingSale(false)
    setShowForm(false)
    resetSaleForm()
    await loadData()
    requestAnimationFrame(()=>{
      const table=document.getElementById('sales-table')
      table?.scrollIntoView({behavior:'smooth',block:'start'})
      table?.focus()
    })
  }


  async function advanceSaleToOrder(v:Venda){
    if(savingSale||!canManageSales||v.status!=='orcamento')return
    setSavingSale(true);setMsg('')
    try{
      const {data:itemData,error:itemError}=await supabase.from('venda_itens').select('*').eq('venda_id',v.id)
      if(itemError)throw itemError
      const items=((itemData||[]) as VendaItem[]).map(i=>({produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto),observacao_item:i.observacao_item||null}))
      if(!items.length)throw new Error('Este orçamento não possui itens válidos.')

      const demand=items.reduce<Record<string,number>>((acc,item)=>{acc[item.produto_id]=(acc[item.produto_id]||0)+item.quantidade;return acc},{})
      const subtotal=items.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
      const discount=items.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
      const total=Math.max(0,subtotal-discount)
      const discountPct=subtotal>0?(discount/subtotal)*100:0
      const costTotal=items.reduce((sum,item)=>{
        const product=produtos.find(p=>p.id===item.produto_id)
        return sum+Number(product?.custo_medio??product?.custo??0)*item.quantidade
      },0)
      const marginPct=total>0?((total-costTotal)/total)*100:0
      const priceIssues=items.flatMap(item=>{
        const product=produtos.find(p=>p.id===item.produto_id)
        if(!product||item.quantidade<=0)return []
        const cost=Math.round(Number(product.custo_medio??product.custo??0)*100)/100
        const minimum=cost*(1+Number(product.percentual_minimo_custo_venda??100)/100)
        const effective=item.valor_unitario-Math.min(item.desconto,item.valor_unitario*item.quantidade)/item.quantidade
        return effective+0.000001<minimum?[{product,effective,minimum}]:[]
      })
      const shortages=Object.entries(demand).flatMap(([productId,qty])=>{
        const product=produtos.find(p=>p.id===productId)
        if(!product)return []
        const available=Number(product.estoque_atual)
        return qty>available?[{product,missing:qty-available}]:[]
      })
      const belowMinimum=Object.entries(demand).flatMap(([productId,qty])=>{
        const product=produtos.find(p=>p.id===productId)
        if(!product)return []
        const available=Number(product.estoque_atual)
        const projected=available-qty
        const minimum=Math.max(0,Number(product.estoque_minimo)||0)
        return projected>=0&&projected<minimum?[{product,projected,minimum}]:[]
      })

      let credit={em_aberto:0,vencido:0}
      if(v.cliente_id){
        const {data}=await supabase.rpc('situacao_credito_cliente',{p_cliente_id:v.cliente_id,p_excluir_venda_id:v.id})
        const row=Array.isArray(data)?data[0]:data
        credit={em_aberto:Number(row?.em_aberto||0),vencido:Number(row?.vencido||0)}
      }
      const client=clientes.find(x=>x.id===v.cliente_id)
      const limit=Number(client?.limite_credito||0)
      const paidTitle=financialTitlesForSale(v.id).some(t=>Number(t.valor_pago)>0)
      const proof=comprovantes.some(p=>p.venda_id===v.id)
      const requiredClient=String(empresa?.campos_obrigatorios?.venda_cliente??'false').toLowerCase()==='true'
      const requiredSeller=String(empresa?.campos_obrigatorios?.venda_vendedor??'false').toLowerCase()==='true'
      const blockers=[
        ...(!v.rota_entrega?[{tipo:'dados_incompletos',label:'Rota de entrega não informada',detalhe:'A aprovação poderá avançar a venda sem rota definida.'}]:[]),
        ...(requiredClient&&!v.cliente_id?[{tipo:'dados_incompletos',label:'Cliente obrigatório não informado',detalhe:'Campo obrigatório ausente na venda.'}]:[]),
        ...(requiredSeller&&!v.vendedor_cadastro_id?[{tipo:'dados_incompletos',label:'Vendedor obrigatório não informado',detalhe:'Campo obrigatório ausente na venda.'}]:[]),
        ...(priceIssues.length?[{tipo:'preco_minimo',label:'Preço abaixo do mínimo',detalhe:priceIssues.map(x=>`${x.product.descricao}: ${money(x.effective)} / mín. ${money(x.minimum)}`).join(' • ')}]:[]),
        ...(discountPct>Number(empresa?.desconto_max_vendedor??10)?[{tipo:'desconto',label:'Desconto acima do limite',detalhe:`${discountPct.toFixed(2)}% / limite ${Number(empresa?.desconto_max_vendedor??10).toFixed(2)}%`}]:[]),
        ...(marginPct<Number(empresa?.margem_minima_percentual??0)?[{tipo:'margem',label:'Margem abaixo do mínimo',detalhe:`${marginPct.toFixed(2)}% / mínimo ${Number(empresa?.margem_minima_percentual??0).toFixed(2)}%`}]:[]),
        ...((empresa?.bloquear_cliente_inadimplente??true)&&credit.vencido>0?[{tipo:'inadimplencia',label:'Cliente inadimplente',detalhe:`${money(credit.vencido)} em títulos vencidos.`}]:[]),
        ...((empresa?.exigir_aprovacao_limite_credito??true)&&limit>0&&credit.em_aberto+total>limit?[{tipo:'limite_credito',label:'Limite de crédito excedido',detalhe:`Excesso de ${money(credit.em_aberto+total-limit)}.`}]:[]),
        ...(shortages.length?[{tipo:'estoque_negativo',label:'Estoque insuficiente',detalhe:shortages.map(x=>`${x.product.descricao}: faltam ${x.missing.toLocaleString('pt-BR')} ${x.product.unidade}`).join(' • ')}]:[]),
        ...(paidTitle?[{tipo:'fatura_paga',label:'Fatura com pagamento registrado',detalhe:'A aprovação avançará o status preservando itens, valores e histórico financeiro já liquidados.'}]:[]),
        ...(proof?[{tipo:'comprovante_anexado',label:'Comprovante já anexado',detalhe:'A aprovação preservará o comprovante existente.'}]:[])
      ]

      const payload={
        p_venda_id:v.id,
        p_cliente_id:v.cliente_id||null,
        p_vendedor_cadastro_id:v.vendedor_cadastro_id||null,
        p_percentual_comissao:v.percentual_comissao??null,
        p_status:'pedido',
        p_forma_pagamento:v.forma_pagamento||'pix',
        p_parcelas:Number(v.parcelas)||1,
        p_primeiro_vencimento:v.primeiro_vencimento||today(),
        p_vencimentos:Array.isArray(v.vencimentos_parcelas)&&v.vencimentos_parcelas.length===Number(v.parcelas)?v.vencimentos_parcelas:buildInstallmentDates(v.primeiro_vencimento||today(),Number(v.parcelas)||1),
        p_observacoes:v.observacoes||'',
        p_rota_entrega:v.rota_entrega||null,
        p_itens:items
      }

      if(blockers.length){
        if(saleApprovals.some(a=>a.entidade_id===v.id)){setMsg('Este orçamento já está aguardando autorização.');return}
        const motivo=await themedPrompt(`Este orçamento possui ${blockers.length} bloqueio(s). Informe o motivo para solicitar autorização.`,'Autorização necessária',blockers)
        if(!motivo)return
        const {error}=await supabase.rpc('solicitar_autorizacao_venda',{p_motivo:motivo,p_payload:{...payload,p_bloqueios:blockers}})
        if(error)throw error
        setMsg('Orçamento enviado para autorização. Após aprovação, será avançado para pedido.')
      }else{
        const {error}=await supabase.rpc('salvar_venda_erp',{p_requisicao:crypto.randomUUID(),p_payload:payload,p_autorizar_sem_estoque:false})
        if(error)throw error
        setMsg('Orçamento avançado para pedido com sucesso.')
        closeSaleDetail()
      }
      await loadData()
    }catch(error){
      setMsg(error instanceof Error?error.message:(error as {message?:string})?.message||'Não foi possível avançar o orçamento.')
    }finally{setSavingSale(false)}
  }

  async function requestSaleAuthorization(){
    if(savingSale||!canManageSales)return
    if(!editingSale){
      setMsg('Salve primeiro como orçamento. Depois abra o orçamento e escolha Pedido ou Faturado.')
      return
    }
    if(saleStatus==='orcamento'){
      setMsg('Selecione Pedido ou Faturado para verificar se a venda precisa de autorização.')
      return
    }
    if(saleApprovals.some(a=>a.entidade_id===editingSale.id)){
      setMsg('Esta venda já está aguardando aprovação.')
      return
    }
    if(saleHasStructuralError){
      setMsg('Há item inválido. Corrija produto/quantidade antes de solicitar autorização.')
      return
    }
    if(!saleHasAuthorizationBlocker){
      setMsg('Esta venda não possui bloqueios. Ela pode ser salva normalmente, sem autorização.')
      return
    }

    const motivo=await themedPrompt(`Esta venda possui ${saleApprovalBlockers.length} bloqueio(s). Informe o motivo para solicitar autorização.`,'Autorização necessária',saleApprovalBlockers)
    if(!motivo)return

    setSavingSale(true)
    try{
      const {error}=await supabase.rpc('solicitar_autorizacao_venda',{
        p_motivo:motivo,
        p_payload:{
          p_venda_id:editingSale.id,
          p_cliente_id:saleClient||null,
          p_vendedor_cadastro_id:saleSeller||null,
          p_percentual_comissao:saleCommissionPercent.trim()===''?null:Number(saleCommissionPercent),
          p_status:saleStatus,
          p_forma_pagamento:salePayment,
          p_parcelas:saleInstallments,
          p_primeiro_vencimento:saleInstallmentDates[0]||saleDueDate,
          p_vencimentos:saleInstallmentDates,
          p_observacoes:saleNotes,
          p_rota_entrega:saleRoute||null,
          p_bloqueios:saleApprovalBlockers,
          p_itens:saleItems.map(({produto_id,quantidade,valor_unitario,desconto,observacao_item})=>({produto_id,quantidade,valor_unitario,desconto,observacao_item:observacao_item.trim()||null}))
        }
      })
      if(error){
        setMsg(error.message)
        return
      }
      setShowForm(false)
      resetSaleForm()
      setActive('vendas')
      await loadData()
      setMsg('Venda enviada para autorização. O documento permanece na lista aguardando a decisão.')
    }finally{
      setSavingSale(false)
    }
  }

  async function buildSaleInvoicePayload(v:Venda){
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total,observacao_item').eq('venda_id',v.id)
    if(error){setMsg(error.message);return null}
    const items=(data||[]) as VendaItem[]
    const drafts=items.map(i=>({key:'pdf',produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto),observacao_item:i.observacao_item||'',receita_producao:[]}))
    return {
      id:v.id,
      document_kind:(v.status==='orcamento'?'orcamento':'venda') as 'orcamento'|'venda',
      document_number:saleCode(v.venda_numero),
      venda_numero:v.venda_numero,
      fatura_numero:v.fatura_numero,
      created_at:v.created_at,
      status:v.status,
      subtotal:Number(v.subtotal),
      desconto:Number(v.desconto),
      total:Number(v.total),
      observacoes:v.observacoes,
      forma_pagamento:v.forma_pagamento,
      parcelas:Number(v.parcelas),
      primeiro_vencimento:v.primeiro_vencimento,
      rota_entrega:v.rota_entrega,
      vendedor_nome:vendedores.find(s=>s.id===v.vendedor_cadastro_id)?.nome||null,
      cliente:clientes.find(c=>c.id===v.cliente_id)||null,
      company:empresa||undefined,
      items:invoiceItems(drafts),
      layout:Array.isArray(v.layout_itens)&&v.layout_itens.length?v.layout_itens.map(entry=>entry.tipo==='section'
        ? {tipo:'section' as const,titulo:entry.titulo}
        : {tipo:'item' as const,item:{codigo:produtos.find(p=>p.id===entry.produto_id)?.codigo,descricao:produtos.find(p=>p.id===entry.produto_id)?.descricao||'Produto',unidade:produtos.find(p=>p.id===entry.produto_id)?.unidade||'UN',quantidade:Number(entry.quantidade),valor_unitario:Number(entry.valor_unitario),desconto:Number(entry.desconto),total:Number(entry.total)}}):undefined
    }
  }
  async function downloadSalePdf(v:Venda){
    const payload=await buildSaleInvoicePayload(v)
    if(!payload)return
    try{
      (await import('./lib/invoicePdf')).generateInvoicePdf(payload)
    }catch{setMsg('Não foi possível gerar o PDF.')}
  }
  async function printSalePdf(v:Venda){
    const payload=await buildSaleInvoicePayload(v)
    if(!payload)return
    try{
      ;(await import('./lib/invoicePdf')).openInvoicePdfForPrint(payload)
    }catch{setMsg('Não foi possível abrir o documento para impressão.')}
  }
  async function buildFinancialInvoicePayload(invoice:FaturaVenda){
    const linkedSaleIds=Array.from(new Set([
      invoice.venda_id,
      ...faturaVendaItens.filter(item=>item.fatura_id===invoice.id).map(item=>item.venda_id)
    ].filter(Boolean)))
    const linkedSales=vendas.filter(v=>linkedSaleIds.includes(v.id))
    if(!linkedSales.length){setMsg('Não foi possível localizar as vendas desta fatura.');return null}

    const {data:itemRows,error:itemError}=await supabase
      .from('venda_itens')
      .select('venda_id,produto_id,quantidade,valor_unitario,desconto,total')
      .in('venda_id',linkedSaleIds)
    if(itemError){setMsg(itemError.message);return null}

    const invoiceItemsRows=(itemRows||[]) as Array<VendaItem&{venda_id:string}>
    const items=invoiceItemsRows.map(item=>{
      const sale=linkedSales.find(v=>v.id===item.venda_id)
      const product=produtos.find(p=>p.id===item.produto_id)
      return {
        codigo:product?.codigo,
        descricao:(linkedSales.length>1?(saleCode(sale?.venda_numero)+' • '):'')+(product?.descricao||'Produto'),
        unidade:product?.unidade||'UN',
        quantidade:Number(item.quantidade),
        valor_unitario:Number(item.valor_unitario),
        desconto:Number(item.desconto),
        total:Number(item.total)
      }
    })

    const firstSale=linkedSales[0]
    const linkedTitles=titulos
      .filter(t=>t.fatura_venda_id===invoice.id)
      .sort((a,b)=>a.vencimento.localeCompare(b.vencimento))
    const sellers=Array.from(new Set(linkedSales.map(v=>vendedores.find(s=>s.id===v.vendedor_cadastro_id)?.nome).filter(Boolean)))
    const subtotal=items.reduce((sum,item)=>sum+item.quantidade*item.valor_unitario,0)
    const discount=items.reduce((sum,item)=>sum+item.desconto,0)

    return {
      id:invoice.id,
      document_kind:'fatura' as const,
      document_number:financialInvoiceCode(invoice.numero),
      venda_numero:firstSale.venda_numero,
      fatura_numero:invoice.numero,
      created_at:invoice.criada_em,
      status:'faturado',
      subtotal,
      desconto:discount,
      total:Number(invoice.valor_total),
      observacoes:linkedSales.length>1?('Fatura consolidada das vendas: '+linkedSales.map(v=>saleCode(v.venda_numero)).join(', ')+'.'):firstSale.observacoes,
      forma_pagamento:(invoice.forma_pagamento||firstSale.forma_pagamento) as PaymentMethod,
      parcelas:Number(invoice.parcelas)||Math.max(1,linkedTitles.length),
      primeiro_vencimento:linkedTitles[0]?.vencimento||firstSale.primeiro_vencimento,
      rota_entrega:firstSale.rota_entrega,
      vendedor_nome:sellers.length?sellers.join(' / '):null,
      cliente:clientes.find(client=>client.id===firstSale.cliente_id)||null,
      company:empresa||undefined,
      items
    }
  }
  async function downloadFinancialInvoicePdf(invoice:FaturaVenda){
    const payload=await buildFinancialInvoicePayload(invoice)
    if(!payload)return
    try{
      ;(await import('./lib/invoicePdf')).generateInvoicePdf(payload)
    }catch{setMsg('Não foi possível gerar o PDF da fatura.')}
  }
  async function printFinancialInvoicePdf(invoice:FaturaVenda){
    const payload=await buildFinancialInvoicePayload(invoice)
    if(!payload)return
    try{
      ;(await import('./lib/invoicePdf')).openInvoicePdfForPrint(payload)
    }catch{setMsg('Não foi possível abrir o PDF da fatura para impressão.')}
  }

  async function cancelSale(v:Venda){if(v.status==='cancelado'||!await themedConfirm(`Cancelar venda ${saleCode(v.venda_numero)}?`))return;const r=await supabase.from('vendas').update({status:'cancelado'}).eq('id',v.id);setMsg(r.error?r.error.message:'Venda cancelada e estoque/financeiro estornados.');if(!r.error){setSalePanel(null);await loadData()}}
  async function deleteSale(v:Venda){if(!(isAdmin&&canManageSales)){setMsg('Sem permissão para excluir venda.');return}if(!await themedConfirm(`Excluir venda ${saleCode(v.venda_numero)} definitivamente?`))return;const r=await supabase.from('vendas').delete().eq('id',v.id).select('id');setMsg(r.error?r.error.message:r.data?.length?'Venda excluída.':'Venda não foi excluída. Verifique vínculos de fatura, pagamentos ou histórico.');if(!r.error&&r.data?.length){setSalePanel(null);await loadData()}}

  // COMPRAS
  function resetPurchaseForm(){const base=today();setEditingPurchase(null);setPurchaseSupplier('');setPurchaseStatus('cotacao');setPurchaseNotes('');setPurchasePayment('pix');setPurchaseInstallments(1);setPurchaseDueDate(base);setPurchaseInstallmentDates([base]);setPurchaseItems([newPurchaseItem()])}
  function startNewPurchase(){if(!canManagePurchases){setMsg('Você possui somente visualização em Compras.');return}resetPurchaseForm();setShowForm(true);setMsg('')}
  function addPurchaseSuggestion(produto:Produto,quantidade:number){
    if(!canManagePurchases){setMsg('Sem permissão para criar compras.');return}
    const qty=Math.max(0.001,Number(quantidade)||0)
    if(!showForm){resetPurchaseForm();setShowForm(true)}
    setPurchaseItems(items=>{
      const existing=items.find(i=>i.produto_id===produto.id)
      if(existing){
        return items.map(i=>i.produto_id===produto.id?{...i,quantidade:Number((i.quantidade+qty).toFixed(3)),custo_unitario:Number(produto.custo||i.custo_unitario)}:i)
      }
      const blank=items.findIndex(i=>!i.produto_id)
      const item:PurchaseItemDraft={key:`${Date.now()}-${Math.random()}`,produto_id:produto.id,quantidade:Number(qty.toFixed(3)),custo_unitario:Number(produto.custo||0)}
      if(blank>=0)return items.map((i,index)=>index===blank?item:i)
      return [...items,item]
    })
    setMsg(`${produto.descricao} adicionado à compra sugerida.`)
  }
  function addPurchaseSuggestions(suggestions= purchaseSuggestions){
    if(!canManagePurchases){setMsg('Sem permissão para criar compras.');return}
    if(!suggestions.length)return
    if(!showForm){resetPurchaseForm();setShowForm(true)}
    setPurchaseItems(items=>{
      let next=items.filter(i=>i.produto_id)
      for(const suggestion of suggestions){
        const idx=next.findIndex(i=>i.produto_id===suggestion.produto.id)
        if(idx>=0){
          next=next.map((i,index)=>index===idx?{...i,quantidade:Number((i.quantidade+suggestion.suggested).toFixed(3)),custo_unitario:Number(suggestion.produto.custo||i.custo_unitario)}:i)
        }else{
          next.push({key:`${Date.now()}-${Math.random()}`,produto_id:suggestion.produto.id,quantidade:Number(suggestion.suggested.toFixed(3)),custo_unitario:Number(suggestion.produto.custo||0)})
        }
      }
      return next.length?next:[newPurchaseItem()]
    })
    setSelectedPurchaseSuggestions({})
    setMsg(`${suggestions.length} item(ns) de estoque baixo adicionados à compra.`)
  }
  async function openPurchasePanel(c:Compra){
    if(purchasePanel===c.id){
      setPurchasePanel(null)
      setPurchaseDetailItems([])
      return
    }
    setPurchasePanel(c.id)
    setPurchaseDetailItems([])
    setPurchaseDetailBusy(true)
    const {data,error}=await supabase.from('compra_itens')
      .select('produto_id,quantidade,custo_unitario,total')
      .eq('compra_id',c.id)
    if(error){
      setMsg(error.message)
      setPurchaseDetailBusy(false)
      return
    }
    setPurchaseDetailItems((data||[]) as CompraItem[])
    setPurchaseDetailBusy(false)
  }

  async function startEditPurchase(c:Compra){
    if(!canManagePurchases){setMsg('Você possui somente visualização em Compras.');return}
    if(c.status==='cancelada'){setMsg('Compra cancelada não pode ser editada.');return}
    const {data,error}=await supabase.from('compra_itens').select('produto_id,quantidade,custo_unitario,total').eq('compra_id',c.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as CompraItem[]
    const base=c.primeiro_vencimento||today();const count=Number(c.parcelas)||1;const dates=Array.isArray(c.vencimentos_parcelas)&&c.vencimentos_parcelas.length===count?c.vencimentos_parcelas:buildInstallmentDates(base,count);setEditingPurchase(c);setPurchaseSupplier(c.fornecedor_id||'');setPurchaseStatus(c.status);setPurchaseNotes(c.observacoes||'');setPurchasePayment(c.forma_pagamento||'pix');setPurchaseInstallments(count);setPurchaseDueDate(dates[0]||base);setPurchaseInstallmentDates(dates)
    setPurchaseItems(items.map(i=>({key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),custo_unitario:Number(i.custo_unitario)})))
    setShowForm(true);setMsg('')
  }
  function choosePurchaseProduct(key:string,id:string){const p=produtos.find(x=>x.id===id);setPurchaseItems(items=>items.map(i=>i.key===key?{...i,produto_id:id,custo_unitario:p?Number(p.custo):0}:i))}
  function updatePurchaseItem(key:string,field:'quantidade'|'custo_unitario',value:number){setPurchaseItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function removePurchaseItem(key:string){setPurchaseItems(items=>items.length===1?items:items.filter(i=>i.key!==key))}
  function resizePurchaseDates(count:number){
    const base=purchaseInstallmentDates[0]||purchaseDueDate||today()
    setPurchaseInstallments(count)
    setPurchaseDueDate(base)
    setPurchaseInstallmentDates(prev=>Array.from({length:count},(_,i)=>prev[i]||addMonthsIso(base,i)))
  }

  function changePurchasePayment(v:PurchasePaymentMethod){
    setPurchasePayment(v)
    if(v==='pix')resizePurchaseDates(1)
    if(v==='cartao')resizePurchaseDates(Math.min(Math.max(purchaseInstallments,1),12))
    if(v==='boleto')resizePurchaseDates(Math.min(Math.max(purchaseInstallments,1),24))
  }

  function changePurchaseInstallmentDate(index:number,value:string){
    setPurchaseInstallmentDates(prev=>{
      const next=[...prev]
      next[index]=value
      if(index===0)setPurchaseDueDate(value)
      return next
    })
  }

  function purchasePdfItems(items:PurchaseItemDraft[]){
    return items.map(i=>{
      const p=produtos.find(x=>x.id===i.produto_id)
      return {
        codigo:p?.codigo,
        descricao:p?.descricao||'Produto',
        unidade:p?.unidade||'UN',
        quantidade:i.quantidade,
        custo_unitario:i.custo_unitario,
        total:i.quantidade*i.custo_unitario
      }
    })
  }

  async function savePurchase(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManagePurchases){setMsg('Sem permissão para editar Compras.');return}
    const items=purchaseItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length){setMsg('Adicione pelo menos um produto.');return}

    const maxInstallments=purchasePayment==='pix'?1:purchasePayment==='cartao'?12:24
    if(purchaseInstallments<1||purchaseInstallments>maxInstallments){
      setMsg('Quantidade de parcelas inválida para a forma de pagamento.')
      return
    }

    if(purchaseInstallmentDates.length!==purchaseInstallments||purchaseInstallmentDates.some(v=>!v)){
      setMsg('Informe a data de vencimento de cada parcela.')
      return
    }

    setSavingPurchase(true)
    const args={
      p_fornecedor_id:purchaseSupplier||null,
      p_status:purchaseStatus,
      p_forma_pagamento:purchasePayment,
      p_parcelas:purchaseInstallments,
      p_primeiro_vencimento:purchaseInstallmentDates[0]||purchaseDueDate,
      p_vencimentos:purchaseInstallmentDates,
      p_observacoes:purchaseNotes,
      p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,custo_unitario:i.custo_unitario}))
    }
    const r=editingPurchase
      ? await supabase.rpc('atualizar_compra_completa',{p_compra_id:editingPurchase.id,...args})
      : await supabase.rpc('criar_compra_completa',args)

    if(r.error||!r.data){
      setSavingPurchase(false)
      setMsg(r.error?.message||'Não foi possível salvar a compra.')
      return
    }

    const saved=(Array.isArray(r.data)?r.data[0]:r.data) as Compra
    const total=items.reduce((s,i)=>s+(i.quantidade*i.custo_unitario),0)
    const fornecedor=fornecedores.find(f=>f.id===purchaseSupplier)||null

    if(saved.status==='cotacao'){
      setMsg(editingPurchase?'Cotação atualizada com sucesso. Sem financeiro e sem movimentação de estoque.':'Cotação salva com sucesso. Sem financeiro e sem movimentação de estoque.')
    }else{
      try{
        (await import('./lib/purchaseInvoicePdf')).generatePurchaseInvoicePdf({
          id:saved.id,
          fatura_numero:saved.fatura_numero,
          created_at:saved.created_at||new Date().toISOString(),
          status:purchaseStatusLabel(saved.status),
          total,
          observacoes:purchaseNotes||null,
          forma_pagamento:purchasePayment,
          parcelas:purchaseInstallments,
          primeiro_vencimento:purchaseInstallmentDates[0]||purchaseDueDate,
          vencimentos_parcelas:purchaseInstallmentDates,
          fornecedor,
          company:empresa||undefined,
          items:purchasePdfItems(items)
        })
        await supabase.from('compras').update({fatura_gerada_em:new Date().toISOString()}).eq('id',saved.id)
        setMsg(saved.status==='pedido_recebido'
          ? 'Pedido recebido. Estoque atualizado e fatura mantida.'
          : 'Pedido aprovado. Fatura confirmada e contas a pagar geradas. Estoque ainda não foi alterado.')
      }catch{
        setMsg(saved.status==='pedido_recebido'
          ? 'Pedido recebido e estoque atualizado. O PDF pode ser reemitido pelo painel.'
          : 'Pedido aprovado e contas a pagar geradas. O PDF pode ser reemitido pelo painel.')
      }
    }

    setSavingPurchase(false)
    setShowForm(false)
    resetPurchaseForm()
    await loadData()
  }

  async function downloadPurchasePdf(compra:Compra){
    const {data,error}=await supabase.from('compra_itens')
      .select('produto_id,quantidade,custo_unitario,total')
      .eq('compra_id',compra.id)

    if(error){setMsg(error.message);return}

    const items=(data||[]) as CompraItem[]
    const fornecedor=fornecedores.find(f=>f.id===compra.fornecedor_id)||null

    try{
      (await import('./lib/purchaseInvoicePdf')).generatePurchaseInvoicePdf({
        id:compra.id,
        fatura_numero:compra.fatura_numero,
        created_at:compra.created_at,
        status:purchaseStatusLabel(compra.status),
        total:Number(compra.total),
        observacoes:compra.observacoes,
        forma_pagamento:compra.forma_pagamento,
        parcelas:Number(compra.parcelas),
        primeiro_vencimento:compra.primeiro_vencimento,
        vencimentos_parcelas:Array.isArray(compra.vencimentos_parcelas)?compra.vencimentos_parcelas:buildInstallmentDates(compra.primeiro_vencimento,Number(compra.parcelas)),
        fornecedor,
        company:empresa||undefined,
        items:items.map(i=>{
          const p=produtos.find(x=>x.id===i.produto_id)
          return {
            codigo:p?.codigo,
            descricao:p?.descricao||'Produto',
            unidade:p?.unidade||'UN',
            quantidade:Number(i.quantidade),
            custo_unitario:Number(i.custo_unitario),
            total:Number(i.total)
          }
        })
      })
      await supabase.from('compras').update({fatura_gerada_em:new Date().toISOString()}).eq('id',compra.id)
    }catch{
      setMsg('Não foi possível gerar o PDF desta compra.')
    }
  }
  async function receivePurchase(c:Compra){
    if(!canManagePurchases){setMsg('Sem permissão para receber compras.');return}
    if(c.status!=='pedido_aprovado')return
    if(!await themedConfirm(`Confirmar o recebimento da compra ${purchaseCode(c.fatura_numero)}? Os itens serão adicionados ao estoque.`))return

    const r=await supabase.from('compras')
      .update({status:'pedido_recebido'})
      .eq('id',c.id)
      .eq('status','pedido_aprovado')

    if(r.error){
      setMsg(r.error.message)
      return
    }

    setMsg(`Compra ${purchaseCode(c.fatura_numero)} recebida. Estoque atualizado com sucesso.`)
    setPurchasePanel(null)
    await loadData()
  }

  async function cancelPurchase(c:Compra){
    if(!canManagePurchases){setMsg('Sem permissão para cancelar compras.');return}
    const detail=c.status==='pedido_recebido'
      ? 'O estoque será estornado e as contas a pagar em aberto serão canceladas.'
      : c.status==='pedido_aprovado'
        ? 'As contas a pagar em aberto serão canceladas. O estoque não será alterado.'
        : 'A cotação será cancelada sem alterar financeiro ou estoque.'
    if(c.status==='cancelada'||!await themedConfirm(`Cancelar esta compra? ${detail}`))return
    const r=await supabase.from('compras').update({status:'cancelada'}).eq('id',c.id)
    setMsg(r.error?r.error.message:c.status==='pedido_recebido'?'Pedido cancelado, estoque estornado e contas a pagar em aberto canceladas.':c.status==='pedido_aprovado'?'Pedido cancelado e contas a pagar em aberto canceladas.':'Cotação cancelada.')
    if(!r.error){setPurchasePanel(null);await loadData()}
  }
  async function deletePurchase(c:Compra){if(!(isAdmin&&canManagePurchases)){setMsg('Sem permissão para excluir compra.');return}if(!await themedConfirm('Excluir esta compra definitivamente?'))return;const r=await supabase.from('compras').delete().eq('id',c.id).select('id');setMsg(r.error?r.error.message:r.data?.length?'Compra excluída.':'Compra não foi excluída. Verifique vínculos financeiros, recebimento ou histórico.');if(!r.error&&r.data?.length){setPurchasePanel(null);await loadData()}}

  // FINANCEIRO
  function startNewTitle(){
    if(!canManageFinance){setMsg('Você possui somente visualização no Financeiro.');return}
    setEditingTitle(null)
    setFinanceTitleType('receber')
    setFinanceTitleEntity('')
    setFinanceImportNotice('')
    setShowForm(true)
    setMsg('')
  }

  function startEditTitle(t:Titulo){
    if(!canManageFinance){setMsg('Você possui somente visualização no Financeiro.');return}
    if(t.funcionario_id){setMsg('Edite os dados deste lançamento no aplicativo RH. Use este painel para pagamentos e detalhes.');return}
    setEditingTitle(t)
    setFinanceTitleType(t.tipo)
    setFinanceTitleEntity(t.entidade_nome||'')
    setFinanceImportNotice('')
    setShowForm(true)
    setMsg('')
  }

  function closeFinancePanel(){
    setFinancePanel(null)
    if(financePanelReturnModule){
      setActive(financePanelReturnModule)
      setFinancePanelReturnModule(null)
      setFinancePanelReturnSubtab(null)
      return
    }
    if(financePanelReturnSubtab){
      setFinanceSubtab(financePanelReturnSubtab)
      setFinancePanelReturnSubtab(null)
    }
  }
  function selectFinanceTitleInPanel(t:Titulo){
    setFinancePanel(t.id)
    setPaymentDate(today())
    setPaymentAmount(String(Math.max(0,Number(t.valor)-Number(t.valor_pago)).toFixed(2)))
    setChangePaymentMethod(false)
    setEffectivePaymentMethod((t.forma_pagamento as PaymentMethod)||'pix')
  }
  function openFinancePanel(t:Titulo){
    if(financePanel===t.id){
      closeFinancePanel()
      return
    }
    setFinancePanelReturnModule(null)
    setFinancePanelReturnSubtab(null)
    setFinancePanelTab('detalhes')
    selectFinanceTitleInPanel(t)
  }
  function openSaleFinancialStatement(v:Venda,returnToBilling=false){
    if(!canViewFinance){setMsg('Seu perfil não possui acesso ao Financeiro.');return}
    const related=financialTitlesForSale(v.id).sort((a,b)=>a.vencimento.localeCompare(b.vencimento))
    setSaleActionMenu(null)
    if(!related.length){
      setMsg(v.status==='orcamento'?'Este orçamento ainda não possui títulos financeiros.':'Não há títulos financeiros vinculados a esta venda.')
      return
    }
    const first=related[0]
    setFinancePanelReturnModule(returnToBilling?null:'vendas')
    setActive('financeiro')
    setFinancePanelReturnSubtab(returnToBilling?'faturamento':null)
    setFinanceSubtab('receber')
    setFinanceStatusFilter('todos')
    setFinanceStart('')
    setFinanceEnd('')
    setFinanceCategory('todos')
    setFinanceCenter('todos')
    setSearch('financeiro-receber',first.fatura_venda_id?financialInvoiceCode(faturasVendas.find(f=>f.id===first.fatura_venda_id)?.numero):saleCode(v.venda_numero))
    setFinancePanel(first.id)
    setFinancePanelTab('pagamentos')
    setPaymentDate(today())
    setPaymentAmount(String(Math.max(0,Number(first.valor)-Number(first.valor_pago)).toFixed(2)))
  }

  function setFinanceFormField(name:string,value:string){
    const form=financeTitleFormRef.current
    if(!form)return
    const field=form.elements.namedItem(name)
    if(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement){
      field.value=value
      field.dispatchEvent(new Event('change',{bubbles:true}))
    }
  }

  function normalizeFinanceText(value:string){
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
  }

  function parseFinanceDate(raw:string){
    const match=raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/)
    if(!match)return ''
    const [,d,m,y]=match
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  function parseFinanceMoney(raw:string){
    const value=raw.replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')
    const n=Number(value.replace(/[^0-9.-]/g,''))
    return Number.isFinite(n)&&n>=0?n:0
  }

  async function importFinanceDocument(file:File){
    if(!file)return
    setFinanceImportNotice('Lendo documento...')
    setFinanceFormField('documento_importado_nome',file.name)

    const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')
    const isImage=file.type.startsWith('image/')

    if(isPdf||isImage){
      setFinanceImportNotice('Analisando documento com IA...')
      try{
        const body=new FormData()
        body.append('file',file)
        const {data,error}=await supabase.functions.invoke('finance-document-ai',{body})
        if(error){
          let message=error.message||'Falha ao analisar documento com IA.'
          const context=(error as unknown as {context?:Response}).context
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
        const extracted=data?.data||{}

        const targetType=extracted.tipo==='pagar'||extracted.tipo==='receber'?extracted.tipo:financeTitleType
        if(targetType!==financeTitleType)setFinanceTitleType(targetType)

        const targetList=targetType==='receber'?clientes:fornecedores
        const doc=String(extracted.documento||'').replace(/\D/g,'')
        const normalizedName=normalizeFinanceText(String(extracted.entidade_nome||''))
        const entity=targetList.find(item=>{
          const itemDoc=(item.documento||'').replace(/\D/g,'')
          if(doc&&itemDoc===doc)return true
          const itemName=normalizeFinanceText(item.nome)
          return normalizedName.length>=4&&(itemName.includes(normalizedName)||normalizedName.includes(itemName))
        })
        if(entity)setFinanceTitleEntity(entity.nome)
        else if(extracted.entidade_nome)setFinanceTitleEntity(String(extracted.entidade_nome))

        if(extracted.valor!=null&&Number(extracted.valor)>=0)setFinanceFormField('valor',Number(extracted.valor).toFixed(2))
        if(extracted.vencimento)setFinanceFormField('vencimento',String(extracted.vencimento))
        else if(extracted.data_documento)setFinanceFormField('vencimento',String(extracted.data_documento))
        if(extracted.forma_pagamento)setFinanceFormField('forma_pagamento',String(extracted.forma_pagamento))
        if(extracted.banco)setFinanceFormField('banco',String(extracted.banco))
        if(extracted.descricao)setFinanceFormField('descricao',String(extracted.descricao))
        else if(!editingTitle)setFinanceFormField('descricao',file.name.replace(/\.[^.]+$/,''))

        const confidence=Number(extracted.confianca)
        const details=[
          extracted.entidade_nome?'entidade':'',
          extracted.valor!=null?'valor':'',
          extracted.vencimento||extracted.data_documento?'data':'',
          extracted.forma_pagamento?'pagamento':'',
          extracted.banco?'banco':''
        ].filter(Boolean)
        setFinanceImportNotice(
          'IA concluiu a leitura'+
          (Number.isFinite(confidence)?' · confiança '+Math.round(confidence*100)+'%':'')+
          (details.length?' · reconhecido: '+details.join(', '):'')+
          '. Revise os campos antes de salvar.'
        )
        return
      }catch{
        if(isImage){
          setFinanceImportNotice('Imagem carregada. A leitura automática está indisponível no momento; revise os campos manualmente.')
          return
        }
        setFinanceImportNotice('')
      }
    }

    let text=''
    try{text=await file.text()}catch{text=''}
    const compact=text.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim()
    if(!compact){
      setFinanceImportNotice('Documento carregado, mas não foi possível extrair texto automaticamente. Revise os campos manualmente.')
      return
    }

    const normalized=normalizeFinanceText(compact)
    const docDigits=(compact.match(/(?:\d[.\/-]?){11,18}/g)||[]).map(v=>v.replace(/\D/g,'')).filter(v=>v.length===11||v.length===14)
    const currentList=financeTitleType==='receber'?clientes:fornecedores
    const otherList=financeTitleType==='receber'?fornecedores:clientes
    const findEntity=(list:Array<Cliente|Fornecedor>)=>list.find(item=>{
      const itemDoc=(item.documento||'').replace(/\D/g,'')
      if(itemDoc&&docDigits.includes(itemDoc))return true
      const name=normalizeFinanceText(item.nome)
      return name.length>=5&&normalized.includes(name)
    })
    let entity=findEntity(currentList)
    if(!entity){
      const other=findEntity(otherList)
      if(other){
        setFinanceTitleType(financeTitleType==='receber'?'pagar':'receber')
        entity=other
      }
    }
    if(entity)setFinanceTitleEntity(entity.nome)

    const valuePatterns=[
      /(?:valor\s+(?:pago|total|do\s+documento|da\s+cobranca)|valor|total)\s*[:\-]?\s*(?:r\$\s*)?([\d.]+,\d{2})/i,
      /r\$\s*([\d.]+,\d{2})/i
    ]
    let amount=0
    for(const pattern of valuePatterns){
      const match=compact.match(pattern)
      if(match){amount=parseFinanceMoney(match[1]);if(amount>0)break}
    }
    if(amount>0)setFinanceFormField('valor',String(amount.toFixed(2)))

    const dateMatch=compact.match(/(?:vencimento|data\s+de\s+vencimento|data\s+do\s+pagamento|pagamento\s+em|data)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i)
    if(dateMatch){
      const iso=parseFinanceDate(dateMatch[1])
      if(iso)setFinanceFormField('vencimento',iso)
    }

    const banks:[RegExp,string][]=[
      [/itau|ita[uú]\s+unibanco/i,'Itaú'],
      [/bradesco/i,'Bradesco'],
      [/santander/i,'Santander'],
      [/banco\s+inter|inter\s+pagamentos/i,'Inter'],
      [/banco\s+do\s+brasil|bb\s+s\.a/i,'Banco do Brasil'],
      [/caixa\s+economica|caixa\s+econ[oô]mica/i,'Caixa Econômica Federal'],
      [/nubank|nu\s+pagamentos/i,'Nubank'],
      [/sicredi/i,'Sicredi'],
      [/sicoob/i,'Sicoob']
    ]
    const bank=banks.find(([pattern])=>pattern.test(compact))?.[1]||''
    if(bank)setFinanceFormField('banco',bank)

    let method=''
    if(/\bpix\b/i.test(compact))method='pix'
    else if(/boleto|linha\s+digitavel|c[oó]digo\s+de\s+barras/i.test(compact))method='boleto'
    else if(/cart[aã]o|cr[eé]dito|d[eé]bito/i.test(compact))method='cartao'
    else if(/dinheiro|esp[eé]cie/i.test(compact))method='dinheiro'
    else if(/ted|doc\b|transfer[eê]ncia/i.test(compact))method='transferencia'
    if(method)setFinanceFormField('forma_pagamento',method)

    if(!editingTitle)setFinanceFormField('descricao',file.name.replace(/\.[^.]+$/,''))
    const found=[
      entity?'entidade':'',
      amount>0?'valor':'',
      bank?'banco':'',
      method?'pagamento':'',
      dateMatch?'data':''
    ].filter(Boolean)
    setFinanceImportNotice(found.length?'Documento importado. Reconhecido: '+found.join(', ')+'. Revise antes de salvar.':'Documento lido, mas os dados não foram reconhecidos automaticamente. Revise os campos manualmente.')
  }

  async function saveTitle(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageFinance){setMsg('Sem permissão para editar o Financeiro.');return}
    const f=new FormData(e.currentTarget)
    const linked=Boolean(editingTitle?.venda_id||editingTitle?.compra_id)
    const classification={
      categoria:String(f.get('categoria')||'')||null,
      centro_custo:String(f.get('centro_custo')||'')||null
    }

    if(linked&&editingTitle){
      const r=await supabase.from('titulos_financeiros').update(classification).eq('id',editingTitle.id)
      setMsg(r.error?r.error.message:'Classificação financeira atualizada. Os dados da fatura permanecem vinculados ao documento de origem.')
      if(!r.error){setShowForm(false);setEditingTitle(null);await loadData()}
      return
    }

    const valor=Number(f.get('valor')||0)
    if(editingTitle&&valor<Number(editingTitle.valor_pago)){
      setMsg('O valor do título não pode ficar abaixo do que já foi pago/recebido.')
      return
    }

    const payload={
      tipo:financeTitleType,
      descricao:String(f.get('descricao')||''),
      entidade_nome:financeTitleEntity||null,
      vencimento:String(f.get('vencimento')||today()),
      valor,
      forma_pagamento:String(f.get('forma_pagamento')||'')||null,
      banco:String(f.get('banco')||'')||null,
      documento_importado_nome:String(f.get('documento_importado_nome')||'')||null,
      ...classification
    }

    const r=editingTitle
      ? await supabase.from('titulos_financeiros').update(payload).eq('id',editingTitle.id)
      : await supabase.from('titulos_financeiros').insert({...payload,valor_pago:0,status:'aberto'})

    setMsg(r.error?r.error.message:editingTitle?'Lançamento atualizado.':'Lançamento criado.')
    if(!r.error){
      setShowForm(false)
      setEditingTitle(null)
      await loadData()
    }
  }

  async function registerPayment(t:Titulo){
    if(!canManageFinance){setMsg('Sem permissão para registrar pagamentos ou recebimentos.');return}
    const amount=Number(paymentAmount)
    const balance=Math.max(0,Number(t.valor)-Number(t.valor_pago))
    if(!paymentDate){setMsg('Informe a data do pagamento/recebimento.');return}
    if(!Number.isFinite(amount)||amount<=0){setMsg('Informe um valor válido.');return}
    if(amount>balance){setMsg('O valor informado é maior que o saldo em aberto.');return}

    const method=changePaymentMethod?effectivePaymentMethod:(t.forma_pagamento||'pix')
    const {error}=await supabase.rpc('registrar_pagamento_titulo_com_forma',{
      p_titulo_id:t.id,
      p_valor:amount,
      p_data_pagamento:paymentDate,
      p_observacao:t.tipo==='receber'?'Recebimento registrado no financeiro':'Pagamento registrado no financeiro',
      p_forma_pagamento:method
    })

    setMsg(error
      ? error.message
      : t.tipo==='receber'
        ? 'Recebimento registrado. A comissão foi atualizada pela data informada.'
        : 'Pagamento registrado.')

    if(!error){
      setChangePaymentMethod(false)
      setEffectivePaymentMethod('pix')
      closeFinancePanel()
      await refreshFinance()
      if(active==='comissoes')await loadCommissions()
    }
  }

  async function cancelTitle(t:Titulo){
    if(!canManageFinance){setMsg('Sem permissão para cancelar lançamentos financeiros.');return}
    if(t.venda_id||t.compra_id){setMsg('Cancele a venda ou compra de origem para manter o financeiro integrado.');return}
    if(Number(t.valor_pago)>0){setMsg('Este título possui pagamento e precisa de regularização financeira antes de cancelar.');return}
    const r=await supabase.from('titulos_financeiros').update({status:'cancelado'}).eq('id',t.id)
    setMsg(r.error?r.error.message:'Lançamento cancelado.')
    if(!r.error)await loadData()
  }

  async function deleteTitle(t:Titulo){
    if(!(isAdmin&&canManageFinance)){setMsg('Sem permissão para excluir lançamento.');return}
    if(t.venda_id||t.compra_id||t.funcionario_id||t.fatura_venda_id){
      setMsg('Este título possui documento de origem e não pode ser excluído por este fluxo.')
      return
    }
    if(t.status!=='cancelado'){
      setMsg('Cancele o lançamento manual antes de excluí-lo.')
      return
    }
    if(Number(t.valor_pago)>0){
      setMsg('Este título ainda possui saldo pago. Estorne os pagamentos antes de excluir.')
      return
    }
    if(!await themedConfirm('Excluir definitivamente este lançamento manual cancelado?'))return
    const {data,error}=await supabase.rpc('excluir_titulo_manual_cancelado',{p_titulo_id:t.id})
    setMsg(error?error.message:data?'Lançamento excluído.':'Lançamento não encontrado.')
    if(!error){
      closeFinancePanel()
      await refreshFinance()
    }
  }

  // CONFIG
  async function loadManagedUsers(){
    if(!canManageConfig)return
    const [{data,error},{data:profileRows,error:profileError}]=await Promise.all([
      supabase.rpc('listar_usuarios_erp'),
      supabase.rpc('listar_permissoes_perfis_erp')
    ])
    if(error||profileError){setMsg('Não foi possível carregar os usuários e perfis: '+(error||profileError)?.message);return}
    const rows=((data||[]) as unknown[]).map((raw:unknown)=>{
      const u=raw as Omit<ManagedUser,'permissoes'>&{permissoes?:unknown}
      return {...u,availablePermissions:permissionModules.filter(m=>u.permissoes&&typeof u.permissoes==='object'&&Object.hasOwn(u.permissoes,m.key)).map(m=>m.key),permissoes:normalizePermissions(u.permissoes,u.perfil)}
    }) as ManagedUser[]
    setManagedUsers(rows)
    setUserEdits(Object.fromEntries(rows.map(u=>[u.user_id,{nome:u.nome,perfil:u.perfil,ativo:u.ativo}])))
    setUserPermissionEdits(Object.fromEntries(rows.map(u=>[u.user_id,{...u.permissoes}])))
    const roles:PerfilRole[]=['administrador','financeiro','vendas','estoque','visualizador']
    const base=Object.fromEntries(roles.map(role=>[role,Object.fromEntries(permissionModules.map(m=>[m.key,false]))])) as Record<PerfilRole,Record<PermissionModule,boolean>>
    for(const row of (profileRows||[]) as {perfil:PerfilRole;modulo:PermissionModule;pode_editar:boolean}[])if(base[row.perfil])base[row.perfil][row.modulo]=Boolean(row.pode_editar)
    setProfilePermissions(base)
  }

  function editManagedUser(id:string,field:'nome'|'perfil'|'ativo',value:string|boolean){
    setUserEdits(prev=>({
      ...prev,
      [id]:{
        ...(prev[id]||{nome:'',perfil:'visualizador' as PerfilRole,ativo:true}),
        [field]:value
      }
    }))
  }

  function editUserPermission(id:string,module:PermissionModule,level:AccessLevel){
    setUserPermissionEdits(prev=>({
      ...prev,
      [id]:{
        ...(prev[id]||defaultPermissionsForRole(managedUsers.find(u=>u.user_id===id)?.perfil||'visualizador')),
        [module]:level
      }
    }))
  }

  function resetUserPermissionsToRole(u:ManagedUser){
    const draftRole=userEdits[u.user_id]?.perfil||u.perfil
    setUserPermissionEdits(prev=>({...prev,[u.user_id]:defaultPermissionsForRole(draftRole)}))
  }

  async function saveUserPermissions(u:ManagedUser){
    if(!canManageConfig){setMsg('Sem permissão para gerenciar acessos.');return}
    if(u.usuario_atual){setMsg('Para sua segurança, suas próprias permissões devem ser alteradas por outro administrador.');return}
    if((userEdits[u.user_id]?.perfil||u.perfil)!==u.perfil){setMsg('Salve a alteração de perfil antes de personalizar as permissões.');return}
    const draft=userPermissionEdits[u.user_id]||u.permissoes
    if(u.perfil!=='administrador'&&draft.config==='editar'){setMsg('Somente administradores podem editar Configurações.');return}
    setSavingPermissionUserId(u.user_id)
    setMsg('')
    const {error}=await supabase.rpc('salvar_permissoes_usuario_erp',{
      p_user_id:u.user_id,
      p_permissoes:Object.fromEntries(u.availablePermissions.map(key=>[key,draft[key]]))
    })
    setSavingPermissionUserId(null)
    if(error){setMsg(error.message);return}
    setMsg('Permissões do usuário atualizadas.')
    await loadManagedUsers()
  }

  function toggleProfilePermission(role:PerfilRole,module:PermissionModule){
    if(!profilePermissions)return
    if(module==='dashboard'||module==='relatorios'||(module==='config'&&role!=='administrador'))return
    setProfilePermissions(prev=>prev?{...prev,[role]:{...prev[role],[module]:!prev[role][module]}}:prev)
  }

  async function saveProfilePermissions(role:PerfilRole){
    if(!canManageConfig||!profilePermissions)return
    setSavingProfileRole(role);setMsg('')
    const payload=Object.fromEntries(permissionModules.map(m=>[m.key,Boolean(profilePermissions[role][m.key])]))
    const {error}=await supabase.rpc('salvar_permissoes_perfil_erp',{p_perfil:role,p_modulos_edicao:payload})
    setSavingProfileRole(null)
    if(error){setMsg(error.message);return}
    setMsg('Permissões de edição do perfil atualizadas.')
    await loadManagedUsers()
  }

  function openManagedUserPassword(u:ManagedUser){
    setPasswordUserId(u.user_id)
    setNewManagedPassword('')
    setConfirmManagedPassword('')
    setMsg('')
  }

  function closeManagedUserPassword(){
    if(savingPasswordUserId)return
    setPasswordUserId(null)
    setNewManagedPassword('')
    setConfirmManagedPassword('')
  }

  async function saveManagedUserPassword(){
    if(!canManageConfig){setMsg('Sem permissão para alterar senhas.');return}
    if(!passwordUserId||savingPasswordUserId)return
    if(newManagedPassword.length<12){setMsg('A nova senha deve ter pelo menos 12 caracteres.');return}
    if(!/[a-z]/.test(newManagedPassword)||!/[A-Z]/.test(newManagedPassword)||!/[0-9]/.test(newManagedPassword)||!/[^A-Za-z0-9]/.test(newManagedPassword)){setMsg('A senha deve conter letra minúscula, maiúscula, número e símbolo.');return}
    if(newManagedPassword!==confirmManagedPassword){setMsg('A confirmação da senha não confere.');return}

    setSavingPasswordUserId(passwordUserId)
    setMsg('')
    const {data,error}=await supabase.functions.invoke('admin-reset-password',{
      body:{user_id:passwordUserId,password:newManagedPassword}
    })
    setSavingPasswordUserId(null)

    if(error){
      setMsg(error.message||'Não foi possível alterar a senha.')
      return
    }
    if(data?.error){
      setMsg(String(data.error))
      return
    }

    const changedUser=managedUsers.find(row=>row.user_id===passwordUserId)
    setMsg('Senha de '+(changedUser?.nome||'usuário')+' alterada com sucesso.')
    setPasswordUserId(null)
    setNewManagedPassword('')
    setConfirmManagedPassword('')
  }

  function managedUserAvatarUrl(u:ManagedUser){
    if(!u.avatar_path)return ''
    return supabase.storage.from('user-avatars').getPublicUrl(u.avatar_path).data.publicUrl
  }

  async function saveManagedUserAvatar(u:ManagedUser,file:File){
    if(!canManageConfig||savingAvatarUserId)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setMsg('Use uma imagem PNG, JPG ou WebP.');return}
    if(file.size>2*1024*1024){setMsg('A imagem deve ter no máximo 2 MB.');return}

    const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
    const path=`${u.user_id}/avatar-${Date.now()}.${extension}`
    setSavingAvatarUserId(u.user_id)
    setMsg('')

    const upload=await supabase.storage.from('user-avatars').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
    if(upload.error){setSavingAvatarUserId(null);setMsg('Não foi possível enviar a imagem: '+upload.error.message);return}

    const save=await supabase.rpc('salvar_avatar_usuario_erp',{p_user_id:u.user_id,p_avatar_path:path})
    if(save.error){
      await supabase.storage.from('user-avatars').remove([path])
      setSavingAvatarUserId(null)
      setMsg(save.error.message)
      return
    }

    if(u.avatar_path)await supabase.storage.from('user-avatars').remove([u.avatar_path])
    if(u.usuario_atual)setCurrentAvatarPath(path)
    setSavingAvatarUserId(null)
    setMsg('Imagem do usuário atualizada.')
    await loadManagedUsers()
  }

  async function removeManagedUserAvatar(u:ManagedUser){
    if(!canManageConfig||savingAvatarUserId||!u.avatar_path)return
    setSavingAvatarUserId(u.user_id)
    setMsg('')
    const save=await supabase.rpc('salvar_avatar_usuario_erp',{p_user_id:u.user_id,p_avatar_path:null})
    if(save.error){setSavingAvatarUserId(null);setMsg(save.error.message);return}
    await supabase.storage.from('user-avatars').remove([u.avatar_path])
    if(u.usuario_atual)setCurrentAvatarPath(null)
    setSavingAvatarUserId(null)
    setMsg('Imagem do usuário removida.')
    await loadManagedUsers()
  }

  async function saveManagedUser(u:ManagedUser){
    if(!canManageConfig||savingUserId){setMsg('Aguarde a gravação atual.');return}
    const draft=userEdits[u.user_id]||{nome:u.nome,perfil:u.perfil,ativo:u.ativo}
    if(!draft.nome.trim()){setMsg('Informe o nome do usuário.');return}
    if(draft.perfil!==u.perfil&&!await themedConfirm('Alterar o perfil restaura as permissões padrão deste usuário. Continuar?'))return
    if(!draft.ativo&&u.ativo&&!await themedConfirm(`Desativar o acesso de "${u.nome}" ao sistema?`))return

    setSavingUserId(u.user_id)
    setMsg('')
    const {error}=await supabase.rpc('atualizar_usuario_erp',{
      p_user_id:u.user_id,
      p_nome:draft.nome.trim(),
      p_perfil:draft.perfil,
      p_ativo:draft.ativo
    })
    setSavingUserId(null)

    if(error){setMsg(error.message);return}
    setMsg('Usuário atualizado com sucesso.')
    await loadManagedUsers()
  }

  async function createManagedUserAccount(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageConfig){
      setMsg('Sem permissão para criar usuários.')
      return
    }
    if(!supabaseUrl||!supabasePublishableKey){
      setMsg('Configuração do Supabase indisponível.')
      return
    }

    if(viewerPassword.length<12){setMsg('A senha inicial deve ter pelo menos 12 caracteres.');return}
    if(!/[a-z]/.test(viewerPassword)||!/[A-Z]/.test(viewerPassword)||!/[0-9]/.test(viewerPassword)||!/[^A-Za-z0-9]/.test(viewerPassword)){setMsg('A senha inicial deve conter letra minúscula, maiúscula, número e símbolo.');return}

    setCreatingViewer(true)
    setMsg('')

    const creator=createClient(supabaseUrl,supabasePublishableKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    })

    const {data,error}=await creator.auth.signUp({
      email:viewerEmail.trim(),
      password:viewerPassword,
      options:{data:{full_name:viewerName.trim()||'Visualizador'}}
    })

    if(error||!data.user){
      setCreatingViewer(false)
      setMsg(error?.message||'Não foi possível criar o usuário.')
      return
    }

    const {error:roleError}=await supabase.rpc('atualizar_usuario_erp',{p_user_id:data.user.id,p_nome:viewerName.trim()||'Usuário',p_perfil:newUserRole,p_ativo:true})
    if(roleError){
      setCreatingViewer(false)
      setMsg('Usuário criado, mas não foi possível aplicar o perfil selecionado: '+roleError.message)
      return
    }

    if(data.session)await creator.auth.signOut({scope:'local'})

    setViewerEmail('')
    setViewerPassword('')
    setNewUserRole('visualizador')
    setCreatingViewer(false)
    setMsg(data.session
      ? 'Usuário criado e liberado para acesso.'
      : 'Usuário criado. Confirme o e-mail enviado para liberar o acesso.')
    await loadManagedUsers()
  }

  async function saveCompany(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageConfig){setMsg('Sem permissão para alterar configurações.');return}
    const f=new FormData(e.currentTarget)
    let settings
    try{settings=readSettings(f,empresa?.campos_obrigatorios)}catch(error){setMsg((error as Error).message);return}
    const payload={id:1,razao_social:String(f.get('razao_social')||'SUA EMPRESA'),nome_fantasia:String(f.get('nome_fantasia')||'SUA EMPRESA'),cnpj:String(f.get('cnpj')||'')||null,email:String(f.get('email')||'')||null,telefone:String(f.get('telefone')||'')||null,endereco:String(f.get('endereco')||'')||null,cidade:String(f.get('cidade')||'')||null,uf:String(f.get('uf')||'')||null,cep:String(f.get('cep')||'')||null,pix_chave:String(f.get('pix_chave')||'')||null,banco:String(f.get('banco')||'')||null,agencia:String(f.get('agencia')||'')||null,conta:String(f.get('conta')||'')||null,condicoes_gerais:String(f.get('condicoes_gerais')||'')||null,updated_at:new Date().toISOString()}
    if(savingCompany||!empresa?.updated_at){setMsg('Atualize as configurações antes de salvar.');return}
    setSavingCompany(true);setMsg('')
    try{
      const r=await supabase.from('empresa_config').update({...payload,...settings}).eq('id',1).eq('updated_at',empresa.updated_at).select('id').maybeSingle()
      if(r.error)throw r.error
      if(!r.data){setMsg('As configurações mudaram em outra sessão ou seu acesso foi alterado. Seus campos foram mantidos. Atualize antes de salvar novamente.');return}
      setMsg('Configurações da empresa salvas.');await loadData()
    }catch(error){setMsg((error as {message?:string}).message||'Não foi possível salvar. Os campos foram mantidos.')}
    finally{setSavingCompany(false)}
  }

  if(loading)return <div className="modulePlaceholder">Carregando...</div>
  if(!supabaseConfigured)return <div className="modulePlaceholder"><div className="panel" style={{maxWidth:620}}><h2>Sistema de Gestão publicado</h2><p>Configuração do Supabase ausente.</p></div></div>
  if(recoveryMode&&session)return <div className={`loginRecoveryPage ${dark?'dark':''}`}>
    <form onSubmit={updateRecoveredPassword} className="loginRecoveryCard">
      <div className="loginRecoveryIcon"><KeyRound size={30}/></div>
      <span className="loginRecoveryEyebrow">Recuperação de acesso</span>
      <h2>Crie uma nova senha</h2>
      <p>Defina uma nova senha para continuar acessando o Sistema de Gestão.</p>
      <label className="loginRecoveryField">
        <span>Nova senha</span>
        <div className="loginInputWrap"><LockKeyhole size={19}/><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={6} autoComplete="new-password" placeholder="Digite a nova senha" required/></div>
      </label>
      <label className="loginRecoveryField">
        <span>Confirmar nova senha</span>
        <div className="loginInputWrap"><LockKeyhole size={19}/><input type="password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} minLength={6} autoComplete="new-password" placeholder="Digite novamente" required/></div>
      </label>
      {msg&&<p className="loginRecoveryMsg">{msg}</p>}
      <button className="primary loginSubmit" disabled={passwordUpdateBusy}><KeyRound size={19}/>{passwordUpdateBusy?'Salvando...':'Alterar senha'}</button>
      <div className="loginSecure"><span></span><ShieldCheck size={17}/><small>Link de recuperação validado</small><span></span></div>
    </form>
  </div>

  if(!session)return <div className={`loginPage loginPagePremium ${dark?'dark':''}`}>
    <button type="button" className="loginThemeToggle" onClick={toggleTheme} aria-label={dark?'Ativar modo claro':'Ativar modo noturno'} title={dark?'Modo claro':'Modo noturno'}>
      {dark?<Sun size={19}/>:<Moon size={19}/>}
      <span>{dark?'Claro':'Noturno'}</span>
    </button>
    <section className="loginInfo">
      <div className="loginBrand">
        <div className="loginBrandMark"><BarChart3 size={42}/></div>
        <div>
          <h1>Sistema de<br/>Gestão</h1>
          <p>ERP completo para otimizar, integrar e dar mais controle ao seu negócio.</p>
          <span className="loginBrandAccent" aria-hidden="true"></span>
        </div>
      </div>
      <div className="loginBenefits">
        <div><span><Layers3 size={24}/></span><p><strong>Gestão Integrada</strong><small>Todas as áreas do seu negócio conectadas em um só lugar.</small></p></div>
        <div><span><TrendingUp size={24}/></span><p><strong>Mais Produtividade</strong><small>Automatize processos e ganhe eficiência no dia a dia.</small></p></div>
        <div><span><ShieldCheck size={24}/></span><p><strong>Segurança de Dados</strong><small>Seus dados protegidos com alta confiabilidade e privacidade.</small></p></div>
      </div>
    </section>

    <form onSubmit={login} className="panel dataForm loginCard loginCardPremium">
      <div className="loginCardIcon"><BarChart3 size={34}/></div>
      <h2>Sistema de Gestão</h2>
      <p>Acesse o ERP</p>

      <label className="fieldLabel loginField">
        <span>E-mail</span>
        <div className="loginInputWrap loginInputWrapClean">
          <div className="loginInputIcon"><Mail size={18}/></div>
          <input type="email" autoComplete="username" placeholder="Digite seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
        </div>
      </label>

      <label className="fieldLabel loginField">
        <span>Senha</span>
        <div className="loginInputWrap loginInputWrapClean">
          <div className="loginInputIcon"><LockKeyhole size={18}/></div>
          <input type={showLoginPassword?'text':'password'} autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
          <button type="button" className="loginPasswordToggle" onClick={()=>setShowLoginPassword(v=>!v)} aria-label={showLoginPassword?'Ocultar senha':'Mostrar senha'}>
            {showLoginPassword?<EyeOff size={20}/>:<Eye size={20}/>}
          </button>
        </div>
      </label>

      <div className="loginAssistRow">
        <label className="loginRemember">
          <input type="checkbox" checked={rememberLogin} onChange={e=>setRememberLogin(e.target.checked)}/>
          <span className="loginRememberBox">{rememberLogin?'✓':''}</span>
          Lembrar-me
        </label>
        <button type="button" className="loginForgot" onClick={openPasswordRecovery}>Esqueci minha senha</button>
      </div>

      <button className="primary loginSubmit" disabled={loginBusy}><LogIn size={21}/>{loginBusy?'Entrando...':'Entrar'}</button>
      {msg&&<p className="loginMsg">{msg}</p>}

      <div className="loginSecure"><span></span><ShieldCheck size={17}/><small>Ambiente seguro</small><span></span></div>
    </form>

    {resetModalOpen&&<div className="loginResetOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setResetModalOpen(false)}}>
      <div className="loginResetModal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
        <button type="button" className="loginResetClose" onClick={()=>setResetModalOpen(false)} aria-label="Fechar"><X size={20}/></button>
        {!resetSent?<>
          <div className="loginRecoveryIcon"><Mail size={28}/></div>
          <span className="loginRecoveryEyebrow">Recuperar senha</span>
          <h2 id="reset-password-title">Esqueceu sua senha?</h2>
          <p>Informe o e-mail cadastrado no SG. Enviaremos um link seguro para você criar uma nova senha.</p>
          <form onSubmit={recoverPassword}>
            <label className="loginRecoveryField">
              <span>E-mail</span>
              <div className="loginInputWrap"><Mail size={19}/><input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} autoComplete="email" placeholder="Digite seu e-mail" required autoFocus/></div>
            </label>
            {msg&&<p className="loginRecoveryMsg">{msg}</p>}
            <button className="primary loginSubmit" disabled={resetBusy}><Mail size={19}/>{resetBusy?'Enviando...':'Enviar link de recuperação'}</button>
          </form>
          <button type="button" className="loginRecoveryBack" onClick={()=>setResetModalOpen(false)}>Voltar para o login</button>
        </>:<>
          <div className="loginRecoveryIcon loginRecoverySuccess"><CheckCircle2 size={30}/></div>
          <span className="loginRecoveryEyebrow">E-mail enviado</span>
          <h2 id="reset-password-title">Confira sua caixa de entrada</h2>
          <p>Enviamos um link de recuperação para <strong>{resetEmail}</strong>. Abra o e-mail e clique no link para definir uma nova senha.</p>
          <div className="loginResetSteps">
            <span><b>1</b> Abra o e-mail recebido</span>
            <span><b>2</b> Clique no link de recuperação</span>
            <span><b>3</b> Crie e confirme sua nova senha</span>
          </div>
          <button type="button" className="primary loginSubmit" onClick={()=>setResetModalOpen(false)}>Entendi</button>
          <button type="button" className="loginRecoveryBack" onClick={()=>{setResetSent(false);setMsg('')}}>Reenviar ou trocar e-mail</button>
        </>}
      </div>
    </div>}

    <section className="loginVisual" aria-hidden="true">
      <div className="loginDevice">
        <div className="loginDeviceTop">
          <div className="loginDeviceBrand"><BarChart3 size={20}/><strong>Sistema de Gestão</strong></div>
          <div className="loginDeviceIcons"><Bell size={18}/><CircleUserRound size={22}/></div>
        </div>
        <div className="loginDeviceTitle">
          <strong>Visão Geral</strong>
          <span>Últimos 30 dias <ChevronDown size={14}/></span>
        </div>
        <div className="loginMiniCards">
          <div><BarChart3 size={18}/><span>Receita</span><strong>R$ 125.430</strong><small>↑ +12,4%</small></div>
          <div><TrendingUp size={18}/><span>Vendas</span><strong>1.284</strong><small>↑ +8,7%</small></div>
          <div><Users size={18}/><span>Clientes</span><strong>892</strong><small>↑ +5,1%</small></div>
        </div>
        <div className="loginChartPanel">
          <strong>Faturamento</strong>
          <div className="loginChart">
            <span></span><i></i><b></b><em></em><u></u>
          </div>
        </div>
        <div className="loginDeviceBottom">
          <div className="loginDonut"><strong>72%</strong></div>
          <div className="loginGoals">
            <strong>Metas do Período</strong>
            <div><span>Vendas</span><i><b style={{width:'85%'}}></b></i><small>85%</small></div>
            <div><span>Faturamento</span><i><b style={{width:'72%'}}></b></i><small>72%</small></div>
            <div><span>Clientes</span><i><b style={{width:'90%'}}></b></i><small>90%</small></div>
          </div>
        </div>
      </div>
      <div className="loginDeviceGlow"></div>
    </section>
  </div>

  const low=produtos.filter(p=>p.ativo&&p.rastrear_estoque!==false&&p.tipo_produto!=='servico'&&Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)
  const monthSales=vendas.filter(v=>{const d=new Date(v.created_at),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&v.status!=='cancelado'}).reduce((s,v)=>s+Number(v.total),0)
  const financeTitles=titulos.filter(t=>!t.funcionario_id)
  const openReceivables=financeTitles.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const openPayables=financeTitles.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const openReceivableCount=financeTitles.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0).length
  const openPayableCount=financeTitles.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0).length
  const financeCategories=Array.from(new Set(financeTitles.map(t=>t.categoria).filter((v):v is string=>Boolean(v)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))
  const financeCenters=Array.from(new Set(financeTitles.map(t=>t.centro_custo).filter((v):v is string=>Boolean(v)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))
  const financeMonthStart=monthStartIso()
  const financeMonthEnd=monthEndIso()
  const financeTitleById=new Map(financeTitles.map(t=>[t.id,t]))
  const financePaymentById=new Map(financePayments.map(p=>[p.id,p]))
  const monthMovement=(type:'receber'|'pagar')=>{
    const payments=financePayments
      .filter(p=>p.data_pagamento>=financeMonthStart&&p.data_pagamento<=financeMonthEnd&&financeTitleById.get(p.titulo_id)?.tipo===type)
      .reduce((s,p)=>s+Number(p.valor),0)
    const reversals=financeReversals
      .filter(e=>{
        const p=financePaymentById.get(e.pagamento_id)
        return e.data_estorno>=financeMonthStart&&e.data_estorno<=financeMonthEnd&&p&&financeTitleById.get(p.titulo_id)?.tipo===type
      })
      .reduce((s,e)=>s+Number(e.valor),0)
    return payments-reversals
  }
  const receivedThisMonth=monthMovement('receber')
  const paidThisMonth=monthMovement('pagar')
  const cashResultThisMonth=receivedThisMonth-paidThisMonth
  const next7End=addDaysIso(today(),6)
  const dueNext7Receivable=financeTitles.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado'&&t.vencimento>=today()&&t.vencimento<=next7End).reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const dueNext7Payable=financeTitles.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado'&&t.vencimento>=today()&&t.vencimento<=next7End).reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const financeProjectionRanges=[[0,6],[7,13],[14,20],[21,29]] as const
  const financeProjection=financeProjectionRanges.map(([from,to],index)=>{
    const start=addDaysIso(today(),from),end=addDaysIso(today(),to)
    const relevant=financeTitles.filter(t=>t.status!=='pago'&&t.status!=='cancelado'&&t.vencimento>=start&&t.vencimento<=end)
    const receber=relevant.filter(t=>t.tipo==='receber').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
    const pagar=relevant.filter(t=>t.tipo==='pagar').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
    return {label:index===0?'Próx. 7 dias':`${from+1}–${to+1} dias`,start,end,receber,pagar,liquido:receber-pagar}
  })
  const financeProjectionMax=Math.max(1,...financeProjection.flatMap(p=>[p.receber,p.pagar]))

  function setFinanceQuickRange(kind:'hoje'|'7d'|'30d'|'mes'){
    const base=today()
    if(kind==='hoje'){setFinanceStart(base);setFinanceEnd(base);return}
    if(kind==='7d'){setFinanceStart(base);setFinanceEnd(addDaysIso(base,6));return}
    if(kind==='30d'){setFinanceStart(base);setFinanceEnd(addDaysIso(base,29));return}
    setFinanceStart(monthStartIso(base));setFinanceEnd(monthEndIso(base))
  }
  function clearFinanceFilters(){
    setFinanceStart('');setFinanceEnd('');setFinanceStatusFilter('todos');setFinanceCategory('todos');setFinanceCenter('todos')
  }

  const dashboardSalesMonths=Array.from({length:6},(_,idx)=>{
    const d=new Date()
    d.setDate(1)
    d.setMonth(d.getMonth()-(5-idx))
    const year=d.getFullYear(),month=d.getMonth()
    const total=vendas.filter(v=>{
      const vd=new Date(v.created_at)
      return v.status!=='cancelado'&&vd.getFullYear()===year&&vd.getMonth()===month
    }).reduce((s,v)=>s+Number(v.total),0)
    return {label:d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),total}
  })
  const dashboardSalesMax=Math.max(1,...dashboardSalesMonths.map(m=>m.total))
  const dashboardStatusData=[
    {label:'Orçamentos',value:vendas.filter(v=>v.status==='orcamento').length,key:'quote'},
    {label:'Pedidos',value:vendas.filter(v=>v.status==='pedido').length,key:'order'},
    {label:'Faturadas',value:vendas.filter(v=>v.status==='faturado').length,key:'billed'},
    {label:'Canceladas',value:vendas.filter(v=>v.status==='cancelado').length,key:'cancelled'}
  ]
  const dashboardStatusMax=Math.max(1,...dashboardStatusData.map(s=>s.value))
  const dashboardFinanceData=[
    {label:'A receber',value:openReceivables,key:'in'},
    {label:'A pagar',value:openPayables,key:'out'}
  ]
  const dashboardFinanceMax=Math.max(1,...dashboardFinanceData.map(i=>i.value))
  const overdueTitles=titulos.filter(t=>t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0)
  const overdueReceivables=overdueTitles.filter(t=>t.tipo==='receber').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const overduePayables=overdueTitles.filter(t=>t.tipo==='pagar').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const saleLayoutEntries=saleLayoutEntriesFor(saleOrder)
  const saleSectionTotal=(sectionKey:string)=>{
    const sectionIndex=saleLayoutEntries.indexOf('section:'+sectionKey)
    if(sectionIndex<0)return 0
    let total=0
    for(let index=sectionIndex+1;index<saleLayoutEntries.length;index++){
      const entry=saleLayoutEntries[index]
      if(entry.startsWith('section:'))break
      if(!entry.startsWith('item:'))continue
      const item=saleItems.find(row=>'item:'+row.key===entry)
      if(item)total+=Math.max(0,Number(item.quantidade||0)*Number(item.valor_unitario||0)-Number(item.desconto||0))
    }
    return total
  }
  const saleSubtotal=saleItems.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
  const saleDiscount=saleItems.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
  const saleTotal=Math.max(0,saleSubtotal-saleDiscount)
  const saleConsumesStock=saleStatus==='pedido'||saleStatus==='faturado'
  const stockDemandForSaleItems=(items:Array<SaleItemDraft|VendaItem>)=>items.reduce<Record<string,number>>((acc,item)=>{
    const product=produtos.find(p=>p.id===item.produto_id)
    const qty=Number(item.quantidade||0)
    if(!product||qty<=0)return acc
    if(product.rastrear_estoque!==false){
      acc[item.produto_id]=(acc[item.produto_id]||0)+qty
      return acc
    }
    const recipe=Array.isArray(item.receita_producao)&&item.receita_producao.length
      ? item.receita_producao
      : produtoComponentes.filter(row=>row.produto_final_id===item.produto_id)
    recipe.forEach(row=>{
      const component=produtos.find(p=>p.id===row.componente_id)
      if(!component||component.rastrear_estoque===false)return
      const demand=qty*Number(row.quantidade||0)
      if(demand>0)acc[row.componente_id]=(acc[row.componente_id]||0)+demand
    })
    return acc
  },{})
  const saleDemandByProduct=stockDemandForSaleItems(saleItems)
  const originalSaleQtyByProduct=stockDemandForSaleItems(originalSaleItems)
  const saleStockShortages=Object.entries(saleDemandByProduct).flatMap(([produtoId,demand])=>{
    const produto=produtos.find(p=>p.id===produtoId)
    if(!produto)return []
    const available=Number(produto.estoque_atual)+(editingSale?Number(originalSaleQtyByProduct[produtoId]||0):0)
    return demand>available?[{produto,available,demand,missing:demand-available}]:[]
  })
  const saleBelowStockMinimum=Object.entries(saleDemandByProduct).flatMap(([produtoId,demand])=>{
    const produto=produtos.find(p=>p.id===produtoId)
    if(!produto)return []
    const available=Number(produto.estoque_atual)+(editingSale?Number(originalSaleQtyByProduct[produtoId]||0):0)
    const projected=available-demand
    const minimum=Math.max(0,Number(produto.estoque_minimo)||0)
    return projected>=0&&projected<minimum?[{produto,projected,minimum}]:[]
  })
  const salePriceMinimumIssues=saleItems.flatMap(item=>{
    const produto=produtos.find(p=>p.id===item.produto_id)
    if(!produto||!item.produto_id||Number(item.quantidade)<=0)return []
    const cost=Math.round(Number(produto.custo_medio??produto.custo??0)*100)/100
    const minimum=cost*(1+Number(produto.percentual_minimo_custo_venda??100)/100)
    const effective=Number(item.valor_unitario)-Math.min(Number(item.desconto||0),Number(item.valor_unitario)*Number(item.quantidade))/Number(item.quantidade)
    return effective+0.000001<minimum?[{produto,effective,minimum}]:[]
  })
  const saleDiscountPct=saleSubtotal>0?(saleDiscount/saleSubtotal)*100:0
  const saleCostTotal=saleItems.reduce((sum,item)=>{
    const product=produtos.find(p=>p.id===item.produto_id)
    return sum+Number(product?.custo_medio??product?.custo??0)*Number(item.quantidade||0)
  },0)
  const saleMarginPct=saleTotal>0?((saleTotal-saleCostTotal)/saleTotal)*100:0
  const selectedSaleClient=clientes.find(c=>c.id===saleClient)
  const saleClientLimit=Number(selectedSaleClient?.limite_credito||0)
  const saleHasPaidTitle=Boolean(editingSale&&financialTitlesForSale(editingSale.id).some(t=>Number(t.valor_pago)>0))
  const saleHasProof=Boolean(editingSale&&comprovantes.some(p=>p.venda_id===editingSale.id))
  const requiredSaleClient=String(empresa?.campos_obrigatorios?.venda_cliente??'false').toLowerCase()==='true'
  const requiredSaleSeller=String(empresa?.campos_obrigatorios?.venda_vendedor??'false').toLowerCase()==='true'
  const saleApprovalBlockers=saleStatus==='orcamento'?[]:[
    ...(!saleRoute?[{tipo:'dados_incompletos',label:'Rota de entrega não informada',detalhe:'A aprovação poderá avançar a venda sem rota definida.'}]:[]),
    ...(requiredSaleClient&&!saleClient?[{tipo:'dados_incompletos',label:'Cliente obrigatório não informado',detalhe:'Campo obrigatório ausente na venda.'}]:[]),
    ...(requiredSaleSeller&&!saleSeller?[{tipo:'dados_incompletos',label:'Vendedor obrigatório não informado',detalhe:'Campo obrigatório ausente na venda.'}]:[]),
    ...(salePriceMinimumIssues.length?[{tipo:'preco_minimo',label:'Preço abaixo do mínimo',detalhe:salePriceMinimumIssues.map(x=>`${x.produto.descricao}: ${money(x.effective)} / mín. ${money(x.minimum)}`).join(' • ')}]:[]),
    ...(saleDiscountPct>Number(empresa?.desconto_max_vendedor??10)?[{tipo:'desconto',label:'Desconto acima do limite',detalhe:`${saleDiscountPct.toFixed(2)}% / limite ${Number(empresa?.desconto_max_vendedor??10).toFixed(2)}%`}]:[]),
    ...(saleMarginPct<Number(empresa?.margem_minima_percentual??0)?[{tipo:'margem',label:'Margem abaixo do mínimo',detalhe:`${saleMarginPct.toFixed(2)}% / mínimo ${Number(empresa?.margem_minima_percentual??0).toFixed(2)}%`}]:[]),
    ...((empresa?.bloquear_cliente_inadimplente??true)&&Number(saleCreditState?.vencido||0)>0?[{tipo:'inadimplencia',label:'Cliente inadimplente',detalhe:`${money(Number(saleCreditState?.vencido||0))} em títulos vencidos.`}]:[]),
    ...((empresa?.exigir_aprovacao_limite_credito??true)&&saleClientLimit>0&&Number(saleCreditState?.em_aberto||0)+saleTotal>saleClientLimit?[{tipo:'limite_credito',label:'Limite de crédito excedido',detalhe:`Excesso de ${money(Number(saleCreditState?.em_aberto||0)+saleTotal-saleClientLimit)}.`}]:[]),
    ...(saleStockShortages.length?[{tipo:'estoque_negativo',label:'Estoque insuficiente',detalhe:saleStockShortages.map(x=>`${x.produto.descricao}: faltam ${x.missing.toLocaleString('pt-BR')} ${x.produto.unidade}`).join(' • ')}]:[]),
    ...(saleHasPaidTitle?[{tipo:'fatura_paga',label:'Fatura com pagamento registrado',detalhe:'A aprovação avançará o status preservando itens, valores e histórico financeiro já liquidados.'}]:[]),
    ...(saleHasProof?[{tipo:'comprovante_anexado',label:'Comprovante já anexado',detalhe:'A aprovação preservará o comprovante existente.'}]:[])
  ]
  const saleHasAuthorizationBlocker=saleApprovalBlockers.length>0
  const saleHasStructuralError=saleItems.length===0||saleItems.some(item=>!item.produto_id||Number(item.quantidade)<=0||!produtos.find(p=>p.id===item.produto_id&&p.ativo))
  function productionMaterialsForItem(item:SaleItemDraft){
    const produto=produtos.find(p=>p.id===item.produto_id)
    if(!produto||produto.tipo_produto!=='produto_final')return []
    return item.receita_producao
      .map(row=>{
        const componente=produtos.find(p=>p.id===row.componente_id)
        const quantidade=Number(row.quantidade)*Number(item.quantidade||0)
        const valorUnitario=Number(row.valor_unitario||0)
        return {row,componente,quantidade,valorUnitario,total:quantidade*valorUnitario}
      })
  }
  function saleItemStockInfo(item:SaleItemDraft){
    const produto=produtos.find(p=>p.id===item.produto_id)
    if(!produto)return null
    if(produto.rastrear_estoque===false)return {kind:'ok',label:'Estoque pela receita',detail:'O produto final não mantém saldo próprio; os materiais da receita serão baixados.'}
    const available=Number(produto.estoque_atual)+(editingSale?Number(originalSaleQtyByProduct[item.produto_id]||0):0)
    const demand=Number(saleDemandByProduct[item.produto_id]||0)
    if(available<=0)return {kind:'none',label:'Sem estoque',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade}`}
    if(demand>available)return {kind:'low',label:'Estoque insuficiente',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade} • solicitado: ${demand.toLocaleString('pt-BR')}`}
    return {kind:'ok',label:'Em estoque',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade}`}
  }
  const purchaseSuggestions=produtos
    .filter(p=>p.ativo&&p.rastrear_estoque!==false&&p.tipo_produto!=='servico'&&Number(p.estoque_atual)<=Number(p.estoque_minimo))
    .map(p=>{
      const current=Number(p.estoque_atual)||0
      const minimum=Math.max(0,Number(p.estoque_minimo)||0)
      const configuredTarget=Math.max(0,Number(p.estoque_reposicao)||0)
      const target=configuredTarget>minimum?configuredTarget:minimum*2
      const suggested=Math.max(0,target-current)
      return {produto:p,current,minimum,target,suggested}
    })
    .filter(s=>s.suggested>0)
    .sort((a,b)=>(a.current-a.minimum)-(b.current-b.minimum))
  const purchaseSuggestionGroups=Array.from(purchaseSuggestions.reduce((groups,item)=>{
    const groupId=item.produto.grupo_id||''
    const group=gruposProdutos.find(g=>g.id===groupId)
    const key=group?.id||'sem-grupo'
    const entry=groups.get(key)||{id:key,name:group?.nome||'Sem grupo',items:[] as typeof purchaseSuggestions,total:0}
    entry.items.push(item)
    entry.total+=item.suggested*Number(item.produto.custo||0)
    groups.set(key,entry)
    return groups
  },new Map<string,{id:string;name:string;items:typeof purchaseSuggestions;total:number}>()).values())
    .sort((a,b)=>a.id==='sem-grupo'?1:b.id==='sem-grupo'?-1:a.name.localeCompare(b.name,'pt-BR'))
  const selectedSuggestions=purchaseSuggestions.filter(item=>selectedPurchaseSuggestions[item.produto.id])
  const purchaseSuggestionTotal=purchaseSuggestions.reduce((sum,s)=>sum+s.suggested*Number(s.produto.custo||0),0)
  const purchaseTotal=purchaseItems.reduce((s,i)=>s+i.quantidade*i.custo_unitario,0)

  const filteredSales=vendas.filter(v=>{const d=v.created_at.slice(0,10);return d>=reportStart&&d<=reportEnd&&(reportStatus==='todos'||v.status===reportStatus)})
  const filteredPurchases=compras.filter(c=>{const d=c.created_at.slice(0,10);return d>=reportStart&&d<=reportEnd})
  const reportSalesTotal=filteredSales.filter(v=>v.status!=='cancelado').reduce((s,v)=>s+Number(v.total),0)
  const reportPurchaseTotal=filteredPurchases.filter(c=>c.status!=='cancelada').reduce((s,c)=>s+Number(c.total),0)

  const normalizeSearch=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const searchMatches=(key:string,values:unknown[])=>{
    const query=normalizeSearch(tableSearch[key]||'').trim()
    if(!query)return true
    return normalizeSearch(values.join(' ')).includes(query)
  }
  const setSearch=(key:string,value:string)=>setTableSearch(prev=>({...prev,[key]:value}))
  const toggleSort=(table:string,key:string)=>setTableSort(prev=>{
    const current=prev[table]
    return {...prev,[table]:{key,dir:current?.key===key&&current.dir==='asc'?'desc':'asc'}}
  })
  const sortMark=(table:string,key:string)=>tableSort[table]?.key===key?(tableSort[table].dir==='asc'?' ▲':' ▼'):''
  const sortList=<T,>(table:string,rows:T[],getters:Record<string,(row:T)=>string|number|null|undefined>)=>{
    const sort=tableSort[table]
    if(!sort||!getters[sort.key])return rows
    const getter=getters[sort.key]
    const compare=(a:T,b:T)=>{
      const av=getter(a),bv=getter(b)
      let cmp=0
      if(typeof av==='number'&&typeof bv==='number')cmp=av-bv
      else cmp=String(av??'').localeCompare(String(bv??''),'pt-BR',{numeric:true,sensitivity:'base'})
      return sort.dir==='asc'?cmp:-cmp
    }
    return [...rows].sort(compare)
  }

  const commissionReceived=comissoes.reduce((s,c)=>s+Number(c.total_recebido),0)
  const commissionTotal=comissoes.reduce((s,c)=>s+Number(c.comissao_apurada),0)
  const salesWithoutSeller=vendas.filter(v=>v.status!=='cancelado'&&!v.vendedor_cadastro_id).length
  const pendingPurchases=compras.filter(c=>c.status==='pedido_aprovado')
  const purchaseTabRows=purchaseTab==='a_receber'?pendingPurchases:compras
  const visiblePurchases=sortList('compras',purchaseTabRows.filter(c=>{const f=fornecedores.find(x=>x.id===c.fornecedor_id);return searchMatches('compras',[purchaseCode(c.fatura_numero),financialInvoiceCode(c.fatura_numero),new Date(c.created_at).toLocaleString('pt-BR'),f?.nome||'Sem fornecedor',c.status,paymentLabel(c.forma_pagamento),c.parcelas,money(Number(c.total))])}),{
    codigo:c=>Number(c.fatura_numero||0),fatura:c=>Number(c.fatura_numero||0),data:c=>c.created_at,fornecedor:c=>fornecedores.find(x=>x.id===c.fornecedor_id)?.nome||'',status:c=>c.status,pagamento:c=>paymentLabel(c.forma_pagamento),total:c=>Number(c.total)
  })
  const pendingSaleApproval=(saleId:string)=>saleApprovals.find(a=>a.entidade_id===saleId)
  const saleStatusDisplay=(v:Venda)=>pendingSaleApproval(v.id)&&v.status==='orcamento'?'Orçamento • aguardando aprovação':v.status==='orcamento'?'Orçamento':v.status==='pedido'?'Pedido':v.status==='faturado'?'Faturado':'Cancelado'
  const filteredSalesList=sortList('vendas',vendas.filter(v=>{
    const client=clientes.find(x=>x.id===v.cliente_id)
    const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id)
    const ps=salePaymentStatus(v)
    return (saleStatusFilter==='todos'||v.status===saleStatusFilter)
      &&(salePaymentFilter==='todos'||v.forma_pagamento===salePaymentFilter)
      &&(salePaymentStateFilter==='todos'||ps.key===salePaymentStateFilter)
      &&(saleRouteFilter==='todos'||v.rota_entrega===saleRouteFilter)
      &&searchMatches('vendas',[saleCode(v.venda_numero),new Date(v.created_at).toLocaleString('pt-BR'),client?.nome||'Consumidor',seller?.nome||'',saleStatusDisplay(v),deliveryRouteLabel(v.rota_entrega),paymentLabel(v.forma_pagamento),v.parcelas,saleInvoiceStatus(v).label,ps.label,money(Number(v.total))])
  }),{
    fatura:v=>Number(v.venda_numero||0),data:v=>v.created_at,cliente:v=>clientes.find(x=>x.id===v.cliente_id)?.nome||'Consumidor',rota:v=>deliveryRouteLabel(v.rota_entrega),vendedor:v=>vendedores.find(x=>x.id===v.vendedor_cadastro_id)?.nome||'',status:v=>saleStatusDisplay(v),pagamento:v=>paymentLabel(v.forma_pagamento),faturamento:v=>saleInvoiceStatus(v).label,statuspag:v=>salePaymentStatus(v).label,total:v=>Number(v.total)
  })
  const saleTotalPages=Math.max(1,Math.ceil(filteredSalesList.length/salePageSize))
  const safeSalePage=Math.min(salePage,saleTotalPages)
  const saleStart=(safeSalePage-1)*salePageSize
  const visibleSales=filteredSalesList.slice(saleStart,saleStart+salePageSize)
  const salePageNumbers=Array.from({length:saleTotalPages},(_,i)=>i+1).filter(p=>p===1||p===saleTotalPages||Math.abs(p-safeSalePage)<=1)
  const salesMonthKey=today().slice(0,7)
  const salesMonthRows=vendas.filter(v=>v.created_at.slice(0,7)===salesMonthKey&&['pedido','faturado'].includes(v.status))
  const salesMonthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date())
  const salesMonthBySeller=vendedores
    .filter(s=>s.ativo||salesMonthRows.some(v=>v.vendedor_cadastro_id===s.id))
    .map(s=>{
      const rows=salesMonthRows.filter(v=>v.vendedor_cadastro_id===s.id)
      return {id:s.id,nome:s.nome,total:rows.reduce((sum,v)=>sum+Number(v.total||0),0),quantidade:rows.length}
    })
    .filter(item=>item.quantidade>0)
    .sort((a,b)=>b.total-a.total)
  const approvedBillingSales=vendas.filter(v=>['pedido','faturado'].includes(v.status)||faturasVendas.some(f=>f.venda_id===v.id))
  const billingSales=approvedBillingSales.filter(v=>{
    const invoiceState=saleInvoiceStatus(v)
    const client=clientes.find(c=>c.id===v.cliente_id)?.nome||'Consumidor'
    const seller=vendedores.find(s=>s.id===v.vendedor_cadastro_id)?.nome||''
    const matchStatus=billingStatusFilter==='todos'||invoiceState.key===billingStatusFilter
    const q=billingSearch.trim().toLowerCase()
    const matchSearch=!q||[saleCode(v.venda_numero),client,seller,paymentLabel(v.forma_pagamento),invoiceState.label,money(Number(v.total))].join(' ').toLowerCase().includes(q)
    return matchStatus&&matchSearch
  })
  const billingCounts={
    todos:approvedBillingSales.length,
    naoFaturado:approvedBillingSales.filter(v=>saleInvoiceStatus(v).key==='nao-faturado').length,
    faturado:approvedBillingSales.filter(v=>saleInvoiceStatus(v).key==='faturado').length,
    cancelado:approvedBillingSales.filter(v=>saleInvoiceStatus(v).key==='cancelado').length
  }
  const openedSale=salePanel?vendas.find(v=>v.id===salePanel)||null:null
  const visibleSellers=sortList('comissoes',vendedores.filter(v=>{const summary=comissoes.find(c=>c.vendedor_id===v.id);return searchMatches('comissoes',[v.nome,v.email||'',v.telefone||'',v.percentual_comissao,money(Number(summary?.total_recebido||0)),money(Number(summary?.comissao_apurada||0)),summary?.pagamentos||0,summary?.vendas||0,v.ativo?'ativo':'inativo'])}),{
    vendedor:v=>v.nome,percentual:v=>Number(v.percentual_comissao),recebido:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.total_recebido||0),comissao:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.comissao_apurada||0),recebimentos:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.pagamentos||0),vendas:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.vendas||0),status:v=>v.ativo?'ativo':'inativo'
  })

  function financialTitlesForSale(id:string){return titlesForSale(id,titulos,faturasVendas,faturaVendaItens)}
  function salePaymentStatus(venda:Venda){
    const related=financialTitlesForSale(venda.id)
    if(venda.status==='cancelado'||(related.length>0&&related.every(t=>t.status==='cancelado'))){
      return {label:'Cancelado',key:'cancelado'}
    }
    if(!related.length)return venda.status==='orcamento'
      ? {label:'Não pago',key:'nao-pago'}
      : {label:'Não pago',key:'nao-pago'}

    const valid=related.filter(t=>t.status!=='cancelado')
    if(!valid.length)return {label:'Não pago',key:'nao-pago'}

    const total=valid.reduce((s,t)=>s+Number(t.valor),0)
    const paid=valid.reduce((s,t)=>s+Number(t.valor_pago),0)

    if(total>0&&paid>=total-0.005)return {label:'Pago',key:'pago'}
    if(paid>0)return {label:'Parcial',key:'parcial'}
    return {label:'Não pago',key:'nao-pago'}
  }
  function invoicesForSale(vendaId:string){
    const linkedIds=faturaVendaItens.filter(i=>i.venda_id===vendaId).map(i=>i.fatura_id)
    return faturasVendas.filter(f=>f.venda_id===vendaId||linkedIds.includes(f.id))
  }
  function activeInvoiceForSale(vendaId:string){
    return invoicesForSale(vendaId).find(f=>f.status==='ativa')||null
  }
  function lastCancelledInvoiceForSale(vendaId:string){
    return invoicesForSale(vendaId).filter(f=>f.status==='cancelada').sort((a,b)=>b.criada_em.localeCompare(a.criada_em))[0]||null
  }
  function saleInvoiceStatus(venda:Venda){
    const activeInvoice=activeInvoiceForSale(venda.id)
    if(activeInvoice)return {label:'Faturado',key:'faturado',invoice:activeInvoice}
    const cancelled=lastCancelledInvoiceForSale(venda.id)
    if(cancelled)return {label:'Fatura cancelada',key:'cancelado',invoice:cancelled}
    return {label:'Não faturado',key:'nao-faturado',invoice:null}
  }
  function buildBillingLinesForTotal(total:number,count:number,firstDate=today(),intervalDays?:number){
    const totalCents=Math.round(total*100)
    const base=Math.floor(totalCents/count)
    return Array.from({length:count},(_,index)=>({
      key:crypto.randomUUID(),
      vencimento:intervalDays?addDaysIso(firstDate,intervalDays*(index+1)):addMonthsIso(firstDate,index),
      valor:(index===count-1?totalCents-base*(count-1):base)/100
    }))
  }
  function buildBillingLines(venda:Venda,count=Math.max(1,Number(venda.parcelas)||1)){
    return buildBillingLinesForTotal(Number(venda.total),count)
  }
  function openBillingSale(venda:Venda){
    if(!canManageFinance){setMsg('Seu perfil possui somente visualização no Financeiro.');return}
    if(!['pedido','faturado'].includes(venda.status)){setMsg('Somente vendas aprovadas podem ser faturadas.');return}
    if(activeInvoiceForSale(venda.id)){setMsg('Esta venda já possui fatura ativa.');return}
    setBillingInvoiceSaleIds([venda.id]);setBillingError('')
    setBillingSale(venda)
    setBillingPayment(venda.forma_pagamento||'pix')
    setBillingLines(buildBillingLines(venda,venda.forma_pagamento==='dinheiro'?1:Math.max(1,Number(venda.parcelas)||1)))
    setMsg('')
  }
  function toggleBillingSale(venda:Venda){
    if(!canManageFinance||billingBusy||!['pedido','faturado'].includes(venda.status))return
    if(activeInvoiceForSale(venda.id))return
    setBillingSelectedSales(prev=>{
      if(prev.includes(venda.id))return prev.filter(id=>id!==venda.id)
      const selected=vendas.filter(v=>prev.includes(v.id))
      if(selected.length&&selected[0].cliente_id!==venda.cliente_id){
        setMsg('Selecione apenas vendas do mesmo cliente para gerar uma fatura única.')
        return prev
      }
      return [...prev,venda.id]
    })
  }
  function openSelectedBillingSales(){
    if(!canManageFinance||!billingSelectedSales.length)return
    const selected=vendas.filter(v=>billingSelectedSales.includes(v.id))
    if(!selected.length)return
    if(selected.some(v=>activeInvoiceForSale(v.id))){setMsg('Uma das vendas selecionadas já possui fatura ativa.');return}
    if(new Set(selected.map(v=>v.cliente_id)).size>1){setMsg('Todas as vendas selecionadas devem ser do mesmo cliente.');return}
    const primary=selected[0]
    const total=selected.reduce((sum,v)=>sum+Number(v.total),0)
    setBillingInvoiceSaleIds(selected.map(v=>v.id));setBillingError('')
    setBillingSale(primary)
    setBillingPayment(primary.forma_pagamento||'boleto')
    setBillingLines(buildBillingLinesForTotal(total,primary.forma_pagamento==='dinheiro'?1:Math.max(1,Number(primary.parcelas)||1)))
    setMsg('')
  }
  function selectedBillingSales(){
    return vendas.filter(v=>billingSelectedSales.includes(v.id))
  }
  function selectedBillingTotal(){
    return selectedBillingSales().reduce((sum,v)=>sum+Number(v.total),0)
  }

  function invoiceBillingTotal(){return vendas.filter(v=>billingInvoiceSaleIds.includes(v.id)).reduce((sum,v)=>sum+Number(v.total),0)}
  function closeBilling(){if(billingBusy)return;setBillingSale(null);setBillingLines([]);setBillingInvoiceSaleIds([]);setBillingError('')}
  function resizeBillingLines(count:number){
    if(!billingSale)return
    setBillingError('')
    const total=invoiceBillingTotal()
    setBillingLines(buildBillingLinesForTotal(total,Math.max(1,count)))
  }
  function setBillingTerms306090(){
    if(!billingSale)return
    setBillingError('')
    const total=invoiceBillingTotal()
    setBillingPayment('boleto')
    setBillingLines(buildBillingLinesForTotal(total,3,today(),30))
  }
  function updateBillingLine(key:string,field:'vencimento'|'valor',value:string|number){
    setBillingError('')
    setBillingLines(lines=>lines.map(line=>line.key===key?{...line,[field]:field==='valor'?Math.max(0,Number(value)||0):String(value)}:line))
  }
  async function createSaleInvoice(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!billingSale||billingBusy||!canManageFinance)return
    const selectedIds=billingInvoiceSaleIds
    try{validateBilling(selectedIds,vendas,faturasVendas,faturaVendaItens,billingPayment,billingLines)}
    catch(error){setBillingError((error as Error).message);return}
    setBillingError('')
    setBillingBusy(true);setMsg('')
    try{
      const {data,error}=await supabase.rpc('criar_fatura_vendas',{
        p_venda_ids:selectedIds,
        p_forma_pagamento:billingPayment,
        p_parcelas:billingLines.map(line=>({vencimento:line.vencimento,valor:Number(line.valor)}))
      })
      if(error)throw error
      if(!data?.fatura_id)throw new Error('O servidor não confirmou a fatura. Atualize a lista antes de tentar novamente.')
      setBillingInvoiceSaleIds([]);setBillingSale(null);setBillingLines([]);setBillingSelectedSales([])
      const paid=Boolean((data as {pago?:boolean}|null)?.pago)
      setMsg(paid?'Fatura criada e recebimento em dinheiro registrado automaticamente no Caixa.':'Fatura criada e parcelas enviadas para Contas a Receber.')
      await refreshFinance()
    }catch(error){setBillingError(error instanceof Error?error.message:(error as {message?:string})?.message||'Não foi possível criar a fatura.')}finally{setBillingBusy(false)}
  }
  async function cancelSaleInvoice(venda:Venda){
    const invoice=activeInvoiceForSale(venda.id)
    if(!invoice||!canManageFinance)return
    const motivo=window.prompt('Motivo do cancelamento da fatura:')
    if(motivo===null)return
    setBillingBusy(true);setMsg('')
    try{
      const {error}=await supabase.rpc('cancelar_fatura_venda',{p_fatura_id:invoice.id,p_motivo:motivo})
      if(error)throw error
      setMsg('Fatura cancelada. O histórico foi preservado.')
      await refreshFinance()
    }catch(error){setMsg(error instanceof Error?error.message:(error as {message?:string})?.message||'Não foi possível cancelar a fatura.')}finally{setBillingBusy(false)}
  }
  function clientReceivableSummary(client:Cliente){
    const clientSaleIds=new Set(vendas.filter(v=>v.cliente_id===client.id).map(v=>v.id))
    const clientName=String(client.nome||'').trim().toLocaleLowerCase('pt-BR')
    const open=titulos.filter(t=>{
      if(t.tipo!=='receber'||t.status==='pago'||t.status==='cancelado')return false
      const saldo=Math.max(0,Number(t.valor)-Number(t.valor_pago))
      if(saldo<=0)return false
      if(t.venda_id&&clientSaleIds.has(t.venda_id))return true
      return !t.venda_id&&String(t.entidade_nome||'').trim().toLocaleLowerCase('pt-BR')===clientName
    })
    return open.reduce((acc,t)=>{
      const saldo=Math.max(0,Number(t.valor)-Number(t.valor_pago))
      if(t.vencimento<today())acc.vencido+=saldo
      else acc.aVencer+=saldo
      return acc
    },{aVencer:0,vencido:0})
  }

  function nameInitials(name:string){
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean)
    if(!parts.length)return '?'
    return (parts[0][0]+(parts.length>1?parts[parts.length-1][0]:'')).toUpperCase()
  }

  function proofPanel(kind:'venda'|'compra',id:string){
    const list=proofsFor(kind,id)
    return <div className="proofPanel">
      <div className="proofHead">
        <div><strong>Comprovantes de pagamento</strong><span>{list.length?String(list.length)+' arquivo(s) anexado(s)':'Nenhum comprovante anexado'}</span></div>
        {((kind==='venda'&&canManageSales)||(kind==='compra'&&canManagePurchases))&&<label className="ghost proofUpload iconOnlyProof" title="Anexar comprovante" aria-label="Anexar comprovante"><Paperclip size={15}/><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>void uploadProof(kind,id,e)}/></label>}
      </div>
      {list.length>0&&<div className="proofList">{list.map(p=><div className="proofItem" key={p.id}>
        <div><strong>{p.nome_arquivo}</strong><span>{dateBr(p.created_at)}{p.tamanho?' • '+(Number(p.tamanho)/1024).toFixed(0)+' KB':''}</span></div>
        <div className="rowActions">
          <button type="button" className="ghost" onClick={()=>void openProof(p)}><ExternalLink size={14}/>Abrir</button>
          {canManageFinance&&<button type="button" className="dangerAction" onClick={()=>void deleteProof(p)}><Trash2 size={14}/>Excluir</button>}
        </div>
      </div>)}</div>}
    </div>
  }

  function titleOrigin(t:Titulo){
    return financeOriginLabel(t,vendas,compras,faturasVendas,faturaVendaItens)
  }
  function openFinanceOrigin(kind:'venda'|'compra',id:string){
    const module=kind==='venda'?'vendas':'compras'
    if(!canViewModule(module))return
    closeForms()
    setFinancePanel(null)
    setFinancePanelReturnModule(null)
    setFinancePanelReturnSubtab(null)
    setShowApps(false)
    setMsg('')
    setActive(module)
    if(kind==='venda')setSalePanel(id)
    else{setPurchaseTab('todas');setSearch('compras','');setPurchasePanel(id)}
  }
  function financeOriginLinks(t:Titulo){
    const documents=financeOriginDocuments(t,vendas,compras,faturasVendas,faturaVendaItens)
    return <span className="financeOriginLinks"><span>Origem:</span>{documents.length?documents.map(doc=>{
      const code=doc.kind==='venda'?saleCode(doc.number):purchaseCode(doc.number)
      const label=(doc.kind==='venda'?'Venda ':'Compra ')+code
      return canViewModule(doc.kind==='venda'?'vendas':'compras')
        ? <button type="button" key={doc.kind+doc.id} className="financeOriginLink" onClick={event=>{event.stopPropagation();openFinanceOrigin(doc.kind,doc.id)}} onDoubleClick={event=>event.stopPropagation()} title={'Abrir '+label} aria-label={'Abrir '+label}>{label}<ExternalLink size={12}/></button>
        : <span key={doc.kind+doc.id}>{label}</span>
    }):<span>{titleOrigin(t)}</span>}</span>
  }

  function mapFinanceReportRows(rows:Titulo[]){
    return rows.map(t=>({
      descricao:t.descricao,
      origem:titleOrigin(t),
      entidade:t.entidade_nome||'—',
      vencimento:t.vencimento,
      valor:Number(t.valor),
      pago:Number(t.valor_pago),
      saldo:Math.max(0,Number(t.valor)-Number(t.valor_pago)),
      status:t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'?'Vencido':financeStatusLabel(t.status),
      categoria:t.categoria||'—',
      centro_custo:t.centro_custo||'—',
      forma_pagamento:t.forma_pagamento||'—',
      tipo:t.tipo,
      funcionario_tipo:t.tipo_funcionario||null,
      competencia:t.competencia||null,
      vale_descontado_em:t.vale_descontado_em||null
    }))
  }

  function filteredFinanceRows(type?:'receber'|'pagar',overdueOnly=false){
    return financeTitles
      .filter(t=>!type||t.tipo===type)
      .filter(t=>!overdueOnly||(t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0))
      .filter(t=>financeStatusFilter==='todos'||t.status===financeStatusFilter)
      .filter(t=>!financeStart||t.vencimento>=financeStart)
      .filter(t=>!financeEnd||t.vencimento<=financeEnd)
      .filter(t=>financeCategory==='todos'||t.categoria===financeCategory)
      .filter(t=>financeCenter==='todos'||t.centro_custo===financeCenter)
  }

  async function downloadFinancePdf(kind:'geral'|'receber'|'pagar'|'vencidos'|'funcionarios'|'vales'){
    try{
      const mod=await import('./lib/financeReportPdf')
      const filters=[
        'Status: '+(financeStatusFilter==='todos'?'Todos':financeStatusLabel(financeStatusFilter)),
        'Categoria: '+(financeCategory==='todos'?'Todas':financeCategory),
        'Centro: '+(financeCenter==='todos'?'Todos':financeCenter)
      ]
      const base={company:empresa,inicio:financeStart||undefined,fim:financeEnd||undefined,filters}
      if(kind==='geral'){
        const receivable=filteredFinanceRows('receber')
        const payable=filteredFinanceRows('pagar')
        const overdue=filteredFinanceRows(undefined,true)
        mod.generateFinanceReportPdf({
          ...base,
          title:'Relatório Financeiro Consolidado',
          filename:'relatorio-financeiro-consolidado',
          summary:[
            {label:'A receber em aberto',value:money(openReceivables)},
            {label:'A pagar em aberto',value:money(openPayables)},
            {label:'Total vencido',value:money(overdueReceivables+overduePayables)},
            {label:'Resultado líquido',value:money(openReceivables-openPayables)}
          ],
          sections:[
            {title:'Contas a receber',rows:mapFinanceReportRows(receivable)},
            {title:'Contas a pagar',rows:mapFinanceReportRows(payable)},
            {title:'Vencidos',rows:mapFinanceReportRows(overdue)}
          ]
        })
      }else if(kind==='receber'){
        const rows=filteredFinanceRows('receber')
        mod.generateFinanceReportPdf({...base,title:'Relatório de Contas a Receber',filename:'relatorio-contas-a-receber',sections:[{title:'Contas a receber',rows:mapFinanceReportRows(rows)}]})
      }else if(kind==='pagar'){
        const rows=filteredFinanceRows('pagar')
        mod.generateFinanceReportPdf({...base,title:'Relatório de Contas a Pagar',filename:'relatorio-contas-a-pagar',sections:[{title:'Contas a pagar',rows:mapFinanceReportRows(rows)}]})
      }else if(kind==='vencidos'){
        const rows=filteredFinanceRows(undefined,true)
        mod.generateFinanceReportPdf({...base,title:'Relatório de Contas Vencidas',filename:'relatorio-contas-vencidas',sections:[
          {title:'Vencidos a receber',rows:mapFinanceReportRows(rows.filter(t=>t.tipo==='receber'))},
          {title:'Vencidos a pagar',rows:mapFinanceReportRows(rows.filter(t=>t.tipo==='pagar'))}
        ]})
      }else if(kind==='funcionarios'){
        const rows=titulos.filter(t=>t.tipo_funcionario==='gasto')
        mod.generateFinanceReportPdf({...base,title:'Relatório de Gastos com Funcionários',filename:'relatorio-gastos-funcionarios',sections:[{title:'Gastos com funcionários',rows:mapFinanceReportRows(rows)}]})
      }else{
        const rows=titulos.filter(t=>t.tipo_funcionario==='vale')
        mod.generateFinanceReportPdf({...base,title:'Relatório de Vales de Funcionários',filename:'relatorio-vales-funcionarios',sections:[{title:'Vales de funcionários',rows:mapFinanceReportRows(rows)}]})
      }
      setMsg('Relatório financeiro gerado em PDF.')
    }catch{
      setMsg('Não foi possível gerar o relatório financeiro em PDF.')
    }
  }

  function financeTable(type:'receber'|'pagar',overdueOnly=false){
    const searchKey=(overdueOnly?'financeiro-vencidos-':'financeiro-')+(type==='receber'?'receber':'pagar')
    const baseRows=financeTitles
      .filter(t=>t.tipo===type)
      .filter(t=>!overdueOnly||(t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0))
      .filter(t=>financeStatusFilter==='todos'||t.status===financeStatusFilter)
      .filter(t=>!financeStart||t.vencimento>=financeStart)
      .filter(t=>!financeEnd||t.vencimento<=financeEnd)
      .filter(t=>financeCategory==='todos'||t.categoria===financeCategory)
      .filter(t=>financeCenter==='todos'||t.centro_custo===financeCenter)
    const rows=sortList(searchKey,baseRows.filter(t=>searchMatches(searchKey,[t.descricao,titleOrigin(t),t.entidade_nome||'',dateBr(t.vencimento),money(Number(t.valor)),money(Number(t.valor_pago)),money(Math.max(0,Number(t.valor)-Number(t.valor_pago))),financeStatusLabel(t.status),t.categoria||'',t.centro_custo||'',t.forma_pagamento||'',t.parcela_numero||''])),{
      descricao:t=>t.descricao,entidade:t=>t.entidade_nome||'',vencimento:t=>t.vencimento,valor:t=>Number(t.valor),pago:t=>Number(t.valor_pago),saldo:t=>Math.max(0,Number(t.valor)-Number(t.valor_pago)),status:t=>t.status
    })
    const groupTitle=overdueOnly?(type==='receber'?'Vencidos a receber':'Vencidos a pagar'):(type==='receber'?'Contas a receber':'Contas a pagar')
    const empty=overdueOnly?(type==='receber'?'Nenhuma conta a receber vencida com estes filtros.':'Nenhuma conta a pagar vencida com estes filtros.'):(type==='receber'?'Nenhuma conta a receber com estes filtros.':'Nenhuma conta a pagar com estes filtros.')
    return <article className={'panel tablePanel financeGroup '+(type==='receber'?'financeReceivableGroup':'financePayableGroup')}>
      <div className="panelHead"><div><h3>{groupTitle}</h3><p>{rows.length} lançamento(s) exibido(s)</p></div><div className="financeTableActions"><button type="button" className="ghost" onClick={()=>void downloadFinancePdf(overdueOnly?'vencidos':type)}><FileDown size={15}/>PDF</button><SearchField value={tableSearch[searchKey]||''} onChange={v=>setSearch(searchKey,v)} placeholder="Pesquisar em todas as colunas"/></div></div>
      <div className="tableWrap"><table>
        <thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'descricao')}>Descrição{sortMark(searchKey,'descricao')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'entidade')}>Cliente / Fornecedor{sortMark(searchKey,'entidade')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'vencimento')}>Vencimento{sortMark(searchKey,'vencimento')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'valor')}>Valor{sortMark(searchKey,'valor')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'pago')}>{type==='receber'?'Recebido':'Pago'}{sortMark(searchKey,'pago')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'saldo')}>Saldo{sortMark(searchKey,'saldo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort(searchKey,'status')}>Status{sortMark(searchKey,'status')}</button></th><th>Gerenciar</th></tr></thead>
        <tbody>
          {rows.length===0&&<tr className="emptyTableRow"><td colSpan={8}><EmptyState message={empty} actionLabel={canManageFinance?'+ Adicionar Lançamento':undefined} onAction={startNewTitle}/></td></tr>}
          {rows.map(t=>{
            const opened=financePanel===t.id
            const balance=Math.max(0,Number(t.valor)-Number(t.valor_pago))
            const linked=Boolean(t.venda_id||t.compra_id||t.fatura_venda_id||t.funcionario_id)
            const invoice=t.fatura_venda_id?faturasVendas.find(f=>f.id===t.fatura_venda_id):undefined
            const invoiceTitles=t.fatura_venda_id
              ? financeTitles.filter(item=>item.fatura_venda_id===t.fatura_venda_id).sort((a,b)=>Number(a.parcela_numero||0)-Number(b.parcela_numero||0)||a.vencimento.localeCompare(b.vencimento))
              : [t]
            const invoiceTotal=invoiceTitles.reduce((sum,item)=>sum+Number(item.valor||0),0)
            const invoicePaid=invoiceTitles.reduce((sum,item)=>sum+Number(item.valor_pago||0),0)
            const invoiceBalance=Math.max(0,invoiceTotal-invoicePaid)
            const invoiceTitle=invoice
              ? financialInvoiceCode(invoice.numero)
              : t.descricao
            return <Fragment key={t.id}>
              <tr {...recordRow(()=>{if(financePanel!==t.id)openFinancePanel(t)},t.descricao)} className={'recordRow '+(t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'?'overdueRow':'')}>
                <td><div className="financeTitleDescription">{t.descricao}{financeOriginLinks(t)}</div></td>
                <td>{t.entidade_nome||'—'}</td>
                <td><span className={t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'?'overdueDate':''}>{dateBr(t.vencimento)}</span></td>
                <td><strong>{money(Number(t.valor))}</strong></td>
                <td>{money(Number(t.valor_pago))}</td>
                <td><strong>{money(balance)}</strong></td>
                <td><span className={'statusBadge '+financeStatusClass(t.status)}>{financeStatusLabel(t.status)}</span></td>
                <td>{!canManageFinance?<span className="readOnlyTag">Somente leitura</span>:<button className="rowMenuBtn" onClick={()=>openFinancePanel(t)} title="Opções" aria-label="Abrir opções" aria-expanded={opened}><MoreVertical size={18}/></button>}</td>
              </tr>
              {canManageFinance&&opened&&<tr className="manageRow"><td colSpan={8}>
                <div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={t.descricao}>
                  <div className="recordDetailBackdrop" onClick={closeFinancePanel}/>
                  <div className="recordDetailSheet">
                    <div className="recordDetailHeader"><strong>{invoiceTitle}</strong><button type="button" className="recordDetailClose" onClick={closeFinancePanel}><X size={17}/>Fechar</button></div>
                    <div className="financeManagePanel">
                  {invoiceTitles.length>1&&<div className="financeInvoiceNavigator">
                    <div className="financeInvoiceNavigatorSummary">
                      <div><span>Fatura</span><strong>{invoiceTitle}</strong></div>
                      <div><span>Total</span><strong>{money(invoiceTotal)}</strong></div>
                      <div><span>Recebido</span><strong>{money(invoicePaid)}</strong></div>
                      <div><span>Saldo</span><strong>{money(invoiceBalance)}</strong></div>
                    </div>
                    <div className="financeInvoiceInstallments" aria-label="Parcelas da fatura">
                      {invoiceTitles.map((item,index)=>{
                        const itemBalance=Math.max(0,Number(item.valor)-Number(item.valor_pago))
                        const active=item.id===t.id
                        return <button type="button" key={item.id} className={active?'financeInvoiceInstallment active':'financeInvoiceInstallment'} onClick={()=>selectFinanceTitleInPanel(item)}>
                          <span>Parcela {item.parcela_numero||index+1}/{invoiceTitles.length}</span>
                          <strong>{money(Number(item.valor))}</strong>
                          <small>{dateBr(item.vencimento)} · {itemBalance<=0?'Pago':financeStatusLabel(item.status)}</small>
                        </button>
                      })}
                    </div>
                  </div>}
                  <div className="actionPanel">
                    <div className="actionMeta">
                      <strong>{invoiceTitles.length>1?`Parcela ${t.parcela_numero||1}/${invoiceTitles.length}`:t.descricao}</strong>
                      <span>Vencimento {dateBr(t.vencimento)} • saldo {money(balance)}</span>
                      {financeOriginLinks(t)}
                    </div>
                    <div className="rowActions">
                      <button className="ghost" onClick={()=>startEditTitle(t)}><Pencil size={15}/>{linked?'Classificar':'Editar'}</button>
                      {t.fatura_venda_id&&(()=>{const invoice=faturasVendas.find(f=>f.id===t.fatura_venda_id);return invoice?<button type="button" className="documentPrintButton" onClick={()=>void printFinancialInvoicePdf(invoice)}><Printer size={15}/>Imprimir PDF da fatura</button>:null})()}
                      {!linked&&<button className="warningBtn" disabled={t.status==='cancelado'} onClick={()=>void cancelTitle(t)}><Ban size={15}/>Cancelar</button>}
                      {!linked&&isAdmin&&canManageFinance&&<button className="dangerAction" onClick={()=>void deleteTitle(t)}><Trash2 size={15}/>Excluir</button>}
                    </div>
                  </div>

                  <div className="financePanelTabs">
                    <button type="button" className={financePanelTab==='detalhes'?'active':''} onClick={()=>setFinancePanelTab('detalhes')}>Detalhes</button>
                    <button type="button" className={financePanelTab==='pagamentos'?'active':''} onClick={()=>setFinancePanelTab('pagamentos')}>Pagamentos</button>
                    {linked&&<button type="button" className={financePanelTab==='comprovantes'?'active':''} onClick={()=>setFinancePanelTab('comprovantes')}>Comprovantes</button>}
                  </div>

                  {financePanelTab==='detalhes'&&<div className="financeDetailGrid">
                    <div><span>Documento de origem</span>{financeOriginLinks(t)}</div>
                    <div><span>Cliente / Fornecedor</span><strong>{t.entidade_nome||'Não informado'}</strong></div>
                    <div><span>Vencimento</span><strong>{dateBr(t.vencimento)}</strong></div>
                    <div><span>Forma de pagamento</span><strong>{t.forma_pagamento?paymentLabel(t.forma_pagamento):'Não informada'}</strong></div>
                    <div><span>Valor</span><strong>{money(Number(t.valor))}</strong></div>
                    <div><span>{type==='receber'?'Recebido':'Pago'}</span><strong>{money(Number(t.valor_pago))}</strong></div>
                    <div><span>Saldo</span><strong>{money(balance)}</strong></div>
                    <div><span>Status</span><strong>{financeStatusLabel(t.status)}</strong></div>
                    <div><span>Categoria</span><strong>{t.categoria||'Sem categoria'}</strong></div>
                    <div><span>Centro de custo</span><strong>{t.centro_custo||'Sem centro de custo'}</strong></div>
                  </div>}

                  {financePanelTab==='pagamentos'&&<>
                    {t.status!=='pago'&&t.status!=='cancelado'&&balance>0&&<div className="paymentEntry">
                      <div><strong>{type==='receber'?'Registrar recebimento':'Registrar pagamento'}</strong><span>A data informada será usada no histórico{type==='receber'?' e no período da comissão':''}.</span></div>
                      <label>Data<input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label>
                      <label>Valor<input type="number" min="0.01" step="0.01" max={balance} value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label>
                      {type==='receber'&&<div className="paymentMethodOverride">
                        <label className="paymentMethodToggle"><input type="checkbox" checked={changePaymentMethod} onChange={e=>{setChangePaymentMethod(e.target.checked);if(e.target.checked)setEffectivePaymentMethod((t.forma_pagamento as PaymentMethod)||'pix')}}/><span>Alterar forma do recebimento</span></label>
                        {changePaymentMethod&&<label>Forma recebida<select value={effectivePaymentMethod} onChange={e=>setEffectivePaymentMethod(e.target.value as PaymentMethod|'transferencia'|'ajuste'|'outro')}>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="pix">PIX</option>
                          <option value="cartao">Cartão</option>
                          <option value="boleto">Boleto</option>
                          <option value="transferencia">Transferência</option>
                          <option value="ajuste">Ajuste</option>
                          <option value="outro">Outro</option>
                        </select></label>}
                      </div>}
                      <button className="primary" onClick={()=>void registerPayment(t)}><CheckCircle2 size={15}/>{type==='receber'?'Receber':'Pagar'}</button>
                    </div>}
                    <PaymentHistory titleId={t.id} onChanged={refreshFinance} onOpenTransaction={id=>{setFinanceTransactionId(id);setFinancePanel(null);setFinancePanelReturnModule(null);setFinancePanelReturnSubtab(null);setActive('financeiro');setFinanceSubtab('conciliacao')}}/>
                  </>}

                  {financePanelTab==='comprovantes'&&linked&&proofPanel(t.venda_id?'venda':'compra',String(t.venda_id||t.compra_id))}
                    </div>
                  </div>
                </div>
              </td></tr>}
            </Fragment>
          })}
        </tbody>
      </table></div>
    </article>
  }

  function headerAction(){
    if(active==='clientes')startNewClient()
    else if(active==='fornecedores')startNewSupplier()
    else if(active==='produtos')startNewProduct()
    else if(active==='compras')startNewPurchase()
    else if(active==='vendas')startNewSale()
    else if(active==='comissoes')startNewSeller()
    else if(active==='financeiro')startNewTitle()
  }

  async function logout(){
    const userId=session?.user.id
    setAccountMenuOpen(false)
    setPermissionsReady(false)
    setDataReady(false)
    setShowApps(true)
    setAccessError('')
    closeForms()
    setUserPermissions(emptyPermissions())
    setCurrentAvatarPath(null)
    if(userId){
      try{sessionStorage.removeItem(`sg-erp-activity:${userId}`)}catch{/* sem ação */}
    }
    try{
      await supabase.auth.signOut({scope:'local'})
    }finally{
      setSession(null)
      setEmail('')
      setPassword('')
      setMsg('')
    }
  }

  async function installDesktopApp(){
    if(appInstalled){setMsg('O SG já está instalado como aplicativo neste dispositivo.');setAccountMenuOpen(false);return}
    if(!installPrompt){setMsg('A instalação ainda não foi liberada pelo navegador. No Chrome ou Edge, use o menu do navegador e escolha “Instalar SG Sistema de Gestão”.');setAccountMenuOpen(false);return}
    await installPrompt.prompt()
    const choice=await installPrompt.userChoice
    if(choice.outcome==='accepted')setMsg('Instalação do SG iniciada.')
    setInstallPrompt(null)
    setAccountMenuOpen(false)
  }

  const documentExpiryNotifications=comprovantes.filter(file=>{
    if(!file.data_vencimento)return false
    const due=new Date(file.data_vencimento+'T12:00:00')
    const now=new Date()
    now.setHours(12,0,0,0)
    const days=Math.ceil((due.getTime()-now.getTime())/86400000)
    return days<=Number(file.alerta_dias??5)
  }).length

  async function openApp(module:ModuleKey){
    if(!permissionsReady||!dataReady||!canViewModule(module))return
    if(module==='infra'||module==='config'){
      const label=module==='infra'?'GitHub & Supabase':'Configurações'
      const password=await themedPasswordPrompt(`Acesso protegido · ${label}`)
      if(password===null)return
      const valid=await sha256Hex(password)===protectedAppPasswordHash
      if(!valid){setMsg('Senha incorreta. Acesso não autorizado.');return}
    }
    setActive(module)
    if(module==='financeiro')setFinanceSubtab('geral')
    closeForms();setMsg('');setShowApps(false)
  }

  return <div className={`app appsWorkspace${dark?' dark':' light'}${showApps?' launcherWorkspace':''}`}>
    <header className="workspaceBar">
      <div className="workspaceIdentity">
        <div className="workspaceBrand"><span className="workspaceBrandMark">SG</span><div className="workspaceBrandText"><strong>{empresa?.nome_fantasia||'Sistema de Gestão'}</strong><small>ERP EMPRESARIAL</small></div></div>
        {!showApps&&<button type="button" className="workspaceHome" onClick={()=>setShowApps(true)}><Grid2X2 size={18}/><span>Aplicativos</span></button>}
      </div>
      <div className="workspaceControls">
        <div className="workspaceAccountMenu">
          <button type="button" className="workspaceAccount workspaceAccountButton" onClick={()=>setAccountMenuOpen(v=>!v)} aria-expanded={accountMenuOpen}>
            {currentAvatarPath?<img className="workspaceAccountAvatar" src={supabase.storage.from('user-avatars').getPublicUrl(currentAvatarPath).data.publicUrl} alt="Sua foto"/>:<span className="workspaceAccountAvatar workspaceAccountAvatarFallback">{(session.user.email||'?').charAt(0).toUpperCase()}</span>}
            <span title={session.user.email}>{session.user.email}</span><small>{profileLabel(profileRole)}</small><ChevronDown size={14}/>
          </button>
          {accountMenuOpen&&<div className="workspaceAccountDropdown">
            <button type="button" onClick={()=>void installDesktopApp()} disabled={appInstalled}><MonitorDown size={16}/><span>{appInstalled?'Aplicativo instalado':'Instalar aplicativo'}</span></button>
            <button type="button" onClick={()=>void logout()}><LogOut size={16}/><span>Sair</span></button>
          </div>}
        </div>
        <button type="button" className="workspaceIcon" onClick={toggleTheme} title={dark?'Ativar modo claro':'Ativar modo escuro'} aria-label={dark?'Ativar modo claro':'Ativar modo escuro'}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
        <select className="workspaceThemeSelect" aria-label="Tema de aparência" value={preference} onChange={e=>setPreference(e.target.value as 'system'|'light'|'dark')}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select>
        
      </div>
    </header>
    <main className="main">
      {!permissionsReady?<section className="panel accessState" role={accessError?'alert':'status'}><h2>{accessError?'Acessos indisponíveis':'Validando seus acessos'}</h2><p>{accessError||'Conferindo seu perfil e suas permissões de acesso.'}</p>{accessError&&<div className="formActions"><button className="primary" onClick={()=>{setAccessError('');void loadData()}}>Tentar novamente</button><button className="ghost" onClick={()=>void logout()}>Sair</button></div>}</section>:showApps?<>
        {msg&&<div className="panel noticePanel" role="status">{msg}</div>}
        <AppLauncher menu={permissionsReady?visibleMenu:[]} company={empresa?.nome_fantasia||'Sistema de Gestão'} ready={dataReady} canEdit={canEditModule} onOpen={openApp} notifications={{financeiro:billingCounts.naoFaturado,autorizacoes:saleApprovals.length,documentos:documentExpiryNotifications}}/>
      </>:permissionsReady&&canViewModule(active)&&<>
      <header className="topbar">
        <div><h1 ref={moduleHeading} tabIndex={-1}>{title}</h1><p>{empresa?.nome_fantasia||'Sistema de Gestão'}</p></div>
        {active==='vendas'&&<div className="salesMonthDashboard salesSellerDashboard" aria-label="Vendas do mês por vendedor">
          {salesMonthBySeller.length>0?salesMonthBySeller.map((seller,index)=><div key={seller.id} className={'salesMonthMetric'+(index===0?' salesMonthMetricPrimary':'')}>
            <span>{seller.nome}</span>
            <strong>{money(seller.total)}</strong>
            <small>{seller.quantidade} venda(s) · {salesMonthLabel}</small>
          </div>):<div className="salesMonthMetric"><span>Vendas do mês</span><strong>R$ 0,00</strong><small>Nenhuma venda por vendedor em {salesMonthLabel}</small></div>}
        </div>}
        <div className="topActions">
          <button className="iconBtn" onClick={()=>void loadData()} title="Atualizar"><RefreshCw size={18}/></button>
          {active==='compras'&&canManagePurchases&&<button className="ghost" onClick={()=>{closeForms();setShowNfeImport(true)}}><Upload size={17}/>Importar XML NF-e</button>}
          {((active==='vendas'&&canManageSales)||(active==='clientes'&&canManageClients)||(active==='fornecedores'&&canManageSuppliers)||(active==='compras'&&canManagePurchases))&&<button className="primary" onClick={headerAction}><Plus size={17}/>{active==='vendas'?'Novo orçamento':active==='compras'?'Nova compra':'Novo'}</button>}
          {canManageProducts&&active==='produtos'&&productSubtab==='cadastro'&&<button className="primary" onClick={headerAction}><Plus size={17}/>Novo produto</button>}
          {canManageFinance&&active==='financeiro'&&financeSubtab!=='faturamento'&&financeSubtab!=='conciliacao'&&<button className="primary" onClick={headerAction}><Plus size={17}/>Nova fatura</button>}
          {canManageCommissions&&active==='comissoes'&&<button className="primary" onClick={headerAction}><UserPlus size={17}/>Novo vendedor</button>}
        </div>
      </header>

      {msg&&!(active==='vendas'&&showForm)&&<div className="panel noticePanel">{msg}</div>}

      {active==='autorizacoes'&&canViewAuthorizations&&<AuthorizationCenter admin={canManageAuthorizations} products={produtos} clients={clientes} sellers={vendedores} sales={vendas} onChanged={loadData} onOpenSale={canViewModule('vendas')?(id)=>{setActive('vendas');setShowApps(false);setSalePanel(id)}:undefined}/>}
      {active==='rh'&&<HumanResources titles={titulos} canEdit={canEditModule('rh')} company={empresa} onChanged={refreshFinance} onOpen={t=>{closeForms();setActive('financeiro');const target=t.tipo_funcionario==='vale'?'receber':'pagar';setFinanceSubtab(target);setFinanceStatusFilter('todos');setFinanceStart('');setFinanceEnd('');setFinanceCategory('todos');setFinanceCenter('todos');setSearch('financeiro-'+target,'');setFinancePanel(t.id);setFinancePanelTab('pagamentos');setPaymentDate(today());setPaymentAmount(String(Math.max(0,Number(t.valor)-Number(t.valor_pago)).toFixed(2)))}}/>}
      {active==='entregas'&&<DeliveryWorkspace canEdit={canEditModule('entregas')} canOperate={canViewModule('entregas')}/>} 
      {active==='fechamento'&&<CashClosing canEdit={canEditModule('fechamento')} isAdmin={isAdmin} company={empresa}/>} 
      {active==='documentos'&&<DocumentsLibrary canEdit={canEditModule('documentos')}/>}
      {active==='infra'&&<InfrastructureUsage/>}
      {active==='dashboard'&&<section className="dashboardPage">
        <div className="dashboardIntro">
          <div>
            <span className="dashboardIntroEyebrow">VISÃO GERAL</span>
            <h2>Painel executivo</h2>
            <p>Acompanhe vendas, financeiro, estoque e operação em um único lugar.</p>
          </div>
          <div className="dashboardIntroBadge"><TrendingUp size={17}/><span>Indicadores do negócio</span></div>
        </div>

        <div className="dashboardKpiGrid">
          <button type="button" className="dashboardKpi dashboardKpiSales" onClick={()=>setActive('vendas')}>
            <span className="dashboardKpiIcon"><ShoppingCart size={20}/></span>
            <span className="dashboardKpiText"><small>Vendas no mês</small><strong>{money(monthSales)}</strong><em>{vendas.filter(v=>v.status!=='cancelado').length} registro(s)</em></span>
            <span className="dashboardKpiArrow"><ChevronRight size={18}/></span>
          </button>
          {canViewFinance&&<button type="button" className="dashboardKpi dashboardKpiReceivable" onClick={()=>{setActive('financeiro');setFinanceSubtab('receber')}}>
            <span className="dashboardKpiIcon"><BadgeDollarSign size={20}/></span>
            <span className="dashboardKpiText"><small>A receber</small><strong>{money(openReceivables)}</strong><em>saldo em aberto</em></span>
            <span className="dashboardKpiArrow"><ChevronRight size={18}/></span>
          </button>}
          {canViewFinance&&<button type="button" className="dashboardKpi dashboardKpiPayable" onClick={()=>{setActive('financeiro');setFinanceSubtab('pagar')}}>
            <span className="dashboardKpiIcon"><WalletCards size={20}/></span>
            <span className="dashboardKpiText"><small>A pagar</small><strong>{money(openPayables)}</strong><em>saldo em aberto</em></span>
            <span className="dashboardKpiArrow"><ChevronRight size={18}/></span>
          </button>}
          <button type="button" className="dashboardKpi dashboardKpiLowStock" onClick={()=>setActive('produtos')}>
            <span className="dashboardKpiIcon"><Package size={20}/></span>
            <span className="dashboardKpiText"><small>Estoque baixo</small><strong>{low}</strong><em>de {produtos.filter(p=>p.ativo).length} produtos ativos</em></span>
            <span className="dashboardKpiArrow"><ChevronRight size={18}/></span>
          </button>
        </div>

        <div className="dashboardResourceGrid">
          <button type="button" className="dashboardResourceCard" onClick={()=>{setActive('clientes');if(clientes.length===0&&canManageClients)startNewClient()}}>
            <span className="dashboardResourceIcon"><Users size={19}/></span>
            <span><small>Clientes ativos</small><strong>{clientes.filter(c=>c.ativo).length}</strong><em>Ver cadastro de clientes</em></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" className="dashboardResourceCard" onClick={()=>{setActive('fornecedores');if(fornecedores.length===0&&canManageSuppliers)startNewSupplier()}}>
            <span className="dashboardResourceIcon"><Building2 size={19}/></span>
            <span><small>Fornecedores ativos</small><strong>{fornecedores.filter(f=>f.ativo).length}</strong><em>Ver cadastro de fornecedores</em></span>
            <ChevronRight size={17}/>
          </button>
          <button type="button" className="dashboardResourceCard dashboardResourceStock" onClick={()=>{setActive('produtos');if(produtos.length===0&&canManageProducts)startNewProduct()}}>
            <span className="dashboardResourceIcon"><Boxes size={19}/></span>
            <span><small>Valor em estoque</small><strong>{money(stockValue)}</strong><em>Consultar produtos e estoque</em></span>
            <ChevronRight size={17}/>
          </button>
        </div>

        <div className={canViewFinance?'dashboardCharts dashboardChartsThree':'dashboardCharts'}>
          <article className="panel dashboardChart dashboardChartSales">
            <div className="dashboardChartHead">
              <div><span>Desempenho</span><h3>Vendas nos últimos 6 meses</h3><p>Evolução mensal do faturamento em vendas.</p></div>
              <strong>{money(dashboardSalesMonths.reduce((s,m)=>s+m.total,0))}</strong>
            </div>
            <div className="dashboardBarChart" aria-label="Gráfico de vendas dos últimos seis meses">
              {dashboardSalesMonths.map(m=><div className="dashboardBarColumn" key={m.label}>
                <div className="dashboardBarValue">{m.total>0?money(m.total):'R$ 0'}</div>
                <div className="dashboardBarTrack"><span className="dashboardBar dashboardBarSales" style={{height:`${Math.max(m.total>0?8:2,(m.total/dashboardSalesMax)*100)}%`}}></span></div>
                <small>{m.label}</small>
              </div>)}
            </div>
          </article>

          <article className="panel dashboardChart">
            <div className="dashboardChartHead">
              <div><span>Operação</span><h3>Status das vendas</h3><p>Distribuição atual por etapa.</p></div>
              <strong>{vendas.length}</strong>
            </div>
            <div className="dashboardHorizontalChart">
              {dashboardStatusData.map(item=><div className="dashboardHorizontalRow" key={item.key}>
                <div className="dashboardHorizontalLabel"><span>{item.label}</span><strong>{item.value}</strong></div>
                <div className="dashboardHorizontalTrack"><span className={`dashboardHorizontalFill status-${item.key}`} style={{width:`${(item.value/dashboardStatusMax)*100}%`}}></span></div>
              </div>)}
            </div>
          </article>

          {canViewFinance&&<article className="panel dashboardChart">
            <div className="dashboardChartHead">
              <div><span>Financeiro</span><h3>Valores em aberto</h3><p>Comparativo entre recebimentos e pagamentos pendentes.</p></div>
            </div>
            <div className="dashboardFinanceChart">
              {dashboardFinanceData.map(item=><div className="dashboardFinanceColumn" key={item.key}>
                <strong>{money(item.value)}</strong>
                <div className="dashboardFinanceTrack"><span className={`dashboardFinanceFill finance-${item.key}`} style={{height:`${Math.max(item.value>0?8:2,(item.value/dashboardFinanceMax)*100)}%`}}></span></div>
                <small>{item.label}</small>
              </div>)}
            </div>
          </article>}
        </div>
      </section>}

      {active==='clientes'&&<section className="semanticPage clientsPage">
        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingClient?'Editar cliente':'Novo cliente'}><div className="saleModalShell entityModalShell"><form className="panel dataForm saleModalForm entityModalForm" onSubmit={saveClient}>
          <div className="formTitle saleModalTitle"><div><h3>{editingClient?'Editar cliente':'Novo cliente'}</h3><p>Cadastre ou atualize os dados do cliente.</p></div><button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de cliente" onClick={()=>{setShowForm(false);setEditingClient(null)}}><X size={18}/></button></div>
          <label className="fieldLabel">Nome / Razão social
            <input name="nome" placeholder="Nome / Razão social" required defaultValue={editingClient?.nome||''}/>
          </label>
          <div className="cnpjLookupField">
            <label className="fieldLabel">CPF / CNPJ
              <input name="documento" inputMode="numeric" placeholder="CPF / CNPJ" defaultValue={maskDocument(editingClient?.documento||'')} onInput={e=>{e.currentTarget.value=maskDocument(e.currentTarget.value)}}/>
            </label>
            <button type="button" className="ghost cnpjLookupButton" disabled={clientLookupBusy} onClick={e=>void lookupClientCnpj(e.currentTarget.form)}>
              <Search size={16}/>{clientLookupBusy?'Consultando...':'Buscar CNPJ'}
            </button>
          </div>
          <label className="fieldLabel">E-mail
            <input name="email" type="email" placeholder="E-mail" defaultValue={editingClient?.email||''}/>
          </label>
          <label className="fieldLabel">Telefone
            <input name="telefone" inputMode="tel" placeholder="Telefone" defaultValue={maskPhone(editingClient?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/>
          </label>
          <label className="fieldLabel">Limite de crédito
            <input name="limite_credito" type="number" min="0" step="0.01" placeholder="0,00" defaultValue={editingClient?.limite_credito||0}/>
          </label>
          <div className="fiscalCadastroSection">
            <div className="fiscalCadastroTitle"><strong>Dados fiscais e endereço para NF-e</strong><span>Estes dados são usados automaticamente na emissão. Mantenha o cadastro completo.</span></div>
            <label className="fieldLabel">Logradouro<input name="logradouro" defaultValue={editingClient?.logradouro||''} placeholder="Rua, avenida..."/></label>
            <label className="fieldLabel">Número<input name="numero" defaultValue={editingClient?.numero||''} placeholder="Número"/></label>
            <label className="fieldLabel">Bairro<input name="bairro" defaultValue={editingClient?.bairro||''} placeholder="Bairro"/></label>
            <label className="fieldLabel">Município<input name="municipio" defaultValue={editingClient?.municipio||''} placeholder="Cidade"/></label>
            <label className="fieldLabel">Código IBGE<input name="codigo_municipio" inputMode="numeric" maxLength={7} defaultValue={editingClient?.codigo_municipio||''} placeholder="7 dígitos"/></label>
            <label className="fieldLabel">UF<input name="uf" maxLength={2} defaultValue={editingClient?.uf||''} placeholder="SP"/></label>
            <label className="fieldLabel">CEP<input name="cep" inputMode="numeric" defaultValue={maskCep(editingClient?.cep||'')} onInput={e=>{e.currentTarget.value=maskCep(e.currentTarget.value)}} placeholder="00000-000"/></label>
            <label className="fieldLabel">Latitude (rotas)<input name="latitude" type="number" step="0.0000001" min="-90" max="90" defaultValue={editingClient?.latitude??''} placeholder="-15.0000000"/></label>
            <label className="fieldLabel">Longitude (rotas)<input name="longitude" type="number" step="0.0000001" min="-180" max="180" defaultValue={editingClient?.longitude??''} placeholder="-47.0000000"/></label>
            <label className="fieldLabel">Inscrição estadual
              <select name="indicador_ie" defaultValue={editingClient?.indicador_ie||'9'}>
                <option value="1">Contribuinte com IE</option>
                <option value="2">Contribuinte isento</option>
                <option value="9">Não contribuinte</option>
              </select>
            </label>
            <label className="fieldLabel">Número da inscrição estadual<input name="inscricao_estadual" defaultValue={editingClient?.inscricao_estadual||''} placeholder="Obrigatório para contribuinte"/></label>
            <label className="fieldLabel">Consumidor final
              <select name="consumidor_final" defaultValue={editingClient?.consumidor_final===false?'false':'true'}>
                <option value="true">Sim</option><option value="false">Não</option>
              </select>
            </label>
            <label className="fieldLabel">Presença do comprador
              <select name="presenca_comprador" defaultValue={String(editingClient?.presenca_comprador||1)}>
                <option value="1">Presencial</option><option value="2">Internet</option><option value="3">Teleatendimento</option><option value="5">Presencial fora do estabelecimento</option><option value="9">Não presencial, outros</option>
              </select>
            </label>
          </div>
          <label className="fieldLabel">Status
            <select name="ativo" defaultValue={editingClient?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select>
          </label>
          <div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingClient(null)}}>Cancelar</button><button className="primary">{editingClient?'Salvar alterações':'Cadastrar cliente'}</button></div>
        </form></div></div>}
        <EditableEntityTable className="clientsEntityTable" readOnly={!canManageClients} title="Clientes" emptyActionLabel="+ Adicionar Cliente" onEmptyAction={startNewClient} headers={['Nome','Documento','E-mail','Telefone','Limite','Status','Gerenciar']} rows={clientes.map(c=>({id:c.id,cells:[c.nome,c.documento||'—',c.email||'—',c.telefone||'—',money(Number(c.limite_credito)),c.ativo?'Ativo':'Inativo'],opened:clientPanel===c.id,onToggle:()=>setClientPanel(clientPanel===c.id?null:c.id),panel:<><div className="entityDetailContent">
  {(()=>{const resumo=clientReceivableSummary(c);return <div className="entityFinanceDash">
    <article className="entityFinanceCard due"><span>Total a vencer</span><strong>{money(resumo.aVencer)}</strong><small>Saldo em aberto com vencimento hoje ou futuro</small></article>
    <article className="entityFinanceCard overdue"><span>Total vencido</span><strong>{money(resumo.vencido)}</strong><small>Saldo em aberto com vencimento anterior a hoje</small></article>
  </div>})()}
  <div className="entityDetailGrid">
  <div><span>Nome / Razão social</span><strong>{c.nome}</strong></div>
  <div><span>CPF / CNPJ</span><strong>{c.documento||'—'}</strong></div>
  <div><span>E-mail</span><strong>{c.email||'—'}</strong></div>
  <div><span>Telefone</span><strong>{c.telefone||'—'}</strong></div>
  <div><span>Limite de crédito</span><strong>{money(Number(c.limite_credito))}</strong></div>
  <div><span>Status</span><strong>{c.ativo?'Ativo':'Inativo'}</strong></div>
  <div><span>Logradouro</span><strong>{c.logradouro||'—'}</strong></div>
  <div><span>Número</span><strong>{c.numero||'—'}</strong></div>
  <div><span>Bairro</span><strong>{c.bairro||'—'}</strong></div>
  <div><span>Município</span><strong>{c.municipio||'—'}</strong></div>
  <div><span>Código IBGE</span><strong>{c.codigo_municipio||'—'}</strong></div>
  <div><span>UF</span><strong>{c.uf||'—'}</strong></div>
  <div><span>CEP</span><strong>{c.cep?maskCep(c.cep):'—'}</strong></div>
  <div><span>Latitude</span><strong>{c.latitude??'—'}</strong></div>
  <div><span>Longitude</span><strong>{c.longitude??'—'}</strong></div>
  <div><span>Inscrição estadual</span><strong>{c.indicador_ie==='1'?'Contribuinte com IE':c.indicador_ie==='2'?'Contribuinte isento':'Não contribuinte'}</strong></div>
  <div><span>Nº inscrição estadual</span><strong>{c.inscricao_estadual||'—'}</strong></div>
  <div><span>Consumidor final</span><strong>{c.consumidor_final===false?'Não':'Sim'}</strong></div>
  <div><span>Presença do comprador</span><strong>{c.presenca_comprador===2?'Internet':c.presenca_comprador===3?'Teleatendimento':c.presenca_comprador===5?'Presencial fora do estabelecimento':c.presenca_comprador===9?'Não presencial, outros':'Presencial'}</strong></div>
  </div>
</div><div className="rowActions entityDetailActions">{canManageClients&&<button className="ghost" onClick={()=>startEditClient(c)}><Pencil size={15}/>Editar</button>}{canViewFinance&&<button className="ghost" disabled={statementBusy!==null} onClick={()=>void downloadEntityStatement('cliente',c)}><FileDown size={15}/>{statementBusy==='cliente:'+c.id?'Gerando...':'PDF de faturas em aberto'}</button>}{isAdmin&&canManageClients&&<button className="dangerAction" onClick={()=>void deleteClient(c)}><Trash2 size={15}/>Excluir</button>}</div></>}))}/>
      </section>}

      {active==='fornecedores'&&<section className="semanticPage suppliersPage">
        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingSupplier?'Editar fornecedor':'Novo fornecedor'}><div className="saleModalShell entityModalShell"><form className="panel dataForm saleModalForm entityModalForm" onSubmit={saveSupplier}>
          <div className="formTitle saleModalTitle"><div><h3>{editingSupplier?'Editar fornecedor':'Novo fornecedor'}</h3><p>Cadastre ou atualize os dados do fornecedor.</p></div><button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de fornecedor" onClick={()=>{setShowForm(false);setEditingSupplier(null)}}><X size={18}/></button></div>
          <label className="fieldLabel">Nome / Razão social
            <input name="nome" placeholder="Nome / Razão social" required defaultValue={editingSupplier?.nome||''}/>
          </label>
          <label className="fieldLabel">CNPJ / CPF
            <input name="documento" inputMode="numeric" placeholder="CNPJ / CPF" defaultValue={maskDocument(editingSupplier?.documento||'')} onInput={e=>{e.currentTarget.value=maskDocument(e.currentTarget.value)}}/>
          </label>
          <label className="fieldLabel">E-mail
            <input name="email" type="email" placeholder="E-mail" defaultValue={editingSupplier?.email||''}/>
          </label>
          <label className="fieldLabel">Telefone
            <input name="telefone" inputMode="tel" placeholder="Telefone" defaultValue={maskPhone(editingSupplier?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/>
          </label>
          <label className="fieldLabel">Status
            <select name="ativo" defaultValue={editingSupplier?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select>
          </label>
          <div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingSupplier(null)}}>Cancelar</button><button className="primary">{editingSupplier?'Salvar alterações':'Cadastrar fornecedor'}</button></div>
        </form></div></div>}
        <EditableEntityTable className="suppliersEntityTable" readOnly={!canManageSuppliers} title="Fornecedores" emptyActionLabel="+ Adicionar Fornecedor" onEmptyAction={startNewSupplier} headers={['Nome','Documento','E-mail','Telefone','Status','Gerenciar']} rows={fornecedores.map(f=>({id:f.id,cells:[f.nome,f.documento||'—',f.email||'—',f.telefone||'—',f.ativo?'Ativo':'Inativo'],opened:supplierPanel===f.id,onToggle:()=>setSupplierPanel(supplierPanel===f.id?null:f.id),panel:<><div className="entityDetailGrid">
  <div><span>Nome / Razão social</span><strong>{f.nome}</strong></div>
  <div><span>CNPJ / CPF</span><strong>{f.documento||'—'}</strong></div>
  <div><span>E-mail</span><strong>{f.email||'—'}</strong></div>
  <div><span>Telefone</span><strong>{f.telefone||'—'}</strong></div>
  <div><span>Status</span><strong>{f.ativo?'Ativo':'Inativo'}</strong></div>
</div><div className="rowActions entityDetailActions">{canManageSuppliers&&<button className="ghost" onClick={()=>startEditSupplier(f)}><Pencil size={15}/>Editar</button>}{canViewFinance&&<button className="ghost" disabled={statementBusy!==null} onClick={()=>void downloadEntityStatement('fornecedor',f)}><FileDown size={15}/>{statementBusy==='fornecedor:'+f.id?'Gerando...':'PDF de faturas em aberto'}</button>}{isAdmin&&canManageSuppliers&&<button className="dangerAction" onClick={()=>void deleteSupplier(f)}><Trash2 size={15}/>Excluir</button>}</div></>}))}/>
      </section>}

      {active==='produtos'&&<section className="semanticPage productsPage">
        <div className="subTabs">
          <button className={productSubtab==='cadastro'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('cadastro');setMsg('')}}><Package size={16}/>Cadastro / Estoque</button>
          <button className={productSubtab==='movimentos'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('movimentos');setShowForm(false);setAdjustingProduct(null);setMsg('')}}><Boxes size={16}/>Entradas e saídas</button>
          <button className={productSubtab==='grupos'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('grupos');setShowForm(false);setAdjustingProduct(null);setMsg('')}}><Package size={16}/>Grupos e subgrupos</button>
          <button className={productSubtab==='producao'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('producao');setShowForm(false);setAdjustingProduct(null);setMsg('')}}><Boxes size={16}/>Produtos de produção</button>
          <button className={productSubtab==='servicos'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('servicos');setShowForm(false);setAdjustingProduct(null);setMsg('')}}><ReceiptText size={16}/>Produtos de serviço</button>
          <button className={productSubtab==='massa'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('massa');setShowForm(false);setAdjustingProduct(null);setMsg('')}}><SlidersHorizontal size={16}/>Produtos e serviços (ajustes em massa)</button>
        </div>

        {productSubtab==='cadastro'&&<>
          <div className="cards compactCards semanticCards">
            <article className="card semanticCard semanticBlue"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong></article>
            <article className="card semanticCard semanticWarning"><span>Estoque baixo</span><strong>{low}</strong></article>
            <article className="card semanticCard semanticBlue"><span>Valor de custo</span><strong>{money(stockValue)}</strong></article>
          </div>

          <div className="inventoryTopActions">
            <button type="button" className="ghost excelSecondaryBtn" onClick={()=>setExcelToolsOpen(v=>!v)} aria-expanded={excelToolsOpen}>
              <FileSpreadsheet size={16}/>Excel
            </button>
          </div>

          {excelToolsOpen&&<div className="panel excelToolsPanel">
            <div className="excelPanelText">
              <div className="excelIcon"><FileSpreadsheet size={20}/></div>
              <div><strong>Importação e exportação Excel</strong><span>Use o modelo para cadastrar produtos ou ajustar o estoque pelo código do item.</span></div>
            </div>
            <div className="excelActions">
              <button type="button" className="ghost" onClick={downloadProductModel}><FileSpreadsheet size={16}/>Baixar modelo</button>
              <button type="button" className="ghost" onClick={exportProducts}><Download size={16}/>Exportar Excel</button>
              <label className={canManageProducts?'primary excelUpload':'ghost excelUpload disabledUpload'}>
                <Upload size={16}/>Importar Excel
                <input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv" onChange={e=>void importProducts(e)} disabled={!canManageProducts}/>
              </label>
            </div>
            <small className="excelWarning">Na importação, o <strong>Estoque Atual</strong> da planilha substitui o saldo existente. Toda diferença é registrada como ajuste de estoque.</small>
          </div>}

          {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={duplicatingProduct?'Duplicar produto':editingProduct?'Editar produto':'Novo produto'}><div className="saleModalShell productModalShell"><form className="panel dataForm saleModalForm productModalForm" onSubmit={saveProduct}>
            <div className="formTitle saleModalTitle">
              <div>
                <h3>{duplicatingProduct?'Duplicar produto':editingProduct?'Editar produto':'Novo produto'}</h3>
                <p>Preencha os dados do produto. O estoque de produtos já cadastrados é alterado pela opção “Ajustar estoque”.</p>
              </div>
              <div className="productModalHeaderActions">
                {editingProduct&&!duplicatingProduct&&productTrackStock&&<button type="button" className="ghost" onClick={()=>startAdjustStock(editingProduct)} disabled={!canManageProducts}><Boxes size={16}/>Ajustar estoque</button>}
                <button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de produto" onClick={()=>{setShowForm(false);setEditingProduct(null);setDuplicatingProduct(false);setProductComponentDrafts([])}}><X size={18}/></button>
              </div>
            </div>

            <label className="fieldLabel">Código
              <input name="codigo" placeholder="Ex.: PRD-001" required defaultValue={editingProduct?.codigo||''}/>
            </label>
            <label className="fieldLabel">Produto / Descrição
              <input name="descricao" placeholder="Nome do produto" required defaultValue={editingProduct?.descricao||''}/>
            </label>
            <label className="fieldLabel">Grupo
              <SearchableSelect value={productGroupId} onChange={value=>{setProductGroupId(value);setProductSubgroupId('')}} placeholder="Sem grupo" searchPlaceholder="Pesquisar grupo..." options={gruposProdutos.filter(g=>g.ativo||g.id===editingProduct?.grupo_id).map(g=>({value:g.id,label:g.nome+(g.ativo?'':' (inativo)')}))}/>
            </label>
            <label className="fieldLabel">Subgrupo
              <SearchableSelect value={productSubgroupId} onChange={setProductSubgroupId} disabled={!productGroupId} placeholder="Sem subgrupo" searchPlaceholder="Pesquisar subgrupo..." options={subgruposProdutos.filter(s=>s.grupo_id===productGroupId&&(s.ativo||s.id===editingProduct?.subgrupo_id)).map(s=>({value:s.id,label:s.nome+(s.ativo?'':' (inativo)')}))}/>
            </label>
            <label className="fieldLabel">Tipo de produto
              <select name="tipo_produto" value={productType} onChange={e=>{const next=e.target.value as 'insumo'|'produto_final'|'servico';setProductType(next);setProductTrackStock(next==='insumo');if(next!=='produto_final')setProductComponentDrafts([])}}>
                <option value="insumo">Insumo / material</option>
                <option value="produto_final">Produto final (produção)</option>
                <option value="servico">Produto de serviço</option>
              </select>
              <small>{productType==='produto_final'?'Produto final possui uma ficha técnica com os materiais necessários para produção.':productType==='servico'?'Serviço pode ser vendido normalmente, mas não movimenta estoque.':'Insumo/material pode ter controle de estoque.'}</small>
            </label>
            <label className="fieldLabel">Unidade
              <input name="unidade" placeholder="Ex.: UN" defaultValue={editingProduct?.unidade||'UN'}/>
            </label>
            <label className="productTrackingField fieldLabelWide">
              <span className="productTrackingControl">
                <input type="checkbox" checked={productTrackStock} disabled={productType!=='insumo'} onChange={e=>setProductTrackStock(e.target.checked)}/>
                <span><strong>Rastrear estoque</strong><small>{productType==='produto_final'?'Produto de produção não mantém saldo próprio. O estoque é baixado pelos materiais da receita.':productType==='servico'?'Serviços não possuem saldo, entrada, saída ou estoque mínimo.':'Controla entradas, saídas, saldo atual e disponibilidade deste produto.'}</small></span>
              </span>
              {productType==='produto_final'&&<span className="productTrackingRecipeNote"><Boxes size={14}/>Os materiais da ficha técnica ficam com rastreamento de estoque ativo.</span>}
            </label>

            <label className="fieldLabel">Custo
              <input name="custo" type="number" min="0" step="0.01" placeholder="0,00" defaultValue={editingProduct?.custo??''}/>
            </label>
            <label className="fieldLabel">Preço de venda
              <input name="preco_venda" type="number" min="0" step="0.01" placeholder="0,00" defaultValue={editingProduct?.preco_venda??''}/>
            </label>
            <label className="fieldLabel">Acréscimo mínimo sobre custo (%)
              <input name="percentual_minimo_custo_venda" type="number" min="0" max="1000" step="0.01" defaultValue={editingProduct?.percentual_minimo_custo_venda??100} required/>
              <small>100% = custo × 2 (R$ 100 de custo → R$ 200 de preço mínimo). 0% = igual ao custo. Considera descontos da venda.</small>
            </label>
            {(!editingProduct||duplicatingProduct)&&<label className="fieldLabel">Estoque inicial
              <input name="estoque_atual" type="number" min="0" step="0.001" placeholder="0" defaultValue="0"/>
            </label>}
            <label className="fieldLabel">Estoque mínimo
              <input name="estoque_minimo" type="number" min="0" step="0.001" placeholder="0" defaultValue={editingProduct?.estoque_minimo??''}/>
            </label>
            {editingProduct&&!duplicatingProduct&&productTrackStock&&<div className="productStockAdjustmentBox fieldLabelWide">
              <div className="productStockAdjustmentInfo">
                <span>Estoque atual</span>
                <strong>{Number(editingProduct.estoque_atual).toLocaleString('pt-BR')} {editingProduct.unidade||'UN'}</strong>
                <small>Para corrigir o saldo, registre um ajuste com motivo e histórico de movimentação.</small>
              </div>

            </div>}
            <label className="fieldLabel">Peso unitário (kg)
              <input name="peso_kg" type="number" min="0" step="0.001" placeholder="0,000" defaultValue={editingProduct?.peso_kg??''}/>
            </label>
            <label className="fieldLabel">Volume unitário (m³)
              <input name="volume_m3" type="number" min="0" step="0.0001" placeholder="0,0000" defaultValue={editingProduct?.volume_m3??''}/>
            </label>
            {productType==='produto_final'&&<div className="productionRecipeSection">
              <div className="productionRecipeHead">
                <div className="productionRecipeHeadText">
                  <span className="productionRecipeEyebrow">PRODUÇÃO</span>
                  <strong>Ficha técnica de produção</strong>
                  <span>Materiais consumidos para produzir 1 unidade deste produto.</span>
                </div>
                <div className="productionRecipeHeadActions">
                  <span className="productionRecipeCounter">{productComponentDrafts.length} material(is)</span>
                  <button type="button" className="ghost" onClick={addProductComponent}><Plus size={15}/>Adicionar material</button>
                </div>
              </div>
              {productComponentDrafts.length===0&&<div className="productionRecipeEmpty">Nenhum material configurado. Adicione os insumos usados na produção.</div>}
              <div className="productionRecipeRows">
                {productComponentDrafts.map((row,index)=><div className="productionRecipeRow" key={row.key}>
                  <div className="productionRecipeRowHead">
                    <strong>Material {index+1}</strong>
                    <button type="button" className="iconBtn dangerBtn productionRecipeRemove" onClick={()=>removeProductComponent(row.key)} title="Remover material"><Trash2 size={16}/></button>
                  </div>
                  <div className="productionRecipeRowGrid">
                    <label className="fieldLabel productionRecipeMaterial">Material
                      <button type="button" className="productionMaterialButton" onClick={()=>{setProductComponentPicker(row.key);setProductComponentPickerSearch('')}}>
                        <Search size={15}/>
                        <span>{(()=>{
                          const material=produtos.find(p=>p.id===row.componente_id)
                          return material?`${material.codigo} — ${material.descricao} (${material.unidade||'UN'})`:'Selecionar material'
                        })()}</span>
                        <strong>{row.componente_id?'Alterar':'Escolher'}</strong>
                      </button>
                    </label>
                    <label className="fieldLabel productionRecipeQuantity">Quantidade por unidade
                      <input type="number" min="0.001" step="0.001" value={row.quantidade} onChange={e=>updateProductComponent(row.key,'quantidade',e.target.value)} required/>
                    </label>
                  </div>
                </div>)}
              </div>
              {productComponentDrafts.length>0&&<div className="productionRecipeCost">
                <span>Custo calculado dos materiais</span>
                <strong>{money(productComponentDrafts.reduce((sum,row)=>{
                  const material=produtos.find(p=>p.id===row.componente_id)
                  return sum+(Number(material?.custo_medio??material?.custo??0)*Number(row.quantidade||0))
                },0))}</strong>
              </div>}
              {productComponentPicker&&<div className="productionPickerBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProductComponentPicker(null)}}>
                <div className="productionPickerModal" role="dialog" aria-modal="true" aria-label="Pesquisar material">
                  <div className="productionPickerHead">
                    <div><strong>Pesquisar material</strong><span>Digite o código ou nome do produto que deseja usar na receita.</span></div>
                    <button type="button" className="iconBtn" onClick={()=>setProductComponentPicker(null)} aria-label="Fechar"><X size={17}/></button>
                  </div>
                  <div className="productionPickerSearch">
                    <Search size={17}/>
                    <input autoFocus value={productComponentPickerSearch} onChange={e=>setProductComponentPickerSearch(e.target.value)} placeholder="Código, nome ou unidade..."/>
                    {productComponentPickerSearch&&<button type="button" onClick={()=>setProductComponentPickerSearch('')}><X size={14}/></button>}
                  </div>
                  <div className="productionPickerList">
                    {produtos.filter(p=>{
                      if(!(p.ativo&&p.tipo_produto!=='produto_final'&&p.id!==editingProduct?.id))return false
                      const q=productComponentPickerSearch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
                      if(!q)return true
                      const hay=[p.codigo,p.descricao,p.unidade].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
                      return hay.includes(q)
                    }).slice(0,80).map(p=><button type="button" key={p.id} className="productionPickerOption" onClick={()=>{
                      updateProductComponent(productComponentPicker,'componente_id',p.id)
                      setProductComponentPicker(null)
                      setProductComponentPickerSearch('')
                    }}>
                      <span><strong>{p.codigo}</strong><b>{p.descricao}</b></span>
                      <small>{p.unidade||'UN'} · estoque {Number(p.estoque_atual||0).toLocaleString('pt-BR')}</small>
                    </button>)}
                    {productComponentPickerSearch&&produtos.filter(p=>p.ativo&&p.tipo_produto!=='produto_final'&&p.id!==editingProduct?.id&&[p.codigo,p.descricao,p.unidade].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(productComponentPickerSearch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim())).length===0&&<div className="productionPickerEmpty">Nenhum material encontrado.</div>}
                  </div>
                </div>
              </div>}
            </div>}
            <div className="fiscalCadastroSection productFiscalSection">
              <div className="fiscalCadastroTitle"><strong>Tributação para NF-e</strong><span>Cadastre uma vez no produto. A venda usa estes dados automaticamente.</span></div>
              <label className="fieldLabel">NCM<input name="ncm" inputMode="numeric" maxLength={8} defaultValue={editingProduct?.ncm||''} placeholder="8 dígitos"/></label>
              <label className="fieldLabel">CFOP interno<input name="cfop_interno" inputMode="numeric" maxLength={4} defaultValue={editingProduct?.cfop_interno||''} placeholder="Ex.: 5102"/></label>
              <label className="fieldLabel">CFOP interestadual<input name="cfop_interestadual" inputMode="numeric" maxLength={4} defaultValue={editingProduct?.cfop_interestadual||''} placeholder="Ex.: 6102"/></label>
              <label className="fieldLabel">Origem
                <select name="origem" defaultValue={editingProduct?.origem==null?'':String(editingProduct.origem)}>
                  <option value="">Selecione</option>
                  {Array.from({length:9},(_,i)=><option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <label className="fieldLabel">CST / CSOSN<input name="cst_icms" inputMode="numeric" maxLength={3} defaultValue={editingProduct?.cst_icms||''} placeholder="2 ou 3 dígitos"/></label>
              <label className="fieldLabel">CST PIS<input name="cst_pis" inputMode="numeric" maxLength={2} defaultValue={editingProduct?.cst_pis||''} placeholder="2 dígitos"/></label>
              <label className="fieldLabel">CST COFINS<input name="cst_cofins" inputMode="numeric" maxLength={2} defaultValue={editingProduct?.cst_cofins||''} placeholder="2 dígitos"/></label>
            </div>
            <label className="fieldLabel">Status
              <select name="ativo" defaultValue={editingProduct?.ativo===false?'false':'true'}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>

            <div className="formActions productFormActions">
              {editingProduct&&!duplicatingProduct&&isAdmin&&canManageProducts&&<button type="button" className="dangerAction productDeleteBtn" onClick={async()=>{const ok=await deleteProduct(editingProduct);if(ok){setShowForm(false);setEditingProduct(null);setProductComponentDrafts([])}}}><Trash2 size={15}/>Excluir produto</button>}
              <div className="productFormActionsRight">
                <button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingProduct(null);setDuplicatingProduct(false);setProductComponentDrafts([])}}>Cancelar</button>
                {editingProduct&&!duplicatingProduct&&<button type="button" className="ghost" onClick={()=>startDuplicateProduct(editingProduct)}><Plus size={15}/>Duplicar produto</button>}
                <button className="primary">{duplicatingProduct?'Cadastrar cópia':editingProduct?'Salvar alterações':'Cadastrar produto'}</button>
              </div>
            </div>
          </form></div></div>}

          {adjustingProduct&&<div className="stockAdjustmentModalOverlay" role="dialog" aria-modal="true" aria-label="Ajustar estoque">
            <div className="stockAdjustmentDialog">
              <div className="stockAdjustmentDialogHeader">
                <div><h3>Ajustar estoque</h3><p>{adjustingProduct.codigo} - {adjustingProduct.descricao}</p></div>
                <button type="button" className="iconBtn" aria-label="Fechar ajuste de estoque" title="Fechar" onClick={()=>setAdjustingProduct(null)}><X size={17}/></button>
              </div>
              <form className="stockForm stockAdjustmentForm" onSubmit={adjustStock}>
                <div className="stockAdjustmentCurrent"><span>Estoque atual</span><strong>{Number(adjustingProduct.estoque_atual).toLocaleString('pt-BR')} {adjustingProduct.unidade||'UN'}</strong></div>
                <label>Novo estoque<input type="number" min="0" step="0.001" value={stockNew} onChange={e=>setStockNew(e.target.value)} required autoFocus/></label>
                <label>Motivo do ajuste<input value={stockReason} onChange={e=>setStockReason(e.target.value)} required placeholder="Ex.: contagem física, perda ou reposição"/></label>
                <div className="formActions"><button type="button" className="ghost" onClick={()=>setAdjustingProduct(null)}>Cancelar</button><button className="primary">Aplicar ajuste</button></div>
              </form>
            </div>
          </div>}

          <ProductTable produtos={produtos} groups={gruposProdutos} subgroups={subgruposProdutos} onCreate={startNewProduct} openId={productPanel} onToggle={id=>setProductPanel(productPanel===id?null:id)} onEdit={startEditProduct} onAdjust={startAdjustStock} onDelete={deleteProduct} onBulkDelete={deleteSelectedProducts} onBulkExport={exportSelectedProducts} canDelete={isAdmin&&canManageProducts} readOnly={!canManageProducts}/>
        </>}

        {productSubtab==='producao'&&<>
          <article className="panel tablePanel productionListPanel">
            <div className="panelHead">
              <div>
                <h3>Produtos de produção</h3>
                <p>Lista de produtos finais • Clique duplo para abrir a receita e os materiais</p>
              </div>
              <div className="productionListActions">
                <SearchField value={tableSearch['produtos-producao']||''} onChange={v=>setSearch('produtos-producao',v)} placeholder="Pesquisar código, produto ou material"/>
                {canManageProducts&&<button type="button" className="primary" onClick={()=>{startNewProduct();setProductType('produto_final')}}><Plus size={16}/>Novo produto</button>}
              </div>
            </div>
            <div className="tableWrap"><table className="productionListTable">
              <thead><tr>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-producao','codigo')}>Código{sortMark('produtos-producao','codigo')}</button></th>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-producao','produto')}>Produto{sortMark('produtos-producao','produto')}</button></th>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-producao','materiais')}>Materiais{sortMark('produtos-producao','materiais')}</button></th>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-producao','custo')}>Custo da receita{sortMark('produtos-producao','custo')}</button></th>
                <th>Unidade</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {sortList('produtos-producao',produtos.filter(p=>{
                  if(p.tipo_produto!=='produto_final')return false
                  const recipe=produtoComponentes.filter(row=>row.produto_final_id===p.id)
                  const materials=recipe.map(row=>produtos.find(item=>item.id===row.componente_id)?.descricao||'').join(' ')
                  return searchMatches('produtos-producao',[p.codigo,p.descricao,p.unidade,materials])
                }),{
                  codigo:p=>p.codigo||'',
                  produto:p=>p.descricao,
                  materiais:p=>produtoComponentes.filter(row=>row.produto_final_id===p.id).length,
                  custo:p=>produtoComponentes.filter(row=>row.produto_final_id===p.id).reduce((sum,row)=>{
                    const material=produtos.find(item=>item.id===row.componente_id)
                    return sum+(Number(material?.custo_medio??material?.custo??0)*Number(row.quantidade||0))
                  },0)
                }).map(p=>{
                  const recipe=produtoComponentes.filter(row=>row.produto_final_id===p.id)
                  const recipeCost=recipe.reduce((sum,row)=>{
                    const material=produtos.find(item=>item.id===row.componente_id)
                    return sum+(Number(material?.custo_medio??material?.custo??0)*Number(row.quantidade||0))
                  },0)
                  return <tr key={p.id} onDoubleClick={()=>{setProductSubtab('cadastro');startEditProduct(p)}} title="Clique duplo para abrir a receita">
                    <td><strong>{p.codigo||'—'}</strong></td>
                    <td><div className="productNameCell productionNameCell"><span className="productionProductName">{p.descricao}</span><small className="productFinalBadge">PRODUÇÃO</small></div></td>
                    <td><strong>{recipe.length}</strong></td>
                    <td>{money(recipeCost)}</td>
                    <td>{p.unidade||'UN'}</td>
                    <td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td>
                  </tr>
                })}
                {produtos.filter(p=>p.tipo_produto==='produto_final').length===0&&<tr className="emptyTableRow"><td colSpan={6}><EmptyState message="Nenhum produto de produção cadastrado." actionLabel={canManageProducts?'+ Novo produto':undefined} onAction={canManageProducts?()=>{startNewProduct();setProductType('produto_final')}:undefined}/></td></tr>}
              </tbody>
            </table></div>
          </article>
        </>}

        {productSubtab==='servicos'&&<>
          <article className="panel tablePanel productionListPanel serviceListPanel">
            <div className="panelHead">
              <div>
                <h3>Produtos de serviço</h3>
                <p>Serviços vendidos sem movimentação de estoque.</p>
              </div>
              <div className="productionListActions">
                <SearchField value={tableSearch['produtos-servicos']||''} onChange={v=>setSearch('produtos-servicos',v)} placeholder="Pesquisar código, serviço ou unidade"/>
                {canManageProducts&&<button type="button" className="primary" onClick={()=>{startNewProduct();setProductType('servico');setProductTrackStock(false)}}><Plus size={16}/>Novo serviço</button>}
              </div>
            </div>
            <div className="tableWrap"><table className="productionListTable">
              <thead><tr>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-servicos','codigo')}>Código{sortMark('produtos-servicos','codigo')}</button></th>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-servicos','produto')}>Serviço{sortMark('produtos-servicos','produto')}</button></th>
                <th>Unidade</th>
                <th><button className="tableSortBtn" onClick={()=>toggleSort('produtos-servicos','preco')}>Preço de venda{sortMark('produtos-servicos','preco')}</button></th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {sortList('produtos-servicos',produtos.filter(p=>p.tipo_produto==='servico'&&searchMatches('produtos-servicos',[p.codigo,p.descricao,p.unidade,money(Number(p.preco_venda))])),{
                  codigo:p=>p.codigo||'',
                  produto:p=>p.descricao,
                  preco:p=>Number(p.preco_venda)
                }).map(p=><tr key={p.id} onDoubleClick={()=>{setProductSubtab('cadastro');startEditProduct(p)}} title="Clique duplo para editar o serviço">
                  <td><strong>{p.codigo||'—'}</strong></td>
                  <td><div className="serviceNameCell"><span className="serviceNameText">{p.descricao}</span><small className="productFinalBadge serviceProductBadge">SERVIÇO</small></div></td>
                  <td>{p.unidade||'UN'}</td>
                  <td><strong>{money(Number(p.preco_venda))}</strong></td>
                  <td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td>
                </tr>)}
                {produtos.filter(p=>p.tipo_produto==='servico').length===0&&<tr className="emptyTableRow"><td colSpan={5}><EmptyState message="Nenhum produto de serviço cadastrado." actionLabel={canManageProducts?'+ Novo serviço':undefined} onAction={canManageProducts?()=>{startNewProduct();setProductType('servico');setProductTrackStock(false)}:undefined}/></td></tr>}
              </tbody>
            </table></div>
          </article>
        </>}

        {productSubtab==='massa'&&<>
          <article className="panel bulkAdjustmentLanding">
            <div className="bulkAdjustmentLandingText">
              <div className="bulkAdjustmentIcon"><SlidersHorizontal size={22}/></div>
              <div>
                <h3>Ajustes em massa de produtos e serviços</h3>
                <p>Crie um novo ajuste, adicione apenas os itens que deseja alterar e confirme tudo de uma vez. O estoque atual não é alterado por esta ferramenta.</p>
              </div>
            </div>
            <button type="button" className="primary bulkAdjustmentNewBtn" onClick={startBulkAdjustment} disabled={!canManageProducts}><Plus size={17}/>Novo ajuste</button>
          </article>
          {bulkAdjustmentOpen&&<div className="bulkAdjustmentScreenOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!savingBulkProducts){setBulkAdjustmentOpen(false);setBulkAdjustmentItems([]);setBulkAdjustmentPicker('');setBulkProductEdits({});setBulkAdjustmentEditingId(null)}}}>
            <article className="panel bulkAdjustmentWorkspace bulkAdjustmentScreen" role="dialog" aria-modal="true" aria-label="Novo ajuste em massa">
            <div className="bulkAdjustmentHeader">
              <div>
                <span className="bulkAdjustmentEyebrow">AJUSTE EM MASSA</span>
                <h3>Novo ajuste</h3>
                <p>Pesquise e adicione produtos ou serviços. Depois altere os campos necessários e confirme o ajuste.</p>
              </div>
              <button type="button" className="iconBtn" title="Fechar ajuste" onClick={()=>{setBulkAdjustmentOpen(false);setBulkAdjustmentItems([]);setBulkAdjustmentPicker('');setBulkProductEdits({})}} disabled={savingBulkProducts}><X size={18}/></button>
            </div>

            <div className="bulkAdjustmentPickerRow">
              <div className="bulkAdjustmentPicker">
                <span>Adicionar produto / serviço</span>
                <ProductLookup
                  products={produtos.filter(p=>!bulkAdjustmentItems.includes(p.id))}
                  value={bulkAdjustmentPicker}
                  onSelect={id=>{setBulkAdjustmentPicker(id);addBulkAdjustmentProduct(id)}}
                  fullWidth
                />
              </div>
              <div className="bulkAdjustmentCounter">
                <span>Itens no ajuste</span>
                <strong>{bulkAdjustmentItems.length}</strong>
              </div>
            </div>

            <div className="bulkAdjustmentItems">
              <div className="bulkAdjustmentTableHead bulkAdjustmentTableHeadSummary">
                <span>Código</span>
                <span>Produto / serviço</span>
                <span>Quantidade</span>
                <span>Unidade</span>
                <span>Custo</span>
                <span>Venda</span>
                <span>Estoque mínimo</span>
                <span>Ações</span>
              </div>
              {bulkAdjustmentItems.map(id=>{
                const p=produtos.find(item=>item.id===id)
                if(!p)return null
                const edit=bulkProductEdits[p.id]||{}
                return <div className="bulkAdjustmentItemRow bulkAdjustmentItemSummary" key={p.id} onDoubleClick={()=>setBulkAdjustmentEditingId(p.id)} title="Clique duplo para editar este item">
                  <strong>{p.codigo||'—'}</strong>
                  <span className="bulkAdjustmentProductName">{edit.descricao??p.descricao}</span>
                  <span>{Number(edit.estoque_atual ?? p.estoque_atual ?? 0).toLocaleString('pt-BR')}</span>
                  <span>{String(edit.unidade??p.unidade??'UN')}</span>
                  <span>{money(Number(edit.custo ?? p.custo ?? 0))}</span>
                  <span>{money(Number(edit.preco_venda ?? p.preco_venda ?? 0))}</span>
                  <span>{p.tipo_produto==='servico'?'—':Number(edit.estoque_minimo ?? p.estoque_minimo ?? 0).toLocaleString('pt-BR')}</span>
                  <div className="bulkAdjustmentRowActions">
                    <button type="button" className="iconBtn" title="Editar item" onClick={()=>setBulkAdjustmentEditingId(p.id)}><Pencil size={16}/></button>
                    <button type="button" className="iconBtn dangerBtn" title="Remover do ajuste" onClick={()=>removeBulkAdjustmentProduct(p.id)} disabled={savingBulkProducts}><Trash2 size={16}/></button>
                  </div>
                </div>
              })}
              {bulkAdjustmentItems.length===0&&<div className="bulkAdjustmentEmpty">
                <Package size={24}/>
                <strong>Nenhum item adicionado</strong>
                <span>Use a pesquisa acima para anexar produtos ou serviços ao ajuste.</span>
              </div>}
            </div>

            {bulkAdjustmentEditingId&&(()=>{
              const p=produtos.find(item=>item.id===bulkAdjustmentEditingId)
              if(!p)return null
              const edit=bulkProductEdits[p.id]||{}
              return <div className="bulkAdjustmentEditOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setBulkAdjustmentEditingId(null)}}>
                <div className="bulkAdjustmentEditModal" role="dialog" aria-modal="true" aria-label="Editar item do ajuste">
                  <div className="bulkAdjustmentEditHeader">
                    <div>
                      <span className="bulkAdjustmentEyebrow">ITEM DO AJUSTE</span>
                      <h3>{p.descricao}</h3>
                      <p>{p.codigo||'Sem código'} · {p.tipo_produto==='servico'?'Serviço':'Produto'}</p>
                    </div>
                    <button type="button" className="iconBtn" onClick={()=>setBulkAdjustmentEditingId(null)}><X size={18}/></button>
                  </div>
                  <div className="bulkAdjustmentStockSnapshot">
                    <div>
                      <span>Estoque atual</span>
                      <strong>{Number(p.estoque_atual||0).toLocaleString('pt-BR',{maximumFractionDigits:3})} {p.unidade||'UN'}</strong>
                    </div>
                    <div>
                      <span>Estoque mínimo</span>
                      <strong>{Number(p.estoque_minimo||0).toLocaleString('pt-BR',{maximumFractionDigits:3})} {p.unidade||'UN'}</strong>
                    </div>
                    <div className={`bulkAdjustmentStockState ${Number(p.estoque_atual)<0?'negative':Number(p.estoque_atual)===0?'zero':Number(p.estoque_atual)<=Number(p.estoque_minimo)?'low':'normal'}`}>
                      <span>Situação</span>
                      <strong>{Number(p.estoque_atual)<0?'Estoque negativo':Number(p.estoque_atual)===0?'Sem estoque':Number(p.estoque_atual)<=Number(p.estoque_minimo)?'Estoque baixo':'Estoque normal'}</strong>
                    </div>
                  </div>
                  <div className="bulkAdjustmentEditGrid">
                    <label><span>Novo estoque / Quantidade</span><input type="number" step="0.001" value={edit.estoque_atual??Number(p.estoque_atual||0)} onChange={e=>setBulkProductField(p.id,'estoque_atual',Number(e.target.value)||0)} disabled={p.tipo_produto==='servico'}/><small>{p.tipo_produto==='servico'?'Serviços não controlam estoque.':'O valor atual acima é apenas informativo. A alteração será registrada no histórico de estoque.'}</small></label>
                    <label><span>Unidade de medida</span><input value={edit.unidade??p.unidade??'UN'} onChange={e=>setBulkProductField(p.id,'unidade',e.target.value)}/></label>
                    <label><span>Preço de custo</span><input type="number" min="0" step="0.01" value={edit.custo??Number(p.custo||0)} onChange={e=>setBulkProductField(p.id,'custo',Math.max(0,Number(e.target.value)||0))}/></label>
                    <label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={edit.preco_venda??Number(p.preco_venda||0)} onChange={e=>setBulkProductField(p.id,'preco_venda',Math.max(0,Number(e.target.value)||0))}/></label>
                    <label><span>Estoque mínimo</span><input type="number" min="0" step="0.001" value={edit.estoque_minimo??Number(p.estoque_minimo||0)} onChange={e=>setBulkProductField(p.id,'estoque_minimo',Math.max(0,Number(e.target.value)||0))} disabled={p.tipo_produto==='servico'}/></label>
                    <label><span>Status</span><select value={String(edit.ativo??p.ativo)} onChange={e=>setBulkProductField(p.id,'ativo',e.target.value==='true')}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
                  </div>
                  <div className="bulkAdjustmentEditActions">
                    <button type="button" className="ghost" onClick={()=>setBulkAdjustmentEditingId(null)}>Cancelar</button>
                    <button type="button" className="primary" onClick={()=>setBulkAdjustmentEditingId(null)}><CheckCircle2 size={16}/>Aplicar ao ajuste</button>
                  </div>
                </div>
              </div>
            })()}

            <div className="bulkAdjustmentFooter">
              <div className="bulkAdjustmentFooterInfo">
                <span>{Object.keys(bulkProductEdits).filter(id=>bulkAdjustmentItems.includes(id)).length} item(ns) com alteração</span>
                <small>Somente os itens efetivamente modificados serão atualizados.</small>
              </div>
              <div className="bulkAdjustmentFooterActions">
                <button type="button" className="ghost" onClick={()=>{setBulkAdjustmentOpen(false);setBulkAdjustmentItems([]);setBulkAdjustmentPicker('');setBulkProductEdits({})}} disabled={savingBulkProducts}>Cancelar</button>
                <button type="button" className="primary" onClick={()=>void confirmBulkAdjustment()} disabled={savingBulkProducts||bulkAdjustmentItems.length===0||Object.keys(bulkProductEdits).filter(id=>bulkAdjustmentItems.includes(id)).length===0}>
                  <CheckCircle2 size={17}/>{savingBulkProducts?'Confirmando...':'Confirmar ajuste'}
                </button>
              </div>
            </div>
          </article>
          </div>}
        </>}

        {productSubtab==='grupos'&&<ProductGroupsManager groups={gruposProdutos} subgroups={subgruposProdutos} canEdit={canManageProducts} onReload={loadData} onMessage={setMsg}/>} 

        {productSubtab==='movimentos'&&<>
          <div className="cards compactCards semanticCards">
            <article className="card semanticCard semanticPositive"><span>Entradas registradas</span><strong>{movimentosEstoque.filter(m=>m.tipo==='entrada').length}</strong><small>{movimentosEstoque.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+Math.abs(Number(m.quantidade)),0).toLocaleString('pt-BR')} unidades</small></article>
            <article className="card semanticCard semanticNegative"><span>Saídas registradas</span><strong>{movimentosEstoque.filter(m=>m.tipo==='saida').length}</strong><small>{movimentosEstoque.filter(m=>m.tipo==='saida').reduce((s,m)=>s+Math.abs(Number(m.quantidade)),0).toLocaleString('pt-BR')} unidades</small></article>
            <article className="card semanticCard semanticWarning"><span>Ajustes</span><strong>{movimentosEstoque.filter(m=>m.tipo==='ajuste').length}</strong><small>alterações manuais/importação</small></article>
          </div>

          <article className="panel tablePanel">
            <div className="panelHead">
              <div><h3>Relatório de entradas e saídas</h3><p>{movimentosEstoque.length} movimentação(ões) carregada(s)</p></div>
              <SearchField value={tableSearch['movimentos-estoque']||''} onChange={v=>setSearch('movimentos-estoque',v)} placeholder="Pesquisar data, produto, tipo, quantidade ou referência"/>
            </div>
            <div className="tableWrap"><table>
              <thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('movimentos-estoque','data')}>Data{sortMark('movimentos-estoque','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('movimentos-estoque','tipo')}>Tipo{sortMark('movimentos-estoque','tipo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('movimentos-estoque','codigo')}>Código{sortMark('movimentos-estoque','codigo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('movimentos-estoque','produto')}>Produto{sortMark('movimentos-estoque','produto')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('movimentos-estoque','quantidade')}>Quantidade{sortMark('movimentos-estoque','quantidade')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('movimentos-estoque','referencia')}>Referência / Motivo{sortMark('movimentos-estoque','referencia')}</button></th></tr></thead>
              <tbody>{sortList('movimentos-estoque',movimentosEstoque.filter(m=>{
                const p=produtos.find(x=>x.id===m.produto_id)
                const tipo=m.tipo==='entrada'?'Entrada':m.tipo==='saida'?'Saída':Number(m.quantidade)>=0?'Ajuste entrada':'Ajuste saída'
                return searchMatches('movimentos-estoque',[new Date(m.created_at).toLocaleString('pt-BR'),tipo,p?.codigo||'',p?.descricao||'',Number(m.quantidade).toLocaleString('pt-BR'),m.referencia||''])
              }),{
                data:m=>m.created_at,
                tipo:m=>m.tipo,
                codigo:m=>produtos.find(x=>x.id===m.produto_id)?.codigo||'',
                produto:m=>produtos.find(x=>x.id===m.produto_id)?.descricao||'',
                quantidade:m=>Math.abs(Number(m.quantidade)),
                referencia:m=>m.referencia||''
              }).map(m=>{
                const p=produtos.find(x=>x.id===m.produto_id)
                const isEntry=m.tipo==='entrada'||(m.tipo==='ajuste'&&Number(m.quantidade)>=0)
                const label=m.tipo==='entrada'?'Entrada':m.tipo==='saida'?'Saída':isEntry?'Ajuste entrada':'Ajuste saída'
                return <tr key={m.id} {...recordRow(()=>{setProductSubtab('cadastro');setProductPanel(m.produto_id)},p?.descricao||'produto')}>
                  <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td><span className={isEntry?'movementBadge movement-in':'movementBadge movement-out'}>{label}</span></td>
                  <td><strong>{p?.codigo||'—'}</strong></td>
                  <td>{p?.descricao||'Produto não encontrado'}</td>
                  <td><strong>{Math.abs(Number(m.quantidade)).toLocaleString('pt-BR')} {p?.unidade||''}</strong></td>
                  <td>{m.referencia||'—'}</td>
                </tr>
              })}</tbody>
            </table></div>
          </article>
        </>}
      </section>}

      {showNfeImport&&<NfeImportModal
        open={showNfeImport}
        products={produtos}
        onClose={()=>setShowNfeImport(false)}
        onImported={async result=>{
          setShowNfeImport(false)
          setMsg(`NF-e importada com sucesso na compra ${purchaseCode(result.fatura_numero)}. Pedido aprovado, aguardando recebimento. Financeiro atualizado; estoque será lançado ao receber a compra.`)
          await loadData()
        }}
      />}

      {active==='compras'&&<section className="semanticPage purchasesPage">
        <div className="subTabs" aria-label="Listas de compras">
          <button type="button" className={purchaseTab==='todas'?'subTab active':'subTab'} aria-pressed={purchaseTab==='todas'} onClick={()=>{setPurchaseTab('todas');setPurchasePanel(null)}}><ShoppingCart size={16}/>Todas as compras ({compras.length})</button>
          <button type="button" className={purchaseTab==='a_receber'?'subTab active':'subTab'} aria-pressed={purchaseTab==='a_receber'} onClick={()=>{setPurchaseTab('a_receber');setPurchasePanel(null)}}><Package size={16}/>A receber ({pendingPurchases.length})</button>
        </div>
        {purchaseTab==='todas'&&<article className="panel purchaseSuggestionPanel">
          <div className="purchaseSuggestionHead">
            <div>
              <span className="purchaseSuggestionEyebrow">Reposição de estoque</span>
              <h3>Sugestão de compra</h3>
              <p>{purchaseSuggestions.length? `${purchaseSuggestions.length} produto(s) estão no estoque mínimo ou abaixo.`:'Nenhum produto precisa de reposição neste momento.'}</p>
            </div>
            {purchaseSuggestions.length>0&&<div className="purchaseSuggestionActions">
              <div><span>Custo estimado</span><strong>{money(purchaseSuggestionTotal)}</strong></div>
              <button type="button" className="primary" disabled={!selectedSuggestions.length||!canManagePurchases} onClick={()=>addPurchaseSuggestions(selectedSuggestions)}><Plus size={16}/>Incluir selecionados ({selectedSuggestions.length})</button>
              <button type="button" className="ghost" onClick={()=>addPurchaseSuggestions()}><ShoppingCart size={16}/>Adicionar todos</button>
            </div>}
          </div>
          {purchaseSuggestionGroups.map(group=><details key={group.id} style={{border:'1px solid var(--border)',borderRadius:8,marginTop:8,overflow:'hidden'}}>
            <summary style={{cursor:'pointer',padding:'12px 14px',fontWeight:600}}>
              {group.name} · {group.items.length} produto(s)
              <span style={{marginLeft:16,fontSize:12,fontWeight:400}}>Subtotal: {money(group.total)} · {group.items.filter(item=>selectedPurchaseSuggestions[item.produto.id]).length} selecionado(s)</span>
            </summary>
            <div className="tableWrap purchaseSuggestionTable"><table>
              <thead><tr>
                <th><input type="checkbox" aria-label={'Selecionar todos de '+group.name} checked={group.items.every(item=>selectedPurchaseSuggestions[item.produto.id])} onChange={e=>{const checked=e.target.checked;setSelectedPurchaseSuggestions(prev=>{const next={...prev};group.items.forEach(item=>{next[item.produto.id]=checked});return next})}}/></th>
                <th>Produto</th><th>Estoque atual</th><th>Estoque mínimo</th><th>Alvo</th><th>Comprar</th><th>Custo estimado</th><th></th>
              </tr></thead>
              <tbody>{group.items.map(s=><tr key={s.produto.id}>
              <td><input type="checkbox" aria-label={'Selecionar '+s.produto.descricao} checked={Boolean(selectedPurchaseSuggestions[s.produto.id])} onChange={e=>{const checked=e.target.checked;setSelectedPurchaseSuggestions(prev=>({...prev,[s.produto.id]:checked}))}}/></td>
              <td><strong>{s.produto.codigo}</strong><span className="purchaseSuggestionDescription">{s.produto.descricao}</span></td>
              <td><span className="stockLevel stockLevelLow">{s.current.toLocaleString('pt-BR')} {s.produto.unidade}</span></td>
              <td>{s.minimum.toLocaleString('pt-BR')} {s.produto.unidade}</td>
              <td>{s.target.toLocaleString('pt-BR')} {s.produto.unidade}</td>
              <td><strong className="purchaseSuggestionQty">+{s.suggested.toLocaleString('pt-BR')} {s.produto.unidade}</strong></td>
              <td><strong>{money(s.suggested*Number(s.produto.custo||0))}</strong></td>
              <td><button type="button" className="ghost purchaseSuggestionAdd" onClick={()=>addPurchaseSuggestion(s.produto,s.suggested)}><Plus size={15}/>Adicionar</button></td>
            </tr>)}</tbody>
            </table></div>
          </details>)} 
        </article>}

        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingPurchase?'Editar compra':'Nova compra'}><div className="saleModalShell"><form className="panel saleForm purchaseForm saleModalForm" onSubmit={savePurchase}>
          <div className="formTitle saleModalTitle">
            <div>
              <h3>{editingPurchase?`Editar compra ${purchaseCode(editingPurchase.fatura_numero)}`:'Nova compra'}</h3>
              <p>Cotação não gera financeiro nem estoque. Pedido aprovado confirma a fatura e gera contas a pagar. Pedido recebido lança a entrada no estoque.</p>
            </div>
            <button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de compra" onClick={()=>{setShowForm(false);resetPurchaseForm();requestAnimationFrame(()=>document.getElementById('purchases-table')?.focus())}}><X size={18}/></button>
          </div>

          <div className="saleHeader saleHeaderExpanded">
            <label>Fornecedor
              <PartyLookup items={fornecedores} value={purchaseSupplier} onSelect={setPurchaseSupplier} kind="fornecedor" emptyLabel="Sem fornecedor"/>
            </label>
            <label>Status
              <select value={purchaseStatus} onChange={e=>setPurchaseStatus(e.target.value)}>
                <option value="cotacao" disabled={editingPurchase?.status==='pedido_aprovado'||editingPurchase?.status==='pedido_recebido'}>Cotação</option>
                <option value="pedido_aprovado" disabled={editingPurchase?.status==='pedido_recebido'}>Pedido aprovado</option>
                <option value="pedido_recebido">Pedido recebido</option>
              </select>
            </label>
            <label>Pagamento
              <select value={purchasePayment} onChange={e=>changePurchasePayment(e.target.value as PurchasePaymentMethod)} required>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
              </select>
            </label>
            <label>Parcelas
              <select value={purchaseInstallments} onChange={e=>resizePurchaseDates(Number(e.target.value))} disabled={purchasePayment==='pix'}>
                {Array.from({length:purchasePayment==='pix'?1:purchasePayment==='cartao'?12:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x</option>)}
              </select>
            </label>
            <label className="saleNotes">Observações
              <input value={purchaseNotes} onChange={e=>setPurchaseNotes(e.target.value)}/>
            </label>
          </div>

          <div className={`paymentNotice purchasePaymentNotice purchaseStageNotice purchaseStage-${purchaseStatus}`}>
            <strong>{purchaseStatus==='cotacao'?'Cotação — sem contas a pagar':purchaseStatus==='pedido_aprovado'?'Pedido aprovado — fatura confirmada':'Pedido recebido — estoque será atualizado'}</strong>
            <span>{purchaseStatus==='cotacao'
              ? 'O financeiro e o estoque permanecem inalterados.'
              : `${paymentLabel(purchasePayment)} • ${purchaseInstallments}x • vencimentos personalizados${purchaseStatus==='pedido_aprovado'?' • sem entrada no estoque':' • entrada no estoque ao salvar'}`}</span>
          </div>

          <div className="panel installmentDatesPanel">
            <div className="installmentDatesHead">
              <div><strong>Datas de vencimento das parcelas</strong><span>Edite cada parcela individualmente.</span></div>
            </div>
            <div className="installmentDatesGrid">
              {purchaseInstallmentDates.map((due,index)=><label key={index}>
                <span>Parcela {index+1}/{purchaseInstallments}</span>
                <input type="date" value={due} onChange={e=>changePurchaseInstallmentDate(index,e.target.value)} required/>
                <small>{money(purchaseInstallments?Math.floor((purchaseTotal/purchaseInstallments)*100)/100:0)}{index===purchaseInstallments-1?' • ajuste final':''}</small>
              </label>)}
            </div>
          </div>

          <div className="saleItemsHead">
            <h3>Itens da compra</h3>
            <button type="button" className="ghost" onClick={()=>setPurchaseItems(x=>[...x,newPurchaseItem()])}><Plus size={16}/>Adicionar item</button>
          </div>

          <div className="saleItems">
            {purchaseItems.map(i=><div className="purchaseItemRow" key={i.key}>
              <div className="saleProductPicker"><ProductLookup products={produtos} value={i.produto_id} onSelect={id=>choosePurchaseProduct(i.key,id)} fullWidth/></div>
              <input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updatePurchaseItem(i.key,'quantidade',Number(e.target.value))}/>
              <input type="number" min="0" step="0.01" value={i.custo_unitario} onChange={e=>updatePurchaseItem(i.key,'custo_unitario',Number(e.target.value))}/>
              <strong>{money(i.quantidade*i.custo_unitario)}</strong>
              <button type="button" className="iconBtn dangerBtn" onClick={()=>removePurchaseItem(i.key)}><Trash2 size={16}/></button>
            </div>)}
          </div>

          <div className="saleTotals">
            <div className="grandTotal"><span>Total a pagar</span><strong>{money(purchaseTotal)}</strong></div>
          </div>

          <div className="saleActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);resetPurchaseForm();requestAnimationFrame(()=>document.getElementById('purchases-table')?.focus())}}>Cancelar</button>
            <button className="primary" disabled={savingPurchase}>{savingPurchase?'Salvando...':purchaseStatus==='cotacao'?'Salvar cotação':purchaseStatus==='pedido_aprovado'?'Aprovar pedido':'Receber pedido'}</button>
          </div>
        </form></div></div>}

        <article id="purchases-table" tabIndex={-1} className="panel tablePanel purchasesTable">
          <div className="panelHead"><div><h3>{purchaseTab==='a_receber'?'Compras a receber':'Cotações, pedidos e compras'}</h3>{purchaseTab==='a_receber'&&<p>Pedidos aprovados aguardando chegada. Confirme o recebimento quando os produtos chegarem.</p>}</div><SearchField value={tableSearch.compras||''} onChange={v=>setSearch('compras',v)} placeholder="Pesquisar em todas as colunas"/></div>
          <div className="tableWrap"><table>
            <thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','codigo')}>Código{sortMark('compras','codigo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','fatura')}>Fatura{sortMark('compras','fatura')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','data')}>Data{sortMark('compras','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','fornecedor')}>Fornecedor{sortMark('compras','fornecedor')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','status')}>Status{sortMark('compras','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','pagamento')}>Pagamento{sortMark('compras','pagamento')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','total')}>Total{sortMark('compras','total')}</button></th><th>Gerenciar</th></tr></thead>
            <tbody>{visiblePurchases.length===0&&<tr className="emptyTableRow"><td colSpan={8}><EmptyState message={purchaseTab==='a_receber'?(pendingPurchases.length===0?'Nenhuma compra aguardando chegada.':'Nenhuma compra a receber encontrada para esta pesquisa.'):compras.length===0?'Nenhuma compra cadastrada.':'Nenhuma compra encontrada para esta pesquisa.'} actionLabel={purchaseTab==='todas'&&compras.length===0&&canManagePurchases?'+ Adicionar Compra':undefined} onAction={startNewPurchase}/></td></tr>}{visiblePurchases.map(c=>{
              const f=fornecedores.find(x=>x.id===c.fornecedor_id)
              const opened=purchasePanel===c.id
              return <Fragment key={c.id}>
                <tr {...recordRow(()=>void openPurchasePanel(c),'compra '+purchaseCode(c.fatura_numero))}>
                  <td><strong>{purchaseCode(c.fatura_numero)}</strong></td>
                  <td>{c.status==='cotacao'?'—':financialInvoiceCode(c.fatura_numero)}</td>
                  <td>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                  <td>{f?.nome||'Sem fornecedor'}</td>
                  <td><span className={`statusBadge status-${c.status==='pedido_recebido'?'faturado':c.status==='cancelada'?'cancelado':c.status==='pedido_aprovado'?'pedido':'orcamento'}`}>{purchaseStatusLabel(c.status)}</span></td>
                  <td>{paymentLabel(c.forma_pagamento)} {Number(c.parcelas)>1?`• ${c.parcelas}x`:''}</td>
                  <td><strong>{money(Number(c.total))}</strong></td>
                  <td><div className="rowActions">{purchaseTab==='a_receber'&&canManagePurchases&&<button type="button" className="ghost receivePurchaseBtn" onDoubleClick={event=>event.stopPropagation()} onClick={()=>void receivePurchase(c)}><CheckCircle2 size={15}/>Receber compra</button>}<button type="button" className="rowMenuBtn" onClick={()=>void openPurchasePanel(c)} title="Opções" aria-label="Abrir opções da compra" aria-expanded={opened}><MoreVertical size={18}/></button></div></td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={8}>
                  <div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={`Compra ${purchaseCode(c.fatura_numero)}`}>
                    <div className="recordDetailBackdrop" onClick={()=>setPurchasePanel(null)}/>
                    <div className="recordDetailSheet">
                      <div className="recordDetailHeader"><strong>{c.status==='cotacao'?'Cotação':'Compra'} {purchaseCode(c.fatura_numero)}</strong><button type="button" className="recordDetailClose" onClick={()=>setPurchasePanel(null)}><X size={17}/>Fechar</button></div>
                      <div className="invoiceManagePanel">
                    <div className="actionPanel">
                      <div className="actionMeta">
                        <strong>{c.status==='cotacao'?'Cotação '+purchaseCode(c.fatura_numero):'Fatura de compra '+financialInvoiceCode(c.fatura_numero)}</strong>
                        <span>{f?.nome||'Sem fornecedor'} • {paymentLabel(c.forma_pagamento)} • {c.parcelas}x • vencimentos individuais</span>
                      </div>
                      <div className="rowActions">
                        <button className="ghost" onClick={()=>void downloadPurchasePdf(c)}><FileDown size={15}/>PDF</button>
                        {c.status==='pedido_aprovado'&&canManagePurchases&&<button className="primary receivePurchaseBtn" onClick={()=>void receivePurchase(c)}><CheckCircle2 size={15}/>Receber compra</button>}
                        {canManagePurchases&&<button className="ghost" disabled={c.status==='cancelada'} onClick={()=>void startEditPurchase(c)}><Pencil size={15}/>Editar</button>}
                        {canManagePurchases&&<button className="warningBtn" disabled={c.status==='cancelada'} onClick={()=>void cancelPurchase(c)}><Ban size={15}/>Cancelar</button>}
                        {isAdmin&&canManagePurchases&&<button className="dangerAction" onClick={()=>void deletePurchase(c)}><Trash2 size={15}/>Excluir</button>}
                      </div>
                    </div>
                    <div className="purchaseCardDetails">
                      <div className="purchaseCardSectionHead">
                        <strong>Itens da compra</strong>
                        <span>{purchaseDetailBusy?'Carregando...':`${purchaseDetailItems.length} item(ns)`}</span>
                      </div>
                      {purchaseDetailBusy
                        ? <div className="purchaseCardEmpty">Carregando itens...</div>
                        : purchaseDetailItems.length===0
                          ? <div className="purchaseCardEmpty">Nenhum item encontrado nesta compra.</div>
                          : <div className="purchaseCardItems">
                              <div className="purchaseCardItem purchaseCardItemHead">
                                <span>Produto</span><span>Qtd.</span><span>Preço unit.</span><span>Subtotal</span>
                              </div>
                              {purchaseDetailItems.map((item,index)=>{
                                const product=produtos.find(p=>p.id===item.produto_id)
                                return <div className="purchaseCardItem" key={item.produto_id+'-'+index}>
                                  <span className="purchaseCardProduct"><strong>{product?.descricao||'Produto'}</strong><small>{product?.codigo||'Sem código'} • {product?.unidade||'UN'}</small></span>
                                  <span>{Number(item.quantidade).toLocaleString('pt-BR',{maximumFractionDigits:3})} {product?.unidade||'UN'}</span>
                                  <span>{money(Number(item.custo_unitario))}</span>
                                  <strong>{money(Number(item.total)||Number(item.quantidade)*Number(item.custo_unitario))}</strong>
                                </div>
                              })}
                            </div>}
                      <div className="purchaseCardSummary">
                        <div><span>Forma de pagamento</span><strong>{paymentLabel(c.forma_pagamento)}{Number(c.parcelas)>1?` • ${c.parcelas}x`:''}</strong></div>
                        <div><span>Subtotal</span><strong>{money(Number(c.total))}</strong></div>
                        <div className="purchaseCardTotal"><span>Total da compra</span><strong>{money(Number(c.total))}</strong></div>
                      </div>
                    </div>
                    {proofPanel('compra',c.id)}
                      </div>
                    </div>
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {active==='vendas'&&<section className="semanticPage salesPage">
        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingSale?'Editar venda':'Novo orçamento'}><div className="saleModalShell"><form className="panel saleForm salesForm saleModalForm" onSubmit={saveSale}>
          <div className="saleGeminiHeader">
            <div className="saleGeminiTitle">
              <span className="saleGeminiTitleIcon"><ReceiptText size={24}/></span>
              <div><h3>{editingSale?(editingSale.status==='orcamento'?'Editar orçamento ':'Editar venda ')+saleCode(editingSale.venda_numero):'Novo orçamento'}</h3>
              <p>O processo de venda começa como orçamento. Depois ele pode ser convertido em Pedido/Venda para gerar cobrança e movimentação de estoque.</p></div>
            </div>
            <div className={`saleGeminiNote${saleHasAuthorizationBlocker?' saleGeminiNoteBlocked':''}`} role={saleHasAuthorizationBlocker?'alert':undefined}>
              {saleHasAuthorizationBlocker?<ShieldCheck size={19}/>:<Info size={19}/>}
              <div>
                <strong>{saleHasAuthorizationBlocker?`Bloqueio identificado (${saleApprovalBlockers.length})`:'Nota de Processo'}</strong>
                {saleHasAuthorizationBlocker
                  ? <span>{saleApprovalBlockers.map(blocker=>`${blocker.label}: ${blocker.detalhe}`).join(' • ')}</span>
                  : <span>{saleStatus==='orcamento'?'Este orçamento não gera cobrança ou movimentação de estoque. Converta para Pedido/Venda para faturamento.':'Pedido/Venda gera cobrança e movimentação conforme as regras do sistema.'}</span>}
              </div>
            </div>
            <button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de venda" onClick={()=>{setShowForm(false);resetSaleForm();requestAnimationFrame(()=>document.getElementById('sales-table')?.focus())}}><X size={18}/></button>
          </div>

          {saleNotice&&<div role="alert" aria-live="assertive" style={{position:"sticky",top:0,zIndex:20,background:"#fff0f0",color:"#991b1b",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10,boxShadow:"0 5px 20px #00000016"}}><Ban size={20}/><span style={{flex:1}}><strong>Atenção:</strong> {saleNotice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setSaleNotice('')} style={{background:"transparent",border:"none",cursor:"pointer",color:"inherit"}}><X size={18}/></button></div>}
          <div className="saleDataCard">
            <div className="saleDataCardTitle"><Users size={18}/><strong>Dados do orçamento</strong></div>
          <div className="saleHeader saleHeaderExpanded">
            <label>Cliente
              <PartyLookup items={clientes} value={saleClient} onSelect={setSaleClient} kind="cliente" emptyLabel="Consumidor"/>
            </label>
            <label>Vendedor
              <SearchableSelect value={saleSeller} onChange={value=>{setSaleSeller(value);if(!editingSale)setSaleCommissionPercent('')}} placeholder="Sem vendedor / sem comissão" showSearch={false} options={vendedores.filter(v=>v.ativo||v.id===saleSeller).map(v=>({value:v.id,label:`${v.nome} — ${Number(v.percentual_comissao).toLocaleString('pt-BR')}%`,keywords:v.nome}))}/>
            </label>
            <label>Comissão desta venda (%)
              <input type="number" min="0" max="100" step="0.01" value={saleCommissionPercent} onChange={e=>setSaleCommissionPercent(e.target.value)} placeholder={saleSeller?String(Number(vendedores.find(v=>v.id===saleSeller)?.percentual_comissao||0)):'0'}/>
              <small className="saleStageHint">{saleCommissionPercent.trim()===''?(saleSeller?'Usando a comissão padrão do vendedor.':'Sem vendedor, sem comissão.'):'Percentual personalizado somente para esta venda.'}</small>
            </label>
            <label>Status
              <select value={saleStatus} onChange={e=>setSaleStatus(e.target.value)} disabled={!editingSale}>
                <option value="orcamento">Orçamento</option>
                <option value="pedido">Pedido</option>
              </select>
              {!editingSale&&<small className="saleStageHint">Toda nova venda começa como orçamento.</small>}
            </label>
            <label>Rota de entrega
              <select value={saleRoute} onChange={e=>setSaleRoute(e.target.value as DeliveryRoute)} required>
                <option value="">Selecione a rota</option>
                <option value="norte">Norte</option>
                <option value="sul">Sul</option>
                <option value="leste">Leste</option>
                <option value="interestadual">Interestadual</option>
                <option value="retirada">Retirada</option>
              </select>
            </label>
            <label>Pagamento
              <select value={salePayment} onChange={e=>changePayment(e.target.value as PaymentMethod)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
              </select>
            </label>
            <label>Parcelas
              <select value={saleInstallments} onChange={e=>resizeSaleDates(Number(e.target.value))} disabled={salePayment==='pix'||salePayment==='dinheiro'}>
                {Array.from({length:salePayment==='pix'||salePayment==='dinheiro'?1:salePayment==='cartao'?12:24},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="saleNotes">Observações
              <textarea value={saleNotes} onChange={e=>setSaleNotes(e.target.value)} placeholder="Informe observações do orçamento (opcional)"/>
            </label>
          </div>
          </div>

          {saleStatus!=='orcamento'&&<div className={`paymentNotice saleStageNotice saleStage-${saleStatus}`}>
            <strong>Pedido aprovado — aguardando faturamento pelo Financeiro</strong>
            <span>{paymentLabel(salePayment)+' • '+saleInstallments+'x indicado pelo vendedor. O Financeiro definirá datas e valores das parcelas.'}</span>
          </div>}
          <div className="saleItemsHead">
            <h3><ShoppingCart size={21}/>Itens</h3>
            <div className="saleItemQuickActions">
              <button type="button" className="ghost saleGlobalDiscountBtn" onClick={()=>{setGlobalDiscountPercent(saleDiscountPct>0?saleDiscountPct.toFixed(2).replace('.',','):'');setGlobalDiscountOpen(true)}}><BadgeDollarSign size={16}/>Desconto global</button>
              <button type="button" className="ghost" onClick={()=>void addSaleSection()}><Plus size={16}/>Adicionar seção</button>
              <button type="button" className="ghost quoteModelBtn" onClick={()=>{setQuoteModelSearch('');setQuoteModelPicker(true)}}><Boxes size={16}/>Modelo de cotação</button>
            </div>
          </div>

          <div className="saleItems saleItemsSortable">
            <div className="saleItemColumnHead" aria-hidden="true"><span></span><span>#</span><span>Produto</span><span>Observação do item</span><span>Quant.</span><span>Preço Unitário</span><span>Desconto</span><span>Total</span><span>Ações</span></div>
            {saleLayoutEntries.map(entry=>{
              if(entry.startsWith('section:')){
                const section=saleSections.find(row=>'section:'+row.key===entry)
                if(!section)return null
                return <div
                  className="saleQuoteSectionRow saleQuoteSectionInline"
                  key={section.key}
                  onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}}
                  onDrop={e=>{e.preventDefault();const source=e.dataTransfer.getData('text/plain');if(source)moveSaleLayout(source,entry)}}
                >
                  <span className="saleQuoteSectionHandle" draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',entry)}} title="Arraste para mover a seção"><GripVertical size={16}/></span>
                  <input value={section.titulo} onChange={e=>updateSaleSection(section.key,e.target.value)} placeholder="Nome da seção" aria-label="Nome da seção"/>
                  <div className="saleQuoteSectionTotal"><span>Total da seção</span><strong>{money(saleSectionTotal(section.key))}</strong></div>
                  <button type="button" className="iconBtn dangerBtn" onClick={()=>removeSaleSection(section.key)} title="Remover seção"><Trash2 size={14}/></button>
                </div>
              }

              const i=saleItems.find(row=>'item:'+row.key===entry)
              if(!i)return null
              const stock=saleItemStockInfo(i)
              const productionMaterials=productionMaterialsForItem(i)
              return <div
                className="saleItemRow saleItemSortableRow"
                id={'sale-item-'+i.key}
                key={i.key}
                onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}}
                onDrop={e=>{e.preventDefault();const source=e.dataTransfer.getData('text/plain');if(source)moveSaleLayout(source,entry)}}
              >
                <span className="saleItemDragHandle" draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',entry)}} title="Arraste para reorganizar"><GripVertical size={17}/></span>
                <span className="saleItemIndex">{saleItems.findIndex(row=>row.key===i.key)+1}</span>
                <div className="saleProductPicker"><ProductLookup products={produtos} value={i.produto_id} onSelect={id=>chooseProduct(i.key,id)} fullWidth/></div>
                <label className="saleItemNoteField"><span>Observação</span><input type="text" maxLength={240} value={i.observacao_item} onChange={e=>updateSaleItemNote(i.key,e.target.value)} placeholder="Ex.: medida, acabamento, reforço..."/></label>
                <label className="saleItemField"><span>Quant.</span><input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updateSaleItem(i.key,'quantidade',Number(e.target.value))}/></label>
                <label className="saleItemField"><span>Preço Unitário</span><input type="number" min="0" step="0.01" value={i.valor_unitario||''} onChange={e=>updateSaleItem(i.key,'valor_unitario',Number(e.target.value))}/></label>
                <label className="saleItemField"><span>Desconto</span><input type="number" min="0" step="0.01" value={i.desconto} onChange={e=>updateSaleItem(i.key,'desconto',Number(e.target.value))}/></label>
                <strong>{money(Math.max(0,i.quantidade*i.valor_unitario-i.desconto))}</strong>
                <div className="saleItemActions">
                  <button type="button" className="saleItemEditBtn" title="Editar item" onClick={()=>{const row=document.getElementById('sale-item-'+i.key);(row?.querySelector('input') as HTMLInputElement|null)?.focus()}}><Pencil size={14}/></button>
                  <button type="button" className="saleItemDeleteBtn" title="Excluir item" onClick={()=>removeSaleItem(i.key)}><Trash2 size={14}/></button>
                </div>
                {stock&&<div className={'saleStockHint stock-'+stock.kind}><span>{stock.label}</span><small>{stock.detail}</small>{saleConsumesStock&&stock.kind!=='ok'&&<b>{canManageAuthorizations?'Você pode autorizar esta exceção.':'Venda bloqueada: solicite autorização a um usuário autorizado.'}</b>}</div>}
                {(produtos.find(p=>p.id===i.produto_id)?.tipo_produto==='produto_final'||produtoComponentes.some(row=>row.produto_final_id===i.produto_id)||i.receita_producao.length>0)&&<div className="saleProductionMaterials saleProductionRecipeEditor">
                  <div className="saleProductionMaterialsTitle">
                    <Boxes size={15}/>
                    <div><strong>Receita deste item</strong><span>Materiais, quantidades e preços podem ser ajustados somente para esta venda.</span></div>
                    <div className="saleProductionRecipeActions">
                      <span className="saleRecipeValue">Receita/un.: <strong>{money(i.receita_producao.reduce((sum,row)=>sum+Number(row.quantidade||0)*Number(row.valor_unitario||0),0))}</strong></span>
                      <button type="button" className="ghost compactBtn" onClick={()=>updateSaleItem(i.key,'valor_unitario',i.receita_producao.reduce((sum,row)=>sum+Number(row.quantidade||0)*Number(row.valor_unitario||0),0))}>Usar total como preço</button>
                      <button type="button" className="ghost compactBtn" onClick={()=>resetSaleRecipe(i.key,i.produto_id)}>Restaurar padrão</button>
                      <button type="button" className="ghost compactBtn" onClick={()=>addSaleRecipeItem(i.key)}><Plus size={14}/>Material</button>
                    </div>
                  </div>
                  {i.receita_producao.length===0?<div className="saleProductionRecipeEmpty">Este produto de produção está sem receita configurada. Adicione os materiais necessários.</div>:<div className="saleProductionRecipeRows">
                    {productionMaterials.map(({row,componente,quantidade,total},idx)=><div key={row.key} className={'saleProductionRecipeRow'+(componente&&Number(componente.estoque_atual)<quantidade?' productionMaterialShort':'')}>
                      <span className="saleProductionRecipeIndex">{idx+1}</span>
                      <ProductLookup products={produtos.filter(p=>p.ativo&&p.id!==i.produto_id)} value={row.componente_id} onSelect={id=>updateSaleRecipeItem(i.key,row.key,'componente_id',id)} fullWidth/>
                      <label><span>Qtd./un.</span><input type="number" min="0.001" step="0.001" value={row.quantidade} onChange={e=>updateSaleRecipeItem(i.key,row.key,'quantidade',Number(e.target.value))}/></label>
                      <label><span>Preço unit.</span><input type="number" min="0" step="0.01" value={row.valor_unitario||''} onChange={e=>updateSaleRecipeItem(i.key,row.key,'valor_unitario',Number(e.target.value))}/></label>
                      <div className="saleProductionRecipeTotal"><span>Total na venda</span><strong>{money(total)}</strong><small>{quantidade.toLocaleString('pt-BR',{maximumFractionDigits:3})} {componente?.unidade||''}{componente?' · Estoque '+Number(componente.estoque_atual).toLocaleString('pt-BR')+' '+componente.unidade:''}</small></div>
                      <button type="button" className="iconBtn dangerBtn" onClick={()=>removeSaleRecipeItem(i.key,row.key)} title="Remover material"><Trash2 size={15}/></button>
                    </div>)}
                  </div>}
                </div>}
              </div>
            })}
          </div>

          <div className="saleAddProductBelowTable">
            <button type="button" className="primary saleAddProductBtn" onClick={addSaleItem}><Plus size={16}/>Adicionar produto</button>
          </div>

          {saleStatus!=='orcamento'&&saleBelowStockMinimum.length>0&&saleStockShortages.length===0&&<div className="stockMinimumNotice">
            <strong>Aviso de estoque mínimo</strong>
            <span>Esta venda pode ser concluída normalmente. Alguns itens ficarão abaixo do estoque mínimo configurado após a saída.</span>
          </div>}

          <div className="saleBottomBar">
            <div className="saleBottomRight">
              <div className="saleTotals">
                <div><span>Subtotal</span><strong>{money(saleSubtotal)}</strong></div>
                <div><span>Desconto</span><strong>{money(saleDiscount)}</strong></div>
                <div className="grandTotal"><span>Total</span><strong>{money(saleTotal)}</strong></div>
              </div>
              <div className="saleActions">
                <button type="button" className="ghost" onClick={()=>{setShowForm(false);resetSaleForm();requestAnimationFrame(()=>document.getElementById('sales-table')?.focus())}}>Cancelar</button>
                {editingSale&&saleStatus!=='orcamento'&&saleHasAuthorizationBlocker&&<button
                  type="button"
                  className="authorizationRequestBtn"
                  disabled={savingSale||saleApprovals.some(a=>a.entidade_id===editingSale.id)}
                  onClick={()=>void requestSaleAuthorization()}
                ><ShieldCheck size={17}/>Solicitar autorização ({saleApprovalBlockers.length})</button>}
                <button className="primary" disabled={savingSale||(saleStatus!=='orcamento'&&saleHasAuthorizationBlocker)} title={saleHasAuthorizationBlocker?'Use Solicitar autorização para avançar esta venda.':''}>{savingSale?'Salvando...':!editingSale?'Salvar orçamento':saleStatus==='orcamento'?'Salvar orçamento':'Salvar como pedido'}</button>
              </div>
            </div>
          </div>
        </form></div></div>}

        {globalDiscountOpen&&showForm&&<div className="saleModalOverlay quoteModelOverlay" role="dialog" aria-modal="true" aria-label="Desconto global">
          <div className="globalDiscountDialog">
            <div className="globalDiscountHeader">
              <div><strong>Desconto global</strong><span>Aplicar o mesmo percentual proporcionalmente em todos os itens desta venda.</span></div>
              <button type="button" className="iconBtn" onClick={()=>setGlobalDiscountOpen(false)} aria-label="Fechar"><X size={17}/></button>
            </div>
            <label className="globalDiscountField">
              <span>Percentual de desconto (%)</span>
              <input autoFocus type="text" inputMode="decimal" value={globalDiscountPercent} onChange={e=>setGlobalDiscountPercent(e.target.value.replace(/[^0-9,.]/g,''))} placeholder="Ex.: 5"/>
              <small>O desconto será distribuído entre os itens conforme o valor bruto de cada linha.</small>
            </label>
            <div className="globalDiscountPreview">
              <span>Subtotal atual <strong>{money(saleSubtotal)}</strong></span>
              <span>Desconto estimado <strong>{money(saleSubtotal*(Math.max(0,Math.min(100,Number(globalDiscountPercent.replace(',','.'))||0))/100))}</strong></span>
              <span>Total estimado <strong>{money(saleSubtotal*(1-Math.max(0,Math.min(100,Number(globalDiscountPercent.replace(',','.'))||0))/100))}</strong></span>
            </div>
            <div className="globalDiscountActions">
              <button type="button" className="ghost" onClick={()=>setGlobalDiscountOpen(false)}>Cancelar</button>
              <button type="button" className="primary" onClick={applyGlobalDiscount}>Aplicar desconto</button>
            </div>
          </div>
        </div>}

        {quoteModelPicker&&showForm&&<div className="saleModalOverlay quoteModelOverlay" role="dialog" aria-modal="true" aria-label="Modelo de cotação">
          <div className="quoteModelDialog">
            <div className="quoteModelHeader">
              <div><strong>Modelo de cotação</strong><span>Selecione um produto final para adicionar à cotação com sua receita de produção.</span></div>
              <button type="button" className="iconBtn" onClick={()=>setQuoteModelPicker(false)} aria-label="Fechar"><X size={17}/></button>
            </div>
            <div className="quoteModelSearch"><Search size={16}/><input autoFocus value={quoteModelSearch} onChange={e=>setQuoteModelSearch(e.target.value)} placeholder="Pesquisar produto final por código ou descrição..."/></div>
            <div className="quoteModelList">
              {produtos.filter(p=>p.ativo&&p.tipo_produto==='produto_final'&&normalizeSearch([p.codigo,p.descricao,p.unidade].join(' ')).includes(normalizeSearch(quoteModelSearch))).map(p=><button type="button" key={p.id} className="quoteModelProduct" onClick={()=>addQuoteModelProduct(p.id)}>
                <span className="quoteModelProductIcon"><Boxes size={17}/></span>
                <span><strong>{p.codigo} — {p.descricao}</strong><small>{p.unidade||'UN'} · {money(Number(p.preco_venda||0))} · {produtoComponentes.filter(row=>row.produto_final_id===p.id).length} material(is)</small></span>
                <ChevronRight size={17}/>
              </button>)}
              {produtos.filter(p=>p.ativo&&p.tipo_produto==='produto_final'&&normalizeSearch([p.codigo,p.descricao,p.unidade].join(' ')).includes(normalizeSearch(quoteModelSearch))).length===0&&<div className="quoteModelEmpty">Nenhum produto final encontrado.</div>}
            </div>
          </div>
        </div>}

        {openedSale?(()=>{
          const v=openedSale
          const client=clientes.find(x=>x.id===v.cliente_id)
          const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id)
          const paymentStatus=salePaymentStatus(v)
          const approval=pendingSaleApproval(v.id)
          const waiting=Boolean(approval&&v.status==='orcamento')
          return <div className="recordDetailOverlay saleRecordOverlay" role="dialog" aria-modal="true" aria-label={`Venda ${saleCode(v.venda_numero)}`}>
            <div className="recordDetailBackdrop" onClick={closeSaleDetail}/>
            <div className="recordDetailSheet recordDetailSheetWide saleRecordSheet">
              <div className="recordDetailHeader"><strong>Venda #{saleCode(v.venda_numero)}</strong><button type="button" className="recordDetailClose" onClick={closeSaleDetail}><X size={17}/>Fechar</button></div>
              <article className="panel saleDetailPage">
            <div className="saleDetailTopbar">
              <button type="button" className="ghost" onClick={closeSaleDetail}><ChevronLeft size={16}/>Voltar para lista</button>
              <div className="saleDetailActions">
                <button type="button" className="documentPdfButton" onClick={()=>void downloadSalePdf(v)}><FileDown size={16}/>{v.status==='orcamento'?'PDF Orçamento':'PDF Venda'}</button>
                <button type="button" className="documentPrintButton" onClick={()=>void printSalePdf(v)}><Printer size={16}/>Imprimir</button>
                {canManageSales&&v.status==='orcamento'&&<button type="button" className="primary advanceSaleBtn" disabled={savingSale||waiting} title={waiting?'Aguardando aprovação administrativa':'Avançar orçamento para pedido'} onClick={()=>void advanceSaleToOrder(v)}><CheckCircle2 size={15}/>{waiting?'Aguardando autorização':'Avançar para pedido'}</button>}
                {canManageSales&&<button type="button" className="ghost" disabled={v.status==='cancelado'||v.status==='faturado'||faturasVendas.some(f=>f.venda_id===v.id&&f.status==='ativa')||waiting} title={(v.status==='faturado'||faturasVendas.some(f=>f.venda_id===v.id&&f.status==='ativa'))?'Venda faturada não pode ser alterada.':waiting?'Aguardando aprovação administrativa':''} onClick={()=>void startEditSale(v)}><Pencil size={15}/>{(v.status==='faturado'||faturasVendas.some(f=>f.venda_id===v.id&&f.status==='ativa'))?'Faturada':'Editar'}</button>}
                <button type="button" className="ghost" disabled={saleHistoryBusy} onClick={()=>void loadSaleHistory(v)}><RefreshCw size={15}/>{saleHistoryBusy?'Carregando...':'Histórico'}</button>
                {isAdmin&&canManageConfig&&canManageSales&&<button type="button" className="ghost" onClick={()=>setSaleDetailTab('documentos')}><ReceiptText size={15}/>NF-e / documentos</button>}
                {canManageSales&&<button type="button" className="warningBtn" disabled={v.status==='cancelado'} onClick={()=>void cancelSale(v)}><Ban size={15}/>Cancelar</button>}
                {isAdmin&&canManageSales&&<button type="button" className="dangerAction" onClick={()=>void deleteSale(v)}><Trash2 size={15}/>Excluir</button>}
              </div>
            </div>

            <div className="saleDetailStatusBar">
              <div>
                <span className="saleDetailEyebrow">{v.status==='orcamento'?'ORÇAMENTO':'VENDA / FATURA'}</span>
                <h2>#{saleCode(v.venda_numero)}</h2>
              </div>
              <div className="saleDetailBadges">
                {waiting
                  ? <span className="statusBadge approvalPendingBadge">Aguardando aprovação</span>
                  : <span className={'statusBadge status-'+v.status}>{saleStatusDisplay(v)}</span>}
                <span className={'statusBadge payment-'+paymentStatus.key}>{paymentStatus.label}</span>
              </div>
            </div>

            <div className="saleDetailSummaryGrid">
              <div><span>Cliente</span><strong>{client?.nome||'Consumidor'}</strong></div>
              <div><span>Data da venda</span><strong>{new Date(v.created_at).toLocaleString('pt-BR')}</strong></div>
              <div><span>Rota</span><strong>{deliveryRouteLabel(v.rota_entrega)}</strong></div>
              <div><span>Vendedor</span><strong>{seller?.nome||'—'}</strong></div>
              <div><span>Comissão</span><strong>{seller?(Number(v.percentual_comissao??seller.percentual_comissao).toLocaleString('pt-BR')+'%'+(v.percentual_comissao!=null?' · específica desta venda':'')):'—'}</strong></div>
              <div><span>Pagamento</span><strong>{paymentLabel(v.forma_pagamento)} · {v.parcelas}x</strong></div>
              <div><span>1º vencimento</span><strong>{dateBr(v.primeiro_vencimento)}</strong></div>
              <div><span>Total</span><strong className="saleDetailTotal">{money(Number(v.total))}</strong></div>
            </div>

            <div className="saleDetailTabs" role="tablist" aria-label="Detalhes da venda">
              <button type="button" className={saleDetailTab==='itens'?'active':''} onClick={()=>setSaleDetailTab('itens')}>Itens da venda</button>
              <button type="button" className={saleDetailTab==='informacoes'?'active':''} onClick={()=>setSaleDetailTab('informacoes')}>Outras informações</button>
              <button type="button" className={saleDetailTab==='documentos'?'active':''} onClick={()=>setSaleDetailTab('documentos')}>Documentos / NF-e</button>
              <button type="button" className={saleDetailTab==='historico'?'active':''} onClick={()=>void loadSaleHistory(v)}>Histórico</button>
            </div>

            {saleDetailTab==='itens'&&<div className="saleDetailSection">
              <div className="tableWrap"><table className="saleItemsDetailTable">
                <thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Desconto</th><th>Valor</th></tr></thead>
                <tbody>
                  {saleDetailItems.length===0&&<tr className="emptyTableRow"><td colSpan={5}><div className="emptyState">Nenhum item nesta venda.</div></td></tr>}
                  {(Array.isArray(v.layout_itens)&&v.layout_itens.length?v.layout_itens:null)?.map((entry,index)=>{
                    if(entry.tipo==='section'){
                      let sectionTotal=0
                      for(let cursor=index+1;cursor<v.layout_itens!.length;cursor++){
                        const next=v.layout_itens![cursor]
                        if(next.tipo==='section')break
                        sectionTotal+=Number(next.total||0)
                      }
                      return <tr key={'section-'+index} className="saleDetailSectionRow"><td colSpan={5}><strong>{entry.titulo}</strong><span>Total da seção: {money(sectionTotal)}</span></td></tr>
                    }
                    const product=produtos.find(p=>p.id===entry.produto_id)
                    return <tr key={'layout-item-'+index}>
                      <td>{product&&isAdmin&&canManageProducts
                        ? <button type="button" className="saleProductLink saleProductInline" onClick={()=>{closeSaleDetail();setActive('produtos');setProductSubtab('cadastro');startEditProduct(product,v.id)}} title="Abrir produto para editar">{product.codigo?product.codigo+' — ':''}{product.descricao}</button>
                        : <strong className="saleProductInline">{product?.codigo?product.codigo+' — ':''}{product?.descricao||'Produto'}</strong>}</td>
                      <td>{Number(entry.quantidade).toLocaleString('pt-BR')}</td>
                      <td>{money(Number(entry.valor_unitario))}</td>
                      <td>{money(Number(entry.desconto))}</td>
                      <td><strong>{money(Number(entry.total))}</strong></td>
                    </tr>
                  })||saleDetailItems.map((item,index)=>{
                    const product=produtos.find(p=>p.id===item.produto_id)
                    return <tr key={item.produto_id+'-'+index}>
                      <td>{product&&isAdmin&&canManageProducts
                        ? <button type="button" className="saleProductLink saleProductInline" onClick={()=>{closeSaleDetail();setActive('produtos');setProductSubtab('cadastro');startEditProduct(product,v.id)}} title="Abrir produto para editar">{product.codigo?product.codigo+' — ':''}{product.descricao}</button>
                        : <strong className="saleProductInline">{product?.codigo?product.codigo+' — ':''}{product?.descricao||'Produto'}</strong>}</td>
                      <td>{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                      <td>{money(Number(item.valor_unitario))}</td>
                      <td>{money(Number(item.desconto))}</td>
                      <td><strong>{money(Number(item.total))}</strong></td>
                    </tr>
                  })}
                </tbody>
              </table></div>
              <div className="saleDetailTotals">
                <span>Subtotal <strong>{money(Number(v.subtotal))}</strong></span>
                <span>Desconto <strong>{money(Number(v.desconto))}</strong></span>
                <span>Total <strong>{money(Number(v.total))}</strong></span>
              </div>
            </div>}

            {saleDetailTab==='informacoes'&&<div className="saleDetailSection saleDetailInfo">
              <div className="saleInfoGroup">
                <h4>Venda</h4>
                <div><span>Status</span><strong>{saleStatusDisplay(v)}</strong></div>
                <div><span>Rota de entrega</span><strong>{deliveryRouteLabel(v.rota_entrega)}</strong></div>
                <div><span>Vendedor</span><strong>{seller?.nome||'—'}</strong></div>
                <div><span>Comissão</span><strong>{seller?Number(seller.percentual_comissao).toLocaleString('pt-BR')+'%':'—'}</strong></div>
              </div>
              <div className="saleInfoGroup">
                <h4>Faturamento</h4>
                <div><span>Pagamento indicado</span><strong>{paymentLabel(v.forma_pagamento)}</strong></div>
                <div><span>Parcelas indicadas</span><strong>{v.parcelas}x</strong></div>
                <div><span>Status da fatura</span><strong>{saleInvoiceStatus(v).label}</strong></div>
                <div><span>Status do pagamento</span><strong>{paymentStatus.label}</strong></div>
              </div>
              {canViewFinance&&(()=>{
                const titles=financialTitlesForSale(v.id).filter(t=>t.status!=='cancelado').sort((a,b)=>Number(a.parcela_numero||0)-Number(b.parcela_numero||0)||a.vencimento.localeCompare(b.vencimento))
                const paid=titles.filter(t=>Math.round(Number(t.valor_pago)*100)>=Math.round(Number(t.valor)*100))
                const residual=titles.reduce((sum,t)=>sum+Math.max(0,Math.round(Number(t.valor)*100)-Math.round(Number(t.valor_pago)*100)),0)/100
                const openTitle=(t:Titulo)=>{
                  setFinancePanelReturnModule('vendas')
                  setFinancePanelReturnSubtab(null)
                  setActive('financeiro')
                  setFinanceSubtab('receber')
                  setFinanceStatusFilter('todos')
                  setFinanceStart('');setFinanceEnd('');setFinanceCategory('todos');setFinanceCenter('todos')
                  setSearch('financeiro-receber','')
                  setFinancePanelTab('pagamentos')
                  selectFinanceTitleInPanel(t)
                }
                return <div className="saleInfoGroup" style={{gridColumn:'1 / -1'}}>
                  <h4>Parcelas e saldo da fatura</h4>
                  {!titles.length?<p>Nenhuma fatura ativa vinculada a esta venda.</p>:<>
                    <div><span>Parcelas pagas</span><strong>{paid.length} de {titles.length}</strong></div>
                    <div><span>Parcelas pendentes (inclui parciais)</span><strong>{titles.length-paid.length}</strong></div>
                    <div><span>Total residual</span><strong>{money(residual)}</strong></div>
                    {titles.map(t=>{
                      const invoice=t.fatura_venda_id?faturasVendas.find(f=>f.id===t.fatura_venda_id):undefined
                      const remaining=Math.max(0,Math.round(Number(t.valor)*100)-Math.round(Number(t.valor_pago)*100))/100
                      const label=invoice?financialInvoiceCode(invoice.numero):t.descricao
                      return <div key={t.id} style={{flexWrap:'wrap',gap:8}}>
                        <span>{canManageFinance?<button type="button" className="financeOriginLink" onClick={()=>openTitle(t)} title="Abrir fatura no Financeiro">{label}<ExternalLink size={12}/></button>:label} · Parcela {t.parcela_numero||1} · {dateBr(t.vencimento)}</span>
                        <strong>{remaining===0?'Paga':Number(t.valor_pago)>0?'Parcial':'Pendente'} · Pago {money(Number(t.valor_pago))} · Residual {money(remaining)}</strong>
                      </div>
                    })}
                    {titles.some(t=>t.fatura_venda_id&&faturaVendaItens.filter(i=>i.fatura_id===t.fatura_venda_id).length>1)&&<p>Fatura consolidada: os valores incluem todas as vendas vinculadas à fatura.</p>}
                  </>}
                </div>
              })()}
              <div className="saleNotesBox">
                <h4>Anotações</h4>
                <p>{v.observacoes||'Nenhuma anotação registrada.'}</p>
              </div>
            </div>}

            {saleDetailTab==='documentos'&&<div className="saleDetailSection saleDocumentsGrid">
              <div>{proofPanel('venda',v.id)}</div>
              <div>{isAdmin?<FocusNfeSale saleId={v.id}/>:<div className="paymentNotice">Emissão de NF-e disponível somente para o Administrador.</div>}</div>
            </div>}
            {saleDetailTab==='historico'&&<div className="saleDetailSection saleHistoryPanel">
              <div className="saleHistoryHead"><div><h4>Histórico completo</h4><p>Registro somente leitura de alterações, pagamentos, estoque, autorizações e documentos.</p></div><button type="button" className="ghost" disabled={saleHistoryBusy} onClick={()=>void loadSaleHistory(v)}><RefreshCw size={14}/>{saleHistoryBusy?'Atualizando...':'Atualizar'}</button></div>
              <div className="saleHistoryTimeline">
                {!saleHistoryBusy&&saleHistory.length===0&&<div className="emptyState">Nenhum evento registrado para esta venda.</div>}
                {saleHistory.map(event=>{
                  const changes=historyChanges(event).filter(change=>!['payload','dados_fiscais','retorno','detalhes'].includes(change.key))
                  const visible=changes.slice(0,3)
                  const technical=changes.length>3||Boolean(event.dados_depois&&Object.keys(event.dados_depois).some(key=>['payload','dados_fiscais','retorno','detalhes'].includes(key)))
                  return <article key={event.evento_id} className="saleHistoryEvent compactHistoryEvent">
                    <div className="saleHistoryDot"/>
                    <div className="saleHistoryCard compactHistoryCard">
                      <div className="saleHistoryMeta compactHistoryMeta">
                        <div><strong>{event.usuario_nome||'Sistema'}</strong><span>{historyLabel(event)}</span></div>
                        <time>{new Date(event.ocorrido_em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time>
                      </div>
                      {visible.length>0&&<div className="saleHistoryInlineChanges">{visible.map(change=><div key={change.key}><span>{historyFieldLabel(change.key)}</span><strong>{historyValue(change.before)} <b>→</b> {historyValue(change.after)}</strong></div>)}</div>}
                      {visible.length===0&&event.dados_depois&&<div className="saleHistoryInlineChanges">{Object.entries(event.dados_depois).filter(([key])=>!['id','created_at','updated_at','venda_id','payload','dados_fiscais','retorno','detalhes'].includes(key)).slice(0,2).map(([key,value])=><div key={key}><span>{historyFieldLabel(key)}</span><strong>{historyValue(value)}</strong></div>)}</div>}
                      {technical&&<details className="saleHistoryTechnical"><summary>Ver detalhes</summary><pre>{JSON.stringify({antes:event.dados_antes,depois:event.dados_depois},null,2)}</pre></details>}
                    </div>
                  </article>
                })}
              </div>
            </div>}
              </article>
            </div>
          </div>
        })():<article id="sales-table" tabIndex={-1} className="panel tablePanel salesTable salesModernTable">
          <div className="salesModernHead">
            <div><h3>Pedidos / Vendas</h3><p>Gerencie e acompanhe os orçamentos, pedidos e vendas da empresa.</p></div>
            <div className="salesModernActions">
              <div className="salesSearchBox"><Search size={16}/><input value={tableSearch.vendas||''} onChange={e=>{setSearch('vendas',e.target.value);setSalePage(1)}} placeholder="Pesquisar em todas as colunas..."/></div>
              <button type="button" className={saleFiltersOpen?'salesFilterButton active':'salesFilterButton'} onClick={()=>setSaleFiltersOpen(v=>!v)}><SlidersHorizontal size={16}/>Filtros avançados</button>
            </div>
          </div>
          {saleFiltersOpen&&<div className="salesAdvancedFilters">
            <label>Status<select value={saleStatusFilter} onChange={e=>{setSaleStatusFilter(e.target.value);setSalePage(1)}}><option value="todos">Todos</option><option value="orcamento">Orçamento</option><option value="pedido">Pedido</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option></select></label>
            <label>Pagamento<select value={salePaymentFilter} onChange={e=>{setSalePaymentFilter(e.target.value);setSalePage(1)}}><option value="todos">Todos</option><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select></label>
            <label>Status pagto<select value={salePaymentStateFilter} onChange={e=>{setSalePaymentStateFilter(e.target.value);setSalePage(1)}}><option value="todos">Todos</option><option value="nao-pago">Não pago</option><option value="parcial">Parcial</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select></label>
            <label>Rota<select value={saleRouteFilter} onChange={e=>{setSaleRouteFilter(e.target.value);setSalePage(1)}}><option value="todos">Todas</option><option value="retirada">Retirada</option><option value="norte">Norte</option><option value="sul">Sul</option><option value="leste">Leste</option><option value="interestadual">Interestadual</option></select></label>
            <button type="button" className="ghost" onClick={()=>{setSaleStatusFilter('todos');setSalePaymentFilter('todos');setSalePaymentStateFilter('todos');setSaleRouteFilter('todos');setSalePage(1)}}>Limpar filtros</button>
          </div>}
          <div className="tableWrap"><table className="salesCompactTable salesUxTable">
            <thead><tr>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','fatura')}>Documento{sortMark('vendas','fatura')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','data')}>Data{sortMark('vendas','data')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','cliente')}>Cliente{sortMark('vendas','cliente')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','vendedor')}>Vendedor{sortMark('vendas','vendedor')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','status')}>Tipo{sortMark('vendas','status')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','pagamento')}>Forma de pagamento{sortMark('vendas','pagamento')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','faturamento')}>Status de faturamento{sortMark('vendas','faturamento')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','statuspag')}>Status de pagamento{sortMark('vendas','statuspag')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','rota')}>Rota{sortMark('vendas','rota')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','total')}>Valor total{sortMark('vendas','total')}</button></th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              {visibleSales.length===0&&<tr className="emptyTableRow"><td colSpan={11}><EmptyState message={vendas.length===0?'Nenhuma venda cadastrada.':'Nenhuma venda encontrada para esta pesquisa/filtro.'} actionLabel={vendas.length===0&&canManageSales?'+ Adicionar Venda':undefined} onAction={startNewSale}/></td></tr>}
              {visibleSales.map(v=>{
                const client=clientes.find(x=>x.id===v.cliente_id)
                const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id)
                const clientName=client?.nome||'Consumidor'
                const sellerName=seller?.nome||'Sem vendedor'
                const paymentStatus=salePaymentStatus(v)
                const waiting=Boolean(pendingSaleApproval(v.id)&&v.status==='orcamento')
                const actionOpen=saleActionMenu===v.id
                return <tr key={v.id} {...recordRow(()=>void openSaleDetail(v),'venda '+saleCode(v.venda_numero))}>
                  <td><strong className="salesDocument">#{saleCode(v.venda_numero)}</strong></td>
                  <td>{new Date(v.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><div className="salesIdentity"><span className="salesAvatar">{nameInitials(clientName)}</span><span>{clientName}</span></div></td>
                  <td><div className="salesIdentity salesSellerIdentity"><span className="salesAvatar sellerAvatar">{nameInitials(sellerName)}</span><span className="salesSellerName">{seller?.nome||'—'}</span></div></td>
                  <td>{waiting
                    ? <span className="salesStatus salesStatusPending">Aguardando aprovação</span>
                    : <span className={'salesStatus salesStatus-'+v.status}>{saleStatusDisplay(v)}</span>}</td>
                  <td><span className="salesPaymentText">{paymentLabel(v.forma_pagamento)}{Number(v.parcelas)>1?' • '+v.parcelas+'x':''}</span></td>
                  <td><span className={'billingInvoiceBadge billingInvoice-'+saleInvoiceStatus(v).key}>{saleInvoiceStatus(v).label}</span></td>
                  <td><span className={'salesPaymentStatus salesPaymentStatus-'+paymentStatus.key}>{paymentStatus.label}</span></td>
                  <td><span className="salesRoute"><MapPin size={14}/>{deliveryRouteLabel(v.rota_entrega)}</span></td>
                  <td><strong className="salesTotal">{money(Number(v.total))}</strong></td>
                  <td className="salesActionsCell"><div className="salesRowMenuWrap"><button type="button" className="rowMenuBtn" onClick={e=>{e.stopPropagation();setSaleActionMenu(actionOpen?null:v.id)}} title="Ações" aria-label="Ações da venda" aria-expanded={actionOpen}><MoreVertical size={18}/></button>
                    {actionOpen&&<div className="salesRowMenu" onClick={e=>e.stopPropagation()}>
                      <button type="button" onClick={()=>{setSaleActionMenu(null);void openSaleDetail(v)}}>Abrir venda</button>
                      <button type="button" onClick={()=>openSaleFinancialStatement(v)}><ReceiptText size={14}/>Abrir Extrato Financeiro</button>
                      <button type="button" onClick={()=>{setSaleActionMenu(null);void downloadSalePdf(v)}}><FileDown size={14}/>Baixar PDF</button>
                    </div>}
                  </div></td>
                </tr>
              })}
            </tbody>
          </table></div>
          <div className="salesPagination">
            <span>{filteredSalesList.length?'Exibindo '+(saleStart+1)+'-'+Math.min(saleStart+visibleSales.length,filteredSalesList.length)+' de '+filteredSalesList.length+' resultados':'Exibindo 0 resultados'}</span>
            <div className="salesPager">
              <button type="button" disabled={safeSalePage<=1} onClick={()=>setSalePage(p=>Math.max(1,p-1))}><ChevronLeft size={15}/></button>
              {salePageNumbers.map((p,index)=><Fragment key={p}>{index>0&&p-salePageNumbers[index-1]>1&&<span className="salesPagerDots">…</span>}<button type="button" className={p===safeSalePage?'active':''} onClick={()=>setSalePage(p)}>{p}</button></Fragment>)}
              <button type="button" disabled={safeSalePage>=saleTotalPages} onClick={()=>setSalePage(p=>Math.min(saleTotalPages,p+1))}><ChevronRight size={15}/></button>
            </div>
          </div>
        </article>}
      </section>}

      {active==='comissoes'&&<section className="semanticPage commissionsPage">
        {showForm&&<form className="panel sellerForm" onSubmit={saveSeller}>
          <div className="formTitle">
            <div><h3>{editingSeller?'Editar vendedor':'Novo vendedor'}</h3><p>O percentual é aplicado aos recebimentos registrados a partir daquele momento.</p></div>
          </div>
          <input name="nome" placeholder="Nome do vendedor" required defaultValue={editingSeller?.nome||''}/>
          <input name="email" type="email" placeholder="E-mail" defaultValue={editingSeller?.email||''}/>
          <input name="telefone" inputMode="tel" placeholder="Telefone" defaultValue={maskPhone(editingSeller?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/>
          <label>Comissão %
            <input name="percentual_comissao" type="number" min="0" max="100" step="0.01" required defaultValue={editingSeller?.percentual_comissao||0}/>
          </label>
          <select name="ativo" defaultValue={editingSeller?.ativo===false?'false':'true'}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          <div className="formActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingSeller(null)}}>Cancelar</button>
            <button className="primary" disabled={!canManageCommissions}>Salvar vendedor</button>
          </div>
        </form>}

        <div className="panel commissionFilters">
          <div><strong>Período de recebimentos</strong><span>A comissão considera somente valores efetivamente recebidos entre as datas abaixo.</span></div>
          <label>De<input type="date" value={commissionStart} onChange={e=>setCommissionStart(e.target.value)}/></label>
          <label>Até<input type="date" value={commissionEnd} onChange={e=>setCommissionEnd(e.target.value)}/></label>
          <label>Relatório de
            <SearchableSelect value={commissionReportSeller==='todos'?'':commissionReportSeller} onChange={value=>setCommissionReportSeller(value||'todos')} placeholder="Todos os vendedores" searchPlaceholder="Pesquisar vendedor..." options={vendedores.map(v=>({value:v.id,label:v.nome+(v.ativo?'':' (inativo)')}))}/>
          </label>
          <button className="ghost" onClick={()=>void loadCommissions()}><RefreshCw size={15}/>Atualizar</button>
          <button className="primary commissionPdfBtn" onClick={()=>void downloadCommissionReport()} title="Gerar relatório de comissões em PDF"><FileDown size={15}/>Gerar PDF</button>
        </div>

        {salesWithoutSeller>0&&<div className="commissionWarning">{salesWithoutSeller} venda(s) estão sem vendedor definido e não gerarão comissão até serem vinculadas a um vendedor.</div>}

        <div className="cards compactCards semanticCards">
          <article className="card semanticCard semanticPositive"><span>Recebido no período</span><strong>{commissionsLoading?'Carregando…':money(commissionReceived)}</strong><small>{dateBr(commissionStart)} a {dateBr(commissionEnd)}</small></article>
          <article className="card semanticCard semanticBlue"><span>Comissões apuradas</span><strong>{commissionsLoading?'Carregando…':money(commissionTotal)}</strong><small>sobre recebimentos</small></article>
          <article className="card semanticCard semanticNeutral"><span>Vendedores ativos</span><strong>{vendedores.filter(v=>v.ativo).length}</strong><small>{salesWithoutSeller} venda(s) sem vendedor</small></article>
        </div>

        <article className="panel tablePanel commissionsTable">
          <div className="panelHead"><h3>Vendedores e comissões</h3><SearchField value={tableSearch.comissoes||''} onChange={v=>setSearch('comissoes',v)} placeholder="Pesquisar vendedores e valores"/></div>
          <div className="tableWrap"><table>
            <thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','vendedor')}>Vendedor{sortMark('comissoes','vendedor')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','percentual')}>% atual{sortMark('comissoes','percentual')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','recebido')}>Recebido no período{sortMark('comissoes','recebido')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','comissao')}>Comissão apurada{sortMark('comissoes','comissao')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','recebimentos')}>Recebimentos{sortMark('comissoes','recebimentos')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','vendas')}>Vendas{sortMark('comissoes','vendas')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('comissoes','status')}>Status{sortMark('comissoes','status')}</button></th><th>Gerenciar</th></tr></thead>
            <tbody>{visibleSellers.length===0&&<tr className="emptyTableRow"><td colSpan={8}><EmptyState message={vendedores.length===0?'Nenhum vendedor cadastrado.':'Nenhum vendedor encontrado para esta pesquisa.'} actionLabel={vendedores.length===0&&canManageCommissions?'+ Adicionar Vendedor':undefined} onAction={startNewSeller}/></td></tr>}{visibleSellers.map(v=>{
              const summary=comissoes.find(c=>c.vendedor_id===v.id)
              const opened=sellerPanel===v.id
              return <Fragment key={v.id}>
                <tr {...recordRow(()=>setSellerPanel(v.id),v.nome)}>
                  <td><strong>{v.nome}</strong><br/><small>{v.email||v.telefone||'—'}</small></td>
                  <td>{Number(v.percentual_comissao).toLocaleString('pt-BR')}%</td>
                  <td>{money(Number(summary?.total_recebido||0))}</td>
                  <td><strong>{money(Number(summary?.comissao_apurada||0))}</strong></td>
                  <td>{summary?.pagamentos||0}</td>
                  <td>{summary?.vendas||0}</td>
                  <td><span className={v.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{v.ativo?'ativo':'inativo'}</span></td>
                  <td>{canManageCommissions?<button type="button" className="rowMenuBtn" onClick={()=>setSellerPanel(opened?null:v.id)} title="Opções" aria-label="Abrir opções do vendedor" aria-expanded={opened}><MoreVertical size={18}/></button>:<span className="readOnlyTag">Somente leitura</span>}</td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={8}>
                  <div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={v.nome}>
                    <div className="recordDetailBackdrop" onClick={()=>setSellerPanel(null)}/>
                    <div className="recordDetailSheet">
                      <div className="recordDetailHeader"><strong>{v.nome}</strong><button type="button" className="recordDetailClose" onClick={()=>setSellerPanel(null)}><X size={17}/>Fechar</button></div>
                      <div className="actionPanel">
                        <div className="actionMeta"><strong>{v.nome}</strong><span>Comissão atual: {Number(v.percentual_comissao).toLocaleString('pt-BR')}%</span></div>
                        <div className="rowActions">
                          {canManageCommissions&&<button type="button" className="ghost" onClick={()=>startEditSeller(v)}><Pencil size={15}/>Editar % / dados</button>}
                          {canManageCommissions&&v.ativo&&<button type="button" className="warningBtn" onClick={()=>void deactivateSeller(v)}><Ban size={15}/>Desativar</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {active==='financeiro'&&<section className="semanticPage financePage">
        <div className="subTabs financeSubTabs">
          <button className={financeSubtab==='geral'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('geral');setFinancePanel(null);setShowForm(false);setEditingTitle(null)}}><WalletCards size={16}/>Visão geral</button>
          <button className={financeSubtab==='pagar'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('pagar');setFinancePanel(null);setShowForm(false);setEditingTitle(null)}}><WalletCards size={16}/>Contas a pagar <span className="subTabCount neutralCount">{openPayableCount}</span></button>
          <button className={financeSubtab==='receber'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('receber');setFinancePanel(null);setShowForm(false);setEditingTitle(null)}}><ReceiptText size={16}/>Contas a receber <span className="subTabCount neutralCount">{openReceivableCount}</span></button>
          <button className={financeSubtab==='vencidos'?'subTab active overdueTab':'subTab overdueTab'} onClick={()=>{setFinanceSubtab('vencidos');setFinancePanel(null);setShowForm(false);setEditingTitle(null)}}><Ban size={16}/>Vencidos <span className="subTabCount">{overdueTitles.length}</span></button>
          <button className={financeSubtab==='faturamento'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('faturamento');setFinancePanel(null);setShowForm(false);setEditingTitle(null)}}><ReceiptText size={16}/>Faturamento de vendas <span className="subTabCount neutralCount">{billingCounts.naoFaturado}</span></button>
          <button className={financeSubtab==='conciliacao'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('conciliacao');closeForms()}}><Building2 size={16}/>Diários e Conciliação</button>
        </div>

        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingTitle?'Editar fatura':'Nova fatura'}><div className="saleModalShell financeModalShell"><form ref={financeTitleFormRef} className="panel dataForm saleModalForm entityModalForm" onSubmit={saveTitle}>
          <div className="formTitle saleModalTitle"><div><h3>{editingTitle?'Editar fatura':'Nova fatura'}</h3><p>{editingTitle&&(editingTitle.venda_id||editingTitle.compra_id)?'Fatura vinculada: apenas classificação financeira pode ser alterada aqui.':'Cadastre uma conta a receber ou uma conta a pagar.'}</p></div><div className="financeImportActions">{!editingTitle&&<><input ref={financeImportInputRef} type="file" accept=".pdf,.txt,.csv,.ofx,.xml,.html,image/*" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importFinanceDocument(file);e.currentTarget.value=''}}/><button type="button" className="ghost financeImportButton" onClick={()=>financeImportInputRef.current?.click()}><Upload size={15}/>Importar documento</button></>}<button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de fatura" onClick={()=>{setShowForm(false);setEditingTitle(null);setFinanceImportNotice('')}}><X size={18}/></button></div></div>
          {financeImportNotice&&<div className="financeImportNotice"><FileDown size={16}/><span>{financeImportNotice}</span></div>}
          {editingTitle&&(editingTitle.venda_id||editingTitle.compra_id)&&<div className="financeLinkedNotice"><ShieldCheck size={18}/><div><strong>Documento integrado</strong><span>Valor, vencimento, entidade e descrição acompanham a {editingTitle.venda_id?'venda':'compra'} de origem.</span></div></div>}
          <label className="fieldLabel">Tipo de fatura
            <select value={financeTitleType} onChange={e=>{setFinanceTitleType(e.target.value as 'receber'|'pagar');setFinanceTitleEntity('')}} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}>
              <option value="receber">Conta a receber</option>
              <option value="pagar">Conta a pagar</option>
            </select>
          </label>
          <label className="fieldLabel">Descrição<input name="descricao" placeholder="Descrição" required defaultValue={editingTitle?.descricao||''} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
          <label className="fieldLabel">Cliente / Fornecedor
            <SearchableSelect value={financeTitleEntity} onChange={setFinanceTitleEntity} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))} placeholder="Sem vínculo cadastral" searchPlaceholder={financeTitleType==='receber'?'Pesquisar cliente...':'Pesquisar fornecedor...'} options={[
              ...(financeTitleEntity&&!(financeTitleType==='receber'?clientes:fornecedores).some(x=>x.nome===financeTitleEntity)?[{value:financeTitleEntity,label:financeTitleEntity+' (registro anterior)'}]:[]),
              ...(financeTitleType==='receber'?clientes:fornecedores).filter(x=>x.ativo||x.nome===financeTitleEntity).map(x=>({value:x.nome,label:x.nome+(x.documento?' · '+x.documento:''),keywords:[x.nome,x.documento].filter(Boolean).join(' ')}))
            ]}/>
          </label>
          <label className="fieldLabel">Data de vencimento<input name="vencimento" type="date" required defaultValue={editingTitle?.vencimento||today()} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
          <label className="fieldLabel">Valor (R$)<input name="valor" type="number" min="0" step="0.01" required defaultValue={editingTitle?.valor||0} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
          <label className="fieldLabel">Forma de pagamento<select name="forma_pagamento" defaultValue={editingTitle?.forma_pagamento||''} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}><option value="">Não informada</option><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option></select></label>
          <label className="fieldLabel">Banco<input name="banco" placeholder="Banco identificado no documento" defaultValue={editingTitle?.banco||''} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
          <input type="hidden" name="documento_importado_nome" defaultValue={editingTitle?.documento_importado_nome||''}/>
          <FinanceClassifications category={editingTitle?.categoria||null} center={editingTitle?.centro_custo||null}/>
          <div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingTitle(null)}}>Cancelar</button><button className="primary">{editingTitle&&(editingTitle.venda_id||editingTitle.compra_id)?'Salvar classificação':editingTitle?'Salvar alterações':'Criar fatura'}</button></div>
        </form></div></div>}

        {financeSubtab==='geral'&&<>
          <div className="financeReportBar"><div><strong>Relatório financeiro completo</strong><span>Contas a pagar, receber, vencidos, funcionários e vales em um único PDF.</span></div><button type="button" className="primary" onClick={()=>void downloadFinancePdf('geral')}><FileDown size={15}/>PDF geral</button></div>
          <div className="financeOverviewGrid">
            <article className="card financeOverviewCard semanticPositive"><span>A receber em aberto</span><strong>{money(openReceivables)}</strong><small>{openReceivableCount} título(s)</small></article>
            <article className="card financeOverviewCard semanticNegative"><span>A pagar em aberto</span><strong>{money(openPayables)}</strong><small>{openPayableCount} título(s)</small></article>
            <article className="card financeOverviewCard semanticWarning"><span>Total vencido</span><strong>{money(overdueReceivables+overduePayables)}</strong><small>{overdueTitles.length} título(s) em atraso</small></article>
            <article className={'card financeOverviewCard '+(openReceivables-openPayables>=0?'semanticBlue':'semanticNegative')}><span>Resultado líquido em aberto</span><strong>{money(openReceivables-openPayables)}</strong><small>a receber - a pagar</small></article>

            <article className="card financeOverviewCard semanticPositive"><span>Recebido no mês</span><strong>{financeActivityState==='loading'?'Carregando…':financeActivityState==='error'?'Indisponível':money(receivedThisMonth)}</strong><small>líquido de estornos</small></article>
            <article className="card financeOverviewCard semanticNegative"><span>Pago no mês</span><strong>{financeActivityState==='loading'?'Carregando…':financeActivityState==='error'?'Indisponível':money(paidThisMonth)}</strong><small>líquido de estornos</small></article>
            <article className={'card financeOverviewCard '+(cashResultThisMonth>=0?'semanticPositive':'semanticNegative')}><span>Resultado de caixa no mês</span><strong>{financeActivityState==='loading'?'Carregando…':financeActivityState==='error'?'Indisponível':money(cashResultThisMonth)}</strong><small>recebimentos - pagamentos</small></article>
            <article className="card financeOverviewCard semanticBlue"><span>Próximos 7 dias</span><strong>{money(dueNext7Receivable-dueNext7Payable)}</strong><small>Receber {money(dueNext7Receivable)} • Pagar {money(dueNext7Payable)}</small></article>
          </div>

          <article className="panel financeProjectionPanel">
            <div className="financeProjectionHead">
              <div><span>Projeção</span><h3>Fluxo financeiro dos próximos 30 dias</h3><p>Baseado nos vencimentos ainda em aberto.</p></div>
              <div className="financeProjectionLegend"><span><i className="projectionIn"></i>A receber</span><span><i className="projectionOut"></i>A pagar</span></div>
            </div>
            <div className="financeProjectionRows">
              {financeProjection.map(p=><div className="financeProjectionRow" key={p.label}>
                <div className="financeProjectionLabel"><strong>{p.label}</strong><span>{dateBr(p.start)} a {dateBr(p.end)}</span></div>
                <div className="financeProjectionBars">
                  <div><span className="projectionIn" style={{width:`${(p.receber/financeProjectionMax)*100}%`}}></span></div>
                  <div><span className="projectionOut" style={{width:`${(p.pagar/financeProjectionMax)*100}%`}}></span></div>
                </div>
                <div className="financeProjectionValues"><span>{money(p.receber)}</span><span>{money(p.pagar)}</span><strong className={p.liquido>=0?'positiveText':'negativeText'}>{money(p.liquido)}</strong></div>
              </div>)}
            </div>
          </article>
        </>}

        {financeSubtab!=='geral'&&financeSubtab!=='faturamento'&&financeSubtab!=='conciliacao'&&<div className={`panel financeFilterPanel ${['pagar','receber','vencidos'].includes(financeSubtab)?'financeFilterPanelCompact':''}`}>
          <div className="financeQuickRanges">
            <span>Período</span>
            <button type="button" className="ghost" onClick={()=>setFinanceQuickRange('hoje')}>Hoje</button>
            <button type="button" className="ghost" onClick={()=>setFinanceQuickRange('7d')}>7 dias</button>
            <button type="button" className="ghost" onClick={()=>setFinanceQuickRange('30d')}>30 dias</button>
            <button type="button" className="ghost" onClick={()=>setFinanceQuickRange('mes')}>Este mês</button>
          </div>
          <label>De<input type="date" value={financeStart} onChange={e=>setFinanceStart(e.target.value)}/></label>
          <label>Até<input type="date" value={financeEnd} onChange={e=>setFinanceEnd(e.target.value)}/></label>
          <label>Status<select value={financeStatusFilter} onChange={e=>setFinanceStatusFilter(e.target.value as typeof financeStatusFilter)}>
            <option value="todos">Todos</option><option value="aberto">Em aberto</option><option value="parcial">Parcial</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option>
          </select></label>
          <label>Categoria<select value={financeCategory} onChange={e=>setFinanceCategory(e.target.value)}><option value="todos">Todas</option>{financeCategories.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label>Centro de custo<select value={financeCenter} onChange={e=>setFinanceCenter(e.target.value)}><option value="todos">Todos</option>{financeCenters.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <button type="button" className="ghost financeClearFilters" onClick={clearFinanceFilters}>Limpar filtros</button>
        </div>}

        {financeSubtab==='vencidos'&&<>
          <div className="cards compactCards semanticCards overdueCards">
            <article className="card semanticCard semanticNegative"><span>Vencidos a receber</span><strong>{money(overdueReceivables)}</strong><small>{overdueTitles.filter(t=>t.tipo==='receber').length} título(s)</small></article>
            <article className="card semanticCard semanticNegative"><span>Vencidos a pagar</span><strong>{money(overduePayables)}</strong><small>{overdueTitles.filter(t=>t.tipo==='pagar').length} título(s)</small></article>
            <article className="card semanticCard semanticWarning"><span>Total vencido</span><strong>{money(overdueReceivables+overduePayables)}</strong><small>{overdueTitles.length} título(s) em atraso</small></article>
          </div>
          <div className="financeGroups">
            {financeTable('receber',true)}
            {financeTable('pagar',true)}
          </div>
        </>}

        {financeSubtab==='faturamento'&&<div className="billingSalesPage">
          <div className="billingSalesHead">
            <div><h2>Faturamento de vendas</h2><p>Somente vendas aprovadas. O Financeiro define vencimentos e gera os títulos em Contas a Receber.</p></div>
            <button type="button" className="ghost" onClick={()=>void refreshFinance()}><RefreshCw size={15}/>Atualizar</button>
          </div>
          <div className="billingInfoBanner"><ReceiptText size={18}/><span>O vendedor indica a forma de pagamento e a quantidade de parcelas. O Financeiro organiza datas, valores e efetiva o faturamento.</span></div>
          <div className="billingStatusTabs">
            <button className={billingStatusFilter==='todos'?'active':''} onClick={()=>setBillingStatusFilter('todos')}>Todos <b>{billingCounts.todos}</b></button>
            <button className={billingStatusFilter==='nao-faturado'?'active':''} onClick={()=>setBillingStatusFilter('nao-faturado')}>Não faturado <b>{billingCounts.naoFaturado}</b></button>
            <button className={billingStatusFilter==='faturado'?'active':''} onClick={()=>setBillingStatusFilter('faturado')}>Faturado <b>{billingCounts.faturado}</b></button>
            <button className={billingStatusFilter==='cancelado'?'active':''} onClick={()=>setBillingStatusFilter('cancelado')}>Cancelado <b>{billingCounts.cancelado}</b></button>
          </div>
          <div className="billingSearch"><Search size={16}/><input value={billingSearch} onChange={e=>setBillingSearch(e.target.value)} placeholder="Buscar por documento, cliente, vendedor..."/></div>
          {billingSelectedSales.length>0&&<div className="billingBulkBar"><div><strong>{billingSelectedSales.length} venda(s) selecionada(s)</strong><span>{clientes.find(c=>c.id===selectedBillingSales()[0]?.cliente_id)?.nome||'Cliente'} • Total {money(selectedBillingTotal())}</span></div><button type="button" className="ghost" onClick={()=>setBillingSelectedSales([])}>Limpar</button><button type="button" className="primary" onClick={openSelectedBillingSales}>Gerar fatura única</button></div>}
          <div className="tableWrap"><table className="billingSalesTable">
            <thead><tr><th className="billingSelectCol">Sel.</th><th>Venda</th><th>Fatura</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Status venda</th><th>Indicação pagamento</th><th>Status da fatura</th><th>Status pagto</th><th>Total</th><th>Ações</th></tr></thead>
            <tbody>
              {billingSales.length===0&&<tr className="emptyTableRow"><td colSpan={12}><EmptyState message="Nenhuma venda aprovada encontrada com estes filtros."/></td></tr>}
              {billingSales.map(v=>{
                const client=clientes.find(c=>c.id===v.cliente_id)?.nome||'Consumidor'
                const seller=vendedores.find(s=>s.id===v.vendedor_cadastro_id)?.nome||'—'
                const invoiceState=saleInvoiceStatus(v)
                const paymentState=salePaymentStatus(v)
                const activeInvoice=activeInvoiceForSale(v.id)
                const selectable=invoiceState.key==='nao-faturado'&&['pedido','faturado'].includes(v.status)
                return <tr key={v.id} className={billingSelectedSales.includes(v.id)?'billingSelectedRow':''}>
                  <td className="billingSelectCol"><input type="checkbox" checked={billingSelectedSales.includes(v.id)} disabled={!selectable||!canManageFinance} onChange={()=>toggleBillingSale(v)} aria-label={'Selecionar '+saleCode(v.venda_numero)}/></td>
                  <td><strong>#{saleCode(v.venda_numero)}</strong></td>
                  <td><strong>{invoiceState.invoice?financialInvoiceCode(invoiceState.invoice.numero):'—'}</strong></td>
                  <td>{dateBr(v.created_at)}</td>
                  <td>{client}</td>
                  <td>{seller}</td>
                  <td><span className={'salesStatus salesStatus-'+v.status}>{saleStatusDisplay(v)}</span></td>
                  <td>{paymentLabel(v.forma_pagamento)}{Number(v.parcelas)>1?' • '+v.parcelas+'x':''}</td>
                  <td><span className={'billingInvoiceBadge billingInvoice-'+invoiceState.key}>{invoiceState.label}</span></td>
                  <td><span className={'salesPaymentStatus salesPaymentStatus-'+paymentState.key}>{paymentState.label}</span></td>
                  <td><strong>{money(Number(v.total))}</strong></td>
                  <td><div className="billingRowActions">
                    {invoiceState.key==='nao-faturado'&&canManageFinance&&<button className="primary" onClick={()=>openBillingSale(v)}>Criar fatura</button>}
                    {activeInvoice&&<button className="ghost" onClick={()=>openSaleFinancialStatement(v,true)}>Ver fatura</button>}
                    {activeInvoice&&<button className="documentPdfButton compactDocumentPdf" onClick={()=>void downloadFinancialInvoicePdf(activeInvoice)}><FileDown size={14}/>PDF Fatura</button>}
                    {activeInvoice&&<button className="documentPrintButton compactDocumentPdf" onClick={()=>void printFinancialInvoicePdf(activeInvoice)}><Printer size={14}/>Imprimir</button>}
                    {activeInvoice&&canManageFinance&&<button className="warningBtn" disabled={billingBusy} onClick={()=>void cancelSaleInvoice(v)}>Cancelar</button>}
                    {invoiceState.key==='cancelado'&&canManageFinance&&['pedido','faturado'].includes(v.status)&&<button className="primary" onClick={()=>openBillingSale(v)}>Refaturar</button>}
                  </div></td>
                </tr>
              })}
            </tbody>
          </table></div>
        </div>}

        {billingSale&&<div className="saleModalOverlay billingInvoiceOverlay" role="dialog" aria-modal="true" aria-label="Criar fatura da venda">
          <div className="saleModalShell billingModalShell billingPremiumShell">
            <form className="panel billingInvoiceForm billingPremiumForm" onSubmit={createSaleInvoice}>
              <div className="billingPremiumHeader">
                <div className="billingPremiumBrand">SG</div>
                <div className="billingPremiumHeaderText">
                  <h3>{billingInvoiceSaleIds.length>1?'Criar fatura consolidada':'Criar fatura — Venda #'+saleCode(billingSale.venda_numero)}</h3>
                  <p>{billingInvoiceSaleIds.length>1?billingInvoiceSaleIds.length+' vendas do mesmo cliente em uma única fatura.':'Organize as parcelas antes de gerar o Contas a Receber.'}</p>
                </div>
                <button type="button" className="iconBtn saleModalClose billingPremiumClose" aria-label="Fechar fatura" disabled={billingBusy} onClick={closeBilling}><X size={20}/></button>
              </div>

              <div className="billingInvoiceSummary billingPremiumSummary">
                <div>
                  <span className="billingSummaryIcon"><CircleUserRound size={21}/></span>
                  <span>Cliente</span>
                  <strong>{clientes.find(c=>c.id===billingSale.cliente_id)?.nome||'Consumidor'}</strong>
                </div>
                <div>
                  <span className="billingSummaryIcon"><BadgeDollarSign size={21}/></span>
                  <span>{billingInvoiceSaleIds.length>1?'Total das vendas':'Total da venda'}</span>
                  <strong>{money(invoiceBillingTotal())}</strong>
                </div>
                <div>
                  <span className="billingSummaryIcon"><ReceiptText size={21}/></span>
                  <span>{billingInvoiceSaleIds.length>1?'Vendas incluídas':'Indicação do vendedor'}</span>
                  <strong>{billingInvoiceSaleIds.length>1?vendas.filter(v=>billingInvoiceSaleIds.includes(v.id)).map(v=>saleCode(v.venda_numero)).join(' • '):paymentLabel(billingSale.forma_pagamento)+' • '+billingSale.parcelas+'x'}</strong>
                </div>
              </div>

              {billingError&&<p className="billingFormError" role="alert">{billingError}</p>}
              <fieldset disabled={billingBusy} className="billingFieldset billingPremiumFieldset">
                <div className="billingPremiumSectionTitle"><ReceiptText size={19}/><strong>Condições da fatura</strong><span></span></div>

                <div className="billingInvoiceControls billingPremiumControls">
                  <label>Forma de pagamento
                    <select value={billingPayment} onChange={e=>{const method=e.target.value as PaymentMethod;setBillingPayment(method);if(method==='dinheiro')resizeBillingLines(1)}}>
                      <option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option>
                    </select>
                  </label>
                  <label>Número de parcelas
                    <select value={billingLines.length} disabled={billingPayment==='dinheiro'} onChange={e=>resizeBillingLines(Number(e.target.value))}>
                      {Array.from({length:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x</option>)}
                    </select>
                  </label>
                  {billingPayment==='boleto'&&<button type="button" className="ghost billingTermsButton billingPremiumTerms" onClick={setBillingTerms306090}><ReceiptText size={16}/>Aplicar 30/60/90</button>}
                </div>

                <div className="billingPremiumSectionTitle"><Layers3 size={19}/><strong>Parcelas</strong><span></span></div>

                <div className="billingLines billingPremiumLines">
                  <div className="billingLinesHead"><span>Parcela</span><span>Vencimento</span><span>Valor</span></div>
                  {billingLines.map((line,index)=><div className="billingLine" key={line.key}>
                    <strong>{index+1}/{billingLines.length}</strong>
                    <input aria-label={`Vencimento da parcela ${index+1}`} type="date" value={line.vencimento} onChange={e=>updateBillingLine(line.key,'vencimento',e.target.value)} required/>
                    <input aria-label={`Valor da parcela ${index+1}`} type="number" min="0.01" step="0.01" value={line.valor} onChange={e=>updateBillingLine(line.key,'valor',e.target.value)} required/>
                  </div>)}
                </div>

                {billingPayment==='dinheiro'&&<div className="billingCashNotice">Pagamento em dinheiro: ao salvar, a fatura será considerada paga e a entrada será registrada automaticamente no diário Dinheiro.</div>}

                <div className="billingPremiumFooter">
                  <div className="billingInvoiceTotal billingPremiumTotal">
                    <span>Soma das parcelas</span><i></i><strong>{money(billingLines.reduce((sum,line)=>sum+Number(line.valor||0),0))}</strong>
                  </div>
                  <div className="formActions billingPremiumActions">
                    <button type="button" className="ghost" onClick={closeBilling}>Cancelar</button>
                    <button className="primary billingPremiumSubmit" disabled={billingBusy}><CheckCircle2 size={18}/>{billingBusy?'Gerando...':'Salvar fatura e gerar lançamentos'}</button>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
        </div>}
        {financeSubtab==='receber'&&<div className="financeGroups financeSingleList">{financeTable('receber')}</div>}
        {financeSubtab==='pagar'&&<div className="financeGroups financeSingleList">{financeTable('pagar')}</div>}
        {financeSubtab==='conciliacao'&&<BankReconciliation onOpenTitle={(id,transactionId)=>{const title=titulos.find(t=>t.id===id);if(!title)return;setFinanceTransactionId(transactionId);setFinancePanelReturnModule(null);setFinancePanelReturnSubtab('conciliacao');setFinanceSubtab(title.tipo);setFinanceStatusFilter('todos');setFinanceStart('');setFinanceEnd('');setFinanceCategory('todos');setFinanceCenter('todos');setSearch('financeiro-'+title.tipo,'');setFinancePanelTab('pagamentos');selectFinanceTitleInPanel(title)}} initialTransactionId={financeTransactionId} onClearTransaction={()=>setFinanceTransactionId(null)} titles={titulos} canEdit={canManageFinance} canClosePeriods={canManageConfig} onChanged={refreshFinance}/>}

      </section>}
      {active==='relatorios'&&<section className="semanticPage reportsPage">
        <div className="panel reportFilters"><label>De<input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label>Até<input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label><label>Status da venda<select value={reportStatus} onChange={e=>setReportStatus(e.target.value)}><option value="todos">Todos</option><option value="orcamento">Orçamento</option><option value="pedido">Pedido</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option></select></label></div>
        <div className="cards compactCards semanticCards"><article className="card semanticCard semanticBlue"><span>Vendas no período</span><strong>{money(reportSalesTotal)}</strong><small>{filteredSales.length} registros</small></article><article className="card semanticCard semanticNegative"><span>Compras no período</span><strong>{money(reportPurchaseTotal)}</strong><small>{filteredPurchases.length} registros</small></article><article className={'card semanticCard '+(reportSalesTotal-reportPurchaseTotal>=0?'semanticPositive':'semanticNegative')}><span>Resultado bruto</span><strong>{money(reportSalesTotal-reportPurchaseTotal)}</strong><small>vendas - compras</small></article></div>
        <div className="reportsStack"><article className="panel tablePanel"><div className="panelHead"><h3>Vendas filtradas</h3><SearchField value={tableSearch['relatorio-vendas']||''} onChange={v=>setSearch('relatorio-vendas',v)} placeholder="Pesquisar"/></div><div className="tableWrap"><table><thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','fatura')}>Fatura{sortMark('relatorio-vendas','fatura')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','data')}>Data{sortMark('relatorio-vendas','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','status')}>Status{sortMark('relatorio-vendas','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','total')}>Total{sortMark('relatorio-vendas','total')}</button></th></tr></thead><tbody>{sortList('relatorio-vendas',filteredSales.filter(v=>searchMatches('relatorio-vendas',[saleCode(v.venda_numero),dateBr(v.created_at),v.status,money(Number(v.total))])),{fatura:v=>Number(v.venda_numero||0),data:v=>v.created_at,status:v=>v.status,total:v=>Number(v.total)}).map(v=><tr key={v.id} {...recordRow(()=>{setActive('vendas');setSalePanel(v.id)},'venda '+saleCode(v.venda_numero))}><td>#{saleCode(v.venda_numero)}</td><td>{dateBr(v.created_at)}</td><td>{v.status}</td><td>{money(Number(v.total))}</td></tr>)}</tbody></table></div></article><article className="panel tablePanel"><div className="panelHead"><h3>Compras filtradas</h3><SearchField value={tableSearch['relatorio-compras']||''} onChange={v=>setSearch('relatorio-compras',v)} placeholder="Pesquisar"/></div><div className="tableWrap"><table><thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-compras','data')}>Data{sortMark('relatorio-compras','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-compras','status')}>Status{sortMark('relatorio-compras','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-compras','total')}>Total{sortMark('relatorio-compras','total')}</button></th></tr></thead><tbody>{sortList('relatorio-compras',filteredPurchases.filter(c=>searchMatches('relatorio-compras',[dateBr(c.created_at),c.status,money(Number(c.total))])),{data:c=>c.created_at,status:c=>c.status,total:c=>Number(c.total)}).map(c=><tr key={c.id} {...recordRow(()=>{setActive('compras');setPurchasePanel(c.id)},'compra '+purchaseCode(c.fatura_numero))}><td>{dateBr(c.created_at)}</td><td>{c.status}</td><td>{money(Number(c.total))}</td></tr>)}</tbody></table></div></article></div>
      </section>}

      {active==='config'&&<section>
        <nav className="configNavigation" aria-label="Seções de configurações">
          {([['empresa','Empresa e regras'],['usuarios','Usuários e acessos'],['integracoes','Interligações'],['financeiro','Cadastros financeiros']] as const).filter(([key])=>key!=='usuarios'&&key!=='financeiro'||canManageConfig).map(([key,label])=><button type="button" key={key} className={configSection===key?'subTab active':'subTab'} onClick={()=>setConfigSection(key)} aria-current={configSection===key?'page':undefined}>{label}</button>)}
        </nav>
        {configSection==='integracoes'&&<IntegrationSettings permissions={userPermissions} company={empresa} onOpen={openApp}/>}
        {configSection==='integracoes'&&isAdmin&&canManageConfig&&<FocusNfeSettings/>}
        {configSection==='financeiro'&&canManageConfig&&<FinanceAdministration/>}
        {configSection==='usuarios'&&canManageConfig&&<form className="panel viewerUserForm" onSubmit={createManagedUserAccount}>
          <div className="formTitle"><div><h3>Criar novo usuário</h3><p>O acesso ao ERP passa a ser controlado pelo administrador. Escolha o perfil inicial do usuário.</p></div></div>
          <label className="fieldLabel">Nome do usuário<input value={viewerName} onChange={e=>setViewerName(e.target.value)} placeholder="Digite o nome" required/></label>
          <label className="fieldLabel">E-mail<input type="email" value={viewerEmail} onChange={e=>setViewerEmail(e.target.value)} placeholder="usuario@empresa.com" required/></label>
          <label className="fieldLabel">Senha inicial<input type="password" value={viewerPassword} onChange={e=>setViewerPassword(e.target.value)} placeholder="12+ caracteres, maiúscula, minúscula, número e símbolo" minLength={12} maxLength={128} required/></label>
          <label className="fieldLabel">Perfil
            <select value={newUserRole} onChange={e=>setNewUserRole(e.target.value as PerfilRole)}>
              <option value="administrador">Administrador</option>
              <option value="financeiro">Financeiro</option>
              <option value="vendas">Vendedor</option>
              <option value="estoque">Estoque</option>
              <option value="visualizador">Usuário normal</option>
            </select>
          </label>
          <button className="primary" disabled={creatingViewer}>{creatingViewer?'Criando...':'Criar usuário'}</button>
        </form>}

        {configSection==='usuarios'&&canManageConfig&&<article className="panel userManagementPanel">
          <div className="panelHead">
            <div><h3>Gerenciar usuários</h3><p>Altere nome, perfil de acesso e status. Usuários desativados deixam de acessar os dados do ERP.</p></div>
            <button type="button" className="ghost" onClick={()=>void loadManagedUsers()}><RefreshCw size={15}/>Atualizar</button>
          </div>
          <SearchField value={tableSearch.usuarios||''} onChange={v=>setSearch('usuarios',v)} placeholder="Pesquisar nome, e-mail, perfil ou status"/>
          <div className="tableWrap userManagementTable"><table>
            <thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('usuarios','nome')}>Nome{sortMark('usuarios','nome')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('usuarios','email')}>E-mail{sortMark('usuarios','email')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('usuarios','perfil')}>Perfil{sortMark('usuarios','perfil')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('usuarios','status')}>Status{sortMark('usuarios','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('usuarios','acesso')}>Último acesso{sortMark('usuarios','acesso')}</button></th><th>Ação</th></tr></thead>
            <tbody>{sortList('usuarios',managedUsers.filter(u=>searchMatches('usuarios',[u.nome,u.email,u.perfil,u.ativo?'ativo':'inativo'])),{nome:u=>u.nome,email:u=>u.email,perfil:u=>u.perfil,status:u=>u.ativo?'ativo':'inativo',acesso:u=>u.ultimo_acesso||''}).map(u=>{
              const draft=userEdits[u.user_id]||{nome:u.nome,perfil:u.perfil,ativo:u.ativo}
              const changed=draft.nome!==u.nome||draft.perfil!==u.perfil||draft.ativo!==u.ativo
              return <Fragment key={u.user_id}><tr {...recordRow(()=>setManagedUserCard(u.user_id),u.nome)}>
                <td><div className="userIdentityCell">
                  <div className="userAvatarWrap">
                    {u.avatar_path?<img className="userAvatar" src={managedUserAvatarUrl(u)} alt={`Imagem de ${u.nome}`}/>:<span className="userAvatar userAvatarFallback">{(u.nome||u.email||'?').trim().charAt(0).toUpperCase()}</span>}
                    <label className="userAvatarUpload" title={u.avatar_path?'Trocar imagem':'Anexar imagem'}>
                      <Upload size={13}/><input type="file" accept="image/png,image/jpeg,image/webp" disabled={savingAvatarUserId===u.user_id} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();const file=e.target.files?.[0];e.currentTarget.value='';if(file)void saveManagedUserAvatar(u,file)}}/>
                    </label>
                    {u.avatar_path&&<button type="button" className="userAvatarRemove" title="Remover imagem" disabled={savingAvatarUserId===u.user_id} onClick={e=>{e.stopPropagation();void removeManagedUserAvatar(u)}}><X size={12}/></button>}
                  </div>
                  <div className="userIdentityFields"><input className="userInlineInput" value={draft.nome} onChange={e=>editManagedUser(u.user_id,'nome',e.target.value)} disabled={u.usuario_atual&&savingUserId===u.user_id}/>{u.usuario_atual&&<small className="currentUserMark">Você</small>}{savingAvatarUserId===u.user_id&&<small className="userAvatarStatus">Enviando imagem...</small>}</div>
                </div></td>
                <td>{u.email}</td>
                <td><select className="userInlineSelect" value={draft.perfil} onChange={e=>editManagedUser(u.user_id,'perfil',e.target.value as PerfilRole)} disabled={u.usuario_atual}>
                  <option value="administrador">Administrador</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="vendas">Vendedor</option>
                  <option value="estoque">Estoque</option>
                  <option value="visualizador">Usuário normal</option>
                </select></td>
                <td><select className="userInlineSelect" value={draft.ativo?'ativo':'inativo'} onChange={e=>editManagedUser(u.user_id,'ativo',e.target.value==='ativo')} disabled={u.usuario_atual}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select></td>
                <td>{u.ultimo_acesso?new Date(u.ultimo_acesso).toLocaleString('pt-BR'):'Nunca acessou'}</td>
                <td><div className="userRowActions"><button type="button" className="ghost userPasswordBtn" onClick={e=>{e.stopPropagation();openManagedUserPassword(u)}} title="Alterar senha"><KeyRound size={14}/>Senha</button><button type="button" className="primary userSaveBtn" disabled={!changed||savingUserId===u.user_id} onClick={()=>void saveManagedUser(u)}>{savingUserId===u.user_id?'Salvando...':'Salvar'}</button></div></td>
              </tr>
              {managedUserCard===u.user_id&&<tr className="manageRow"><td colSpan={6}>
                <div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={`Permissões de ${u.nome}`}>
                  <div className="recordDetailBackdrop" onClick={()=>setManagedUserCard(null)}/>
                  <div className="recordDetailSheet recordDetailSheetWide">
                    <div className="recordDetailHeader"><strong>{u.nome}</strong><button type="button" className="recordDetailClose" onClick={()=>setManagedUserCard(null)}><X size={17}/>Fechar</button></div>
                    <div className="userPermissionPanel">
                  <div className="actionPanel">
                    <div className="actionMeta">
                      <strong>{u.nome}</strong>
                      <span>{u.email} · {profileLabel(u.perfil)} · {u.ativo?'Ativo':'Inativo'}</span>
                      <span>Cadastrado em {dateBr(u.criado_em)}</span>
                    </div>
                    <div className="rowActions">
                      {!u.usuario_atual&&<button type="button" className="ghost" onClick={()=>resetUserPermissionsToRole(u)}>Usar padrão do perfil</button>}
                      <button type="button" className="ghost" onClick={()=>setManagedUserCard(null)}>Fechar</button>
                    </div>
                  </div>
                  {u.usuario_atual&&<div className="permissionSafetyNotice"><ShieldCheck size={16}/><span>Suas próprias permissões ficam bloqueadas nesta sessão. Outro administrador pode alterá-las.</span></div>}
                  <div className="permissionGrid">
                    {permissionModules.map(module=>{
                      const draft=userPermissionEdits[u.user_id]||u.permissoes
                      const level=draft[module.key]
                      return <div className="permissionRow" key={module.key}>
                        <div className="permissionModuleInfo"><strong>{module.label}</strong><span>{module.description}</span></div>
                        <select
                          value={u.availablePermissions.includes(module.key)?level:'preserved'}
                          disabled={u.usuario_atual||!u.availablePermissions.includes(module.key)||(userEdits[u.user_id]?.perfil||u.perfil)!==u.perfil}
                          onChange={e=>editUserPermission(u.user_id,module.key,e.target.value as AccessLevel)}
                          aria-label={`Permissão de ${module.label}`}
                        >
                          <option value="preserved" disabled>Preservado no servidor</option><option value="nenhum">Sem acesso</option>
                          <option value="visualizar">Somente visualizar</option>
                          {module.editable&&(module.key!=='config'||u.perfil==='administrador')&&<option value="editar">Editar</option>}
                        </select>
                      </div>
                    })}
                  </div>
                  {!u.usuario_atual&&<div className="permissionActions">
                    <span>Trocar o perfil restaura os acessos padrão. Salve o perfil antes de personalizar a matriz. Campos não retornados pelo servidor são preservados.</span>
                    <button
                      type="button"
                      className="primary"
                      disabled={(userEdits[u.user_id]?.perfil||u.perfil)!==u.perfil||savingPermissionUserId===u.user_id||JSON.stringify(userPermissionEdits[u.user_id]||u.permissoes)===JSON.stringify(u.permissoes)}
                      onClick={()=>void saveUserPermissions(u)}
                    >{savingPermissionUserId===u.user_id?'Salvando permissões...':'Salvar permissões'}</button>
                  </div>}
                    </div>
                  </div>
                </div>
              </td></tr>}</Fragment>
            })}</tbody>
          </table></div>
        </article>}

        {configSection==='usuarios'&&canManageConfig&&passwordUserId&&(()=>{
          const passwordUser=managedUsers.find(row=>row.user_id===passwordUserId)
          if(!passwordUser)return null
          const passwordBusy=savingPasswordUserId===passwordUserId
          return <div className="recordDetailOverlay passwordResetOverlay" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
            <div className="recordDetailBackdrop" onClick={closeManagedUserPassword}/>
            <div className="recordDetailSheet passwordResetSheet">
              <div className="recordDetailHeader"><strong id="password-reset-title">Alterar senha</strong><button type="button" className="recordDetailClose" disabled={passwordBusy} onClick={closeManagedUserPassword}><X size={17}/>Fechar</button></div>
              <div className="passwordResetContent">
                <div className="passwordResetUser"><span className="passwordResetIcon"><KeyRound size={20}/></span><div><strong>{passwordUser.nome}</strong><span>{passwordUser.email}</span></div></div>
                <div className="permissionSafetyNotice"><ShieldCheck size={16}/><span>A senha é alterada diretamente no login do usuário. O sistema nunca exibe nem armazena a senha atual.</span></div>
                <label className="fieldLabel">Nova senha<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newManagedPassword} onChange={e=>setNewManagedPassword(e.target.value)} placeholder="12+ caracteres, maiúscula, minúscula, número e símbolo" disabled={passwordBusy}/></label>
                <label className="fieldLabel">Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmManagedPassword} onChange={e=>setConfirmManagedPassword(e.target.value)} placeholder="Digite novamente" disabled={passwordBusy}/></label>
                {confirmManagedPassword&&newManagedPassword!==confirmManagedPassword&&<small className="passwordMismatch">As senhas não coincidem.</small>}
                <div className="passwordResetActions"><button type="button" className="ghost" disabled={passwordBusy} onClick={closeManagedUserPassword}>Cancelar</button><button type="button" className="primary" disabled={passwordBusy||newManagedPassword.length<12||newManagedPassword!==confirmManagedPassword} onClick={()=>void saveManagedUserPassword()}>{passwordBusy?'Alterando...':'Alterar senha'}</button></div>
              </div>
            </div>
          </div>
        })()}

        {configSection==='usuarios'&&canManageConfig&&profilePermissions&&<article className="panel profilePermissionPanel">
          <div className="panelHead"><div><h3>O que cada perfil pode editar</h3><p>Todos os perfis podem visualizar todos os apps. Marque somente os apps que cada perfil poderá alterar.</p></div></div>
          <div className="profilePermissionGrid">
            {(['administrador','financeiro','vendas','estoque','visualizador'] as PerfilRole[]).map(role=><section className="profilePermissionCard" key={role}>
              <div className="profilePermissionHead"><div><strong>{profileLabel(role)}</strong><span>Visualização liberada em todos os apps</span></div><button type="button" className="primary" disabled={savingProfileRole===role} onClick={()=>void saveProfilePermissions(role)}>{savingProfileRole===role?'Salvando...':'Salvar'}</button></div>
              <div className="profilePermissionApps">
                {permissionModules.map(module=>{
                  const locked=module.key==='dashboard'||module.key==='relatorios'||(module.key==='config'&&role!=='administrador')
                  return <label key={module.key} className={'profilePermissionItem'+(locked?' isLocked':'')}>
                    <input type="checkbox" checked={Boolean(profilePermissions[role][module.key])} disabled={locked||savingProfileRole===role} onChange={()=>toggleProfilePermission(role,module.key)}/>
                    <span><strong>{module.label}</strong><small>{locked?'Somente visualizar':'Pode editar'}</small></span>
                  </label>
                })}
              </div>
            </section>)}
          </div>
        </article>}

        {configSection==='empresa'&&<form key={empresa?.updated_at||'initial'} className="panel configForm" onSubmit={saveCompany}>
          <div className="formTitle"><div><h3>Dados da empresa</h3><p>Esses dados alimentam as faturas e a identificação do ERP.</p></div>{!canManageConfig&&<span className="readOnlyTag">Somente leitura</span>}</div><fieldset className="configFieldset" disabled={!canManageConfig||savingCompany}>
          <label className="fieldLabel">Razão social<input name="razao_social" placeholder="Razão social da empresa" defaultValue={empresa?.razao_social||''} required/></label>
          <label className="fieldLabel">Nome fantasia<input name="nome_fantasia" placeholder="Nome fantasia" defaultValue={empresa?.nome_fantasia||''} required/></label>
          <label className="fieldLabel">CNPJ<input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" defaultValue={maskCnpj(empresa?.cnpj||'')} onInput={e=>{e.currentTarget.value=maskCnpj(e.currentTarget.value)}}/></label>
          <label className="fieldLabel">E-mail<input name="email" type="email" placeholder="contato@empresa.com" defaultValue={empresa?.email||''}/></label>
          <label className="fieldLabel">Telefone<input name="telefone" inputMode="tel" placeholder="(00) 00000-0000" defaultValue={maskPhone(empresa?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/></label>
          <label className="fieldLabel">Endereço<input name="endereco" placeholder="Rua, número e complemento" defaultValue={empresa?.endereco||''}/></label>
          <label className="fieldLabel">Cidade<input name="cidade" placeholder="Cidade" defaultValue={empresa?.cidade||''}/></label>
          <label className="fieldLabel">UF<input name="uf" placeholder="UF" maxLength={2} defaultValue={empresa?.uf||''}/></label>
          <label className="fieldLabel">CEP<input name="cep" inputMode="numeric" placeholder="00000-000" defaultValue={maskCep(empresa?.cep||'')} onInput={e=>{e.currentTarget.value=maskCep(e.currentTarget.value)}}/></label>
          <label className="fieldLabel">Chave PIX<input name="pix_chave" placeholder="Chave PIX" defaultValue={empresa?.pix_chave||''}/></label>
          <label className="fieldLabel">Banco<input name="banco" placeholder="Banco" defaultValue={empresa?.banco||''}/></label>
          <label className="fieldLabel">Agência<input name="agencia" placeholder="Agência" defaultValue={empresa?.agencia||''}/></label>
          <label className="fieldLabel">Conta<input name="conta" placeholder="Conta" defaultValue={empresa?.conta||''}/></label>
          <label className="fieldLabel fieldLabelWide">Condições gerais da fatura<textarea name="condicoes_gerais" placeholder="Condições gerais da fatura" defaultValue={empresa?.condicoes_gerais||''}/></label>
          <h3 className="fieldLabelWide">Regras comerciais e segurança</h3>
          <label className="fieldLabel">Desconto máximo do vendedor (%)<input name="desconto_max_vendedor" type="number" min="0" max="100" step="0.01" required defaultValue={empresa?.desconto_max_vendedor??10}/></label>
          <label className="fieldLabel">Margem mínima (%)<input name="margem_minima_percentual" type="number" min="0" max="100" step="0.01" required defaultValue={empresa?.margem_minima_percentual??0}/></label>
          <label className="fieldLabel">Validade do orçamento (dias)<input name="validade_orcamento_dias" type="number" min="1" max="365" required defaultValue={empresa?.validade_orcamento_dias??7}/></label>
          <label className="fieldLabel">Encerrar sessão inativa (minutos)<input name="sessao_inatividade_minutos" type="number" min="5" max="480" required defaultValue={empresa?.sessao_inatividade_minutos??30}/></label>
          <label><input type="checkbox" name="bloquear_cliente_inadimplente" defaultChecked={empresa?.bloquear_cliente_inadimplente??true}/> Exigir autorização para cliente inadimplente</label>
          <label><input type="checkbox" name="exigir_aprovacao_limite_credito" defaultChecked={empresa?.exigir_aprovacao_limite_credito??true}/> Exigir autorização acima do limite de crédito</label>
          <label><input type="checkbox" name="venda_cliente" defaultChecked={Boolean(empresa?.campos_obrigatorios?.venda_cliente)}/> Cliente obrigatório na venda</label>
          <label><input type="checkbox" name="venda_vendedor" defaultChecked={Boolean(empresa?.campos_obrigatorios?.venda_vendedor)}/> Vendedor obrigatório na venda</label>
          <label><input type="checkbox" name="compra_fornecedor" defaultChecked={Boolean(empresa?.campos_obrigatorios?.compra_fornecedor)}/> Fornecedor obrigatório na compra</label>
          <p className="fieldLabelWide">Política de estoque: {empresa?.reservar_estoque_pedido?'baixa ao confirmar o pedido':'baixa no faturamento'}, conforme a configuração atual. Compras dão entrada ao receber. Novos usuários aguardam liberação de um administrador.</p>
          <div className="formActions"><button className="primary" disabled={savingCompany}>{savingCompany?'Salvando...':'Salvar configurações'}</button></div></fieldset>
        </form>}
      </section>}
      </>}
    </main>
  </div>
}

function SearchField({value,onChange,placeholder='Pesquisar'}:{value:string;onChange:(value:string)=>void;placeholder?:string}){
  return <div className="tableSearch">
    <Search size={16}/>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}/>
    {value&&<button type="button" onClick={()=>onChange('')} title="Limpar pesquisa"><X size={14}/></button>}
  </div>
}

function paymentLabel(v:string){return v==='dinheiro'?'Dinheiro':v==='pix'?'PIX':v==='cartao'?'Cartão':v==='boleto'?'Boleto':v||'—'}

function EmptyState({message,actionLabel,onAction}:{message:string;actionLabel?:string;onAction?:()=>void}){
  return <div className="emptyState"><span>{message}</span>{actionLabel&&onAction&&<button type="button" className="primary emptyStateAction" onClick={onAction}><Plus size={15}/>{actionLabel.replace(/^\+\s*/,'')}</button>}</div>
}


function EditableEntityTable({title,headers,rows,readOnly=false,emptyActionLabel,onEmptyAction,className=''}:{title:string;headers:string[];rows:{id:string;cells:(string|number)[];opened:boolean;onToggle:()=>void;panel:ReactNode}[];readOnly?:boolean;emptyActionLabel?:string;onEmptyAction?:()=>void;className?:string}){
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState<{index:number;dir:'asc'|'desc'}|null>(null)
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const filtered=normalized?rows.filter(r=>r.cells.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized)):rows
  const sorted=[...filtered].sort((a,b)=>{
    if(!sort)return 0
    const av=a.cells[sort.index],bv=b.cells[sort.index]
    const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),'pt-BR',{numeric:true,sensitivity:'base'})
    return sort.dir==='asc'?cmp:-cmp
  })
  const toggle=(index:number)=>setSort(s=>({index,dir:s?.index===index&&s.dir==='asc'?'desc':'asc'}))
  return <article className={'panel tablePanel '+className}><div className="panelHead"><h3>{title}</h3><SearchField value={query} onChange={setQuery} placeholder="Pesquisar em todas as colunas"/></div><div className="tableWrap"><table><thead><tr>{headers.map((h,i)=><th key={h}>{i===headers.length-1?h:<button className="tableSortBtn" onClick={()=>toggle(i)}>{h}{sort?.index===i?(sort.dir==='asc'?' ▲':' ▼'):''}</button>}</th>)}</tr></thead><tbody>{sorted.length===0&&<tr className="emptyTableRow"><td colSpan={headers.length}><EmptyState message={rows.length===0?`Nenhum registro em ${title.toLowerCase()}.`:'Nenhum resultado encontrado.'} actionLabel={rows.length===0&&!readOnly?emptyActionLabel:undefined} onAction={onEmptyAction}/></td></tr>}{sorted.map(r=><Fragment key={r.id}><tr {...recordRow(()=>{if(!r.opened)r.onToggle()},String(r.cells[0]))}>{r.cells.map((cell,i)=><td key={i}>{cell}</td>)}<td><button className="rowMenuBtn" onClick={r.onToggle} title="Opções" aria-label="Abrir opções" aria-expanded={r.opened}><MoreVertical size={18}/></button></td></tr>{r.opened&&<tr className="manageRow"><td colSpan={headers.length}><div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={String(r.cells[0])}><div className="recordDetailBackdrop" onClick={r.onToggle}/><div className="recordDetailSheet"><div className="recordDetailHeader"><strong>{String(r.cells[0])}</strong><button type="button" className="recordDetailClose" onClick={r.onToggle}><X size={17}/>Fechar</button></div><div className="actionPanel">{r.panel}</div></div></div></td></tr>}</Fragment>)}</tbody></table></div></article>
}

function ProductTable({produtos,groups,subgroups,onCreate,onEdit,onBulkDelete,onBulkExport,canDelete,readOnly=false}:{produtos:Produto[];groups:ProductGroup[];subgroups:ProductSubgroup[];onCreate:()=>void;openId:string|null;onToggle:(id:string)=>void;onEdit:(p:Produto)=>void;onAdjust:(p:Produto)=>void;onDelete:(p:Produto)=>void;onBulkDelete:(ids:string[])=>Promise<boolean>|boolean;onBulkExport:(ids:string[])=>Promise<void>|void;canDelete:boolean;readOnly?:boolean}){
  const [query,setQuery]=useState('')
  const [groupFilter,setGroupFilter]=useState('todos')
  const [subgroupFilter,setSubgroupFilter]=useState('todos')
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const [sort,setSort]=useState<{key:'codigo'|'produto'|'grupo'|'subgrupo'|'status'|'unidade'|'estoque'|'minimo'|'custo'|'venda';dir:'asc'|'desc'}|null>(null)
  const [page,setPage]=useState(1)
  const pageSize=100

  const groupMap=useMemo(()=>new Map(groups.map(g=>[g.id,g.nome])),[groups])
  const subgroupMap=useMemo(()=>new Map(subgroups.map(s=>[s.id,s.nome])),[subgroups])
  const groupName=(p:Produto)=>p.grupo_id?groupMap.get(p.grupo_id)||'Sem grupo':'Sem grupo'
  const subgroupName=(p:Produto)=>p.subgrupo_id?subgroupMap.get(p.subgrupo_id)||'—':'—'
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()

  const filtered=useMemo(()=>produtos.filter(p=>{
    if(groupFilter!=='todos'&&(groupFilter==='sem-grupo'?Boolean(p.grupo_id):p.grupo_id!==groupFilter))return false
    if(subgroupFilter!=='todos'&&(subgroupFilter==='sem-subgrupo'?Boolean(p.subgrupo_id):p.subgrupo_id!==subgroupFilter))return false
    if(!normalized)return true
    return [p.codigo,p.descricao,groupName(p),subgroupName(p),p.ativo?'ativo':'inativo',p.unidade,p.estoque_atual,p.estoque_minimo,money(Number(p.custo)),money(Number(p.preco_venda))].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized)
  }),[produtos,groupFilter,subgroupFilter,normalized,groupMap,subgroupMap])

  const sorted=useMemo(()=>[...filtered].sort((a,b)=>{
    if(!sort)return a.descricao.localeCompare(b.descricao,'pt-BR',{numeric:true,sensitivity:'base'})
    const map=(p:Produto)=>sort.key==='codigo'?p.codigo:sort.key==='produto'?p.descricao:sort.key==='grupo'?groupName(p):sort.key==='subgrupo'?subgroupName(p):sort.key==='status'?(p.ativo?'ativo':'inativo'):sort.key==='unidade'?p.unidade:sort.key==='estoque'?Number(p.estoque_atual):sort.key==='minimo'?Number(p.estoque_minimo):sort.key==='custo'?Number(p.custo):Number(p.preco_venda)
    const av=map(a),bv=map(b)
    const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'pt-BR',{numeric:true,sensitivity:'base'})
    return sort.dir==='asc'?cmp:-cmp
  }),[filtered,sort,groupMap,subgroupMap])

  useEffect(()=>{setPage(1)},[query,groupFilter,subgroupFilter,sort])
  const pageCount=Math.max(1,Math.ceil(sorted.length/pageSize))
  useEffect(()=>{if(page>pageCount)setPage(pageCount)},[page,pageCount])
  const pageRows=sorted.slice((page-1)*pageSize,page*pageSize)

  const toggle=(key:'codigo'|'produto'|'grupo'|'subgrupo'|'status'|'unidade'|'estoque'|'minimo'|'custo'|'venda')=>setSort(v=>({key,dir:v?.key===key&&v.dir==='asc'?'desc':'asc'}))
  const mark=(key:'codigo'|'produto'|'grupo'|'subgrupo'|'status'|'unidade'|'estoque'|'minimo'|'custo'|'venda')=>sort?.key===key?(sort.dir==='asc'?' ▲':' ▼'):''
  const visibleSubgroups=useMemo(()=>subgroups.filter(s=>groupFilter==='todos'||groupFilter==='sem-grupo'||s.grupo_id===groupFilter),[subgroups,groupFilter])
  const visibleIds=pageRows.map(p=>p.id)
  const allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selectedIds.includes(id))
  const toggleSelected=(id:string)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  const toggleAllVisible=()=>setSelectedIds(prev=>allVisibleSelected?prev.filter(id=>!visibleIds.includes(id)):Array.from(new Set([...prev,...visibleIds])))

  return <article className="panel tablePanel">
    <div className="panelHead"><div>{produtos.some(p=>Number(p.estoque_atual)<0)&&<p role="status">Há produtos com saldo negativo. Confira as entradas e saídas e registre a reposição ou um ajuste justificado após a contagem física.</p>}<h3>Produtos / Estoque</h3><p>{filtered.length} de {produtos.length} cadastrados</p></div><SearchField value={query} onChange={setQuery} placeholder="Pesquisar em todas as colunas"/></div>
    {selectedIds.length>0&&<div className="productBulkActions" style={{position:'fixed',right:16,bottom:16,zIndex:1200,maxWidth:'calc(100vw - 32px)',boxShadow:'0 10px 30px rgba(0,0,0,.28)'}}>
      <strong>{selectedIds.length} selecionado(s)</strong>
      <button type="button" className="ghost" onClick={()=>void onBulkExport(selectedIds)}><Download size={15}/>Exportar selecionados</button>
      {canDelete&&<button type="button" className="dangerAction" onClick={async()=>{const completed=await onBulkDelete(selectedIds);if(completed)setSelectedIds([])}}><Trash2 size={15}/>Excluir selecionados</button>}
      <button type="button" className="ghost" onClick={()=>setSelectedIds([])}>Limpar seleção</button>
    </div>}
    <div className="productGroupFilters">
      <label>Grupo<SearchableSelect value={groupFilter==='todos'?'':groupFilter} onChange={value=>{setGroupFilter(value||'todos');setSubgroupFilter('todos')}} placeholder="Todos os grupos" searchPlaceholder="Pesquisar grupo..." options={[{value:'sem-grupo',label:'Sem grupo'},...groups.filter(g=>g.ativo).map(g=>({value:g.id,label:g.nome}))]}/></label>
      <label>Subgrupo<SearchableSelect value={subgroupFilter==='todos'?'':subgroupFilter} onChange={value=>setSubgroupFilter(value||'todos')} placeholder="Todos os subgrupos" searchPlaceholder="Pesquisar subgrupo..." options={[{value:'sem-subgrupo',label:'Sem subgrupo'},...visibleSubgroups.filter(s=>s.ativo).map(s=>({value:s.id,label:s.nome}))]}/></label>
    </div>
    <div className="tableWrap"><table><thead><tr>
      <th className="productSelectCell"><input type="checkbox" aria-label="Selecionar todos os produtos desta página" checked={allVisibleSelected} onChange={toggleAllVisible}/></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('codigo')}>Código{mark('codigo')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('produto')}>Produto{mark('produto')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('grupo')}>Grupo{mark('grupo')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('subgrupo')}>Subgrupo{mark('subgrupo')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('status')}>Status{mark('status')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('unidade')}>Un.{mark('unidade')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('estoque')}>Estoque{mark('estoque')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('minimo')}>Mínimo{mark('minimo')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('custo')}>Custo{mark('custo')}</button></th>
      <th><button className="tableSortBtn" onClick={()=>toggle('venda')}>Venda{mark('venda')}</button></th>
    </tr></thead><tbody>
      {filtered.length===0&&<tr className="emptyTableRow"><td colSpan={11}><EmptyState message={produtos.length===0?'Nenhum produto cadastrado.':'Nenhum produto encontrado para estes filtros.'} actionLabel={produtos.length===0&&!readOnly?'+ Adicionar Produto':undefined} onAction={onCreate}/></td></tr>}
      {pageRows.map(p=>{const low=Number(p.estoque_atual)<=Number(p.estoque_minimo);return <tr key={p.id} {...recordRow(()=>{if(!readOnly)onEdit(p)},p.descricao)}><td className="productSelectCell" onDoubleClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={'Selecionar '+p.codigo+' - '+p.descricao} checked={selectedIds.includes(p.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleSelected(p.id)}/></td><td>{p.codigo}</td><td><div className="productNameCell"><span>{p.descricao}</span>{p.tipo_produto==='produto_final'&&<small className="productFinalBadge">PRODUÇÃO</small>}{p.tipo_produto==='servico'&&<small className="productFinalBadge serviceProductBadge">SERVIÇO</small>}</div></td><td>{groupName(p)}</td><td>{subgroupName(p)}</td><td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td><td>{p.unidade}</td><td><strong className={low?'stockLow':''}>{Number(p.estoque_atual).toLocaleString('pt-BR')}</strong></td><td>{Number(p.estoque_minimo).toLocaleString('pt-BR')}</td><td>{money(Number(p.custo))}</td><td>{money(Number(p.preco_venda))}</td></tr>})}
    </tbody></table></div>
    {filtered.length>pageSize&&<div className="productTablePagination">
      <span>Mostrando {(page-1)*pageSize+1}–{Math.min(page*pageSize,filtered.length)} de {filtered.length}</span>
      <div>
        <button type="button" className="ghost" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={15}/>Anterior</button>
        <strong>Página {page} de {pageCount}</strong>
        <button type="button" className="ghost" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page===pageCount}>Próxima<ChevronRight size={15}/></button>
      </div>
    </div>}
  </article>
}

export default App

