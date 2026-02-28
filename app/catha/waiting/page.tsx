"use client"

import { useSession, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Shield, Mail, AlertCircle, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function WaitingPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [refreshCountdown, setRefreshCountdown] = useState(30)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if user should be redirected (super_admin or approved admin with permissions)
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = session.user.role
      const approved = (session.user as any).approved
      const routePermissions = (session.user as any).routePermissions
      
      // Super admin should NEVER be on waiting page
      if (role === "super_admin") {
        router.replace("/catha")
        return
      }
      
      // Approved cashier/manager with permissions → redirect to first allowed page
      if ((role === "cashier_admin" || role === "manager_admin") && approved && routePermissions?.length) {
        router.replace(routePermissions[0] || "/catha")
        return
      }
      // Otherwise stay on waiting until authorized AND given permissions
    }
  }, [session, status, router])

  // Auto-refresh session every 30 seconds
  useEffect(() => {
    if (status === "authenticated" && session?.user && !isRefreshing) {
      const interval = setInterval(async () => {
        setIsRefreshing(true)
        try {
          await update() // Refresh session to check for approval
        } catch (error) {
          console.error("Error refreshing session:", error)
        } finally {
          setIsRefreshing(false)
        }
      }, 30000) // 30 seconds

      return () => clearInterval(interval)
    }
  }, [status, session, update, isRefreshing])

  // Countdown timer
  useEffect(() => {
    if (status === "authenticated" && !isRefreshing) {
      const timer = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            return 30
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [status, isRefreshing])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-stone-600 dark:text-stone-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <Card className="max-w-md w-full border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 shadow-xl">
          <CardHeader>
            <CardTitle>Session required</CardTitle>
            <CardDescription>Please sign in to view this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/catha/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshCountdown(30)
    try {
      // Force a complete session refresh
      await update() // This triggers JWT callback with trigger='update' to refresh from database
      
      // Wait a bit for the token to update, then check session
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Force a hard reload to get fresh token from middleware
      window.location.href = "/catha"
    } catch (error) {
      console.error("Error refreshing:", error)
      setIsRefreshing(false)
    }
  }
  
  // Also add a "Force Re-login" button for when token is completely broken
  const handleForceRelogin = () => {
    // Clear all auth cookies and force re-login
    document.cookie = "authjs.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = "__Secure-authjs.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = "next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = "__Secure-next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    window.location.href = "/catha/login"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-amber-100 dark:bg-amber-950/30 w-20 h-20 flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-stone-900 dark:text-stone-50">
            Your account is under review
          </CardTitle>
          <CardDescription className="text-base mt-2 text-stone-600 dark:text-stone-400">
            Stay here until you are authorized and given permissions by an administrator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Account Status
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                  Your account is pending approval. A super administrator must authorize you and assign the necessary permissions before you can access the app.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Signed in as
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 font-mono">
                  {session.user.email}
                </p>
                {session.user.role && (
                  <p className="text-xs text-stone-500 dark:text-stone-500 mt-1">
                    Role: <span className="font-medium capitalize">{session.user.role}</span>
                    {(session.user as any).approved && (
                      <span className="ml-2 text-green-600 dark:text-green-400">✓ Approved</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {!isRefreshing && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <RefreshCw className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Auto-refreshing in {refreshCountdown} seconds to check for approval...
                </p>
              </div>
            )}

            {isRefreshing && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Refreshing session and checking for approval...
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </Button>
            <Button
              variant="default"
              className="gap-2"
              onClick={handleForceRelogin}
              disabled={isRefreshing}
            >
              <AlertCircle className="h-4 w-4" />
              Force Re-login
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => signOut({ callbackUrl: "/catha/login" })}
              disabled={isRefreshing}
            >
              <AlertCircle className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
