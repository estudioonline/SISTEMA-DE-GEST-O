import { ArrowRight, ShieldCheck } from 'lucide-react'
import { canViewPermission } from './lib/permissions'
import type { PermissionMap, PermissionModule } from './lib/permissions'

export function IntegrationSettings({permissions,company,onOpen}:{permissions:PermissionMap;company:{reservar_estoque_pedido?:boolean;sessao_inatividade_minutos?:number}|null;onOpen:(module:PermissionModule)=>void}){
  const flows:{module:PermissionModule;title:string;steps:string;rule:string}[]=[
    {module:'vendas',title:'Vendas e estoque',steps:'Orçamento → Pedido → Faturamento pelo Financeiro',rule:`Orçamentos não movimentam estoque. A baixa ocorre ${company?.reservar_estoque_pedido?'na confirmação do pedido':'no faturamento'}, conforme a regra atual.`},
    {module:'compras',title:'Compras e estoque',steps:'Cotação → Pedido aprovado → Pedido recebido',rule:'A aprovação gera contas a pagar. O recebimento dá entrada no estoque uma vez.'},
    {module:'financeiro',title:'Faturas e recebimentos',steps:'Vendas aprovadas → Fatura individual ou consolidada → Recebimento',rule:'A consolidação exige o mesmo cliente e parcelas com soma exata. Dinheiro gera recebimento no diário Dinheiro ao faturar. Pagamentos e estornos mantêm o histórico.'},
    {module:'autorizacoes',title:'Exceções administrativas',steps:'Bloqueio → Solicitação → Decisão justificada → Venda vinculada',rule:'A decisão revalida a operação no banco. Solicitações desatualizadas ou já decididas são recusadas. Uma autorização não deve apagar pagamentos ou histórico.'},
  ]
  return <article className="panel integrationSettings"><div className="panelHead"><div><h3>Interligações do ERP</h3><p>Regras que conectam os módulos. Use os atalhos para continuar o trabalho.</p></div><ShieldCheck size={24}/></div>
    <div className="integrationGrid">{flows.filter(f=>canViewPermission(permissions,f.module)).map(flow=><section key={flow.module} className="integrationCard"><h4>{flow.title}</h4><strong>{flow.steps}</strong><p>{flow.rule}</p><button className="ghost" onClick={()=>onOpen(flow.module)}>Abrir módulo <ArrowRight size={15}/></button></section>)}</div>
    <p className="permissionSafetyNotice"><ShieldCheck size={17}/>Acesso conferido no banco ao entrar, ao retornar à aba e a cada 30 segundos. A sessão encerra após {company?.sessao_inatividade_minutos||30} minutos de inatividade.</p>
  </article>
}
