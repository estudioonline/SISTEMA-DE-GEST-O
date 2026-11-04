import {useState} from 'react'
import {BarChart3,Boxes,ClipboardCheck,PackageCheck,Truck,X} from 'lucide-react'
import {DeliveryManagement} from './DeliveryManagement'
import {LogisticsOperations} from './LogisticsOperations'
import {ProductionWorkspace} from './ProductionWorkspace'
import './delivery-workspace.css'
import './logistics-operations.css'
import './production-earnings.css'

type Section='separacao'|'producao'|'rotas'|'conferencia'|'relatorio'

const sections:{key:Section;title:string;description:string;icon:typeof Boxes}[]=[
  {key:'separacao',title:'Separar pedidos',description:'Pedidos confirmados aguardando separação, organização, rota ou saída.',icon:Boxes},
  {key:'rotas',title:'Rotas de entrega',description:'Montar viagens, definir motorista, ordem das paradas e liberar a rota.',icon:Truck},
  {key:'conferencia',title:'Conferir entregas',description:'Revisar entregues, não entregues, comprovantes e retornos do motorista.',icon:ClipboardCheck},
  {key:'producao',title:'Produção pronta',description:'Pedidos prontos para entrar na logística e seguir para uma rota.',icon:PackageCheck},
  {key:'relatorio',title:'Relatório de entregas',description:'Acompanhar histórico por período, motorista, rota e situação da entrega.',icon:BarChart3},
]

export function DeliveryWorkspace({canEdit,canOperate}:{canEdit:boolean;canOperate:boolean}){
  const [section,setSection]=useState<Section|null>(null)
  if(!section){
    return <section className="deliveryWorkspace">
      <header className="deliveryWorkspaceHead">
        <div><span>LOGÍSTICA</span><h2>Operação logística</h2><p>Separe pedidos, acompanhe produção, monte rotas, confira entregas e analise os resultados.</p></div>
      </header>
      <div className="deliveryWorkspaceGrid">
        {sections.map(item=>{
          const Icon=item.icon
          return <button key={item.key} type="button" className="deliveryWorkspaceCard" onClick={()=>setSection(item.key)}>
            <span className="deliveryWorkspaceIcon"><Icon size={21}/></span>
            <span className="deliveryWorkspaceText"><strong>{item.title}</strong><small>{item.description}</small></span>
          </button>
        })}
      </div>
    </section>
  }

  return <section className="deliveryWorkspace">
    <div className="deliveryWorkspaceNav">
      <button type="button" className="deliveryWorkspaceBack" onClick={()=>setSection(null)}>← Logística</button>
      <nav aria-label="Áreas de Logística">
        {sections.map(item=><button key={item.key} type="button" className={section===item.key?'active':''} onClick={()=>setSection(item.key)}>{item.title}</button>)}
      </nav>
      <button type="button" className="deliveryWorkspaceClose" onClick={()=>setSection(null)} title="Voltar ao início"><X size={16}/></button>
    </div>
    <div className="deliveryWorkspaceContext">
      <strong>{sections.find(item=>item.key===section)?.title}</strong>
      <span>{sections.find(item=>item.key===section)?.description}</span>
    </div>
    {section==='separacao'&&<LogisticsOperations mode="separacao" canEdit={canEdit}/>}
    {section==='producao'&&<ProductionWorkspace canEdit={canEdit}/>}
    {section==='relatorio'&&<LogisticsOperations mode="relatorio" canEdit={canEdit}/>}
    {section==='rotas'&&<DeliveryManagement key="rotas" canEdit={canEdit} canOperate={canOperate} initialView="montagem"/>}
    {section==='conferencia'&&<DeliveryManagement key="conferencia" canEdit={canEdit} canOperate={canOperate} initialView="historico"/>}
  </section>
}
