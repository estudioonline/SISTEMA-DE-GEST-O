import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards,
  BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut, Trash2, FileDown,
  Pencil, Ban, MoreVertical, RefreshCw, CheckCircle2, ChevronLeft, Grid2X2,
  Upload, Download, FileSpreadsheet, BadgeDollarSign, UserPlus, Paperclip, ExternalLink, Search, X, ShieldCheck, TrendingUp, Printer, Truck
} from 'lucide-react'
import { supabase, supabaseConfigured, supabasePublishableKey, supabaseUrl } from './lib/supabase'
import type { CommissionReportRow } from './lib/commissionReportPdf'
import { recordRow } from './lib/recordRow'
import { buildStatement } from './lib/entityStatement'
import type { StatementKind, StatementWire } from './lib/entityStatement'
import { readAllRows } from './lib/readAllRows'
import { readSettings } from './lib/erpSettings'
import { AuthorizationCenter } from './AuthorizationCenter'
import { PaymentHistory } from './PaymentHistory'
import { FinanceAdministration, FinanceClassifications } from './FinanceAdministration'
import { NfeImportModal } from './NfeImportModal'
import { FocusNfeSettings, FocusNfeSale } from './FocusNfe'
import { AppLauncher } from './AppLauncher'
import { EmployeeFinance } from './EmployeeFinance'
import { BankReconciliation } from './BankReconciliation'
import { DeliveryManagement } from './DeliveryManagement'
import type { EmployeeTitle } from './EmployeeFinance'
import { canEditPermission, canViewPermission, defaultPermissionsForRole, normalizePermissions, permissionModules } from './lib/permissions'
import type { AccessLevel, PermissionMap, PermissionModule } from './lib/permissions'

type ModuleKey=PermissionModule
type PerfilRole='administrador'|'financeiro'|'vendas'|'estoque'|'visualizador'
type PaymentMethod='dinheiro'|'pix'|'cartao'|'boleto'
type PurchasePaymentMethod='pix'|'cartao'|'boleto'
type DeliveryRoute='norte'|'sul'|'leste'|'interestadual'|'retirada'

type Cliente={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;limite_credito:number;ativo:boolean;logradouro?:string|null;numero?:string|null;bairro?:string|null;municipio?:string|null;codigo_municipio?:string|null;uf?:string|null;cep?:string|null;indicador_ie?:string|null;inscricao_estadual?:string|null;consumidor_final?:boolean|null;presenca_comprador?:number|null;latitude?:number|null;longitude?:number|null}
type Fornecedor={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;ativo:boolean}
type Produto={id:string;codigo:string;descricao:string;unidade:string;custo:number;custo_medio?:number|null;preco_venda:number;estoque_atual:number;estoque_minimo:number;estoque_reposicao?:number|null;percentual_minimo_custo_venda?:number|null;ativo:boolean;ncm?:string|null;cfop_interno?:string|null;cfop_interestadual?:string|null;origem?:number|null;cst_icms?:string|null;cst_pis?:string|null;cst_cofins?:string|null;complemento_tributario?:Record<string,unknown>|null;peso_kg?:number|null;volume_m3?:number|null}
type Venda={id:string;cliente_id:string|null;vendedor_id:string|null;vendedor_cadastro_id:string|null;status:string;subtotal:number;desconto:number;total:number;observacoes:string|null;rota_entrega:DeliveryRoute|null;created_at:string;forma_pagamento:PaymentMethod;parcelas:number;primeiro_vencimento:string;vencimentos_parcelas?:string[]|null;fatura_numero:number|null;fatura_gerada_em:string|null;estoque_negativo_autorizado_por?:string|null;estoque_negativo_autorizado_em?:string|null}
type VendaItem={produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number}
type SaleItemDraft={key:string;produto_id:string;quantidade:number;valor_unitario:number;desconto:number}
type Compra={id:string;fornecedor_id:string|null;status:string;total:number;observacoes:string|null;created_at:string;forma_pagamento:PurchasePaymentMethod;parcelas:number;primeiro_vencimento:string;vencimentos_parcelas:string[];fatura_numero:number|null;fatura_gerada_em:string|null;chave_nfe?:string|null;numero_nfe?:string|null;cnpj_fornecedor?:string|null;nome_fornecedor?:string|null;data_emissao?:string|null;valor_total_nfe?:number|null}
type CompraItem={produto_id:string;quantidade:number;custo_unitario:number;total:number}
type PurchaseItemDraft={key:string;produto_id:string;quantidade:number;custo_unitario:number}
type Titulo=EmployeeTitle&{id:string;tipo:'pagar'|'receber';descricao:string;entidade_nome:string|null;vencimento:string;valor:number;valor_pago:number;status:'aberto'|'parcial'|'pago'|'cancelado';categoria:string|null;centro_custo:string|null;venda_id:string|null;compra_id:string|null;parcela_numero:number|null;forma_pagamento:string|null;created_at:string}
type SaleApproval={id:string;entidade_id:string|null;status:string;solicitado_em:string;payload:Record<string,unknown>|null}
type FinancePayment={id:string;titulo_id:string;data_pagamento:string;valor:number}
type FinanceReversal={id:string;pagamento_id:string;valor:number;data_estorno:string}
type EmpresaConfig={id:number;razao_social:string;nome_fantasia:string;cnpj:string|null;email:string|null;telefone:string|null;endereco:string|null;cidade:string|null;uf:string|null;cep:string|null;pix_chave:string|null;banco:string|null;agencia:string|null;conta:string|null;condicoes_gerais:string|null;desconto_max_vendedor?:number;margem_minima_percentual?:number;validade_orcamento_dias?:number;bloquear_cliente_inadimplente?:boolean;exigir_aprovacao_limite_credito?:boolean;reservar_estoque_pedido?:boolean;sessao_inatividade_minutos?:number;campos_obrigatorios?:Record<string,unknown>}
type Vendedor={id:string;nome:string;email:string|null;telefone:string|null;percentual_comissao:number;ativo:boolean;created_at:string}
type ManagedUser={user_id:string;nome:string;email:string;perfil:PerfilRole;ativo:boolean;criado_em:string;ultimo_acesso:string|null;usuario_atual:boolean;permissoes:PermissionMap}
type ComissaoResumo={vendedor_id:string;vendedor_nome:string;percentual_comissao:number;total_recebido:number;comissao_apurada:number;pagamentos:number;vendas:number}
type Comprovante={id:string;venda_id:string|null;compra_id:string|null;storage_path:string;nome_arquivo:string;mime_type:string|null;tamanho:number|null;created_at:string}
type MovimentoEstoque={id:string;produto_id:string;tipo:string;quantidade:number;referencia:string|null;created_at:string}
type SaleHistoryEvent={evento_id:string;fonte:string;acao:string;usuario_id:string|null;usuario_nome:string;usuario_perfil:string|null;ocorrido_em:string;dados_antes:Record<string,unknown>|null;dados_depois:Record<string,unknown>|null}

