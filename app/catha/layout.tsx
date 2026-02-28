"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

function BarLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)

  // Set page title for all /catha pages
  useEffect(() => {
    document.title = "Catha Lounge | Restaurant & Bar"
  }, [])

  // Check authentication on mount and when session changes
  useEffect(() => {
    // Allow access to login, signup, waiting, unauthorized, and pending-approval pages (standalone pages without sidebar)
    if (pathname === "/catha/login" || pathname === "/catha/signup" || pathname === "/catha/pending-approval" || pathname === "/catha/waiting" || pathname === "/catha/unauthorized") {
      setMounted(true)
      return
    }

    // Wait for session to load
    if (status === 'loading') {
      console.log(`[Catha Layout] Waiting for session to load for ${pathname}`)
      return
    }

    // If no session, redirect to login (middleware should handle this, but just in case)
    if (!session?.user) {
      console.log(`[Catha Layout] No session found for ${pathname}, redirecting to login`)
      router.push('/catha/login')
      return
    }

    // Check user collection - only bar users should access catha routes
    const userCollection = (session.user as { userCollection?: string }).userCollection
    if (userCollection !== "bar") {
      console.log(`[Catha Layout] User collection is "${userCollection}" (not "bar"), redirecting to login`)
      router.push('/catha/login')
      return
    }

    // User is authenticated and is a bar user, allow access
    console.log(`[Catha Layout] ✅ Authenticated bar user, allowing access to ${pathname}`)
    setMounted(true)
  }, [session, status, pathname, router])

  // Show loading state while checking authentication
  if (!mounted || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render sidebar for login, signup, waiting, unauthorized, or pending-approval (standalone pages)
  if (pathname === "/catha/login" || pathname === "/catha/signup" || pathname === "/catha/pending-approval" || pathname === "/catha/waiting" || pathname === "/catha/unauthorized") {
    return <>{children}</>
  }

  // Render full layout for authenticated users
  return (
    <div className="flex h-screen min-h-0 bg-background overflow-x-hidden">
      <Sidebar />
      {/* Desktop (1280px+): padding for sidebar, Tablet/iPad Pro: no padding (sidebar is overlay) */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden pos-scroll xl:pl-64">
        {children}
      </main>
    </div>
  )
}

export default function BarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // SessionProvider is already provided in root layout, no need to nest it
  return <BarLayoutContent>{children}</BarLayoutContent>
}

