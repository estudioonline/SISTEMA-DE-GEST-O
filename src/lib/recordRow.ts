import type {HTMLAttributes} from 'react'

// Nested controls keep their own actions; opening an already-open card is harmless.
export function recordRow(onOpen:()=>void,label:string):HTMLAttributes<HTMLTableRowElement>{
 return {
  className:'recordRow',tabIndex:0,'aria-label':`Abrir card de ${label}`,
  title:'Dê dois cliques para abrir o card. Pelo teclado, use Enter.',
  onDoubleClick(event){if(!(event.target as Element).closest('button,a,input,select,textarea,label,[role="button"],[contenteditable="true"]'))onOpen()},
  onKeyDown(event){if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onOpen()}},
 }
}
