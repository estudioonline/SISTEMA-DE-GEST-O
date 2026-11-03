import {useState} from 'react'
import {Coins,PackageCheck,UsersRound} from 'lucide-react'
import {LogisticsOperations} from './LogisticsOperations'
import {ProductionEarnings} from './ProductionEarnings'

export function ProductionWorkspace({canEdit}:{canEdit:boolean}){
  const [tab,setTab]=useState<'fila'|'ganhos'|'equipe'>('fila')
  return <section>
    <div className="productionSubnav">
      <button className={tab==='fila'?'active':''} onClick={()=>setTab('fila')}><PackageCheck size={15}/>Fila de produção</button>
      <button className={tab==='ganhos'?'active':''} onClick={()=>setTab('ganhos')}><Coins size={15}/>Ganhos por produção</button>
      <button className={tab==='equipe'?'active':''} onClick={()=>setTab('equipe')}><UsersRound size={15}/>Equipe e funções</button>
    </div>
    {tab==='fila'?<LogisticsOperations mode="producao" canEdit={canEdit}/>:tab==='ganhos'?<ProductionEarnings canEdit={canEdit}/>:<ProductionEarnings canEdit={canEdit} management/>}
  </section>
}
