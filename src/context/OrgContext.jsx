/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const OrgContext = createContext(null)

function generarSlug(nombre) {
  return nombre.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function OrgProvider({ session, children }) {
  const [org, setOrg]         = useState(null)
  const [miembro, setMiembro] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!session?.user) { setLoading(false); return }
    setLoading(true)

    // Sincronizar perfil de usuario
    try {
      await supabase.from('user_profiles').upsert({
        id: session.user.id,
        email: session.user.email,
        nombre: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
        actualizado_en: new Date().toISOString()
      })
    } catch (e) {
      console.error('Error al sincronizar perfil de usuario:', e)
    }

    // 1. Buscar despacho existente
    const { data } = await supabase
      .from('despacho_miembros')
      .select('id, rol, despacho:despachos(id, nombre, slug, plan, owner_id)')
      .eq('user_id', session.user.id)
      .eq('activo', true)
      .maybeSingle()

    if (data?.despacho) {
      setOrg(data.despacho)
      setMiembro({ id: data.id, rol: data.rol })
      setLoading(false)
      return
    }

    // 2. No tiene despacho → auto-crear con nombre por defecto
    const nombre =
      session.user.user_metadata?.full_name ||
      session.user.email?.split('@')[0] ||
      'Mi Despacho'

    const { data: desp, error } = await supabase
      .from('despachos')
      .insert({ nombre, owner_id: session.user.id, slug: generarSlug(nombre) })
      .select()
      .single()

    if (!error && desp) {
      const { data: mem } = await supabase
        .from('despacho_miembros')
        .insert({ despacho_id: desp.id, user_id: session.user.id, rol: 'admin' })
        .select('id, rol')
        .single()

      // Migrar datos existentes al nuevo despacho
      await supabase.rpc('migrar_datos_a_despacho', { p_despacho_id: desp.id })

      setOrg(desp)
      setMiembro({ id: mem?.id, rol: 'admin' })
    }

    setLoading(false)
  }, [session])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  const isAdmin  = miembro?.rol === 'admin'
  const canWrite = miembro?.rol === 'admin' || miembro?.rol === 'abogado'

  return (
    <OrgContext.Provider value={{ org, miembro, isAdmin, canWrite, loading, refetch: cargar }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg debe usarse dentro de <OrgProvider>')
  return ctx
}
