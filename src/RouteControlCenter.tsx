import {Plus} from 'lucide-react'

type Tab='montagem'|'rota'|'historico'

export function RouteControlCenter({
  onViewChange,
  canEdit,
}:{
  onViewChange:(view:Tab)=>void
  canEdit:boolean
  canOperate:boolean
  selectedDeliveryIds:string[]
  onClearSelection:()=>void
  onChanged:()=>Promise<void>|void
  onConfirmDelivery:(deliveryId:string)=>void
  refreshKey:number
}){
  return <section className="routeTrelloBlank">
    <div className="routeTrelloBlankBoard">
      {canEdit&&<button
        type="button"
        className="routeTrelloAddList"
        onClick={()=>onViewChange('montagem')}
      >
        <Plus size={18}/>
        <span>Adicionar outra rota</span>
      </button>}
    </div>
  </section>
}
