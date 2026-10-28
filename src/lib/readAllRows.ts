type Page<T>={data:T[]|null;error:{message:string}|null}
// Fetch every page before returning, so totals and exports never use a truncated result.
export async function readAllRows<T>(fetchPage:(from:number,to:number)=>PromiseLike<Page<T>>,pageSize=500):Promise<Page<T>>{
 const data:T[]=[]
 for(let offset=0;;offset+=pageSize){
  const page=await fetchPage(offset,offset+pageSize-1)
  if(page.error)return {data:null,error:page.error}
  const rows=page.data||[];data.push(...rows)
  if(rows.length<pageSize)return {data,error:null}
 }
}
