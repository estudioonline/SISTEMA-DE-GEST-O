import test from 'node:test'
import assert from 'node:assert/strict'
import {readAllRows} from '../src/lib/readAllRows.ts'
test('all pages contribute to totals and exports',async()=>{
 const source=Array.from({length:1203},(_,i)=>({id:i}))
 const pages:number[]=[]
 const result=await readAllRows(async(from,to)=>{pages.push(from);return {data:source.slice(from,to+1),error:null}})
 assert.deepEqual(pages,[0,500,1000])
 assert.deepEqual(result.data,source)
})
test('a later failure never returns a partial total',async()=>{
 const result=await readAllRows(async(from)=>from?{data:null,error:{message:'Falha'}}:{data:[1,2],error:null},2)
 assert.equal(result.data,null);assert.equal(result.error?.message,'Falha')
})
