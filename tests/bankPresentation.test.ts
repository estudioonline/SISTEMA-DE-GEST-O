import assert from 'node:assert/strict'
import test from 'node:test'
import {bankBrand,balanceTrend,isPending,sparkPoints} from '../src/lib/bankPresentation.ts'
import {readThemePreference,resolveDark,saveThemePreference,THEME_STORAGE_KEY} from '../src/lib/theme.ts'

test('theme follows the OS until an explicit preference is saved, and storage failure is safe',()=>{
 const values=new Map<string,string>()
 const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
 assert.equal(readThemePreference(storage),'system')
 assert.equal(resolveDark(readThemePreference(storage),true),true)
 saveThemePreference(storage,'light')
 assert.equal(resolveDark(readThemePreference(storage),true),false)
 saveThemePreference(storage,'dark')
 assert.equal(resolveDark(readThemePreference(storage),false),true)
 saveThemePreference(storage,'system')
 assert.equal(values.has(THEME_STORAGE_KEY),false)
 values.set(THEME_STORAGE_KEY,'invalid')
 assert.equal(readThemePreference(storage),'system')
 assert.equal(readThemePreference({getItem:()=>{throw Error('Blocked')}}),'system')
 assert.doesNotThrow(()=>saveThemePreference({setItem:()=>{throw Error('Blocked')},removeItem:()=>{}},'dark'))
})

test('pending badges exclude reconciled and ignored entries and update with imported entries',()=>{
 const rows=[{status:'conciliado'},{status:'ignorado'},{status:'pendente'},{status:'parcial'}]
 assert.equal(rows.filter(isPending).length,2)
 rows.push({status:'pendente'})
 assert.equal(rows.filter(isPending).length,3)
 rows[2].status='conciliado'
 assert.equal(rows.filter(isPending).length,2)
})

test('bank branding handles accented names, bank codes, and unknown accounts',()=>{
 assert.equal(bankBrand('Itaú','Conta 1').color,'#FF6200')
 assert.equal(bankBrand('237','Conta 2').name,'Bradesco')
 assert.equal(bankBrand(null,'INTER Empresas').name,'Inter')
 assert.equal(bankBrand('033','Conta 3').name,'Santander')
 assert.equal(bankBrand(null,'Caixa interno').logo,null)
})

test('balance sparkline uses chronological daily totals, ends at current balance, and has no invented empty data',()=>{
 const rows=[{valor:-25,data_lancamento:'2026-10-29',status:'pendente'},{valor:100,data_lancamento:'2026-10-28',status:'conciliado'},{valor:-10,data_lancamento:'2026-10-29',status:'ignorado'}]
 assert.deepEqual(balanceTrend(165,rows),[100,200,165])
 assert.deepEqual(balanceTrend(10,[]),[])
 assert.equal(sparkPoints([]),'')
 assert.equal(sparkPoints([10,10]),'0.00,28.00 300.00,28.00')
 assert.equal(sparkPoints([100,200,165]),'0.00,48.00 150.00,8.00 300.00,22.00')
 const many=Array.from({length:40},(_,i)=>({valor:.1,data_lancamento:String(i).padStart(2,'0'),status:'pendente'}))
 const trend=balanceTrend(4,many)
 assert.equal(trend.length,31)
 assert.equal(trend.at(-1),4)
})
