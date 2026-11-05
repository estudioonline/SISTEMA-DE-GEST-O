/** Stable purchase reference, distinct from its FAT invoice display code. */
export function purchaseCode(value:number|null|undefined):string {
  return value==null?'—':`C${String(value).padStart(5,'0')}`
}
