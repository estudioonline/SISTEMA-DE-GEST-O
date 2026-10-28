import fs from 'node:fs'
import {createHash} from 'node:crypto'
const manifest=JSON.parse(fs.readFileSync('supabase/checkpoints/migration-manifest.json','utf8'))
const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql'))
const versions=new Set()
for(const file of files){
 const match=file.match(/^(\d{14})_(.+)\.sql$/)
 if(!match||versions.has(match[1]))throw new Error('Migration version invalid or duplicated: '+file)
 versions.add(match[1])
}
for(const migration of manifest.migrations){
 const file=`supabase/migrations/${migration.version}_${migration.name}.sql`
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')
 const hash=createHash('sha256').update(text).digest('hex')
 if(hash!==migration.sha256)throw new Error('Applied migration differs from checkpoint: '+file)
}
console.log(`${manifest.migrations.length} applied migrations verified; ${files.length-manifest.migrations.length} new migrations.`)
