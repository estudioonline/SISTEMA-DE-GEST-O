import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

const rememberKey='sg-auth-remember'

function browserStorage(){
  const hasWindow=typeof window!=='undefined'
  return {
    getItem(key:string){
      if(!hasWindow)return null
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    },
    setItem(key:string,value:string){
      if(!hasWindow)return
      const remember=window.localStorage.getItem(rememberKey)==='1'
      if(remember){
        window.localStorage.setItem(key,value)
        window.sessionStorage.removeItem(key)
      }else{
        window.sessionStorage.setItem(key,value)
        window.localStorage.removeItem(key)
      }
    },
    removeItem(key:string){
      if(!hasWindow)return
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    }
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder',
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      storage:browserStorage()
    }
  }
)
