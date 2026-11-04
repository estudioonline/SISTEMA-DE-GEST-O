import {Search,X} from 'lucide-react'
import {useMemo,useState} from 'react'

export type SearchableOption={
  value:string
  label:string
  keywords?:string
  disabled?:boolean
}

type Props={
  value:string
  onChange:(value:string)=>void
  options:SearchableOption[]
  placeholder?:string
  searchPlaceholder?:string
  disabled?:boolean
  required?:boolean
  className?:string
}

function norm(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
}

export function SearchableSelect({
  value,onChange,options,placeholder='Selecione',searchPlaceholder='Pesquisar...',disabled=false,required=false,className=''
}:Props){
  const [query,setQuery]=useState('')
  const selected=options.find(option=>option.value===value)
  const filtered=useMemo(()=>{
    const q=norm(query)
    if(!q)return options
    return options.filter(option=>norm(option.label+' '+(option.keywords||'')).includes(q))
  },[options,query,value])

  return <div className={'searchableSelect '+className}>
    <div className="searchableSelectSearch">
      <Search size={15}/>
      <input
        type="text"
        value={query}
        onChange={e=>setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        disabled={disabled}
        aria-label={searchPlaceholder}
      />
      {query&&<button type="button" onClick={()=>setQuery('')} title="Limpar pesquisa" aria-label="Limpar pesquisa"><X size={13}/></button>}
    </div>
    <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} required={required}>
      <option value="">{placeholder}</option>
      {selected&&!filtered.some(option=>option.value===selected.value)&&<option value={selected.value} hidden>{selected.label}</option>}
      {filtered.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    {query&&filtered.length===0&&<small className="searchableSelectEmpty">Nenhum resultado para “{query}”.</small>}
    {selected&&query&&<small className="searchableSelectCurrent">Selecionado: {selected.label}</small>}
  </div>
}
