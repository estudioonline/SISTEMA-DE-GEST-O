/** Display code shared by receivable and payable invoices. Keeps the stored number intact. */
export function financialInvoiceCode(value:number|null|undefined):string {
  return value==null?'—':`FAT${String(value).padStart(5,'0')}`
}
