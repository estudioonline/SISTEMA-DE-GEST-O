import {useState} from 'react'
import {BarChart3,Boxes,ClipboardCheck,PackageCheck,Truck,X} from 'lucide-react'
import {DeliveryManagement} from './DeliveryManagement'
import './delivery-workspace.css'

type Section='separacao'|'producao'|'rotas'|'conferencia'|'relatorio'

const sections:{key:Section;title:string;description:string;icon:typeof Boxes}[]=[
  {key:'separacao',title:'Separar pedidos',description:'Pedidos confirmados aguardando separação, organização, rota ou saída.',icon:Boxes},
  {key:'rotas',title:'Rotas de entrega',description:'Montar viagens, definir motorista, ordem das paradas e liberar a rota.',icon:Truck},
  {key:'producao',title:'Produção pronta',description:'Pedidos prontos para entrar na logística e seguir para uma rota.',icon:PackageCheck},
  {key:'conferencia',title:'Conferir entregas',description:'Revisar entregues, não entregues, comprovantes e retornos do motorista.',icon:ClipboardCheck},
  {key:'relatorio',title:'Relatório de entregas',description:'Acompanhar histórico por período, motorista, rota e situação da entrega.',icon:BarChart3},
]

export function DeliveryWorkspace({canEdit,canOperate}:{canEdit:boolean;canOperate:boolean}){
  const [section,setSection]=useState<Section|null>(null)
  if(!section){
    return <section className="deliveryWorkspace">
      <header className="deliveryWorkspaceHead">
        <div><span>ENTREGAS</span><h2>Operação de entregas</h2><p>Separe, monte rotas, confira retornos e acompanhe o histórico sem movimentar estoque.</p></div>
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
      <button type="button" className="deliveryWorkspaceBack" onClick={()=>setSection(null)}>← Entregas</button>
      <nav aria-label="Áreas de Entregas">
        {sections.map(item=><button key={item.key} type="button" className={section===item.key?'active':''} onClick={()=>setSection(item.key)}>{item.title}</button>)}
      </nav>
      <button type="button" className="deliveryWorkspaceClose" onClick={()=>setSection(null)} title="Voltar ao início"><X size={16}/></button>
    </div>
    <div className="deliveryWorkspaceContext">
      <strong>{sections.find(item=>item.key===section)?.title}</strong>
      <span>{sections.find(item=>item.key===section)?.description}</span>
    </div>
    <DeliveryManagement key={section} canEdit={canEdit} canOperate={canOperate} initialView={section==='rotas'?'rota':section==='conferencia'||section==='relatorio'?'historico':'montagem'}/>
  </section>
}
