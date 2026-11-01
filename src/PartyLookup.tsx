import {useEffect,useId,useMemo,useRef,useState} from 'react'
import type {KeyboardEvent} from 'react'
import {createPortal} from 'react-dom'
import {Search,X} from 'lucide-react'

type Party={id:string;nome:string;documento?:string|null;email?:string|null;telefone?:string|null;ativo:boolean}

const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

export function PartyLookup({items,value,onSelect,kind,emptyLabel}:{
  items:Party[]
  value:string
  onSelect:(id:string)=>void
  kind:'cliente'|'fornecedor'
  emptyLabel:string
}){
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const [dark,setDark]=useState(false)
  const trigger=useRef<HTMLButtonElement>(null)
  const input=useRef<HTMLInputElement>(null)
  const dialog=useRef<HTMLDivElement>(null)
  const titleId=useId()
  const selected=items.find(item=>item.id===value)
  const results=useMemo(()=>{
    const terms=norm(query).trim().split(/\s+/).filter(Boolean)
    return items.filter(item=>item.ativo&&terms.every(term=>norm([item.nome,item.documento,item.email,item.telefone].filter(Boolean).join(' ')).includes(term)))
  },[items,query])
  const close=()=>{setOpen(false);trigger.current?.focus()}
  useEffect(()=>{if(open)input.current?.focus()},[open])
  function keyDown(e:KeyboardEvent<HTMLDivElement>){
    e.stopPropagation()
    if(e.key==='Escape'){e.preventDefault();close()}
    else if(e.key==='Enter'&&e.target===input.current&&results.length===1){e.preventDefault();onSelect(results[0].id);close()}
  }
  return <>
    <button ref={trigger} type="button" className="partyLookupField" onClick={()=>{
      setDark(Boolean(trigger.current?.closest('.dark')));setQuery('');setOpen(true)
    }} aria-haspopup="dialog" aria-expanded={open}>
      <Search size={16}/>
      <span>{selected?selected.nome:emptyLabel}</span>
      <strong>{selected?'Alterar':'Escolher'}</strong>
    </button>
    {open&&createPortal(<div className={'partyLookupOverlay'+(dark?' dark':'')} onClick={e=>{if(e.target===e.currentTarget)close()}} onKeyDown={keyDown}>
      <div ref={dialog} className="partyLookupDialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="partyLookupHeader"><div><h2 id={titleId}>Pesquisar {kind}</h2><p>Busque por nome, documento, telefone ou e-mail.</p></div><button type="button" className="iconBtn" onClick={close}><X size={18}/></button></div>
        <label className="partyLookupSearch"><Search size={18}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder={'Digite o nome ou documento do '+kind}/>{query&&<button type="button" onClick={()=>{setQuery('');input.current?.focus()}}><X size={15}/></button>}</label>
        <p className="partyLookupCount">{results.length.toLocaleString('pt-BR')} resultado(s)</p>
        <div className="partyLookupResults">
          <button type="button" className={'partyLookupResult'+(!value?' isSelected':'')} onClick={()=>{onSelect('');close()}}>
            <span><strong>{emptyLabel}</strong><small>Sem vínculo cadastral</small></span>
          </button>
          {results.map(item=><button type="button" key={item.id} className={'partyLookupResult'+(item.id===value?' isSelected':'')} onClick={()=>{onSelect(item.id);close()}}>
            <span><strong>{item.nome}</strong><small>{item.documento||'Sem documento'}</small></span>
            <em>{[item.telefone,item.email].filter(Boolean).join(' · ')||'Sem contato'}</em>
          </button>)}
          {results.length===0&&<div className="partyLookupEmpty">Nenhum {kind} encontrado.</div>}
        </div>
      </div>
    </div>,document.body)}
  </>
}
