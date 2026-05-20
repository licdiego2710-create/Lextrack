import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import { ToastProvider } from './context/ToastContext'

import Layout from './components/layout/Layout'

import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Expedientes from './pages/Expedientes'
import Demandas from './pages/Demandas'
import Estadisticas from './pages/Estadisticas'
import Tareas from './pages/Tareas'
import Agenda from './pages/Agenda'
import Plazos from './pages/Plazos'
import Documentos from './pages/Documentos'
import Partes from './pages/Partes'
import Usuarios from './pages/Usuarios'
import Bitacora from './pages/Bitacora'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Inicializa el tema desde localStorage (la Landing es pública pero el resto respeta el modo).
    try {
      const stored = localStorage.getItem('lextrack_theme') || 'light'
      document.documentElement.setAttribute('data-theme', stored)
    } catch { /* ignore */ }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#60a5fa',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '3px',
        fontSize: 18,
        fontWeight: 700,
      }}>
        LEXTRACK MX
      </div>
    )
  }

  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing/>}/>
        <Route path="/auth" element={!session ? <Auth/> : <Navigate to="/app/dashboard" replace/>}/>
        <Route path="/app/*" element={session ? <AppLayout session={session}/> : <Navigate to="/auth" replace/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}

function AppLayout({ session }) {
  return (
    <Layout session={session}>
      <Routes>
        <Route path="dashboard"    element={<Dashboard session={session}/>} />
        <Route path="expedientes"  element={<Expedientes session={session}/>} />
        <Route path="demandas"     element={<Demandas session={session}/>} />
        <Route path="estadisticas" element={<Estadisticas session={session}/>} />
        <Route path="tareas"       element={<Tareas session={session}/>} />
        <Route path="agenda"       element={<Agenda session={session}/>} />
        <Route path="plazos"       element={<Plazos/>} />
        <Route path="documentos"   element={<Documentos/>} />
        <Route path="partes"       element={<Partes/>} />
        <Route path="usuarios"     element={<Usuarios session={session}/>} />
        <Route path="bitacora"     element={<Bitacora/>} />
        <Route index element={<Navigate to="dashboard" replace/>} />
        <Route path="*" element={<Navigate to="dashboard" replace/>} />
      </Routes>
    </Layout>
  )
}
