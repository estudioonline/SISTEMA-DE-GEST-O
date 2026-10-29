export type AccessLevel='nenhum'|'visualizar'|'editar'
export type PermissionModule='dashboard'|'vendas'|'clientes'|'fornecedores'|'produtos'|'compras'|'comissoes'|'financeiro'|'entregas'|'autorizacoes'|'relatorios'|'config'
export type PermissionMap=Record<PermissionModule,AccessLevel>

export const permissionModules:{key:PermissionModule;label:string;editable:boolean;description:string}[]=[
  {key:'dashboard',label:'Dashboard',editable:false,description:'Indicadores e visão geral'},
  {key:'vendas',label:'Vendas',editable:true,description:'Orçamentos, pedidos e faturamento'},
  {key:'clientes',label:'Clientes',editable:true,description:'Cadastro e consulta de clientes'},
  {key:'fornecedores',label:'Fornecedores',editable:true,description:'Cadastro e consulta de fornecedores'},
  {key:'produtos',label:'Produtos / Estoque',editable:true,description:'Produtos, custos e movimentações'},
  {key:'compras',label:'Compras',editable:true,description:'Cotações, pedidos, recebimentos e NF-e'},
  {key:'comissoes',label:'Comissões',editable:true,description:'Vendedores, apuração e fechamentos'},
  {key:'financeiro',label:'Financeiro',editable:true,description:'Contas, pagamentos e comprovantes'},
  {key:'entregas',label:'Entregas',editable:true,description:'Rotas, entregas, ocorrências e comprovantes'},
  {key:'autorizacoes',label:'Autorizações',editable:true,description:'Solicitações e decisões administrativas'},
  {key:'relatorios',label:'Relatórios',editable:false,description:'Consultas e relatórios gerenciais'},
  {key:'config',label:'Configurações',editable:true,description:'Empresa, usuários e regras do ERP'}
]

const none:PermissionMap={
  dashboard:'nenhum',vendas:'nenhum',clientes:'nenhum',fornecedores:'nenhum',produtos:'nenhum',
  compras:'nenhum',comissoes:'nenhum',financeiro:'nenhum',entregas:'nenhum',autorizacoes:'nenhum',relatorios:'nenhum',config:'nenhum'
}

export function defaultPermissionsForRole(role:string):PermissionMap{
  const p={...none}
  if(role==='administrador'){
    for(const m of permissionModules)p[m.key]=m.editable?'editar':'visualizar'
    return p
  }
  if(role==='financeiro'){
    p.dashboard='visualizar';p.clientes='visualizar';p.fornecedores='visualizar';p.financeiro='editar';p.relatorios='visualizar'
    return p
  }
  if(role==='vendas'){
    p.dashboard='visualizar';p.vendas='editar';p.clientes='editar';p.produtos='visualizar';p.comissoes='visualizar';p.autorizacoes='visualizar';p.relatorios='visualizar'
    return p
  }
  if(role==='estoque'){
    p.dashboard='visualizar';p.fornecedores='editar';p.produtos='editar';p.compras='editar';p.relatorios='visualizar'
    return p
  }
  p.dashboard='visualizar';p.vendas='visualizar';p.clientes='visualizar';p.relatorios='visualizar'
  return p
}

export function normalizePermissions(value:unknown,fallbackRole='visualizador'):PermissionMap{
  const result=defaultPermissionsForRole(fallbackRole)
  if(!value||typeof value!=='object')return result
  const source=value as Record<string,unknown>
  for(const item of permissionModules){
    const level=source[item.key]
    if(level==='nenhum'||level==='visualizar'||level==='editar'){
      result[item.key]=item.editable?level:(level==='nenhum'?'nenhum':'visualizar')
    }
  }
  return result
}

export function canViewPermission(map:PermissionMap,module:PermissionModule){
  return map[module]==='visualizar'||map[module]==='editar'
}
export function canEditPermission(map:PermissionMap,module:PermissionModule){
  return map[module]==='editar'
}
