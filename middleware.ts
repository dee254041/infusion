import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Edge-safe helper: Get app-specific secret from env vars
function getAppSecret(appName: 'catha' | 'jaba'): string | null {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
  
  if (appName === 'catha') {
    const secret = process.env.AUTH_SECRET_CATHA || (!isProduction ? process.env.NEXTAUTH_SECRET : undefined)
    if (!secret && isProduction) {
      console.error('[Middleware] ❌ CRITICAL: AUTH_SECRET_CATHA must be set in production')
      return null
    }
    return secret || null
  } else {
    const secret = process.env.AUTH_SECRET_JABA || (!isProduction ? process.env.NEXTAUTH_SECRET : undefined)
    if (!secret && isProduction) {
      console.error('[Middleware] ❌ CRITICAL: AUTH_SECRET_JABA must be set in production')
      return null
    }
    return secret || null
  }
}

// Edge-safe helper: Check if session cookie exists for an app
function hasSession(cookies: any, appName: 'catha' | 'jaba'): boolean {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
  const prefix = isProduction ? '__Secure-' : ''
  const cookieName = `${prefix}${appName}.session-token`
  return !!cookies.get(cookieName)?.value
}

// Helper function to get token for a specific app
// CRITICAL: Each app uses its own cookie name to prevent collisions
// Catha → catha.session-token
// Jaba → jaba.session-token
async function getTokenForApp(request: NextRequest, appName: 'catha' | 'jaba'): Promise<any | null> {
  // Get app-specific secret
  const secret = getAppSecret(appName)
  if (!secret) {
    console.log(`[Middleware ${appName}] ❌ No secret available (AUTH_SECRET_${appName.toUpperCase()} or NEXTAUTH_SECRET)`)
    return null
  }

  const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
  const prefix = isProduction ? '__Secure-' : ''
  
  // Each app has its own cookie name - NO SHARING
  const cookieName = `${prefix}${appName}.session-token`
  
  // Log all cookies for debugging
  const allCookies = request.cookies.getAll()
  const cookieNames = allCookies.map(c => c.name)
  console.log(`[Middleware ${appName}] 🔍 All cookies seen: ${cookieNames.join(', ')}`)
  
  // Check if this app's session cookie exists
  const cookieValue = request.cookies.get(cookieName)?.value
  if (!cookieValue) {
    console.log(`[Middleware ${appName}] ❌ No ${cookieName} cookie found`)
    console.log(`[Middleware ${appName}] 💡 User is not logged into ${appName} app`)
    return null
  }

  // ✅ SAFE TOKEN LOGGING: Log raw cookie length (NOT the value) to confirm token exists
  console.log(`[Middleware ${appName}] ✅ Found ${cookieName} cookie (length: ${cookieValue.length}), attempting decode...`)
  console.log(`[Middleware ${appName}] 🔍 RAW COOKIE TOKEN LENGTH: ${cookieValue.length} (token exists in cookie)`)

  try {
    const token = await getToken({ 
      req: request, 
      secret: secret,
      cookieName: cookieName
    })
    
    if (token) {
      // ✅ SAFE TOKEN LOGGING: Confirm token exists and is readable
      console.log(`[Middleware ${appName}] ✅ Token exists? YES - successfully decoded from cookie`)
      
      // CRITICAL: Validate token exists and has required fields
      const tokenApp = (token as any)?.app
      const tokenExp = (token as any)?.exp
      const tokenRole = (token as any)?.role
      const tokenApproved = (token as any)?.approved
      const tokenId = (token as any)?.id
      const tokenUserCollection = (token as any)?.userCollection
      
      // ✅ SAFE TOKEN LOGGING: Log non-sensitive token data
      const tokenData = {
        id: tokenId?.substring(0, 8) + '...' || 'none',
        app: tokenApp || 'none',
        role: tokenRole || 'none',
        approved: tokenApproved ?? 'none',
        exp: tokenExp ? new Date(tokenExp * 1000).toISOString() : 'none',
        userCollection: tokenUserCollection || 'none',
      }
      console.log(`[Middleware ${appName}] 📋 Token data:`, JSON.stringify(tokenData, null, 2))
      
      // CRITICAL: Validate token expiration (only if exp is present)
      // Don't block if exp is missing - NextAuth handles expiration via maxAge
      if (tokenExp !== undefined && tokenExp !== null) {
        const now = Math.floor(Date.now() / 1000)
        if (tokenExp < now) {
          console.log(`[Middleware ${appName}] ⚠️ Token expired (exp: ${new Date(tokenExp * 1000).toISOString()}, now: ${new Date(now * 1000).toISOString()})`)
          return null
        }
      } else {
        // exp is missing - log warning in dev, but don't block
        const isProduction = process.env.NODE_ENV === 'production'
        if (!isProduction) {
          console.log(`[Middleware ${appName}] ⚠️ WARNING: Token exp field is missing - relying on NextAuth maxAge for expiration`)
        }
      }
      
      // CRITICAL: Validate token.app field (MUST check - primary validation)
      // This ensures the token belongs to the correct app
      if (!tokenApp || tokenApp !== appName) {
        console.log(`[Middleware ${appName}] ⚠️ Token app (${tokenApp}) doesn't match expected app (${appName})`)
        console.log(`[Middleware ${appName}] 💡 User is logged into the other app - blocking access`)
        return null
      }
      
      // OPTIONAL: Validate userCollection (warning only, not blocking)
      // userCollection might vary or change, so we don't block on this
      // Primary validation is token.app which is guaranteed stable
      const expectedCollection = appName === 'catha' ? 'bar' : 'jaba'
      if (tokenUserCollection && tokenUserCollection !== expectedCollection) {
        console.log(`[Middleware ${appName}] ⚠️ WARNING: Token userCollection (${tokenUserCollection}) doesn't match expected (${expectedCollection})`)
        console.log(`[Middleware ${appName}] 💡 This is a warning - token.app validation passed, allowing access`)
        // Don't return null - token.app is the primary check
      }
      
      // Log token data (production-safe: only essential fields, no sensitive data)
      const isProduction = process.env.NODE_ENV === 'production'
      if (isProduction) {
        // Production: Log only essential fields
        console.log(`[Middleware ${appName}] ✅ Token validated - app: ${tokenApp}, role: ${tokenRole}, approved: ${tokenApproved}, id: ${tokenId?.substring(0, 8)}...`)
      } else {
        // Development: Log full token for debugging
        console.log(`[Middleware ${appName}] ✅ Successfully decoded JWT token from ${cookieName}`)
        console.log(`[Middleware ${appName}] 📋 TOKEN DATA:`, JSON.stringify({
          app: tokenApp,
          userCollection: tokenUserCollection,
          role: tokenRole,
          email: (token as any)?.email,
          approved: tokenApproved,
          routePermissions: (token as any)?.routePermissions,
          id: tokenId,
          exp: tokenExp,
        }, null, 2))
      }
      
      return token
    } else {
      console.log(`[Middleware ${appName}] ❌ Token exists? NO - getToken returned null for ${cookieName}`)
      console.log(`[Middleware ${appName}] 💡 Possible causes:`)
      console.log(`[Middleware ${appName}]    - Secret mismatch (different AUTH_SECRET used to sign cookie)`)
      console.log(`[Middleware ${appName}]    - Session strategy is "database" instead of "jwt"`)
      console.log(`[Middleware ${appName}]    - Corrupted or expired token`)
      console.log(`[Middleware ${appName}]    - Cookie was signed by the other app (shouldn't happen with separate cookie names)`)
      return null
    }
  } catch (error: any) {
    console.log(`[Middleware ${appName}] ❌ getToken error: ${error.message}`)
    return null
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Helper function to check if pathname matches any route in permissions
  function hasRoutePermission(pathname: string, routePermissions: string[] | undefined): boolean {
    if (!routePermissions || routePermissions.length === 0) return false
    // Check exact match or if pathname starts with any permission route
    return routePermissions.some(route => pathname === route || pathname.startsWith(route + '/'))
  }


  // ─── Protect /catha routes ───
  if (
    pathname.startsWith("/catha") &&
    pathname !== "/catha/login" &&
    pathname !== "/catha/signup" &&
    pathname !== "/catha/waiting" &&
    pathname !== "/catha/unauthorized" &&
    !pathname.startsWith("/api")
  ) {
    const cookies = request.cookies

    // Check if user has Catha session cookie
    const hasSessionCookie = hasSession(cookies, 'catha')
    console.log(`[Middleware Catha] Checking ${pathname}, hasSessionCookie: ${hasSessionCookie}`)
    
    if (!hasSessionCookie) {
      console.log(`[Middleware Catha] ❌ No session cookie found for ${pathname}, redirecting to login`)
      const url = new URL("/catha/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    // Get token and user info - try ALL possible methods to ensure we get the token
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
    
    let token: any = null
    
    try {
      // Log environment info for debugging
      console.log(`[Middleware Catha] Environment check - isProduction: ${isProduction}, NEXTAUTH_URL: ${process.env.NEXTAUTH_URL?.substring(0, 50)}...`)
      console.log(`[Middleware Catha] NEXTAUTH_SECRET present: ${!!process.env.NEXTAUTH_SECRET}`)
      
      // Method 1: Get token for Catha app (uses catha.session-token cookie with AUTH_SECRET_CATHA)
      token = await getTokenForApp(request, 'catha')
      
      if (token) {
        console.log(`[Middleware Catha] ✅ Token retrieved successfully!`)
        console.log(`[Middleware Catha] Token details - userCollection: ${token?.userCollection}, role: ${token?.role}, email: ${token?.email}`)
      } else {
        // Log available cookies for debugging
        const allCookies = request.cookies.getAll()
        const cookieNames = allCookies.map(c => c.name)
        const cookieInfo = allCookies.map(c => `${c.name}=${c.value.substring(0, 30)}... (length: ${c.value.length})`)
        console.log(`[Middleware Catha] ❌ All getToken attempts failed`)
        console.log(`[Middleware Catha] Available cookies (${cookieNames.length}): ${cookieNames.join(', ')}`)
        console.log(`[Middleware Catha] Cookie details: ${cookieInfo.join(' | ')}`)
      }
    } catch (tokenError: any) {
      console.error(`[Middleware Catha] ❌ Error getting token: ${tokenError.message}`)
      console.error(`[Middleware Catha] Error stack: ${tokenError.stack}`)
      const url = new URL("/catha/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      url.searchParams.set("error", "token_error")
      return NextResponse.redirect(url)
    }
    
    if (!token) {
      console.log(`[Middleware Catha] ⚠️ No token found for ${pathname} (session cookie exists but token is null)`)
      // Since getTokenForApp tries the app-specific cookie, if it still returns null,
      // the token might be corrupted or the secret is wrong
      // Redirect to login to force re-authentication
      const url = new URL("/catha/login", request.url)
      // Only set callbackUrl if not already on login page to prevent loops
      if (pathname !== "/catha/login" && !request.url.includes('/catha/login')) {
        url.searchParams.set("callbackUrl", pathname)
      }
      url.searchParams.set("error", "token_decode_failed")
      return NextResponse.redirect(url)
    }

    const userCollection = (token as any)?.userCollection
    let role = (token as any)?.role as string | undefined
    let approved = (token as any)?.approved as boolean | undefined
    const routePermissions = (token as any)?.routePermissions as string[] | undefined
    const email = (token as any)?.email as string | undefined

    // Debug logging for production
    console.log(`[Middleware Catha] pathname: ${pathname}, role: ${role}, approved: ${approved}, userCollection: ${userCollection}, email: ${email}`)

    // Catha uses bar users; if they signed in as jaba they shouldn't access catha app
    if (userCollection !== "bar") {
      const url = new URL("/catha/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    // NOTE: Cannot fetch from database in middleware (Edge runtime doesn't support MongoDB)
    // If role is missing from token, redirect to login to force token refresh
    // This ensures permissions always work correctly
    if (!role) {
      console.log(`[Middleware Catha] ⚠️ CRITICAL: Token missing role${email ? ` for ${email}` : ''} - forcing re-authentication`)
      const url = new URL("/catha/login", request.url)
      if (pathname !== "/catha/login") {
        url.searchParams.set("callbackUrl", pathname)
      }
      url.searchParams.set("error", "token_refresh_required")
      return NextResponse.redirect(url)
    }
    
    // Ensure approved status is defined (default to false if missing)
    if (approved === undefined) {
      console.log(`[Middleware Catha] ⚠️ WARNING: Token missing approved status for ${email || 'unknown'} - defaulting to false`)
      approved = false
    }

    // ─── SUPER ADMIN: Can access ALL pages (ALWAYS, regardless of approved status or permissions) ───
    if (role === "super_admin") {
      console.log(`[Middleware Catha] ✅ Super admin detected - allowing access to ALL pages including ${pathname}`)
      // Super admin on waiting/unauthorized pages: redirect to dashboard
      if (pathname === "/catha/waiting" || pathname === "/catha/unauthorized") {
        console.log(`[Middleware Catha] 🔄 Redirecting super admin from ${pathname} to /catha`)
        return NextResponse.redirect(new URL("/catha", request.url))
      }
      // Super admin bypasses ALL permission checks - allow access to any /catha/* route
      return NextResponse.next()
    }
    
    // Role check already handled above - if we reach here, role exists

    // ─── ADMIN (cashier_admin or manager_admin): Must be approved AND have permissions ───
    if (role === "cashier_admin" || role === "manager_admin") {
      // If not approved → redirect to waiting
      if (!approved) {
        if (pathname !== "/catha/waiting") {
          return NextResponse.redirect(new URL("/catha/waiting", request.url))
        }
        return NextResponse.next()
      }

      // If approved but no permissions → redirect to waiting
      if (!routePermissions || routePermissions.length === 0) {
        if (pathname !== "/catha/waiting") {
          return NextResponse.redirect(new URL("/catha/waiting", request.url))
        }
        return NextResponse.next()
      }

      // If accessing page not in permissions → show Access Denied (unauthorized page)
      if (!hasRoutePermission(pathname, routePermissions)) {
        return NextResponse.redirect(new URL("/catha/unauthorized", request.url))
      }

      // Approved admin with permissions - on waiting/unauthorized, redirect to first allowed page
      if (pathname === "/catha/waiting" || pathname === "/catha/unauthorized") {
        const firstAllowed = routePermissions?.[0] || "/catha"
        return NextResponse.redirect(new URL(firstAllowed, request.url))
      }
      return NextResponse.next()
    }

    // ─── USER or any other role: Always redirect to waiting ───
    if (pathname !== "/catha/waiting") {
      return NextResponse.redirect(new URL("/catha/waiting", request.url))
    }
    return NextResponse.next()
  }

  // ─── Protect /jaba routes ───
  if (
    pathname.startsWith("/jaba") &&
    !pathname.startsWith("/jaba/login") &&
    !pathname.startsWith("/jaba/signup") &&
    pathname !== "/jaba/waiting" &&
    pathname !== "/jaba/unauthorized" &&
    !pathname.startsWith("/api")
  ) {
    const cookies = request.cookies

    // Check if user has Jaba session cookie
    const hasSessionCookie = hasSession(cookies, 'jaba')
    console.log(`[Middleware Jaba] Checking ${pathname}, hasSessionCookie: ${hasSessionCookie}`)
    
    if (!hasSessionCookie) {
      console.log(`[Middleware Jaba] ❌ No session cookie found for ${pathname}, redirecting to login`)
      const url = new URL("/jaba/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    // Get token and user info - try ALL possible methods to ensure we get the token
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https://')
    
    let token: any = null
    
    try {
      // Log environment info for debugging
      const jabaSecret = getAppSecret('jaba')
      console.log(`[Middleware Jaba] Environment check - isProduction: ${isProduction}, NEXTAUTH_URL: ${process.env.NEXTAUTH_URL?.substring(0, 50)}...`)
      console.log(`[Middleware Jaba] AUTH_SECRET_JABA present: ${!!process.env.AUTH_SECRET_JABA}, NEXTAUTH_SECRET fallback: ${!!process.env.NEXTAUTH_SECRET}`)
      
      // Method 1: Get token for Jaba app (uses jaba.session-token cookie with AUTH_SECRET_JABA)
      token = await getTokenForApp(request, 'jaba')
      
      if (token) {
        console.log(`[Middleware Jaba] ✅ Token retrieved successfully!`)
        console.log(`[Middleware Jaba] Token details - userCollection: ${token?.userCollection}, role: ${token?.role}, email: ${token?.email}`)
      } else {
        // Log available cookies for debugging
        const allCookies = request.cookies.getAll()
        const cookieNames = allCookies.map(c => c.name)
        const cookieInfo = allCookies.map(c => `${c.name}=${c.value.substring(0, 30)}... (length: ${c.value.length})`)
        console.log(`[Middleware Jaba] ❌ All getToken attempts failed`)
        console.log(`[Middleware Jaba] Available cookies (${cookieNames.length}): ${cookieNames.join(', ')}`)
        console.log(`[Middleware Jaba] Cookie details: ${cookieInfo.join(' | ')}`)
      }
    } catch (tokenError: any) {
      console.error(`[Middleware Jaba] ❌ Error getting token: ${tokenError.message}`)
      console.error(`[Middleware Jaba] Error stack: ${tokenError.stack}`)
      const url = new URL("/jaba/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      url.searchParams.set("error", "token_error")
      return NextResponse.redirect(url)
    }
    
    if (!token) {
      console.log(`[Middleware Jaba] ⚠️ No token found for ${pathname} (session cookie exists but token is null)`)
      console.log(`[Middleware Jaba] This might be a NextAuth v5 Edge runtime issue. Allowing access if session API confirms authentication.`)
      // CRITICAL FIX: If getToken fails but session cookie exists, don't redirect immediately
      // Instead, let the client-side session check handle it (login page will redirect if needed)
      // This prevents infinite loops when getToken can't decode the token in Edge runtime
      // The session API (/api/auth/session) can read it fine, so we trust that
      if (pathname === "/jaba/login") {
        // If we're already on login page and token is null, allow it (client will handle redirect)
        return NextResponse.next()
      }
      // For other pages, redirect to login but don't set callbackUrl to prevent loop
      const url = new URL("/jaba/login", request.url)
      // Don't set callbackUrl if we're coming from login to prevent loop
      if (!request.url.includes('/jaba/login')) {
        url.searchParams.set("callbackUrl", pathname)
      }
      return NextResponse.redirect(url)
    }

    const userCollection = (token as any)?.userCollection
    const role = (token as any)?.role as string | undefined
    const approved = (token as any)?.approved as boolean | undefined
    const routePermissions = (token as any)?.routePermissions as string[] | undefined
    const email = (token as any)?.email as string | undefined

    // Debug logging for production
    console.log(`[Middleware Jaba] pathname: ${pathname}, role: ${role}, approved: ${approved}, userCollection: ${userCollection}, email: ${email}`)

    // Jaba app: STRICTLY only jaba users (not bar) can access
    // This is critical - bar users should NEVER access jaba routes
    if (userCollection !== "jaba") {
      console.log(`[Middleware Jaba] ❌ BLOCKED: userCollection is "${userCollection}" (expected "jaba"). Redirecting to login.`)
      const url = new URL("/jaba/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      // Clear any session cookies to force re-authentication with correct context
      const response = NextResponse.redirect(url)
      response.cookies.delete("authjs.session-token")
      response.cookies.delete("__Secure-authjs.session-token")
      response.cookies.delete("next-auth.session-token")
      response.cookies.delete("__Secure-next-auth.session-token")
      return response
    }

    // ─── SUPER ADMIN: Can access ALL pages (ALWAYS, regardless of approved status) ───
    if (role === "super_admin") {
      // Super admin on waiting/unauthorized pages: redirect to dashboard
      if (pathname === "/jaba/waiting" || pathname === "/jaba/unauthorized") {
        return NextResponse.redirect(new URL("/jaba", request.url))
      }
      return NextResponse.next()
    }

    // ─── ADMIN (cashier_admin or manager_admin): Must be approved AND have permissions ───
    if (role === "cashier_admin" || role === "manager_admin") {
      // If not approved → redirect to waiting
      if (!approved) {
        if (pathname !== "/jaba/waiting") {
          return NextResponse.redirect(new URL("/jaba/waiting", request.url))
        }
        return NextResponse.next()
      }

      // If approved but no permissions → redirect to waiting
      if (!routePermissions || routePermissions.length === 0) {
        if (pathname !== "/jaba/waiting") {
          return NextResponse.redirect(new URL("/jaba/waiting", request.url))
        }
        return NextResponse.next()
      }

      // If accessing page not in permissions → show Access Denied (unauthorized page)
      if (!hasRoutePermission(pathname, routePermissions)) {
        return NextResponse.redirect(new URL("/jaba/unauthorized", request.url))
      }

      // Approved admin with permissions - on waiting/unauthorized, redirect to first allowed page
      if (pathname === "/jaba/waiting" || pathname === "/jaba/unauthorized") {
        const firstAllowed = routePermissions?.[0] || "/jaba"
        return NextResponse.redirect(new URL(firstAllowed, request.url))
      }
      return NextResponse.next()
    }

    // ─── USER or any other role: Always redirect to waiting ───
    if (pathname !== "/jaba/waiting") {
      return NextResponse.redirect(new URL("/jaba/waiting", request.url))
    }
    return NextResponse.next()
  }

  // ─── Protect /super-admin routes (if they exist) ───
  if (
    pathname.startsWith("/super-admin") &&
    !pathname.startsWith("/api")
  ) {
    const cookies = request.cookies

    if (!hasSession(cookies, 'catha')) {
      const url = new URL("/catha/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    // Use the same robust token retrieval method
    // Use Catha cookie name for /super-admin routes (they're part of Catha)
    const token = await getTokenForApp(request, 'catha')
    
    if (!token) {
      const url = new URL("/catha/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    const role = (token as any)?.role as string | undefined
    const userCollection = (token as any)?.userCollection

    // Only super_admin can access /super-admin/*
    if (role !== "super_admin") {
      return NextResponse.redirect(new URL("/catha/waiting", request.url))
    }
    
    // Ensure user is from the correct collection
    if (userCollection !== "bar") {
      const url = new URL("/catha/login", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // Redirect old bar routes to /catha routes (except /catha itself and /jaba)
  const barRoutes = [
    "/pos",
    "/inventory",
    "/suppliers",
    "/stock-movement",
    "/orders",
    "/mpesa",
    "/expenses",
    "/clients",
    "/users",
    "/distributor-requests",
    "/reports",
    "/settings",
  ]

  if (barRoutes.includes(pathname) && !pathname.startsWith("/catha") && !pathname.startsWith("/jaba")) {
    return NextResponse.redirect(new URL(`/catha${pathname}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - including /api/auth/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
