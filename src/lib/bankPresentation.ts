type Movement = {valor:number;data_lancamento:string;status:string}
export const isPending = (tx: Pick<Movement,'status'>) => tx.status === 'pendente' || tx.status === 'parcial'
const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export function bankBrand(bank:string|null, name:string) {
  const value = normalize((bank || '') + ' ' + name)
  if (/itau|\b341\b/.test(value)) return {name:'Itaú',color:'#FF6200',logo:'https://www.itau.com.br/media/dam/m/59ca6000bfbf59d6/original/ITAU_LOGO_HEX_48X48.png'}
  if (/bradesco|\b237\b/.test(value)) return {name:'Bradesco',color:'#CC092F',logo:'https://assets.bradesco/content/dam/portal-bradesco/assets/classic/home/images/logo-mobile.png'}
  if (/santander|\b033\b/.test(value)) return {name:'Santander',color:'#CC092F',logo:'https://www.santander.com.br/sites/WPC_CMS/imagem/21-03-26_095020_M_favicon.png'}
  if (/\binter\b|\b077\b/.test(value)) return {name:'Inter',color:'#FF7A00',logo:'https://inter.co/favicon.svg'}
  return {name:bank || 'Conta bancária',color:'#64748B',logo:null}
}
// Reconstruct only the available imported movements, anchored to the account's current balance.
export function balanceTrend(currentBalance:number, rows:Movement[]) {
  const days = new Map<string,number>()
  for (const row of rows) days.set(row.data_lancamento,(days.get(row.data_lancamento)||0)+Math.round(Number(row.valor)*100))
  const ordered = [...days].sort(([a],[b])=>a.localeCompare(b))
  if (!ordered.length) return []
  let cents = Math.round(currentBalance*100) - ordered.reduce((sum,[,amount])=>sum+amount,0)
  const values = [cents/100]
  for (const [,amount] of ordered) { cents += amount; values.push(cents/100) }
  return values.slice(-31)
}
export function sparkPoints(values:number[]) {
  if (values.length < 2) return ''
  const min = Math.min(...values), max = Math.max(...values), span = max-min
  return values.map((value,index)=>`${(index/(values.length-1)*300).toFixed(2)},${(span ? 48-(value-min)/span*40 : 28).toFixed(2)}`).join(' ')
}
