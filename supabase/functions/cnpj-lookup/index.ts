import {createClient} from 'npm:@supabase/supabase-js@2.75.0'

const allowedOrigins=new Set([
  'https://estudioonline.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
])

const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{
  status,
  headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}
})

const secretKey=()=>{
  const keys=Deno.env.get('SUPABASE_SECRET_KEYS')
  return keys?JSON.parse(keys).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

const clean=(value:unknown)=>String(value??'').trim()
const normalize=(value:unknown)=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,' ')
  .replace(/\s+/g,' ').trim()

type BrasilApiCnpj={
  cnpj?:string
  razao_social?:string
  nome_fantasia?:string|null
  email?:string|null
  ddd_telefone_1?:string|null
  ddd_telefone_2?:string|null
  logradouro?:string
  numero?:string
  bairro?:string
  municipio?:string|null
  uf?:string
  cep?:string
  descricao_situacao_cadastral?:string|null
}

type IbgeMunicipio={id?:number;nome?:string}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('Origin')??''
  const cors:Record<string,string>={
    'Vary':'Origin',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS'
  }
  if(allowedOrigins.has(origin))cors['Access-Control-Allow-Origin']=origin
  if(origin&&!allowedOrigins.has(origin))return json({error:'Origem não permitida.'},403,cors)
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  if(req.method!=='POST')return json({error:'Método não permitido.'},405,cors)

  try{
    const bearer=req.headers.get('Authorization')??''
    if(!bearer.startsWith('Bearer '))return json({error:'Entre novamente no sistema.'},401,cors)

    const db=createClient(Deno.env.get('SUPABASE_URL')!,secretKey()!,{
      auth:{persistSession:false,autoRefreshToken:false}
    })
    const auth=await db.auth.getUser(bearer.slice(7))
    if(auth.error||!auth.data.user)return json({error:'Sessão inválida. Entre novamente.'},401,cors)
    const actor=auth.data.user.id

    const [profile,permission]=await Promise.all([
      db.from('profiles').select('ativo').eq('id',actor).maybeSingle(),
      db.from('usuario_permissoes').select('nivel').eq('user_id',actor).eq('modulo','clientes').maybeSingle()
    ])
    if(profile.error||!profile.data?.ativo)return json({error:'Usuário sem acesso ativo.'},403,cors)
    if(permission.error||permission.data?.nivel!=='editar')return json({error:'Sem permissão para editar clientes.'},403,cors)

    const body=await req.json()
    const cnpj=clean(body?.cnpj).replace(/[^0-9A-Za-z]/g,'').toUpperCase()
    if(!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj))return json({error:'Informe um CNPJ válido com 14 caracteres.'},400,cors)

    let companyResponse:Response
    try{
      companyResponse=await fetch('https://brasilapi.com.br/api/cnpj/v1/'+encodeURIComponent(cnpj),{
        headers:{Accept:'application/json','User-Agent':'ERP-Sistema-de-Gestao/1.0'},
        signal:AbortSignal.timeout(8000)
      })
    }catch{
      return json({error:'O serviço de consulta de CNPJ não respondeu. Tente novamente.'},503,cors)
    }

    if(companyResponse.status===400||companyResponse.status===404)return json({error:'CNPJ não encontrado ou inválido.'},404,cors)
    if(companyResponse.status===429)return json({error:'Limite temporário de consultas atingido. Tente novamente em instantes.'},429,cors)
    if(!companyResponse.ok)return json({error:'Consulta de CNPJ temporariamente indisponível.'},503,cors)

    const company=await companyResponse.json() as BrasilApiCnpj
    const uf=clean(company.uf).toUpperCase()
    const municipio=clean(company.municipio)
    let codigoIbge=''

    if(/^[A-Z]{2}$/.test(uf)&&municipio){
      try{
        const ibgeResponse=await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/'+encodeURIComponent(uf)+'/municipios',{
          headers:{Accept:'application/json'},
          signal:AbortSignal.timeout(7000)
        })
        if(ibgeResponse.ok){
          const municipios=await ibgeResponse.json() as IbgeMunicipio[]
          const target=normalize(municipio)
          const found=municipios.find(item=>normalize(item.nome)===target)
          if(found?.id&&/^\d{7}$/.test(String(found.id)))codigoIbge=String(found.id)
        }
      }catch{/* Endereço continua útil mesmo se o IBGE estiver temporariamente indisponível. */}
    }

    return json({
      cnpj:clean(company.cnpj)||cnpj,
      razao_social:clean(company.razao_social),
      nome_fantasia:clean(company.nome_fantasia),
      email:clean(company.email),
      telefone:clean(company.ddd_telefone_1)||clean(company.ddd_telefone_2),
      logradouro:clean(company.logradouro),
      numero:clean(company.numero),
      bairro:clean(company.bairro),
      municipio,
      codigo_ibge:codigoIbge,
      uf,
      cep:clean(company.cep).replace(/\D/g,'').slice(0,8),
      situacao_cadastral:clean(company.descricao_situacao_cadastral)
    },200,cors)
  }catch(error){
    return json({error:error instanceof Error?error.message:'Não foi possível consultar o CNPJ.'},400,cors)
  }
})
