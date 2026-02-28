"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { useState, Suspense, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wine, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

const SESSION_LOAD_TIMEOUT_MS = 2500

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [sessionLoadTimedOut, setSessionLoadTimedOut] = useState(false)
  const callbackUrl = searchParams.get("callbackUrl") || "/catha"
  const error = searchParams.get("error")
  const hasRedirected = useRef(false)

  useEffect(() => {
    document.title = "Catha Lounge | Sign In"
  }, [])

  // Set server-side cookie to indicate this is a bar user sign-in
  useEffect(() => {
    fetch('/api/auth/bar-setup').catch(console.error)
    document.cookie = "auth_context=bar; path=/; max-age=3600" // 1 hour
  }, [])

  // If session check hangs, show login form after timeout
  useEffect(() => {
    if (status !== "loading") return
    const t = setTimeout(() => setSessionLoadTimedOut(true), SESSION_LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [status])

  // Redirect authenticated bar users to their destination
  useEffect(() => {
    if (hasRedirected.current) {
      console.log(`[Login Catha] Already redirected, skipping`)
      return
    }
    if (error) {
      console.log(`[Login Catha] Error present (${error}), not redirecting`)
      return
    }
    if (status === "loading" && !sessionLoadTimedOut) {
      console.log(`[Login Catha] Session still loading, waiting...`)
      return
    }
    
    // Only proceed if we have a fully loaded session
    if (status === "authenticated" && session?.user) {
      const userCollection = (session.user as { userCollection?: string }).userCollection
      console.log(`[Login Catha] Session authenticated - userCollection: ${userCollection}, email: ${session.user.email}, role: ${session.user.role}`)
      
      // CRITICAL: Only redirect BAR users. Jaba users should NEVER be redirected to /catha routes
      if (userCollection === "jaba") {
        console.log(`[Login Catha] ❌ BLOCKED: Jaba user (${session.user.email}) trying to access Catha login. Clearing session and redirecting to Jaba.`)
        signOut({ callbackUrl: "/jaba/login" })
        return
      }
      
      // Only redirect if userCollection is explicitly "bar"
      if (userCollection === "bar") {
        let url = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`
        // Prevent redirect loop: don't redirect to login page itself
        if (url === "/catha/login" || url.startsWith("/catha/login?")) {
          url = "/catha"
        }
        // Redirect to first allowed page if user doesn't have permission for callbackUrl
        const routePermissions = (session.user as { routePermissions?: string[] })?.routePermissions
        const role = session.user.role
        const hasAccess = role === "super_admin" || (routePermissions && routePermissions.some(
          (r) => url === r || url.startsWith(r + "/")
        ))
        if (!hasAccess && routePermissions && routePermissions.length > 0) {
          url = routePermissions[0]
          console.log(`[Login Catha] CallbackUrl not permitted, redirecting to first allowed: ${url}`)
        } else if (!hasAccess) {
          url = "/catha"
        }
        if (!hasRedirected.current) {
          hasRedirected.current = true
          console.log(`[Login Catha] ✅ Redirecting authenticated Bar user to: ${url}`)
          router.replace(url)
        }
      } else {
        console.log(`[Login Catha] ⚠️ User collection is "${userCollection}" (not "bar"), not redirecting. Middleware will handle.`)
        // If userCollection is undefined, the session might not be fully loaded yet
        // Wait a bit and let the session callback set it
        if (!userCollection && status === "authenticated") {
          console.log(`[Login Catha] ⚠️ Session authenticated but userCollection is undefined. This might be a timing issue.`)
        }
      }
    } else if (status === "unauthenticated") {
      console.log(`[Login Catha] User is not authenticated, showing login form`)
    }
  }, [session, status, sessionLoadTimedOut, callbackUrl, router, error])

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      // Pass callbackUrl - middleware redirects to first allowed page if user lacks permission
      const url = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`
      const safeCallback = (url === "/catha/login" || url.startsWith("/catha/login?")) ? "/catha" : url
      await signIn("google", {
        callbackUrl: safeCallback,
        redirect: true,
      })
    } catch (error) {
      console.error("Sign in error:", error)
      setIsLoading(false)
    }
  }

  const getErrorMessage = () => {
    switch (error) {
      case "AccessDenied":
        return "Sign-in blocked: MongoDB connection failed. Users cannot be saved to the database. Please fix the MongoDB connection before signing in."
      case "Configuration":
        return "There is a problem with the server configuration. Please contact support."
      case "Verification":
        return "The verification token has expired or has already been used."
      default:
        return "An error occurred during sign in. Please check the server logs for details."
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 flex-col justify-between p-12 text-white/90">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="rounded-xl p-2.5 bg-amber-500/20 border border-amber-400/30">
              <Wine className="h-8 w-8 text-amber-300" strokeWidth={1.5} />
            </div>
            <span className="font-serif text-xl tracking-wide">Catha Lounge</span>
          </div>
          <h1 className="font-serif text-4xl font-medium tracking-tight leading-tight max-w-sm">
            Restaurant & Bar
          </h1>
          <p className="mt-4 text-amber-200/80 text-lg max-w-sm font-light">
            Sign in to manage your orders, menu, and operations.
          </p>
        </div>
        <p className="text-sm text-stone-500">© Catha Lodge</p>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-b from-stone-50 to-amber-50/30 min-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="rounded-xl p-2.5 bg-amber-500/15 border border-amber-400/20">
              <Wine className="h-7 w-7 text-amber-700" strokeWidth={1.5} />
            </div>
            <span className="font-serif text-xl text-stone-800 tracking-wide">Catha Lounge</span>
          </div>

          <Card className="border-0 shadow-xl shadow-amber-900/5 bg-white/95 backdrop-blur-sm overflow-hidden">
            <CardHeader className="text-center pb-2 lg:pb-2">
              <CardTitle className="font-serif text-2xl sm:text-3xl font-medium text-stone-800 tracking-tight">
                Welcome back
              </CardTitle>
              <CardDescription className="text-stone-500 mt-1">
                Sign in to access the restaurant & bar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {error && (
                <div className="rounded-lg bg-red-50/90 border border-red-200/80 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-red-800 mb-1">Sign In Error</h3>
                      <p className="text-sm text-red-700">{getErrorMessage()}</p>
                    </div>
                  </div>
                </div>
              )}
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 border-2 border-[#34A853] bg-[#34A853] hover:bg-[#2d9249] hover:border-[#2d9249] text-white hover:text-white font-medium transition-colors shadow-sm"
              >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </span>
            )}
          </Button>
          <div className="text-center text-sm text-stone-600 pt-1">
            Don&apos;t have an account?{" "}
            <Link href="/catha/signup" className="text-amber-700 hover:text-amber-800 font-medium transition-colors">
              Sign up
            </Link>
          </div>
          <p className="text-xs text-center text-stone-400 pt-2">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          <p className="text-stone-500">Loading...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

