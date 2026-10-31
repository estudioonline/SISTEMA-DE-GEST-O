import {useState} from 'react'
import {Plus,Pencil,Save,X} from 'lucide-react'
import {supabase} from './lib/supabase'

export type ProductGroup={id:string;nome:string;ordem:number;ativo:boolean}
export type ProductSubgroup={id:string;grupo_id:string;nome:string;ordem:number;ativo:boolean}

export function ProductGroupsManager({groups,subgroups,canEdit,onReload,onMessage}:{groups:ProductGroup[];subgroups:ProductSubgroup[];canEdit:boolean;onReload:()=>Promise<void>;onMessage:(message:string)=>void}){
  const [newGroup,setNewGroup]=useState('')
  const [newSubgroup,setNewSubgroup]=useState('')
  const [subgroupGroup,setSubgroupGroup]=useState('')
  const [editingGroup,setEditingGroup]=useState<ProductGroup|null>(null)
  const [editingSubgroup,setEditingSubgroup]=useState<ProductSubgroup|null>(null)
  const [busy,setBusy]=useState(false)

  async function createGroup(){
    const nome=newGroup.trim();if(!nome||busy)return
    setBusy(true)
    const {error}=await supabase.from('grupos_produtos').insert({nome,ordem:(groups.at(-1)?.ordem||0)+10})
    setBusy(false)
    if(error){onMessage(error.message);return}
    setNewGroup('');onMessage('Grupo criado.');await onReload()
  }
  async function createSubgroup(){
    const nome=newSubgroup.trim();if(!nome||!subgroupGroup||busy)return
    setBusy(true)
    const siblings=subgroups.filter(s=>s.grupo_id===subgroupGroup)
    const {error}=await supabase.from('subgrupos_produtos').insert({grupo_id:subgroupGroup,nome,ordem:(siblings.at(-1)?.ordem||0)+10})
    setBusy(false)
    if(error){onMessage(error.message);return}
    setNewSubgroup('');onMessage('Subgrupo criado.');await onReload()
  }
  async function saveGroup(){
    if(!editingGroup||busy)return
    const nome=editingGroup.nome.trim();if(!nome)return
    setBusy(true)
    const {error}=await supabase.from('grupos_produtos').update({nome,ativo:editingGroup.ativo}).eq('id',editingGroup.id)
    setBusy(false)
    if(error){onMessage(error.message);return}
    setEditingGroup(null);onMessage('Grupo atualizado.');await onReload()
  }
  async function saveSubgroup(){
    if(!editingSubgroup||busy)return
    const nome=editingSubgroup.nome.trim();if(!nome)return
    setBusy(true)
    const {error}=await supabase.from('subgrupos_produtos').update({nome,ativo:editingSubgroup.ativo,grupo_id:editingSubgroup.grupo_id}).eq('id',editingSubgroup.id)
    setBusy(false)
    if(error){onMessage(error.message);return}
    setEditingSubgroup(null);onMessage('Subgrupo atualizado.');await onReload()
  }

  return <section className="panel productGroupsManager">
    <div className="panelHead"><div><h3>Grupos e subgrupos</h3><p>Estrutura editável para organizar o estoque. Alterações futuras não exigem mexer no código.</p></div></div>
    {canEdit&&<div className="productGroupCreate">
      <label>Grupo<input value={newGroup} onChange={e=>setNewGroup(e.target.value)} placeholder="Novo grupo"/></label>
      <button type="button" className="ghost" disabled={!newGroup.trim()||busy} onClick={()=>void createGroup()}><Plus size={15}/>Adicionar grupo</button>
      <label>Grupo do subgrupo<select value={subgroupGroup} onChange={e=>setSubgroupGroup(e.target.value)}><option value="">Selecione</option>{groups.filter(g=>g.ativo).map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
      <label>Subgrupo<input value={newSubgroup} onChange={e=>setNewSubgroup(e.target.value)} placeholder="Novo subgrupo"/></label>
      <button type="button" className="ghost" disabled={!subgroupGroup||!newSubgroup.trim()||busy} onClick={()=>void createSubgroup()}><Plus size={15}/>Adicionar subgrupo</button>
    </div>}
    <div className="productGroupList">
      {groups.map(g=><article key={g.id} className="productGroupCard">
        <div className="productGroupTitle">
          {editingGroup?.id===g.id?<><input value={editingGroup.nome} onChange={e=>setEditingGroup({...editingGroup,nome:e.target.value})}/><select value={editingGroup.ativo?'true':'false'} onChange={e=>setEditingGroup({...editingGroup,ativo:e.target.value==='true'})}><option value="true">Ativo</option><option value="false">Inativo</option></select><button className="iconBtn" onClick={()=>void saveGroup()}><Save size={15}/></button><button className="iconBtn" onClick={()=>setEditingGroup(null)}><X size={15}/></button></>:<><strong>{g.nome}</strong><span>{g.ativo?'Ativo':'Inativo'}</span>{canEdit&&<button className="iconBtn" onClick={()=>setEditingGroup({...g})}><Pencil size={15}/></button>}</>}
        </div>
        <div className="productSubgroupList">
          {subgroups.filter(s=>s.grupo_id===g.id).map(s=><div key={s.id} className="productSubgroupRow">
            {editingSubgroup?.id===s.id?<><input value={editingSubgroup.nome} onChange={e=>setEditingSubgroup({...editingSubgroup,nome:e.target.value})}/><select value={editingSubgroup.ativo?'true':'false'} onChange={e=>setEditingSubgroup({...editingSubgroup,ativo:e.target.value==='true'})}><option value="true">Ativo</option><option value="false">Inativo</option></select><button className="iconBtn" onClick={()=>void saveSubgroup()}><Save size={14}/></button><button className="iconBtn" onClick={()=>setEditingSubgroup(null)}><X size={14}/></button></>:<><span>{s.nome}</span><small>{s.ativo?'Ativo':'Inativo'}</small>{canEdit&&<button className="iconBtn" onClick={()=>setEditingSubgroup({...s})}><Pencil size={14}/></button>}</>}
          </div>)}
          {!subgroups.some(s=>s.grupo_id===g.id)&&<small>Sem subgrupos</small>}
        </div>
      </article>)}
    </div>
  </section>
}
