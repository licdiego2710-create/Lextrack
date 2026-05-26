import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import { ToastProvider } from './context/ToastContext'
import { OrgProvider, useOrg } from './context/OrgContext'
import { ThemeProvider } from './context/ThemeContext'

import Layout from './components/layout/Layout'
import Landing      from './pages/Landing'
import Dashboard    from './pages/Dashboard'
import Expedientes  from './pages/Expedientes'
import Demandas     from './pages/Demandas'
import Estadisticas from './pages/Estadisticas'
import Tareas       from './pages/Tareas'
import Agenda       from './pages/Agenda'
import Plazos       from './pages/Plazos'
import Documentos   from './pages/Documentos'
import Partes       from './pages/Partes'
import Usuarios     from './pages/Usuarios'
import Bitacora     from './pages/Bitacora'
import Prospectos      from './pages/Prospectos'
import BuscadorPartes  from './pages/BuscadorPartes'
import Billing         from './pages/Billing'
import Configuracion   from './pages/Configuracion'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Splash/>

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing/>}/>
            <Route path="/auth" element={!session ? <Auth/> : <Navigate to="/app/dashboard" replace/>}/>
            <Route
              path="/app/*"
              element={
                session
                  ? <OrgProvider session={session}>
                      <AppGate session={session}/>
                    </OrgProvider>
                  : <Navigate to="/auth" replace/>
              }
            />
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}

function AppGate({ session }) {
  const { loading } = useOrg()
  if (loading) return <Splash/>
  return <AppLayout session={session}/>
}

function AppLayout({ session }) {
  const { miembro } = useOrg()
  const isCliente = miembro?.rol === 'cliente'

  return (
    <Layout session={session}>
      <Routes>
        <Route path="dashboard"    element={<Dashboard    session={session}/>} />
        <Route path="expedientes"  element={<Expedientes  session={session}/>} />
        <Route path="documentos"   element={<Documentos/>} />

        {!isCliente && (
          <>
            <Route path="demandas"     element={<Demandas     session={session}/>} />
            <Route path="estadisticas" element={<Estadisticas session={session}/>} />
            <Route path="tareas"       element={<Tareas       session={session}/>} />
            <Route path="agenda"       element={<Agenda       session={session}/>} />
            <Route path="plazos"       element={<Plazos/>} />
            <Route path="partes"       element={<Partes/>} />
            <Route path="usuarios"     element={<Usuarios     session={session}/>} />
            <Route path="facturacion"  element={<Billing      session={session}/>} />
            <Route path="bitacora"     element={<Bitacora/>} />
            <Route path="prospectos"      element={<Prospectos      session={session}/>} />
            <Route path="buscador-partes" element={<BuscadorPartes  session={session}/>} />
            <Route path="configuracion"   element={<Configuracion/>} />
          </>
        )}

        <Route index element={<Navigate to="dashboard" replace/>} />
        <Route path="*" element={<Navigate to="dashboard" replace/>} />
      </Routes>
    </Layout>
  )
}

function Splash() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0f172a',
      color: '#60a5fa', fontFamily: 'system-ui, sans-serif',
      letterSpacing: '3px', fontSize: 18, fontWeight: 700,
    }}>
      LEXTRACK MX
    </div>
  )
}