const menu=[
  ['vendas','Vendas',ReceiptText],['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos / Estoque',Package],['compras','Compras',ShoppingCart],
  ['comissoes','Comissões',BadgeDollarSign],['financeiro','Financeiro',WalletCards],['entregas','Entregas',Truck],['autorizacoes','Autorizações',ShieldCheck],['relatorios','Relatórios',BarChart3],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const addDaysIso=(base:string,days:number)=>{const [y,m,d]=base.split('-').map(Number);const x=new Date(y,m-1,d+days,12);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
const monthStartIso=(base=today())=>base.slice(0,8)+'01'
const monthEndIso=(base=today())=>addDaysIso(addMonthsIso(base.slice(0,8)+'01',1),-1)
const dateBr=(v:string)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v.length===10?v+'T12:00:00':v)):'—'
const invoiceNo=(n:number|null|undefined)=>String(n||0).padStart(7,'0')
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
const newSaleItem=():SaleItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,valor_unitario:0,desconto:0})
const newPurchaseItem=():PurchaseItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,custo_unitario:0})
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
  const [dark,setDark]=useState(false)
  const [showApps,setShowApps]=useState(true)
  const [permissionsReady,setPermissionsReady]=useState(false)
  const moduleHeading=useRef<HTMLHeadingElement>(null)
  const [profileRole,setProfileRole]=useState<PerfilRole>('visualizador')
  const [userPermissions,setUserPermissions]=useState<PermissionMap>(()=>defaultPermissionsForRole('visualizador'))
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
  const [savingPermissionUserId,setSavingPermissionUserId]=useState<string|null>(null)

  const [showForm,setShowForm]=useState(false)
  const [editingClient,setEditingClient]=useState<Cliente|null>(null)
  const [clientLookupBusy,setClientLookupBusy]=useState(false)
  const [clientPanel,setClientPanel]=useState<string|null>(null)
  const [editingSupplier,setEditingSupplier]=useState<Fornecedor|null>(null)
  const [supplierPanel,setSupplierPanel]=useState<string|null>(null)
  const [statementBusy,setStatementBusy]=useState<string|null>(null)

  const [editingProduct,setEditingProduct]=useState<Produto|null>(null)
  const [productPanel,setProductPanel]=useState<string|null>(null)
  const [adjustingProduct,setAdjustingProduct]=useState<Produto|null>(null)
  const [stockNew,setStockNew]=useState('')
  const [stockReason,setStockReason]=useState('Ajuste manual')
  const [productSubtab,setProductSubtab]=useState<'cadastro'|'movimentos'>('cadastro')
  const [excelToolsOpen,setExcelToolsOpen]=useState(false)

  const [editingSale,setEditingSale]=useState<Venda|null>(null)
  const [salePanel,setSalePanel]=useState<string|null>(null)
  const [saleDetailItems,setSaleDetailItems]=useState<VendaItem[]>([])
  const [saleDetailTab,setSaleDetailTab]=useState<'itens'|'informacoes'|'documentos'|'historico'>('itens')
  const [saleHistory,setSaleHistory]=useState<SaleHistoryEvent[]>([])
  const [saleHistoryBusy,setSaleHistoryBusy]=useState(false)
  const [saleClient,setSaleClient]=useState('')
  const [saleSeller,setSaleSeller]=useState('')
  const [saleStatus,setSaleStatus]=useState('orcamento')
  const [saleNotes,setSaleNotes]=useState('')
  const [saleRoute,setSaleRoute]=useState<DeliveryRoute|''>('')
  const [salePayment,setSalePayment]=useState<PaymentMethod>('pix')
  const [saleInstallments,setSaleInstallments]=useState(1)
  const [saleDueDate,setSaleDueDate]=useState(today())
  const [saleInstallmentDates,setSaleInstallmentDates]=useState<string[]>([today()])
  const [saleItems,setSaleItems]=useState<SaleItemDraft[]>([newSaleItem()])
  const [originalSaleItems,setOriginalSaleItems]=useState<VendaItem[]>([])
  const [saleCreditState,setSaleCreditState]=useState<{em_aberto:number;vencido:number}|null>(null)
  const [savingSale,setSavingSale]=useState(false)
  const [saleRequestId,setSaleRequestId]=useState(()=>crypto.randomUUID())

  const [editingPurchase,setEditingPurchase]=useState<Compra|null>(null)
  const [purchasePanel,setPurchasePanel]=useState<string|null>(null)
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
  const [financePanelTab,setFinancePanelTab]=useState<'detalhes'|'pagamentos'|'comprovantes'>('detalhes')
  const [financeSubtab,setFinanceSubtab]=useState<'geral'|'vencidos'|'receber'|'pagar'|'funcionarios'|'vales'|'conciliacao'>('geral')
  const [financeStatusFilter,setFinanceStatusFilter]=useState<'todos'|'aberto'|'parcial'|'pago'|'cancelado'>('todos')
  const [financeStart,setFinanceStart]=useState('')
  const [financeEnd,setFinanceEnd]=useState('')
  const [financeCategory,setFinanceCategory]=useState('todos')
  const [financeCenter,setFinanceCenter]=useState('todos')
  const [financeTitleType,setFinanceTitleType]=useState<'receber'|'pagar'>('receber')
  const [financeTitleEntity,setFinanceTitleEntity]=useState('')
  const [financeActivityState,setFinanceActivityState]=useState<'loading'|'ready'|'error'>('loading')
  const [financePayments,setFinancePayments]=useState<FinancePayment[]>([])
  const [financeReversals,setFinanceReversals]=useState<FinanceReversal[]>([])
  const [paymentDate,setPaymentDate]=useState(today())
  const [paymentAmount,setPaymentAmount]=useState('')

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
  const canViewModule=(module:PermissionModule)=>canViewPermission(userPermissions,module)
  const canEditModule=(module:PermissionModule)=>canEditPermission(userPermissions,module)
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
  const canManageConfig=canEditModule('config')
  const visibleMenu=menu.filter(([k])=>canViewModule(k))

  useEffect(()=>{if(!showApps)moduleHeading.current?.focus()},[showApps,active])

  useEffect(()=>{
    if(!supabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    setProfileRole('visualizador');setUserPermissions(defaultPermissionsForRole('visualizador'));setActive('dashboard');setShowApps(true);setPermissionsReady(false);closeForms()
    setClientes([]);setFornecedores([]);setProdutos([]);setVendas([]);setCompras([]);setTitulos([]);setSaleApprovals([])
    setEmpresa(null);setVendedores([]);setComprovantes([]);setMovimentosEstoque([]);setComissoes([])
    setManagedUsers([]);setManagedUserCard(null);setUserEdits({});setUserPermissionEdits({});setFinancePayments([]);setFinanceReversals([]);setEmail('');setPassword('')
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
    const minutes=Math.max(5,Number(empresa?.sessao_inatividade_minutos||30))
    let timer=window.setTimeout(async()=>{setMsg('Sessão encerrada por inatividade.');await supabase.auth.signOut()},minutes*60*1000)
    const reset=()=>{
      window.clearTimeout(timer)
      timer=window.setTimeout(async()=>{setMsg('Sessão encerrada por inatividade.');await supabase.auth.signOut()},minutes*60*1000)
    }
    const events=['pointerdown','keydown','scroll','touchstart'] as const
    events.forEach(ev=>window.addEventListener(ev,reset,{passive:true}))
    return ()=>{window.clearTimeout(timer);events.forEach(ev=>window.removeEventListener(ev,reset))}
  },[session,empresa?.sessao_inatividade_minutos])

  async function loadData(){
    if(!session)return
    const [c,f,p,v,cp,t,ec,pr,vd,cv,me,sa,pm]=await Promise.all([
      readAllRows((from,to)=>supabase.from('clientes').select('*').order('nome',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('fornecedores').select('*').order('nome',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('produtos').select('*').order('descricao',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('vendas').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('compras').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('titulos_financeiros').select('*').order('vencimento',{ascending:true}).order('id').range(from,to)),
      supabase.from('empresa_config').select('*').eq('id',1).maybeSingle(),
      supabase.from('profiles').select('perfil,ativo').eq('id',session.user.id).maybeSingle(),
      readAllRows((from,to)=>supabase.from('vendedores').select('*').order('nome',{ascending:true}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('comprovantes_pagamento').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('movimentos_estoque').select('*').order('created_at',{ascending:false}).order('id').range(from,to)),
      readAllRows((from,to)=>supabase.from('aprovacoes_operacoes').select('id,entidade_id,status,solicitado_em,payload').eq('entidade_tipo','venda').eq('status','pendente').order('solicitado_em',{ascending:false}).order('id').range(from,to)),
      supabase.rpc('minhas_permissoes_erp')
    ])
    if(currentSessionUser.current!==session.user.id)return
    if(!c.error)setClientes((c.data||[]) as Cliente[])
    if(!f.error)setFornecedores((f.data||[]) as Fornecedor[])
    if(!p.error)setProdutos((p.data||[]) as Produto[])
    if(!v.error)setVendas((v.data||[]) as Venda[])
    if(!cp.error)setCompras((cp.data||[]) as Compra[])
    if(!t.error)setTitulos((t.data||[]) as Titulo[])
    if(!ec.error&&ec.data)setEmpresa(ec.data as EmpresaConfig)
    if(pr.error||!pr.data?.perfil||!pr.data.ativo){
      setProfileRole('visualizador')
      setUserPermissions(defaultPermissionsForRole('visualizador'))
      setClientes([]);setFornecedores([]);setProdutos([]);setVendas([]);setCompras([]);setTitulos([]);setEmpresa(null);setVendedores([]);setComprovantes([]);setMovimentosEstoque([])
      setMsg('Acesso não liberado. Procure um administrador do sistema.')
      await supabase.auth.signOut()
      return
    }
    if(!pr.error&&pr.data?.perfil){
      const role=pr.data.perfil as PerfilRole
      setProfileRole(role)
      if(!pm.error)setUserPermissions(normalizePermissions(Object.fromEntries(((pm.data||[]) as {modulo:string;nivel:AccessLevel}[]).map(row=>[row.modulo,row.nivel])),role))
      else setUserPermissions(defaultPermissionsForRole(role))
      if(pr.data.ativo===false){
        setMsg('Seu usuário está desativado. Procure um administrador do sistema.')
        await supabase.auth.signOut()
        return
      }
    }
    if(!vd.error)setVendedores((vd.data||[]) as Vendedor[])
    if(!cv.error)setComprovantes((cv.data||[]) as Comprovante[])
    if(!me.error)setMovimentosEstoque((me.data||[]) as MovimentoEstoque[])
    if(!sa.error)setSaleApprovals((sa.data||[]) as SaleApproval[])
    setPermissionsReady(true)
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
    if(!window.confirm('Excluir este comprovante?'))return
    const storage=await supabase.storage.from('comprovantes-pagamento').remove([p.storage_path])
    if(storage.error){setMsg(storage.error.message);return}
    const meta=await supabase.from('comprovantes_pagamento').delete().eq('id',p.id)
    setMsg(meta.error?meta.error.message:'Comprovante excluído.')
    if(!meta.error)await loadData()
  }

  async function login(e:FormEvent){
    e.preventDefault();setMsg('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)setMsg(error.message)
  }

  function closeForms(){
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
    if(!window.confirm(`Excluir o cliente "${c.nome}"?`))return
    const r=await supabase.from('clientes').delete().eq('id',c.id)
    if(r.error?.code==='23503'){
      const d=await supabase.from('clientes').update({ativo:false}).eq('id',c.id)
      setMsg(d.error?d.error.message:'Cliente com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:'Cliente excluído.')
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
    if(!window.confirm(`Excluir o fornecedor "${f.nome}"?`))return
    const r=await supabase.from('fornecedores').delete().eq('id',f.id)
    if(r.error?.code==='23503'){
      const d=await supabase.from('fornecedores').update({ativo:false}).eq('id',f.id)
      setMsg(d.error?d.error.message:'Fornecedor com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:'Fornecedor excluído.')
    await loadData()
  }

  // PRODUTOS / ESTOQUE
  function startNewProduct(){if(!canManageProducts){setMsg('Você possui somente visualização em Produtos / Estoque.');return}setEditingProduct(null);setAdjustingProduct(null);setShowForm(true);setMsg('')}
  function startEditProduct(p:Produto){if(!canManageProducts){setMsg('Você possui somente visualização em Produtos / Estoque.');return}setEditingProduct(p);setAdjustingProduct(null);setShowForm(true);setMsg('')}
  async function saveProduct(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageProducts){setMsg('Sem permissão para editar Produtos / Estoque.');return}
    const f=new FormData(e.currentTarget)
    let complemento:Record<string,unknown>={}
    const complementoRaw=String(f.get('complemento_tributario')||'').trim()
    if(complementoRaw){
      try{
        const parsed=JSON.parse(complementoRaw)
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error()
        complemento=parsed as Record<string,unknown>
      }catch{
        setMsg('Complemento tributário deve ser um objeto JSON válido.')
        return
      }
    }
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
      ativo:String(f.get('ativo')||'true')==='true'
    }
    const r=editingProduct?await supabase.from('produtos').update(base).eq('id',editingProduct.id):await supabase.from('produtos').insert({...base,estoque_atual:Number(f.get('estoque_atual')||0)})
    setMsg(r.error?r.error.message:editingProduct?'Produto atualizado.':'Produto cadastrado.')
    if(!r.error){setEditingProduct(null);setShowForm(false);await loadData()}
  }
  function startAdjustStock(p:Produto){if(!canManageProducts){setMsg('Sem permissão para ajustar estoque.');return}setAdjustingProduct(p);setStockNew(String(p.estoque_atual));setStockReason('Ajuste manual');setShowForm(false);setMsg('')}
  async function adjustStock(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!canManageProducts){setMsg('Sem permissão para ajustar estoque.');return}
    if(!adjustingProduct)return
    const {error}=await supabase.rpc('ajustar_estoque_produto',{p_produto_id:adjustingProduct.id,p_novo_estoque:Number(stockNew),p_motivo:stockReason})
    setMsg(error?error.message:'Estoque ajustado e movimento registrado.')
    if(!error){setAdjustingProduct(null);await loadData()}
  }
  async function deleteProduct(p:Produto){
    if(!(isAdmin&&canManageProducts)){setMsg('Sem permissão para excluir produtos.');return}
    if(!window.confirm(`Excluir o produto "${p.descricao}"?`))return
    const r=await supabase.from('produtos').delete().eq('id',p.id)
    if(r.error?.code==='23503'){
      const d=await supabase.from('produtos').update({ativo:false}).eq('id',p.id)
      setMsg(d.error?d.error.message:'Produto com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:'Produto excluído.')
    await loadData()
  }

  async function exportProducts(){
    try{
      (await import('./lib/productsExcel')).exportProductsExcel(produtos)
      setMsg(`Relatório Excel exportado com ${produtos.length} produto(s).`)
    }catch{
      setMsg('Não foi possível exportar o relatório Excel.')
    }
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

      const confirmed=window.confirm(
        `Importar ${rows.length} linha(s)?\n\nProdutos com o mesmo código serão atualizados. O valor da coluna "Estoque Atual" substituirá o saldo atual e a diferença ficará registrada no histórico.`
      )
      if(!confirmed){
        setMsg('Importação cancelada.')
        return
      }

      const {data,error}=await supabase.rpc('importar_produtos_estoque',{p_linhas:rows})
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
  function resetSaleForm(){setSaleRequestId(crypto.randomUUID());setSaleNotice('');setEditingSale(null);setOriginalSaleItems([]);setSaleCreditState(null);setSaleClient('');setSaleSeller('');setSaleStatus('orcamento');setSaleNotes('');setSaleRoute('');setSalePayment('pix');setSaleInstallments(1);setSaleDueDate(today());setSaleInstallmentDates([today()]);setSaleItems([newSaleItem()])}
  function startNewSale(){if(!canManageSales){setMsg('Seu perfil não tem permissão para criar vendas.');return}setSalePanel(null);setSaleDetailItems([]);resetSaleForm();setShowForm(true);setMsg('')}
  async function openSaleDetail(v:Venda){
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
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
    if(v.status==='cancelado'){setMsg('Venda cancelada não pode ser editada.');return}
    if(saleApprovals.some(a=>a.entidade_id===v.id)){setMsg('Este orçamento está aguardando aprovação e não pode ser alterado até a decisão do administrador.');return}
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as VendaItem[]
    setSaleRequestId(crypto.randomUUID())
    setOriginalSaleItems(items)
    const saleCount=Number(v.parcelas)||1;const saleBase=v.primeiro_vencimento||today();const saleDates=Array.isArray(v.vencimentos_parcelas)&&v.vencimentos_parcelas.length===saleCount?v.vencimentos_parcelas:buildInstallmentDates(saleBase,saleCount);setEditingSale(v);setSaleClient(v.cliente_id||'');setSaleSeller(v.vendedor_cadastro_id||'');setSaleStatus(v.status);setSaleNotes(v.observacoes||'');setSaleRoute(v.rota_entrega||'');setSalePayment(v.forma_pagamento||'pix');setSaleInstallments(saleCount);setSaleDueDate(saleDates[0]||saleBase);setSaleInstallmentDates(saleDates)
    setSaleItems(items.map(i=>({key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)})))
    setSalePanel(null);setSaleDetailItems([]);setShowForm(true);setMsg('')
  }
  function chooseProduct(key:string,id:string){const p=produtos.find(x=>x.id===id);setSaleItems(items=>items.map(i=>i.key===key?{...i,produto_id:id,valor_unitario:p?Number(p.preco_venda):0}:i))}
  function updateSaleItem(key:string,field:'quantidade'|'valor_unitario'|'desconto',value:number){setSaleItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function removeSaleItem(key:string){setSaleItems(items=>items.length===1?items:items.filter(i=>i.key!==key))}
  function resizeSaleDates(count:number){
    const base=saleInstallmentDates[0]||saleDueDate||today()
    setSaleInstallments(count)
    setSaleDueDate(base)
    setSaleInstallmentDates(prev=>Array.from({length:count},(_,i)=>prev[i]||addMonthsIso(base,i)))
  }
  function changeSaleInstallmentDate(index:number,value:string){
    setSaleInstallmentDates(prev=>{
      const next=[...prev]
      next[index]=value
      if(index===0)setSaleDueDate(value)
      return next
    })
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
    setMsg('');setSaleNotice('')

    const items=saleItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length||saleHasStructuralError){
      setMsg('Corrija os itens da venda antes de continuar: produto ativo, quantidade maior que zero e preço válido.')
      return
    }

    if(saleInstallmentDates.length!==saleInstallments||saleInstallmentDates.some(v=>!v)){
      setMsg('Informe a data de vencimento de cada parcela.')
      return
    }

    if(saleStatus!=='orcamento'&&saleHasAuthorizationBlocker){
      setMsg('Esta venda possui bloqueios que exigem autorização: '+saleApprovalBlockers.map(b=>b.label).join(', ')+'. Use o botão destacado “Solicitar autorização”.')
      return
    }

    setSavingSale(true);setMsg('')
    const args={
      p_cliente_id:saleClient||null,
      p_vendedor_cadastro_id:saleSeller||null,
      p_status:saleStatus,
      p_forma_pagamento:salePayment,
      p_parcelas:saleInstallments,
      p_primeiro_vencimento:saleInstallmentDates[0]||saleDueDate,
      p_vencimentos:saleInstallmentDates,
      p_observacoes:saleNotes,
      p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:i.desconto}))
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
    const subtotal=items.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
    const desconto=items.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
    const total=Math.max(0,subtotal-desconto)

    try{
      (await import('./lib/invoicePdf')).generateInvoicePdf({
        id:saved.id,
        fatura_numero:saved.fatura_numero,
        created_at:saved.created_at||new Date().toISOString(),
        status:saved.status,
        subtotal,
        desconto,
        total,
        observacoes:saleNotes||null,
        forma_pagamento:salePayment,
        parcelas:saleInstallments,
        primeiro_vencimento:saleInstallmentDates[0]||saleDueDate,
        rota_entrega:saleRoute||null,
        vendedor_nome:vendedores.find(v=>v.id===saleSeller)?.nome||null,
        cliente:clientes.find(c=>c.id===saleClient)||null,
        company:empresa||undefined,
        items:invoiceItems(items)
      })
      await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',saved.id)
      setMsg(editingSale?'Venda atualizada e documento reemitido.':saleStatus==='orcamento'?'Orçamento salvo.':'Venda salva e fatura emitida.')
    }catch{
      setMsg('Venda salva. O documento pode ser reemitido pelo painel.')
    }

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
      const items=((itemData||[]) as VendaItem[]).map(i=>({produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)}))
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
      const paidTitle=titulos.some(t=>t.venda_id===v.id&&Number(t.valor_pago)>0)
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
        ...(!shortages.length&&belowMinimum.length?[{tipo:'estoque_minimo',label:'Estoque ficará abaixo do mínimo',detalhe:belowMinimum.map(x=>`${x.product.descricao}: saldo ${x.projected.toLocaleString('pt-BR')} / mínimo ${x.minimum.toLocaleString('pt-BR')}`).join(' • ')}]:[]),
        ...(paidTitle?[{tipo:'fatura_paga',label:'Fatura com pagamento registrado',detalhe:'A aprovação avançará o status preservando itens, valores e histórico financeiro já liquidados.'}]:[]),
        ...(proof?[{tipo:'comprovante_anexado',label:'Comprovante já anexado',detalhe:'A aprovação preservará o comprovante existente.'}]:[])
      ]

      const payload={
        p_venda_id:v.id,
        p_cliente_id:v.cliente_id||null,
        p_vendedor_cadastro_id:v.vendedor_cadastro_id||null,
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
        const motivo=window.prompt(`Este orçamento possui ${blockers.length} bloqueio(s). Informe o motivo para solicitar autorização:`)
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

    const motivo=window.prompt('Justifique a solicitação para o responsável pela autorização (mínimo de 5 caracteres):')
    if(!motivo)return

    setSavingSale(true)
    try{
      const {error}=await supabase.rpc('solicitar_autorizacao_venda',{
        p_motivo:motivo,
        p_payload:{
          p_venda_id:editingSale.id,
          p_cliente_id:saleClient||null,
          p_vendedor_cadastro_id:saleSeller||null,
          p_status:saleStatus,
          p_forma_pagamento:salePayment,
          p_parcelas:saleInstallments,
          p_primeiro_vencimento:saleInstallmentDates[0]||saleDueDate,
          p_vencimentos:saleInstallmentDates,
          p_observacoes:saleNotes,
          p_rota_entrega:saleRoute||null,
          p_bloqueios:saleApprovalBlockers,
          p_itens:saleItems.map(({produto_id,quantidade,valor_unitario,desconto})=>({produto_id,quantidade,valor_unitario,desconto}))
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
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
    if(error){setMsg(error.message);return null}
    const items=(data||[]) as VendaItem[]
    const drafts=items.map(i=>({key:'pdf',produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)}))
    return {
      id:v.id,
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
      items:invoiceItems(drafts)
    }
  }
  async function downloadSalePdf(v:Venda){
    const payload=await buildSaleInvoicePayload(v)
    if(!payload)return
    try{
      (await import('./lib/invoicePdf')).generateInvoicePdf(payload)
      await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',v.id)
    }catch{setMsg('Não foi possível gerar o PDF.')}
  }
  async function printSalePdf(v:Venda){
    const payload=await buildSaleInvoicePayload(v)
    if(!payload)return
    try{
      ;(await import('./lib/invoicePdf')).openInvoicePdfForPrint(payload)
    }catch{setMsg('Não foi possível abrir o documento para impressão.')}
  }
  async function cancelSale(v:Venda){if(v.status==='cancelado'||!window.confirm(`Cancelar fatura ${invoiceNo(v.fatura_numero)}?`))return;const r=await supabase.from('vendas').update({status:'cancelado'}).eq('id',v.id);setMsg(r.error?r.error.message:'Venda cancelada e estoque/financeiro estornados.');if(!r.error){setSalePanel(null);await loadData()}}
  async function deleteSale(v:Venda){if(!(isAdmin&&canManageSales)){setMsg('Sem permissão para excluir venda.');return}if(!window.confirm(`Excluir fatura ${invoiceNo(v.fatura_numero)} definitivamente?`))return;const r=await supabase.from('vendas').delete().eq('id',v.id);setMsg(r.error?r.error.message:'Venda excluída.');if(!r.error){setSalePanel(null);await loadData()}}

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
  function addAllPurchaseSuggestions(){
    if(!canManagePurchases){setMsg('Sem permissão para criar compras.');return}
    if(!purchaseSuggestions.length)return
    if(!showForm){resetPurchaseForm();setShowForm(true)}
    setPurchaseItems(items=>{
      let next=items.filter(i=>i.produto_id)
      for(const suggestion of purchaseSuggestions){
        const idx=next.findIndex(i=>i.produto_id===suggestion.produto.id)
        if(idx>=0){
          next=next.map((i,index)=>index===idx?{...i,quantidade:Number((i.quantidade+suggestion.suggested).toFixed(3)),custo_unitario:Number(suggestion.produto.custo||i.custo_unitario)}:i)
        }else{
          next.push({key:`${Date.now()}-${Math.random()}`,produto_id:suggestion.produto.id,quantidade:Number(suggestion.suggested.toFixed(3)),custo_unitario:Number(suggestion.produto.custo||0)})
        }
      }
      return next.length?next:[newPurchaseItem()]
    })
    setMsg(`${purchaseSuggestions.length} item(ns) de estoque baixo adicionados à compra.`)
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
    if(!window.confirm(`Confirmar o recebimento da compra #${invoiceNo(c.fatura_numero)}? Os itens serão adicionados ao estoque.`))return

    const r=await supabase.from('compras')
      .update({status:'pedido_recebido'})
      .eq('id',c.id)
      .eq('status','pedido_aprovado')

    if(r.error){
      setMsg(r.error.message)
      return
    }

    setMsg(`Compra #${invoiceNo(c.fatura_numero)} recebida. Estoque atualizado com sucesso.`)
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
    if(c.status==='cancelada'||!window.confirm(`Cancelar esta compra? ${detail}`))return
    const r=await supabase.from('compras').update({status:'cancelada'}).eq('id',c.id)
    setMsg(r.error?r.error.message:c.status==='pedido_recebido'?'Pedido cancelado, estoque estornado e contas a pagar em aberto canceladas.':c.status==='pedido_aprovado'?'Pedido cancelado e contas a pagar em aberto canceladas.':'Cotação cancelada.')
    if(!r.error){setPurchasePanel(null);await loadData()}
  }
  async function deletePurchase(c:Compra){if(!(isAdmin&&canManagePurchases)){setMsg('Sem permissão para excluir compra.');return}if(!window.confirm('Excluir esta compra definitivamente?'))return;const r=await supabase.from('compras').delete().eq('id',c.id);setMsg(r.error?r.error.message:'Compra excluída.');if(!r.error){setPurchasePanel(null);await loadData()}}

  // FINANCEIRO
  function startNewTitle(){
    if(!canManageFinance){setMsg('Você possui somente visualização no Financeiro.');return}
    setEditingTitle(null)
    setFinanceTitleType('receber')
    setFinanceTitleEntity('')
    setShowForm(true)
    setMsg('')
  }

  function startEditTitle(t:Titulo){
    if(!canManageFinance){setMsg('Você possui somente visualização no Financeiro.');return}
    setEditingTitle(t)
    setFinanceTitleType(t.tipo)
    setFinanceTitleEntity(t.entidade_nome||'')
    setShowForm(true)
    setMsg('')
  }

  function openFinancePanel(t:Titulo){
    if(financePanel===t.id){
      setFinancePanel(null)
      return
    }
    setFinancePanel(t.id)
    setFinancePanelTab('detalhes')
    setPaymentDate(today())
    setPaymentAmount(String(Math.max(0,Number(t.valor)-Number(t.valor_pago)).toFixed(2)))
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

    const {error}=await supabase.rpc('registrar_pagamento_titulo',{
      p_titulo_id:t.id,
      p_valor:amount,
      p_data_pagamento:paymentDate,
      p_observacao:t.tipo==='receber'?'Recebimento registrado no financeiro':'Pagamento registrado no financeiro'
    })

    setMsg(error
      ? error.message
      : t.tipo==='receber'
        ? 'Recebimento registrado. A comissão foi atualizada pela data informada.'
        : 'Pagamento registrado.')

    if(!error){
      setFinancePanel(null)
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
    if(t.venda_id||t.compra_id||Number(t.valor_pago)>0){setMsg('Título vinculado ou com pagamento não pode ser excluído. Altere o documento de origem.');return}
    if(!(isAdmin&&canManageFinance)){setMsg('Sem permissão para excluir lançamento.');return}
    if(!window.confirm('Excluir este lançamento?'))return
    const r=await supabase.from('titulos_financeiros').delete().eq('id',t.id)
    setMsg(r.error?r.error.message:'Lançamento excluído.')
    if(!r.error)await loadData()
  }

  // CONFIG
  async function loadManagedUsers(){
    if(!canManageConfig)return
    const {data,error}=await supabase.rpc('listar_usuarios_erp')
    if(error){setMsg('Não foi possível carregar os usuários: '+error.message);return}
    const rows=((data||[]) as unknown[]).map((raw:unknown)=>{
      const u=raw as Omit<ManagedUser,'permissoes'>&{permissoes?:unknown}
      return {...u,permissoes:normalizePermissions(u.permissoes,u.perfil)}
    }) as ManagedUser[]
    setManagedUsers(rows)
    setUserEdits(Object.fromEntries(rows.map(u=>[u.user_id,{nome:u.nome,perfil:u.perfil,ativo:u.ativo}])))
    setUserPermissionEdits(Object.fromEntries(rows.map(u=>[u.user_id,{...u.permissoes}])))
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
    const draft=userPermissionEdits[u.user_id]||u.permissoes
    setSavingPermissionUserId(u.user_id)
    setMsg('')
    const {error}=await supabase.rpc('salvar_permissoes_usuario_erp',{
      p_user_id:u.user_id,
      p_permissoes:draft
    })
    setSavingPermissionUserId(null)
    if(error){setMsg(error.message);return}
    setMsg('Permissões do usuário atualizadas.')
    await loadManagedUsers()
  }

  async function saveManagedUser(u:ManagedUser){
    if(!canManageConfig){setMsg('Sem permissão para gerenciar usuários.');return}
    const draft=userEdits[u.user_id]||{nome:u.nome,perfil:u.perfil,ativo:u.ativo}
    if(!draft.ativo&&u.ativo&&!window.confirm(`Desativar o acesso de "${u.nome}" ao sistema?`))return

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

    if(data.session)await creator.auth.signOut()

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
    const r=await supabase.from('empresa_config').upsert({...payload,...settings},{onConflict:'id'})
    setMsg(r.error?r.error.message:'Configurações da empresa salvas.')
    if(!r.error)await loadData()
  }

  if(loading)return <div className="modulePlaceholder">Carregando...</div>
  if(!supabaseConfigured)return <div className="modulePlaceholder"><div className="panel" style={{maxWidth:620}}><h2>Sistema de Gestão publicado</h2><p>Configuração do Supabase ausente.</p></div></div>
  if(!session)return <div className="loginPage">
    <section className="loginInfo">
      <div className="loginBrand"><BarChart3 size={48}/><div><h1>Sistema de<br/>Gestão</h1><p>Mais controle para o seu negócio.</p></div></div>
      <div className="loginBenefits">
        <div><span><BarChart3 size={24}/></span><p><strong>Gestão Integrada</strong><small>Todas as áreas do seu negócio em um só lugar.</small></p></div>
        <div><span><Users size={24}/></span><p><strong>Mais Produtividade</strong><small>Processos mais ágeis e eficientes.</small></p></div>
        <div><span><ShieldCheck size={24}/></span><p><strong>Segurança de Dados</strong><small>Suas informações sempre protegidas.</small></p></div>
      </div>
    </section>

    <form onSubmit={login} className="panel dataForm loginCard">
      <div className="loginCardIcon"><BarChart3 size={30}/></div>
      <h2>Sistema de Gestão</h2>
      <p>Acesse o ERP</p>
      <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
      <button className="primary">Entrar</button>
      {msg&&<p className="loginMsg">{msg}</p>}
    </form>

    <section className="loginVisual" aria-hidden="true">
      <div className="loginLaptop">
        <div className="loginLaptopBar"></div>
        <div className="loginMiniCards">
          <div><BarChart3 size={18}/><span>Receita</span><strong>R$ 125.430</strong></div>
          <div><TrendingUp size={18}/><span>Vendas</span><strong>1.284</strong></div>
          <div><Users size={18}/><span>Clientes</span><strong>892</strong></div>
        </div>
        <div className="loginChart">
          <span></span><i></i><b></b><em></em><u></u>
        </div>
        <div className="loginDonut"></div>
      </div>
      <div className="loginLaptopBase"></div>
    </section>
  </div>

  const low=produtos.filter(p=>p.ativo&&Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)
  const monthSales=vendas.filter(v=>{const d=new Date(v.created_at),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&v.status!=='cancelado'}).reduce((s,v)=>s+Number(v.total),0)
  const openReceivables=titulos.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const openPayables=titulos.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const openReceivableCount=titulos.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0).length
  const openPayableCount=titulos.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0).length
  const financeCategories=Array.from(new Set(titulos.map(t=>t.categoria).filter((v):v is string=>Boolean(v)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))
  const financeCenters=Array.from(new Set(titulos.map(t=>t.centro_custo).filter((v):v is string=>Boolean(v)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))
  const financeMonthStart=monthStartIso()
  const financeMonthEnd=monthEndIso()
  const financeTitleById=new Map(titulos.map(t=>[t.id,t]))
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
  const dueNext7Receivable=titulos.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado'&&t.vencimento>=today()&&t.vencimento<=next7End).reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const dueNext7Payable=titulos.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado'&&t.vencimento>=today()&&t.vencimento<=next7End).reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const financeProjectionRanges=[[0,6],[7,13],[14,20],[21,29]] as const
  const financeProjection=financeProjectionRanges.map(([from,to],index)=>{
    const start=addDaysIso(today(),from),end=addDaysIso(today(),to)
    const relevant=titulos.filter(t=>t.status!=='pago'&&t.status!=='cancelado'&&t.vencimento>=start&&t.vencimento<=end)
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
  const saleSubtotal=saleItems.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
  const saleDiscount=saleItems.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
  const saleTotal=Math.max(0,saleSubtotal-saleDiscount)
  const saleConsumesStock=saleStatus==='pedido'||saleStatus==='faturado'
  const saleDemandByProduct=saleItems.reduce<Record<string,number>>((acc,item)=>{
    if(item.produto_id)acc[item.produto_id]=(acc[item.produto_id]||0)+Number(item.quantidade||0)
    return acc
  },{})
  const originalSaleQtyByProduct=originalSaleItems.reduce<Record<string,number>>((acc,item)=>{
    acc[item.produto_id]=(acc[item.produto_id]||0)+Number(item.quantidade||0)
    return acc
  },{})
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
  const saleHasPaidTitle=Boolean(editingSale&&titulos.some(t=>t.venda_id===editingSale.id&&Number(t.valor_pago)>0))
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
    ...(!saleStockShortages.length&&saleBelowStockMinimum.length?[{tipo:'estoque_minimo',label:'Estoque ficará abaixo do mínimo',detalhe:saleBelowStockMinimum.map(x=>`${x.produto.descricao}: saldo ${x.projected.toLocaleString('pt-BR')} / mínimo ${x.minimum.toLocaleString('pt-BR')}`).join(' • ')}]:[]),
    ...(saleHasPaidTitle?[{tipo:'fatura_paga',label:'Fatura com pagamento registrado',detalhe:'A aprovação avançará o status preservando itens, valores e histórico financeiro já liquidados.'}]:[]),
    ...(saleHasProof?[{tipo:'comprovante_anexado',label:'Comprovante já anexado',detalhe:'A aprovação preservará o comprovante existente.'}]:[])
  ]
  const saleHasAuthorizationBlocker=saleApprovalBlockers.length>0
  const saleHasStructuralError=saleItems.length===0||saleItems.some(item=>!item.produto_id||Number(item.quantidade)<=0||!produtos.find(p=>p.id===item.produto_id&&p.ativo))
  function saleItemStockInfo(item:SaleItemDraft){
    const produto=produtos.find(p=>p.id===item.produto_id)
    if(!produto)return null
    const available=Number(produto.estoque_atual)+(editingSale?Number(originalSaleQtyByProduct[item.produto_id]||0):0)
    const demand=Number(saleDemandByProduct[item.produto_id]||0)
    if(available<=0)return {kind:'none',label:'Sem estoque',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade}`}
    if(demand>available)return {kind:'low',label:'Estoque insuficiente',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade} • solicitado: ${demand.toLocaleString('pt-BR')}`}
    return {kind:'ok',label:'Em estoque',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade}`}
  }
  const purchaseSuggestions=produtos
    .filter(p=>p.ativo&&Number(p.estoque_atual)<=Number(p.estoque_minimo))
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
  const visiblePurchases=sortList('compras',compras.filter(c=>{const f=fornecedores.find(x=>x.id===c.fornecedor_id);return searchMatches('compras',[invoiceNo(c.fatura_numero),new Date(c.created_at).toLocaleString('pt-BR'),f?.nome||'Sem fornecedor',c.status,paymentLabel(c.forma_pagamento),c.parcelas,money(Number(c.total))])}),{
    fatura:c=>Number(c.fatura_numero||0),data:c=>c.created_at,fornecedor:c=>fornecedores.find(x=>x.id===c.fornecedor_id)?.nome||'',status:c=>c.status,pagamento:c=>paymentLabel(c.forma_pagamento),total:c=>Number(c.total)
  })
  const pendingSaleApproval=(saleId:string)=>saleApprovals.find(a=>a.entidade_id===saleId)
  const saleStatusDisplay=(v:Venda)=>pendingSaleApproval(v.id)&&v.status==='orcamento'?'Orçamento • aguardando aprovação':v.status==='orcamento'?'Orçamento':v.status==='pedido'?'Pedido':v.status==='faturado'?'Faturado':'Cancelado'
  const visibleSales=sortList('vendas',vendas.filter(v=>{const client=clientes.find(x=>x.id===v.cliente_id);const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id);const ps=salePaymentStatus(v);return searchMatches('vendas',[invoiceNo(v.fatura_numero),new Date(v.created_at).toLocaleString('pt-BR'),client?.nome||'Consumidor',seller?.nome||'',saleStatusDisplay(v),deliveryRouteLabel(v.rota_entrega),paymentLabel(v.forma_pagamento),v.parcelas,ps.label,money(Number(v.total))])}),{
    fatura:v=>Number(v.fatura_numero||0),data:v=>v.created_at,cliente:v=>clientes.find(x=>x.id===v.cliente_id)?.nome||'Consumidor',rota:v=>deliveryRouteLabel(v.rota_entrega),vendedor:v=>vendedores.find(x=>x.id===v.vendedor_cadastro_id)?.nome||'',status:v=>saleStatusDisplay(v),pagamento:v=>paymentLabel(v.forma_pagamento),statuspag:v=>salePaymentStatus(v).label,total:v=>Number(v.total)
  })
  const openedSale=salePanel?vendas.find(v=>v.id===salePanel)||null:null
  const visibleSellers=sortList('comissoes',vendedores.filter(v=>{const summary=comissoes.find(c=>c.vendedor_id===v.id);return searchMatches('comissoes',[v.nome,v.email||'',v.telefone||'',v.percentual_comissao,money(Number(summary?.total_recebido||0)),money(Number(summary?.comissao_apurada||0)),summary?.pagamentos||0,summary?.vendas||0,v.ativo?'ativo':'inativo'])}),{
    vendedor:v=>v.nome,percentual:v=>Number(v.percentual_comissao),recebido:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.total_recebido||0),comissao:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.comissao_apurada||0),recebimentos:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.pagamentos||0),vendas:v=>Number(comissoes.find(c=>c.vendedor_id===v.id)?.vendas||0),status:v=>v.ativo?'ativo':'inativo'
  })

  function salePaymentStatus(venda:Venda){
    const related=titulos.filter(t=>t.venda_id===venda.id)
    if(venda.status==='cancelado'||(related.length>0&&related.every(t=>t.status==='cancelado'))){
      return {label:'Cancelado',key:'cancelado'}
    }
    if(!related.length)return {label:'Sem cobrança',key:'sem-cobranca'}

    const valid=related.filter(t=>t.status!=='cancelado')
    if(!valid.length)return {label:'Cancelado',key:'cancelado'}

    const total=valid.reduce((s,t)=>s+Number(t.valor),0)
    const paid=valid.reduce((s,t)=>s+Number(t.valor_pago),0)

    if(total>0&&paid>=total-0.005)return {label:'Pago',key:'pago'}
    if(paid>0)return {label:'Parcial',key:'parcial'}
    return {label:'Pendente',key:'pendente'}
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

  function mapFinanceReportRows(rows:Titulo[]){
    return rows.map(t=>({
      descricao:t.descricao,
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
    return titulos
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
        const employees=titulos.filter(t=>t.tipo_funcionario==='gasto')
        const advances=titulos.filter(t=>t.tipo_funcionario==='vale')
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
            {title:'Vencidos',rows:mapFinanceReportRows(overdue)},
            {title:'Gastos com funcionários',note:'Detalhamento dos lançamentos de funcionários já refletidos nas contas a pagar.',rows:mapFinanceReportRows(employees)},
            {title:'Vales de funcionários',note:'Detalhamento dos vales já refletidos nas contas a pagar.',rows:mapFinanceReportRows(advances)}
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
    const baseRows=titulos
      .filter(t=>t.tipo===type)
      .filter(t=>!overdueOnly||(t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0))
      .filter(t=>financeStatusFilter==='todos'||t.status===financeStatusFilter)
      .filter(t=>!financeStart||t.vencimento>=financeStart)
      .filter(t=>!financeEnd||t.vencimento<=financeEnd)
      .filter(t=>financeCategory==='todos'||t.categoria===financeCategory)
      .filter(t=>financeCenter==='todos'||t.centro_custo===financeCenter)
    const rows=sortList(searchKey,baseRows.filter(t=>searchMatches(searchKey,[t.descricao,t.entidade_nome||'',dateBr(t.vencimento),money(Number(t.valor)),money(Number(t.valor_pago)),money(Math.max(0,Number(t.valor)-Number(t.valor_pago))),financeStatusLabel(t.status),t.categoria||'',t.centro_custo||'',t.forma_pagamento||'',t.parcela_numero||''])),{
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
            const linked=Boolean(t.venda_id||t.compra_id)
            const origin=t.venda_id?'Venda':t.compra_id?'Compra':'Manual'
            return <Fragment key={t.id}>
              <tr {...recordRow(()=>{if(financePanel!==t.id)openFinancePanel(t)},t.descricao)} className={'recordRow '+(t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'?'overdueRow':'')}>
                <td>{t.descricao}</td>
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
                  <div className="recordDetailBackdrop" onClick={()=>setFinancePanel(null)}/>
                  <div className="recordDetailSheet">
                    <div className="recordDetailHeader"><strong>{t.descricao}</strong><button type="button" className="recordDetailClose" onClick={()=>setFinancePanel(null)}><X size={17}/>Fechar</button></div>
                    <div className="financeManagePanel">
                  <div className="actionPanel">
                    <div className="actionMeta">
                      <strong>{t.descricao}</strong>
                      <span>{linked?`Ligado à ${origin.toLowerCase()} • parcela ${t.parcela_numero||1}`:'Lançamento manual'} • saldo {money(balance)}</span>
                    </div>
                    <div className="rowActions">
                      <button className="ghost" onClick={()=>startEditTitle(t)}><Pencil size={15}/>{linked?'Classificar':'Editar'}</button>
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
                    <div><span>Origem</span><strong>{origin}</strong></div>
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
                      <button className="primary" onClick={()=>void registerPayment(t)}><CheckCircle2 size={15}/>{type==='receber'?'Receber':'Pagar'}</button>
                    </div>}
                    <PaymentHistory titleId={t.id} onChanged={refreshFinance}/>
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

  function openApp(module:ModuleKey){
    if(!permissionsReady||!canViewModule(module))return
    setActive(module)
    if(module==='financeiro')setFinanceSubtab('geral')
    closeForms();setMsg('');setShowApps(false)
  }

  return <div className={`app appsWorkspace${dark?' dark':''}${showApps?' launcherWorkspace':''}`}>
    <header className="workspaceBar">
      <div className="workspaceIdentity">
        <div className="workspaceBrand"><span className="workspaceBrandMark">SG</span><div className="workspaceBrandText"><strong>{empresa?.nome_fantasia||'Sistema de Gestão'}</strong><small>ERP EMPRESARIAL</small></div></div>
        <button type="button" className="workspaceHome" onClick={()=>setShowApps(true)} aria-current={showApps?'page':undefined}><Grid2X2 size={18}/><span>Aplicativos</span></button>
      </div>
      <div className="workspaceControls">
        <div className="workspaceAccount"><span title={session.user.email}>{session.user.email}</span><small>{profileLabel(profileRole)}</small></div>
        <button type="button" className="workspaceIcon" onClick={()=>setDark(v=>!v)} title={dark?'Ativar modo claro':'Ativar modo escuro'} aria-label={dark?'Ativar modo claro':'Ativar modo escuro'}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
        <button type="button" className="workspaceIcon" onClick={()=>void supabase.auth.signOut()} title="Sair" aria-label="Sair"><LogOut size={17}/></button>
      </div>
    </header>
    <main className="main">
      {showApps?<>
        {msg&&<div className="panel noticePanel" role="status">{msg}</div>}
        <AppLauncher menu={permissionsReady?visibleMenu:[]} company={empresa?.nome_fantasia||'Sistema de Gestão'} ready={permissionsReady} canEdit={canEditModule} onOpen={openApp} notifications={{autorizacoes:saleApprovals.length}}/>
      </>:permissionsReady&&canViewModule(active)&&<>
      <header className="topbar">
        <div><h1 ref={moduleHeading} tabIndex={-1}>{title}</h1><p>{empresa?.nome_fantasia||'Sistema de Gestão'}</p></div>
        <div className="topActions">
          <button className="iconBtn" onClick={()=>void loadData()} title="Atualizar"><RefreshCw size={18}/></button>
          {active==='compras'&&canManagePurchases&&<button className="ghost" onClick={()=>{closeForms();setShowNfeImport(true)}}><Upload size={17}/>Importar XML NF-e</button>}
          {((active==='vendas'&&canManageSales)||(active==='clientes'&&canManageClients)||(active==='fornecedores'&&canManageSuppliers)||(active==='compras'&&canManagePurchases))&&<button className="primary" onClick={headerAction}><Plus size={17}/>{active==='vendas'?'Novo orçamento':active==='compras'?'Nova compra':'Novo'}</button>}
          {canManageProducts&&active==='produtos'&&productSubtab==='cadastro'&&<button className="primary" onClick={headerAction}><Plus size={17}/>Novo produto</button>}
          {canManageFinance&&active==='financeiro'&&financeSubtab!=='funcionarios'&&financeSubtab!=='vales'&&<button className="primary" onClick={headerAction}><Plus size={17}/>Nova fatura</button>}
          {canManageCommissions&&active==='comissoes'&&<button className="primary" onClick={headerAction}><UserPlus size={17}/>Novo vendedor</button>}
        </div>
      </header>

      {msg&&!(active==='vendas'&&showForm)&&<div className="panel noticePanel">{msg}</div>}

      {active==='autorizacoes'&&canViewAuthorizations&&<AuthorizationCenter admin={canManageAuthorizations} products={produtos} clients={clientes} sellers={vendedores} onChanged={loadData}/>}
      {active==='entregas'&&<DeliveryManagement canEdit={canEditModule('entregas')} canOperate={canViewModule('entregas')}/>} 
      {active==='dashboard'&&<section>
        <div className="cards dashboardCards">
          <article className="card dashboardCard dashboardCardSales"><span>Vendas no mês</span><strong>{money(monthSales)}</strong><small>{vendas.filter(v=>v.status!=='cancelado').length} registros</small></article>
          {canViewFinance&&<article className="card dashboardCard dashboardCardReceivable"><span>A receber</span><strong>{money(openReceivables)}</strong><small>em aberto</small></article>}
          {canViewFinance&&<article className="card dashboardCard dashboardCardPayable"><span>A pagar</span><strong>{money(openPayables)}</strong><small>em aberto</small></article>}
          <article className="card dashboardCard dashboardCardLowStock"><span>Estoque baixo</span><strong>{low}</strong><small>de {produtos.filter(p=>p.ativo).length} produtos ativos</small></article>
        </div>
        <div className="cards compactCards dashboardCards">
          <article className="card dashboardCard"><span>Clientes</span><strong>{clientes.filter(c=>c.ativo).length}</strong><button className="ghost" onClick={()=>{setActive('clientes');if(clientes.length===0&&canManageClients)startNewClient()}}>{clientes.length===0&&canManageClients?'+ Adicionar Cliente':'Gerenciar'}</button></article>
          <article className="card dashboardCard"><span>Fornecedores</span><strong>{fornecedores.filter(f=>f.ativo).length}</strong><button className="ghost" onClick={()=>{setActive('fornecedores');if(fornecedores.length===0&&canManageSuppliers)startNewSupplier()}}>{fornecedores.length===0&&canManageSuppliers?'+ Adicionar Fornecedor':'Gerenciar'}</button></article>
          <article className="card dashboardCard dashboardCardStockValue"><span>Valor em estoque</span><strong>{money(stockValue)}</strong><button className="ghost" onClick={()=>{setActive('produtos');if(produtos.length===0&&canManageProducts)startNewProduct()}}>{produtos.length===0&&canManageProducts?'+ Adicionar Produto':'Gerenciar'}</button></article>
        </div>

        <div className={canViewFinance?'dashboardCharts dashboardChartsThree':'dashboardCharts'}>
          <article className="panel dashboardChart">
            <div className="dashboardChartHead">
              <div><span>Desempenho</span><h3>Vendas nos últimos 6 meses</h3></div>
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
              <div><span>Operação</span><h3>Status das vendas</h3></div>
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
              <div><span>Financeiro</span><h3>Valores em aberto</h3></div>
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
        <EditableEntityTable readOnly={!canManageClients} title="Clientes" emptyActionLabel="+ Adicionar Cliente" onEmptyAction={startNewClient} headers={['Nome','Documento','E-mail','Telefone','Limite','Status','Gerenciar']} rows={clientes.map(c=>({id:c.id,cells:[c.nome,c.documento||'—',c.email||'—',c.telefone||'—',money(Number(c.limite_credito)),c.ativo?'Ativo':'Inativo'],opened:clientPanel===c.id,onToggle:()=>setClientPanel(clientPanel===c.id?null:c.id),panel:<><div className="entityDetailGrid">
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
        <EditableEntityTable readOnly={!canManageSuppliers} title="Fornecedores" emptyActionLabel="+ Adicionar Fornecedor" onEmptyAction={startNewSupplier} headers={['Nome','Documento','E-mail','Telefone','Status','Gerenciar']} rows={fornecedores.map(f=>({id:f.id,cells:[f.nome,f.documento||'—',f.email||'—',f.telefone||'—',f.ativo?'Ativo':'Inativo'],opened:supplierPanel===f.id,onToggle:()=>setSupplierPanel(supplierPanel===f.id?null:f.id),panel:<><div className="entityDetailGrid">
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

          {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingProduct?'Editar produto':'Novo produto'}><div className="saleModalShell productModalShell"><form className="panel dataForm saleModalForm productModalForm" onSubmit={saveProduct}>
            <div className="formTitle saleModalTitle">
              <div>
                <h3>{editingProduct?'Editar produto':'Novo produto'}</h3>
                <p>Preencha os dados do produto. O estoque de produtos já cadastrados é alterado pela opção “Ajustar estoque”.</p>
              </div>
              <button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de produto" onClick={()=>{setShowForm(false);setEditingProduct(null)}}><X size={18}/></button>
            </div>

            <label className="fieldLabel">Código
              <input name="codigo" placeholder="Ex.: PRD-001" required defaultValue={editingProduct?.codigo||''}/>
            </label>
            <label className="fieldLabel">Produto / Descrição
              <input name="descricao" placeholder="Nome do produto" required defaultValue={editingProduct?.descricao||''}/>
            </label>
            <label className="fieldLabel">Unidade
              <input name="unidade" placeholder="Ex.: UN" defaultValue={editingProduct?.unidade||'UN'}/>
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
            {!editingProduct&&<label className="fieldLabel">Estoque inicial
              <input name="estoque_atual" type="number" min="0" step="0.001" placeholder="0" defaultValue="0"/>
            </label>}
            <label className="fieldLabel">Estoque mínimo
              <input name="estoque_minimo" type="number" min="0" step="0.001" placeholder="0" defaultValue={editingProduct?.estoque_minimo??''}/>
            </label>
            <label className="fieldLabel">Peso unitário (kg)
              <input name="peso_kg" type="number" min="0" step="0.001" placeholder="0,000" defaultValue={editingProduct?.peso_kg??''}/>
            </label>
            <label className="fieldLabel">Volume unitário (m³)
              <input name="volume_m3" type="number" min="0" step="0.0001" placeholder="0,0000" defaultValue={editingProduct?.volume_m3??''}/>
            </label>
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
              <label className="fieldLabel fieldLabelWide">Complementos tributários (JSON)
                <textarea name="complemento_tributario" rows={3} defaultValue={editingProduct?.complemento_tributario&&Object.keys(editingProduct.complemento_tributario).length?JSON.stringify(editingProduct.complemento_tributario,null,2):''} placeholder="Opcional. Somente quando orientado pelo contador."/>
              </label>
            </div>
            <label className="fieldLabel">Status
              <select name="ativo" defaultValue={editingProduct?.ativo===false?'false':'true'}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>

            <div className="formActions">
              <button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingProduct(null)}}>Cancelar</button>
              <button className="primary">{editingProduct?'Salvar alterações':'Cadastrar produto'}</button>
            </div>
          </form></div></div>}

          {adjustingProduct&&<form className="panel stockForm" onSubmit={adjustStock}>
            <div><strong>Ajustar estoque</strong><span>{adjustingProduct.codigo} - {adjustingProduct.descricao}</span></div>
            <label>Novo estoque<input type="number" min="0" step="0.001" value={stockNew} onChange={e=>setStockNew(e.target.value)} required/></label>
            <label>Motivo<input value={stockReason} onChange={e=>setStockReason(e.target.value)} required/></label>
            <div className="formActions"><button type="button" className="ghost" onClick={()=>setAdjustingProduct(null)}>Cancelar</button><button className="primary">Aplicar</button></div>
          </form>}

          <ProductTable produtos={produtos} onCreate={startNewProduct} openId={productPanel} onToggle={id=>setProductPanel(productPanel===id?null:id)} onEdit={startEditProduct} onAdjust={startAdjustStock} onDelete={deleteProduct} canDelete={isAdmin&&canManageProducts} readOnly={!canManageProducts}/>
        </>}

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
          setMsg(`NF-e importada com sucesso na compra #${invoiceNo(result.fatura_numero)}. Estoque e financeiro atualizados.`)
          await loadData()
        }}
      />}

      {active==='compras'&&<section className="semanticPage purchasesPage">
        <article className="panel purchaseSuggestionPanel">
          <div className="purchaseSuggestionHead">
            <div>
              <span className="purchaseSuggestionEyebrow">Reposição de estoque</span>
              <h3>Sugestão de compra</h3>
              <p>{purchaseSuggestions.length? `${purchaseSuggestions.length} produto(s) estão no estoque mínimo ou abaixo.`:'Nenhum produto precisa de reposição neste momento.'}</p>
            </div>
            {purchaseSuggestions.length>0&&<div className="purchaseSuggestionActions">
              <div><span>Custo estimado</span><strong>{money(purchaseSuggestionTotal)}</strong></div>
              <button type="button" className="primary" onClick={addAllPurchaseSuggestions}><ShoppingCart size={16}/>Adicionar todos</button>
            </div>}
          </div>
          {purchaseSuggestions.length>0&&<div className="tableWrap purchaseSuggestionTable"><table>
            <thead><tr><th>Produto</th><th>Estoque atual</th><th>Estoque mínimo</th><th>Alvo</th><th>Comprar</th><th>Custo estimado</th><th></th></tr></thead>
            <tbody>{purchaseSuggestions.map(s=><tr key={s.produto.id}>
              <td><strong>{s.produto.codigo}</strong><span className="purchaseSuggestionDescription">{s.produto.descricao}</span></td>
              <td><span className="stockLevel stockLevelLow">{s.current.toLocaleString('pt-BR')} {s.produto.unidade}</span></td>
              <td>{s.minimum.toLocaleString('pt-BR')} {s.produto.unidade}</td>
              <td>{s.target.toLocaleString('pt-BR')} {s.produto.unidade}</td>
              <td><strong className="purchaseSuggestionQty">+{s.suggested.toLocaleString('pt-BR')} {s.produto.unidade}</strong></td>
              <td><strong>{money(s.suggested*Number(s.produto.custo||0))}</strong></td>
              <td><button type="button" className="ghost purchaseSuggestionAdd" onClick={()=>addPurchaseSuggestion(s.produto,s.suggested)}><Plus size={15}/>Adicionar</button></td>
            </tr>)}</tbody>
          </table></div>}
        </article>

        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingPurchase?'Editar compra':'Nova compra'}><div className="saleModalShell"><form className="panel saleForm purchaseForm saleModalForm" onSubmit={savePurchase}>
          <div className="formTitle saleModalTitle">
            <div>
              <h3>{editingPurchase?`Editar compra ${invoiceNo(editingPurchase.fatura_numero)}`:'Nova compra'}</h3>
              <p>Cotação não gera financeiro nem estoque. Pedido aprovado confirma a fatura e gera contas a pagar. Pedido recebido lança a entrada no estoque.</p>
            </div>
            <button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de compra" onClick={()=>{setShowForm(false);resetPurchaseForm();requestAnimationFrame(()=>document.getElementById('purchases-table')?.focus())}}><X size={18}/></button>
          </div>

          <div className="saleHeader saleHeaderExpanded">
            <label>Fornecedor
              <select value={purchaseSupplier} onChange={e=>setPurchaseSupplier(e.target.value)}>
                <option value="">Sem fornecedor</option>
                {fornecedores.filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
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
              <select value={i.produto_id} onChange={e=>choosePurchaseProduct(i.key,e.target.value)} required>
                <option value="">Produto</option>
                {produtos.filter(p=>p.ativo||p.id===i.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updatePurchaseItem(i.key,'quantidade',Number(e.target.value))}/>
              <input type="number" min="0" step="0.01" value={i.custo_unitario} onChange={e=>updatePurchaseItem(i.key,'custo_unitario',Number(e.target.value))}/>
              <strong>{money(i.quantidade*i.custo_unitario)}</strong>
              <button type="button" className="iconBtn dangerBtn" onClick={()=>removePurchaseItem(i.key)}><Trash2 size={16}/></button>
            </div>)}
          </div>

          {saleConsumesStock&&saleStockShortages.length>0&&<div className="stockAuthorizationWarning">
            <strong>Estoque insuficiente em {saleStockShortages.length} produto(s)</strong>
            <span>{canManageAuthorizations?'Você possui permissão de autorização. Ao salvar, será solicitada uma confirmação extra para estoque negativo.':'A venda não pode ser concluída por este usuário. Solicite autorização a um usuário autorizado.'}</span>
          </div>}

          <div className="saleTotals">
            <div className="grandTotal"><span>Total a pagar</span><strong>{money(purchaseTotal)}</strong></div>
          </div>

          <div className="saleActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);resetPurchaseForm();requestAnimationFrame(()=>document.getElementById('purchases-table')?.focus())}}>Cancelar</button>
            <button className="primary" disabled={savingPurchase}>{savingPurchase?'Salvando...':purchaseStatus==='cotacao'?'Salvar cotação':purchaseStatus==='pedido_aprovado'?'Aprovar pedido':'Receber pedido'}</button>
          </div>
        </form></div></div>}

        <article id="purchases-table" tabIndex={-1} className="panel tablePanel purchasesTable">
          <div className="panelHead"><h3>Cotações, pedidos e compras</h3><SearchField value={tableSearch.compras||''} onChange={v=>setSearch('compras',v)} placeholder="Pesquisar em todas as colunas"/></div>
          <div className="tableWrap"><table>
            <thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','fatura')}>Fatura{sortMark('compras','fatura')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','data')}>Data{sortMark('compras','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','fornecedor')}>Fornecedor{sortMark('compras','fornecedor')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','status')}>Status{sortMark('compras','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','pagamento')}>Pagamento{sortMark('compras','pagamento')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('compras','total')}>Total{sortMark('compras','total')}</button></th><th>Gerenciar</th></tr></thead>
            <tbody>{visiblePurchases.length===0&&<tr className="emptyTableRow"><td colSpan={7}><EmptyState message={compras.length===0?'Nenhuma compra cadastrada.':'Nenhuma compra encontrada para esta pesquisa.'} actionLabel={compras.length===0&&canManagePurchases?'+ Adicionar Compra':undefined} onAction={startNewPurchase}/></td></tr>}{visiblePurchases.map(c=>{
              const f=fornecedores.find(x=>x.id===c.fornecedor_id)
              const opened=purchasePanel===c.id
              return <Fragment key={c.id}>
                <tr {...recordRow(()=>setPurchasePanel(c.id),'compra '+invoiceNo(c.fatura_numero))}>
                  <td><strong>#{invoiceNo(c.fatura_numero)}</strong></td>
                  <td>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                  <td>{f?.nome||'Sem fornecedor'}</td>
                  <td><span className={`statusBadge status-${c.status==='pedido_recebido'?'faturado':c.status==='cancelada'?'cancelado':c.status==='pedido_aprovado'?'pedido':'orcamento'}`}>{purchaseStatusLabel(c.status)}</span></td>
                  <td>{paymentLabel(c.forma_pagamento)} {Number(c.parcelas)>1?`• ${c.parcelas}x`:''}</td>
                  <td><strong>{money(Number(c.total))}</strong></td>
                  <td><button className="rowMenuBtn" onClick={()=>setPurchasePanel(opened?null:c.id)} title="Opções" aria-label="Abrir opções da compra" aria-expanded={opened}><MoreVertical size={18}/></button></td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={7}>
                  <div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={`Compra #${invoiceNo(c.fatura_numero)}`}>
                    <div className="recordDetailBackdrop" onClick={()=>setPurchasePanel(null)}/>
                    <div className="recordDetailSheet">
                      <div className="recordDetailHeader"><strong>{c.status==='cotacao'?'Cotação':'Compra'} #{invoiceNo(c.fatura_numero)}</strong><button type="button" className="recordDetailClose" onClick={()=>setPurchasePanel(null)}><X size={17}/>Fechar</button></div>
                      <div className="invoiceManagePanel">
                    <div className="actionPanel">
                      <div className="actionMeta">
                        <strong>{c.status==='cotacao'?'Cotação':'Fatura de compra'} #{invoiceNo(c.fatura_numero)}</strong>
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
          <div className="formTitle saleModalTitle">
            <div>
              <h3>{editingSale?(editingSale.status==='orcamento'?'Editar orçamento ':'Editar venda ')+invoiceNo(editingSale.fatura_numero):'Novo orçamento'}</h3>
              <p>Toda nova negociação começa como orçamento. Depois ela pode avançar para Pedido/Venda; somente nessa etapa gera cobrança e movimenta estoque.</p>
            </div>
            <button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de venda" onClick={()=>{setShowForm(false);resetSaleForm();requestAnimationFrame(()=>document.getElementById('sales-table')?.focus())}}><X size={18}/></button>
          </div>

          {saleNotice&&<div role="alert" aria-live="assertive" style={{position:"sticky",top:0,zIndex:20,background:"#fff0f0",color:"#991b1b",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10,boxShadow:"0 5px 20px #00000016"}}><Ban size={20}/><span style={{flex:1}}><strong>Atenção:</strong> {saleNotice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setSaleNotice('')} style={{background:"transparent",border:"none",cursor:"pointer",color:"inherit"}}><X size={18}/></button></div>}
          <div className="saleHeader saleHeaderExpanded">
            <label>Cliente
              <select value={saleClient} onChange={e=>setSaleClient(e.target.value)}>
                <option value="">Consumidor</option>
                {clientes.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Vendedor
              <select value={saleSeller} onChange={e=>setSaleSeller(e.target.value)}>
                <option value="">Sem vendedor / sem comissão</option>
                {vendedores.filter(v=>v.ativo||v.id===saleSeller).map(v=><option key={v.id} value={v.id}>{v.nome} — {Number(v.percentual_comissao).toLocaleString('pt-BR')}%</option>)}
              </select>
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
            {saleInstallmentDates.map((due,index)=><label key={index}>{index+1}º vencimento
              <input type="date" value={due} onChange={e=>changeSaleInstallmentDate(index,e.target.value)} required/>
            </label>)}
            <label className="saleNotes">Observações
              <input value={saleNotes} onChange={e=>setSaleNotes(e.target.value)}/>
            </label>
          </div>

          <div className={`paymentNotice saleStageNotice saleStage-${saleStatus}`}>
            <strong>{saleStatus==='orcamento'?'Orçamento — sem cobrança e sem movimentação de estoque':'Pedido — gera cobrança e movimenta estoque'}</strong>
            <span>{saleStatus==='orcamento'
              ? 'Depois de salvo, o orçamento pode ser convertido em Pedido/Venda. Se houver bloqueio, seguirá para aprovação.'
              : `${paymentLabel(salePayment)} • ${saleInstallments}x • vencimento ${dateBr(saleDueDate)}${saleSeller?' • comissão: '+String(vendedores.find(v=>v.id===saleSeller)?.percentual_comissao||0)+'%':''}`}</span>
          </div>

          <div className="saleItemsHead">
            <h3>Itens</h3>
            <button type="button" className="ghost" onClick={()=>setSaleItems(x=>[...x,newSaleItem()])}><Plus size={16}/>Adicionar item</button>
          </div>

          <div className="saleItems">
            {saleItems.map(i=>{const stock=saleItemStockInfo(i);return <div className="saleItemRow" key={i.key}>
              <select value={i.produto_id} onChange={e=>chooseProduct(i.key,e.target.value)} required>
                <option value="">Produto</option>
                {produtos.filter(p=>p.ativo||p.id===i.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao} — estoque {Number(p.estoque_atual).toLocaleString('pt-BR')}</option>)}
              </select>
              <label className="saleItemField"><span>Quant.</span><input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updateSaleItem(i.key,'quantidade',Number(e.target.value))}/></label>
              <label className="saleItemField"><span>Preço</span><input type="number" min="0" step="0.01" value={i.valor_unitario||''} onChange={e=>updateSaleItem(i.key,'valor_unitario',Number(e.target.value))}/></label>
              <label className="saleItemField"><span>Desconto</span><input type="number" min="0" step="0.01" value={i.desconto} onChange={e=>updateSaleItem(i.key,'desconto',Number(e.target.value))}/></label>
              <strong>{money(Math.max(0,i.quantidade*i.valor_unitario-i.desconto))}</strong>
              <button type="button" className="iconBtn dangerBtn" onClick={()=>removeSaleItem(i.key)}><Trash2 size={16}/></button>
              {stock&&<div className={'saleStockHint stock-'+stock.kind}><span>{stock.label}</span><small>{stock.detail}</small>{saleConsumesStock&&stock.kind!=='ok'&&<b>{canManageAuthorizations?'Você pode autorizar esta exceção.':'Venda bloqueada: solicite autorização a um usuário autorizado.'}</b>}</div>}
            </div>})}
          </div>

          <div className="saleTotals">
            <div><span>Subtotal</span><strong>{money(saleSubtotal)}</strong></div>
            <div><span>Desconto</span><strong>{money(saleDiscount)}</strong></div>
            <div className="grandTotal"><span>Total</span><strong>{money(saleTotal)}</strong></div>
          </div>

          {saleHasAuthorizationBlocker&&<div className="saleAuthorizationBlockers" role="alert">
            <div className="saleAuthorizationBlockersHead">
              <ShieldCheck size={20}/>
              <div><strong>Esta venda precisa de autorização</strong><span>{saleApprovalBlockers.length} bloqueio(s) identificado(s). A venda normal não será concluída enquanto houver estes bloqueios.</span></div>
            </div>
            <div className="saleAuthorizationBlockerList">
              {saleApprovalBlockers.map((blocker,index)=><div key={blocker.tipo+'-'+index}>
                <strong>{blocker.label}</strong>
                <span>{blocker.detalhe}</span>
              </div>)}
            </div>
          </div>}

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
        </form></div></div>}

        {openedSale?(()=>{
          const v=openedSale
          const client=clientes.find(x=>x.id===v.cliente_id)
          const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id)
          const paymentStatus=salePaymentStatus(v)
          const approval=pendingSaleApproval(v.id)
          const waiting=Boolean(approval&&v.status==='orcamento')
          return <div className="recordDetailOverlay saleRecordOverlay" role="dialog" aria-modal="true" aria-label={`Venda #${invoiceNo(v.fatura_numero)}`}>
            <div className="recordDetailBackdrop" onClick={closeSaleDetail}/>
            <div className="recordDetailSheet recordDetailSheetWide saleRecordSheet">
              <div className="recordDetailHeader"><strong>Venda #{invoiceNo(v.fatura_numero)}</strong><button type="button" className="recordDetailClose" onClick={closeSaleDetail}><X size={17}/>Fechar</button></div>
              <article className="panel saleDetailPage">
            <div className="saleDetailTopbar">
              <button type="button" className="ghost" onClick={closeSaleDetail}><ChevronLeft size={16}/>Voltar para lista</button>
              <div className="saleDetailActions">
                <button type="button" className="ghost" onClick={()=>void downloadSalePdf(v)}><FileDown size={15}/>PDF</button>
                {canManageSales&&v.status==='orcamento'&&<button type="button" className="primary advanceSaleBtn" disabled={savingSale||waiting} title={waiting?'Aguardando aprovação administrativa':'Avançar orçamento para pedido'} onClick={()=>void advanceSaleToOrder(v)}><CheckCircle2 size={15}/>{waiting?'Aguardando autorização':'Avançar para pedido'}</button>}
                {canManageSales&&<button type="button" className="ghost" disabled={v.status==='cancelado'||waiting} title={waiting?'Aguardando aprovação administrativa':''} onClick={()=>void startEditSale(v)}><Pencil size={15}/>Editar</button>}
                <button type="button" className="ghost" disabled={saleHistoryBusy} onClick={()=>void loadSaleHistory(v)}><RefreshCw size={15}/>{saleHistoryBusy?'Carregando...':'Histórico'}</button>
                {isAdmin&&canManageConfig&&canManageSales&&<button type="button" className="ghost" onClick={()=>setSaleDetailTab('documentos')}><ReceiptText size={15}/>NF-e / documentos</button>}
                {canManageSales&&<button type="button" className="warningBtn" disabled={v.status==='cancelado'} onClick={()=>void cancelSale(v)}><Ban size={15}/>Cancelar</button>}
                {isAdmin&&canManageSales&&<button type="button" className="dangerAction" onClick={()=>void deleteSale(v)}><Trash2 size={15}/>Excluir</button>}
              </div>
            </div>

            <div className="saleDetailStatusBar">
              <div>
                <span className="saleDetailEyebrow">{v.status==='orcamento'?'ORÇAMENTO':'VENDA / FATURA'}</span>
                <h2>#{invoiceNo(v.fatura_numero)}</h2>
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
              <div><span>Comissão</span><strong>{seller?Number(seller.percentual_comissao).toLocaleString('pt-BR')+'%':'—'}</strong></div>
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
                  {saleDetailItems.map((item,index)=>{
                    const product=produtos.find(p=>p.id===item.produto_id)
                    return <tr key={item.produto_id+'-'+index}>
                      <td><strong>{product?.descricao||'Produto'}</strong><br/><small>{product?.codigo||''}</small></td>
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
                <div><span>Método de pagamento</span><strong>{paymentLabel(v.forma_pagamento)}</strong></div>
                <div><span>Parcelas</span><strong>{v.parcelas}x</strong></div>
                <div><span>Primeiro vencimento</span><strong>{dateBr(v.primeiro_vencimento)}</strong></div>
                <div><span>Status da cobrança</span><strong>{paymentStatus.label}</strong></div>
              </div>
              <div className="saleNotesBox">
                <h4>Anotações</h4>
                <p>{v.observacoes||'Nenhuma anotação registrada.'}</p>
              </div>
            </div>}

            {saleDetailTab==='documentos'&&<div className="saleDetailSection saleDocumentsGrid">
              <div>{proofPanel('venda',v.id)}</div>
              <div>{isAdmin&&canManageConfig&&canManageSales?<FocusNfeSale saleId={v.id}/>:<div className="paymentNotice">NF-e disponível apenas para usuários autorizados.</div>}</div>
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
        })():<article id="sales-table" tabIndex={-1} className="panel tablePanel salesTable">
          <div className="panelHead">
            <div><h3>Orçamentos, vendas e faturas</h3><p>Lista compacta. Dê dois cliques em uma linha para abrir a venda.</p></div>
            <SearchField value={tableSearch.vendas||''} onChange={v=>setSearch('vendas',v)} placeholder="Pesquisar em todas as colunas"/>
          </div>
          <div className="tableWrap"><table className="salesCompactTable">
            <thead><tr>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','fatura')}>Documento{sortMark('vendas','fatura')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','data')}>Data{sortMark('vendas','data')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','cliente')}>Cliente{sortMark('vendas','cliente')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','vendedor')}>Vendedor{sortMark('vendas','vendedor')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','status')}>Status{sortMark('vendas','status')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','pagamento')}>Pagamento{sortMark('vendas','pagamento')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','rota')}>Rota{sortMark('vendas','rota')}</button></th>
              <th><button className="tableSortBtn" onClick={()=>toggleSort('vendas','total')}>Total{sortMark('vendas','total')}</button></th>
              <th>Gerenciar</th>
            </tr></thead>
            <tbody>
              {visibleSales.length===0&&<tr className="emptyTableRow"><td colSpan={9}><EmptyState message={vendas.length===0?'Nenhuma venda cadastrada.':'Nenhuma venda encontrada para esta pesquisa.'} actionLabel={vendas.length===0&&canManageSales?'+ Adicionar Venda':undefined} onAction={startNewSale}/></td></tr>}
              {visibleSales.map(v=>{
                const client=clientes.find(x=>x.id===v.cliente_id)
                const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id)
                const paymentStatus=salePaymentStatus(v)
                const waiting=Boolean(pendingSaleApproval(v.id)&&v.status==='orcamento')
                return <tr key={v.id} {...recordRow(()=>void openSaleDetail(v),'venda '+invoiceNo(v.fatura_numero))}>
                  <td><strong>#{invoiceNo(v.fatura_numero)}</strong></td>
                  <td>{new Date(v.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{client?.nome||'Consumidor'}</td>
                  <td>{seller?.nome||'—'}</td>
                  <td>{waiting
                    ? <span className="statusBadge approvalPendingBadge">Aguardando aprovação</span>
                    : <span className={'statusBadge status-'+v.status}>{saleStatusDisplay(v)}</span>}</td>
                  <td>{paymentLabel(v.forma_pagamento)}{Number(v.parcelas)>1?' • '+v.parcelas+'x':''}<br/><small>{paymentStatus.label}</small></td>
                  <td>{deliveryRouteLabel(v.rota_entrega)}</td>
                  <td><strong>{money(Number(v.total))}</strong></td>
                  <td><button type="button" className="rowMenuBtn" onClick={()=>void openSaleDetail(v)} title="Abrir venda" aria-label="Abrir venda"><MoreVertical size={18}/></button></td>
                </tr>
              })}
            </tbody>
          </table></div>
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
            <select value={commissionReportSeller} onChange={e=>setCommissionReportSeller(e.target.value)}>
              <option value="todos">Todos os vendedores</option>
              {vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}{v.ativo?'':' (inativo)'}</option>)}
            </select>
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
                  <td>{canManageCommissions?<button className="rowMenuBtn" onClick={()=>setSellerPanel(opened?null:v.id)} title="Opções" aria-label="Abrir opções do vendedor" aria-expanded={opened}><MoreVertical size={18}/></button>:<span className="readOnlyTag">Somente leitura</span>}</td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={8}>
                  <div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={v.nome}>
                    <div className="recordDetailBackdrop" onClick={()=>setSellerPanel(null)}/>
                    <div className="recordDetailSheet">
                      <div className="recordDetailHeader"><strong>{v.nome}</strong><button type="button" className="recordDetailClose" onClick={()=>setSellerPanel(null)}><X size={17}/>Fechar</button></div>
                      <div className="actionPanel">
                    <div className="actionMeta"><strong>{v.nome}</strong><span>Comissão atual: {Number(v.percentual_comissao).toLocaleString('pt-BR')}%</span></div>
                    <div className="rowActions">
                      {canManageCommissions&&<button className="ghost" onClick={()=>startEditSeller(v)}><Pencil size={15}/>Editar % / dados</button>}
                      {canManageCommissions&&v.ativo&&<button className="warningBtn" onClick={()=>void deactivateSeller(v)}><Ban size={15}/>Desativar</button>}
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
          <button className={financeSubtab==='funcionarios'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('funcionarios');closeForms()}}><Users size={16}/>Funcionários</button>
          <button className={financeSubtab==='vales'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('vales');closeForms()}}><WalletCards size={16}/>Vale</button>
          <button className={financeSubtab==='conciliacao'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('conciliacao');closeForms()}}><Building2 size={16}/>Diários e Conciliação</button>
        </div>

        {showForm&&<div className="saleModalOverlay" role="dialog" aria-modal="true" aria-label={editingTitle?'Editar fatura':'Nova fatura'}><div className="saleModalShell financeModalShell"><form className="panel dataForm saleModalForm entityModalForm" onSubmit={saveTitle}>
          <div className="formTitle saleModalTitle"><div><h3>{editingTitle?'Editar fatura':'Nova fatura'}</h3><p>{editingTitle&&(editingTitle.venda_id||editingTitle.compra_id)?'Fatura vinculada: apenas classificação financeira pode ser alterada aqui.':'Cadastre uma conta a receber ou uma conta a pagar.'}</p></div><button type="button" className="iconBtn saleModalClose" title="Fechar" aria-label="Fechar formulário de fatura" onClick={()=>{setShowForm(false);setEditingTitle(null)}}><X size={18}/></button></div>
          {editingTitle&&(editingTitle.venda_id||editingTitle.compra_id)&&<div className="financeLinkedNotice"><ShieldCheck size={18}/><div><strong>Documento integrado</strong><span>Valor, vencimento, entidade e descrição acompanham a {editingTitle.venda_id?'venda':'compra'} de origem.</span></div></div>}
          <label className="fieldLabel">Tipo de fatura
            <select value={financeTitleType} onChange={e=>{setFinanceTitleType(e.target.value as 'receber'|'pagar');setFinanceTitleEntity('')}} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}>
              <option value="receber">Conta a receber</option>
              <option value="pagar">Conta a pagar</option>
            </select>
          </label>
          <label className="fieldLabel">Descrição<input name="descricao" placeholder="Descrição" required defaultValue={editingTitle?.descricao||''} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
          <label className="fieldLabel">Cliente / Fornecedor
            <select value={financeTitleEntity} onChange={e=>setFinanceTitleEntity(e.target.value)} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}>
              <option value="">Sem vínculo cadastral</option>
              {financeTitleEntity&&!(financeTitleType==='receber'?clientes:fornecedores).some(x=>x.nome===financeTitleEntity)&&<option value={financeTitleEntity}>{financeTitleEntity} (registro anterior)</option>}
              {(financeTitleType==='receber'?clientes:fornecedores).filter(x=>x.ativo||x.nome===financeTitleEntity).map(x=><option key={x.id} value={x.nome}>{x.nome}</option>)}
            </select>
          </label>
          <label className="fieldLabel">Data de vencimento<input name="vencimento" type="date" required defaultValue={editingTitle?.vencimento||today()} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
          <label className="fieldLabel">Valor (R$)<input name="valor" type="number" min="0" step="0.01" required defaultValue={editingTitle?.valor||0} disabled={Boolean(editingTitle&&(editingTitle.venda_id||editingTitle.compra_id))}/></label>
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

        {financeSubtab!=='geral'&&financeSubtab!=='funcionarios'&&financeSubtab!=='vales'&&financeSubtab!=='conciliacao'&&<div className="panel financeFilterPanel">
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

        {financeSubtab==='receber'&&<div className="financeGroups financeSingleList">{financeTable('receber')}</div>}
        {financeSubtab==='pagar'&&<div className="financeGroups financeSingleList">{financeTable('pagar')}</div>}
        {(financeSubtab==='funcionarios'||financeSubtab==='vales')&&<><div className="financeReportBar compact"><div><strong>{financeSubtab==='funcionarios'?'Relatório de funcionários':'Relatório de vales'}</strong><span>Exporta os lançamentos desta área em PDF.</span></div><button type="button" className="ghost" onClick={()=>void downloadFinancePdf(financeSubtab)}><FileDown size={15}/>PDF</button></div><EmployeeFinance kind={financeSubtab==='funcionarios'?'gasto':'vale'} titles={titulos} canEdit={canManageFinance} onChanged={refreshFinance} onOpen={t=>{setFinanceSubtab('pagar');setFinanceStatusFilter('todos');setFinanceStart('');setFinanceEnd('');setFinanceCategory('todos');setFinanceCenter('todos');setSearch('financeiro-pagar','');openFinancePanel(t);setFinancePanel(t.id);setFinancePanelTab('pagamentos')}}/></>}
        {financeSubtab==='conciliacao'&&<BankReconciliation titles={titulos} canEdit={canManageFinance} canClosePeriods={canManageConfig} onChanged={refreshFinance}/>}

      </section>}
      {active==='relatorios'&&<section className="semanticPage reportsPage">
        <div className="panel reportFilters"><label>De<input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label>Até<input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label><label>Status da venda<select value={reportStatus} onChange={e=>setReportStatus(e.target.value)}><option value="todos">Todos</option><option value="orcamento">Orçamento</option><option value="pedido">Pedido</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option></select></label></div>
        <div className="cards compactCards semanticCards"><article className="card semanticCard semanticBlue"><span>Vendas no período</span><strong>{money(reportSalesTotal)}</strong><small>{filteredSales.length} registros</small></article><article className="card semanticCard semanticNegative"><span>Compras no período</span><strong>{money(reportPurchaseTotal)}</strong><small>{filteredPurchases.length} registros</small></article><article className={'card semanticCard '+(reportSalesTotal-reportPurchaseTotal>=0?'semanticPositive':'semanticNegative')}><span>Resultado bruto</span><strong>{money(reportSalesTotal-reportPurchaseTotal)}</strong><small>vendas - compras</small></article></div>
        <div className="reportsStack"><article className="panel tablePanel"><div className="panelHead"><h3>Vendas filtradas</h3><SearchField value={tableSearch['relatorio-vendas']||''} onChange={v=>setSearch('relatorio-vendas',v)} placeholder="Pesquisar"/></div><div className="tableWrap"><table><thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','fatura')}>Fatura{sortMark('relatorio-vendas','fatura')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','data')}>Data{sortMark('relatorio-vendas','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','status')}>Status{sortMark('relatorio-vendas','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-vendas','total')}>Total{sortMark('relatorio-vendas','total')}</button></th></tr></thead><tbody>{sortList('relatorio-vendas',filteredSales.filter(v=>searchMatches('relatorio-vendas',[invoiceNo(v.fatura_numero),dateBr(v.created_at),v.status,money(Number(v.total))])),{fatura:v=>Number(v.fatura_numero||0),data:v=>v.created_at,status:v=>v.status,total:v=>Number(v.total)}).map(v=><tr key={v.id} {...recordRow(()=>{setActive('vendas');setSalePanel(v.id)},'venda '+invoiceNo(v.fatura_numero))}><td>#{invoiceNo(v.fatura_numero)}</td><td>{dateBr(v.created_at)}</td><td>{v.status}</td><td>{money(Number(v.total))}</td></tr>)}</tbody></table></div></article><article className="panel tablePanel"><div className="panelHead"><h3>Compras filtradas</h3><SearchField value={tableSearch['relatorio-compras']||''} onChange={v=>setSearch('relatorio-compras',v)} placeholder="Pesquisar"/></div><div className="tableWrap"><table><thead><tr><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-compras','data')}>Data{sortMark('relatorio-compras','data')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-compras','status')}>Status{sortMark('relatorio-compras','status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggleSort('relatorio-compras','total')}>Total{sortMark('relatorio-compras','total')}</button></th></tr></thead><tbody>{sortList('relatorio-compras',filteredPurchases.filter(c=>searchMatches('relatorio-compras',[dateBr(c.created_at),c.status,money(Number(c.total))])),{data:c=>c.created_at,status:c=>c.status,total:c=>Number(c.total)}).map(c=><tr key={c.id} {...recordRow(()=>{setActive('compras');setPurchasePanel(c.id)},'compra '+invoiceNo(c.fatura_numero))}><td>{dateBr(c.created_at)}</td><td>{c.status}</td><td>{money(Number(c.total))}</td></tr>)}</tbody></table></div></article></div>
      </section>}

      {active==='config'&&<section>
        {isAdmin&&canManageConfig&&<FocusNfeSettings/>}
        {canManageConfig&&<FinanceAdministration/>}
        {canManageConfig&&<form className="panel viewerUserForm" onSubmit={createManagedUserAccount}>
          <div className="formTitle"><div><h3>Criar novo usuário</h3><p>O acesso ao ERP passa a ser controlado pelo administrador. Escolha o perfil inicial do usuário.</p></div></div>
          <label className="fieldLabel">Nome do usuário<input value={viewerName} onChange={e=>setViewerName(e.target.value)} placeholder="Digite o nome" required/></label>
          <label className="fieldLabel">E-mail<input type="email" value={viewerEmail} onChange={e=>setViewerEmail(e.target.value)} placeholder="usuario@empresa.com" required/></label>
          <label className="fieldLabel">Senha inicial<input type="password" value={viewerPassword} onChange={e=>setViewerPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" minLength={8} required/></label>
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

        {canManageConfig&&<article className="panel userManagementPanel">
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
                <td><input className="userInlineInput" value={draft.nome} onChange={e=>editManagedUser(u.user_id,'nome',e.target.value)} disabled={u.usuario_atual&&savingUserId===u.user_id}/>{u.usuario_atual&&<small className="currentUserMark">Você</small>}</td>
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
                <td><button type="button" className="primary userSaveBtn" disabled={!changed||savingUserId===u.user_id} onClick={()=>void saveManagedUser(u)}>{savingUserId===u.user_id?'Salvando...':'Salvar'}</button></td>
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
                          value={level}
                          disabled={u.usuario_atual}
                          onChange={e=>editUserPermission(u.user_id,module.key,e.target.value as AccessLevel)}
                          aria-label={`Permissão de ${module.label}`}
                        >
                          <option value="nenhum">Sem acesso</option>
                          <option value="visualizar">Somente visualizar</option>
                          {module.editable&&<option value="editar">Editar</option>}
                        </select>
                      </div>
                    })}
                  </div>
                  {!u.usuario_atual&&<div className="permissionActions">
                    <span>Perfil define o padrão inicial; esta matriz personaliza o acesso deste usuário.</span>
                    <button
                      type="button"
                      className="primary"
                      disabled={savingPermissionUserId===u.user_id||JSON.stringify(userPermissionEdits[u.user_id]||u.permissoes)===JSON.stringify(u.permissoes)}
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

        <form className="panel configForm" onSubmit={saveCompany}>
          <div className="formTitle"><div><h3>Dados da empresa</h3><p>Esses dados alimentam as faturas e a identificação do ERP.</p></div>{!canManageConfig&&<span className="readOnlyTag">Somente leitura</span>}</div><fieldset className="configFieldset" disabled={!canManageConfig}>
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
          <p className="fieldLabelWide">Política de estoque: baixa ao confirmar o pedido, conforme definido pela administração. Compras dão entrada ao receber. Novos usuários aguardam liberação de um administrador.</p>
          <div className="formActions"><button className="primary">Salvar configurações</button></div></fieldset>
        </form>
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


function EditableEntityTable({title,headers,rows,readOnly=false,emptyActionLabel,onEmptyAction}:{title:string;headers:string[];rows:{id:string;cells:(string|number)[];opened:boolean;onToggle:()=>void;panel:ReactNode}[];readOnly?:boolean;emptyActionLabel?:string;onEmptyAction?:()=>void}){
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
  return <article className="panel tablePanel"><div className="panelHead"><h3>{title}</h3><SearchField value={query} onChange={setQuery} placeholder="Pesquisar em todas as colunas"/></div><div className="tableWrap"><table><thead><tr>{headers.map((h,i)=><th key={h}>{i===headers.length-1?h:<button className="tableSortBtn" onClick={()=>toggle(i)}>{h}{sort?.index===i?(sort.dir==='asc'?' ▲':' ▼'):''}</button>}</th>)}</tr></thead><tbody>{sorted.length===0&&<tr className="emptyTableRow"><td colSpan={headers.length}><EmptyState message={rows.length===0?`Nenhum registro em ${title.toLowerCase()}.`:'Nenhum resultado encontrado.'} actionLabel={rows.length===0&&!readOnly?emptyActionLabel:undefined} onAction={onEmptyAction}/></td></tr>}{sorted.map(r=><Fragment key={r.id}><tr {...recordRow(()=>{if(!r.opened)r.onToggle()},String(r.cells[0]))}>{r.cells.map((cell,i)=><td key={i}>{cell}</td>)}<td><button className="rowMenuBtn" onClick={r.onToggle} title="Opções" aria-label="Abrir opções" aria-expanded={r.opened}><MoreVertical size={18}/></button></td></tr>{r.opened&&<tr className="manageRow"><td colSpan={headers.length}><div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={String(r.cells[0])}><div className="recordDetailBackdrop" onClick={r.onToggle}/><div className="recordDetailSheet"><div className="recordDetailHeader"><strong>{String(r.cells[0])}</strong><button type="button" className="recordDetailClose" onClick={r.onToggle}><X size={17}/>Fechar</button></div><div className="actionPanel">{r.panel}</div></div></div></td></tr>}</Fragment>)}</tbody></table></div></article>
}

function ProductTable({produtos,onCreate,openId,onToggle,onEdit,onAdjust,onDelete,canDelete,readOnly=false}:{produtos:Produto[];onCreate:()=>void;openId:string|null;onToggle:(id:string)=>void;onEdit:(p:Produto)=>void;onAdjust:(p:Produto)=>void;onDelete:(p:Produto)=>void;canDelete:boolean;readOnly?:boolean}){
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState<{key:'codigo'|'produto'|'status'|'unidade'|'estoque'|'minimo'|'custo'|'venda';dir:'asc'|'desc'}|null>(null)
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const filtered=normalized?produtos.filter(p=>[p.codigo,p.descricao,p.ativo?'ativo':'inativo',p.unidade,p.estoque_atual,p.estoque_minimo,money(Number(p.custo)),money(Number(p.preco_venda))].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized)):produtos
  const sorted=[...filtered].sort((a,b)=>{
    if(!sort)return 0
    const map=(p:Produto)=>sort.key==='codigo'?p.codigo:sort.key==='produto'?p.descricao:sort.key==='status'?(p.ativo?'ativo':'inativo'):sort.key==='unidade'?p.unidade:sort.key==='estoque'?Number(p.estoque_atual):sort.key==='minimo'?Number(p.estoque_minimo):sort.key==='custo'?Number(p.custo):Number(p.preco_venda)
    const av=map(a),bv=map(b)
    const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'pt-BR',{numeric:true,sensitivity:'base'})
    return sort.dir==='asc'?cmp:-cmp
  })
  const toggle=(key:typeof sort extends never?never:'codigo'|'produto'|'status'|'unidade'|'estoque'|'minimo'|'custo'|'venda')=>setSort(s=>({key,dir:s?.key===key&&s.dir==='asc'?'desc':'asc'}))
  const mark=(key:'codigo'|'produto'|'status'|'unidade'|'estoque'|'minimo'|'custo'|'venda')=>sort?.key===key?(sort.dir==='asc'?' ▲':' ▼'):''
  return <article className="panel tablePanel"><div className="panelHead"><div>{produtos.some(p=>Number(p.estoque_atual)<0)&&<p role="status">Há produtos com saldo negativo. Confira as entradas e saídas e registre a reposição ou um ajuste justificado após a contagem física.</p>}<h3>Produtos / Estoque</h3><p>{filtered.length} de {produtos.length} cadastrados</p></div><SearchField value={query} onChange={setQuery} placeholder="Pesquisar em todas as colunas"/></div><div className="tableWrap"><table><thead><tr><th><button className="tableSortBtn" onClick={()=>toggle('codigo')}>Código{mark('codigo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('produto')}>Produto{mark('produto')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('status')}>Status{mark('status')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('unidade')}>Un.{mark('unidade')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('estoque')}>Estoque{mark('estoque')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('minimo')}>Mínimo{mark('minimo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('custo')}>Custo{mark('custo')}</button></th><th><button className="tableSortBtn" onClick={()=>toggle('venda')}>Venda{mark('venda')}</button></th><th>Gerenciar</th></tr></thead><tbody>{filtered.length===0&&<tr className="emptyTableRow"><td colSpan={9}><EmptyState message={produtos.length===0?'Nenhum produto cadastrado.':'Nenhum produto encontrado para esta pesquisa.'} actionLabel={produtos.length===0&&!readOnly?'+ Adicionar Produto':undefined} onAction={onCreate}/></td></tr>}{sorted.map(p=>{const opened=openId===p.id;const low=Number(p.estoque_atual)<=Number(p.estoque_minimo);return <Fragment key={p.id}><tr {...recordRow(()=>{if(readOnly){if(!opened)onToggle(p.id)}else{onEdit(p)}},p.descricao)}><td>{p.codigo}</td><td>{p.descricao}</td><td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td><td>{p.unidade}</td><td><strong className={low?'stockLow':''}>{Number(p.estoque_atual).toLocaleString('pt-BR')}</strong></td><td>{Number(p.estoque_minimo).toLocaleString('pt-BR')}</td><td>{money(Number(p.custo))}</td><td>{money(Number(p.preco_venda))}</td><td><button className="rowMenuBtn" onClick={()=>onToggle(p.id)} title="Opções" aria-label="Abrir opções do produto" aria-expanded={opened}><MoreVertical size={18}/></button></td></tr>{opened&&<tr className="manageRow"><td colSpan={9}><div className="recordDetailOverlay" role="dialog" aria-modal="true" aria-label={p.descricao}><div className="recordDetailBackdrop" onClick={()=>onToggle(p.id)}/><div className="recordDetailSheet"><div className="recordDetailHeader"><strong>{p.codigo} - {p.descricao}</strong><button type="button" className="recordDetailClose" onClick={()=>onToggle(p.id)}><X size={17}/>Fechar</button></div><div className="actionPanel"><div className="actionMeta"><strong>{p.codigo} - {p.descricao}</strong><span>Estoque: {Number(p.estoque_atual).toLocaleString('pt-BR')} {p.unidade}</span></div><div className="rowActions">{!readOnly&&<button className="ghost" onClick={()=>onEdit(p)}><Pencil size={15}/>Editar</button>}{!readOnly&&<button className="ghost" onClick={()=>onAdjust(p)}><Boxes size={15}/>Ajustar estoque</button>}{canDelete&&!readOnly&&<button className="dangerAction" onClick={()=>void onDelete(p)}><Trash2 size={15}/>Excluir</button>}</div></div></div></div></td></tr>}</Fragment>})}</tbody></table></div></article>
}

export default App

