import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { NextResponse } from 'next/server'
import { getBarUserByEmail, getBarUserByProviderId, createBarUser, updateBarUserLastLogin } from '@/lib/models/bar-user'
import { cookies, headers } from 'next/headers'

// Validate environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('[Catha Auth] Missing Google OAuth credentials. Please check your .env file.')
}

// CRITICAL: Require separate secret for Catha in production
// Do NOT fall back to NEXTAUTH_SECRET in production to prevent secret sharing
const isProduction = process.env.NODE_ENV === 'production'
const CATHA_SECRET = process.env.AUTH_SECRET_CATHA || (!isProduction ? process.env.NEXTAUTH_SECRET : undefined)

if (!CATHA_SECRET) {
  if (isProduction) {
    throw new Error('[Catha Auth] ❌ CRITICAL: AUTH_SECRET_CATHA must be set in production. Do not use NEXTAUTH_SECRET fallback.')
  } else {
    console.error('[Catha Auth] ⚠️ WARNING: AUTH_SECRET_CATHA is not set. Using NEXTAUTH_SECRET fallback (dev only).')
    if (!process.env.NEXTAUTH_SECRET) {
      throw new Error('[Catha Auth] ❌ NEXTAUTH_SECRET is also not set. Authentication will not work.')
    }
  }
} else {
  console.log(`[Catha Auth] ✅ Secret configured (length: ${CATHA_SECRET.length})`)
}

// Validate and normalize NEXTAUTH_URL (remove trailing slash if present)
let NEXTAUTH_URL = process.env.NEXTAUTH_URL
if (NEXTAUTH_URL) {
  NEXTAUTH_URL = NEXTAUTH_URL.replace(/\/$/, '')
  console.log(`[Catha Auth] NEXTAUTH_URL set to: ${NEXTAUTH_URL}`)
}

export const cathaAuth = NextAuth({
  trustHost: true,
  basePath: '/api/auth/catha',
  secret: CATHA_SECRET,
  // CRITICAL: Explicitly set session strategy to JWT for middleware compatibility
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // CRITICAL: Catha uses its own cookie name to prevent conflicts with Jaba
  cookies: {
    sessionToken: {
      name: (() => {
        const isProduction = process.env.NODE_ENV === 'production' || NEXTAUTH_URL?.startsWith('https://')
        const prefix = isProduction ? '__Secure-' : ''
        return `${prefix}catha.session-token`
      })(),
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production' || NEXTAUTH_URL?.startsWith('https://'),
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      async profile(profile, tokens) {
        return {
          ...profile,
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        if (!user.email) {
          console.error('[Catha Auth] ❌ No email provided by Google')
          return false
        }

        console.log(`[Catha Auth] 🔐 Processing sign in for: ${user.email}`)

        try {
          // Catha ONLY uses bar_users collection
          const barUser = await getBarUserByEmail(user.email)
          if (barUser) {
            console.log(`[Catha Auth] ✅ Catha user exists (bar_users): ${barUser.email}`)
            try {
              await updateBarUserLastLogin(user.email)
              if (!barUser.providerId) {
                const client = await (await import('@/lib/mongodb')).default
                await client.db('infusion_jaba').collection('bar_users').updateOne(
                  { email: user.email },
                  { $set: { providerId: account.providerAccountId, provider: 'google' } }
                )
              }
            } catch (e: any) {
              console.error('[Catha Auth] ⚠️ Bar user update failed:', e.message)
            }
            ;(account as any).userCollection = 'bar'
            return true
          }
          
          // New user - create in bar_users
          console.log(`[Catha Auth] 📝 New Catha user (bar_users): ${user.email}`)
          try {
            const barUser = await createBarUser({
              name: user.name || 'User',
              email: user.email,
              image: user.image || undefined,
              role: 'pending' as 'pending' | 'admin' | 'super_admin',
              status: 'active',
              permissions: [],
              provider: 'google',
              providerId: account.providerAccountId,
            })
            console.log(`[Catha Auth] ✅ Bar user created for Catha: ${barUser.email} (role: pending)`)
            await updateBarUserLastLogin(user.email)
            ;(account as any).userCollection = 'bar'
            return true
          } catch (createError: any) {
            console.error('[Catha Auth] ❌ Failed to create bar user:', createError.message)
            return false
          }
        } catch (error: any) {
          console.error('[Catha Auth] ❌ CRITICAL: MongoDB connection failed')
          console.error('[Catha Auth] ❌ Error:', error.message)
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      if (!session.user?.email) {
        console.error('[Catha Auth Session] ❌ No email in session')
        return session
      }

      // Always fetch fresh data from database
      try {
        const barUser = await getBarUserByEmail(session.user.email)
        if (barUser) {
          const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'cashier_admin' || barUser.role === 'manager_admin' || barUser.role === 'pending') 
            ? barUser.role 
            : 'pending'
          
          session.user.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
          session.user.status = (barUser.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled'
          session.user.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (barUser.approved ?? false)
          ;(session.user as any).userCollection = 'bar'

          // SUPER ADMIN: Give access to ALL routes
          if (normalizedRole === 'super_admin') {
            const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
            session.user.routePermissions = Object.values(PERMISSION_PAGE_ROUTES) as string[]
            console.log(`[Catha Auth Session] ✅ Super admin - granted access to ALL ${session.user.routePermissions.length} routes`)
          } else if ((barUser.role === 'cashier_admin' || barUser.role === 'manager_admin') && Array.isArray(barUser.permissions)) {
            ;(session.user as any).permissions = barUser.permissions
            const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
            const routes: string[] = []
            barUser.permissions.forEach((perm) => {
              if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
                routes.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
              }
            })
            session.user.routePermissions = routes
          } else if (Array.isArray(barUser.routePermissions)) {
            session.user.routePermissions = barUser.routePermissions
            // Use permissions if available; otherwise build from routePermissions for sidebar/hooks
            if (Array.isArray(barUser.permissions) && barUser.permissions.length > 0) {
              ;(session.user as any).permissions = barUser.permissions
            } else {
              const { PERMISSION_PAGE_ROUTES, createEmptyPermissions } = await import('@/lib/permissions')
              const perms = createEmptyPermissions()
              barUser.routePermissions.forEach((route) => {
                const entry = perms.find((p) => PERMISSION_PAGE_ROUTES[p.pageKey as keyof typeof PERMISSION_PAGE_ROUTES] === route)
                if (entry) entry.actions.view = true
              })
              ;(session.user as any).permissions = perms
            }
          }

          console.log(`[Catha Auth Session] Bar user - role: ${normalizedRole}, permissions: ${(session.user as any).permissions?.length || 0}, routePermissions: ${session.user.routePermissions?.length || 0}`)
        } else {
          console.error(`[Catha Auth Session] ❌ Bar user not found for email: ${session.user.email}`)
          session.user.role = 'pending'
          session.user.approved = false
          ;(session.user as any).userCollection = 'bar'
        }
      } catch (error: any) {
        console.error(`[Catha Auth Session] ❌ ERROR fetching bar user:`, error.message)
        session.user.role = 'pending'
        session.user.approved = false
        ;(session.user as any).userCollection = 'bar'
      }

      return session
    },
    async jwt({ token, user, account, trigger }) {
      console.log(`[Catha Auth JWT] Called - trigger: ${trigger}, user: ${user?.email || 'none'}, account: ${account?.provider || 'none'}`)
      
      // CRITICAL: Always force token.app to 'catha' (this is the Catha auth instance)
      // This ensures tokens are never "repaired" from the other app
      const previousApp = (token as any).app
      ;(token as any).app = 'catha'
      if (previousApp && previousApp !== 'catha') {
        console.log(`[Catha Auth JWT] ⚠️ Token had app="${previousApp}", forcing to "catha" (Catha instance)`)
      }
      
      // ✅ SAFE TOKEN LOGGING: Log non-sensitive token fields to confirm token generation
      const isProduction = process.env.NODE_ENV === 'production'
      const tokenSnapshot = {
        id: (token as any)?.id?.substring(0, 8) + '...' || 'none',
        email: (token as any)?.email || 'none',
        app: (token as any)?.app || 'none',
        role: (token as any)?.role || 'none',
        approved: (token as any)?.approved ?? 'none',
        exp: (token as any)?.exp ? new Date((token as any).exp * 1000).toISOString() : 'none',
        userCollection: (token as any)?.userCollection || 'none',
      }
      console.log(`[Catha Auth JWT] 📋 Token snapshot:`, JSON.stringify(tokenSnapshot, null, 2))
      
      // On sign in, user and account are available
      if (user && account?.provider === 'google') {
        token.id = user.id
        if (user.email) {
          (token as any).email = user.email
        }
        
        // App is already forced to 'catha' above
        ;(token as any).userCollection = 'bar'
        console.log(`[Catha Auth JWT] app: catha, userCollection: bar`)
        
        // Fetch fresh user data from database
        if (user.email) {
          try {
            const barUser = await getBarUserByEmail(user.email)
            if (barUser) {
              const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'cashier_admin' || barUser.role === 'manager_admin' || barUser.role === 'pending') 
                ? barUser.role 
                : 'pending'
              token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
              token.status = (barUser.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled'
              token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (barUser.approved ?? false)
              
              // SUPER ADMIN: Give access to ALL routes
              if (normalizedRole === 'super_admin') {
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                ;(token as any).routePermissions = Object.values(PERMISSION_PAGE_ROUTES) as string[]
                console.log(`[Catha Auth JWT] ✅ Super admin - granted access to ALL ${(token as any).routePermissions.length} routes`)
              } else if ((barUser.role === 'cashier_admin' || barUser.role === 'manager_admin') && Array.isArray(barUser.permissions)) {
                const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')
                const routes: string[] = []
                barUser.permissions.forEach((perm) => {
                  if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
                    routes.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
                  }
                })
                ;(token as any).routePermissions = routes
              } else if (Array.isArray(barUser.routePermissions)) {
                ;(token as any).routePermissions = barUser.routePermissions
              }
              
              console.log(`[Catha Auth JWT] ✅ Bar user data SET - email: ${user.email}, role: ${barUser.role}, normalizedRole: ${normalizedRole}, approved: ${barUser.approved}, token.approved: ${token.approved}, token.role: ${token.role}, routePermissions: ${(token as any).routePermissions?.length || 0}`)
            } else {
              console.error(`[Catha Auth JWT] ❌ Bar user not found for email: ${user.email}`)
              token.role = 'pending'
              token.approved = false
            }
          } catch (error: any) {
            console.error(`[Catha Auth JWT] ❌ ERROR fetching bar user:`, error.message)
            token.role = 'pending'
            token.approved = false
          }
        }
      }
      
      // On token refresh, update user data
      if (trigger === 'update' && (token as any).email) {
        // App is already forced to 'catha' at the start of this callback
        
        try {
          const barUser = await getBarUserByEmail((token as any).email)
          if (barUser) {
            const normalizedRole = (barUser.role === 'super_admin' || barUser.role === 'cashier_admin' || barUser.role === 'manager_admin' || barUser.role === 'pending') 
              ? barUser.role 
              : 'pending'
            token.role = normalizedRole as 'pending' | 'cashier_admin' | 'manager_admin' | 'super_admin'
            token.status = (barUser.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled'
            token.approved = normalizedRole === 'super_admin' || normalizedRole === 'cashier_admin' || normalizedRole === 'manager_admin' || (barUser.approved ?? false)
          }
        } catch (error: any) {
          console.error(`[Catha Auth JWT] ❌ ERROR refreshing bar user data:`, error.message)
        }
      }
      
      // App is already forced to 'catha' at the start of this callback
      return token
    },
  },
  pages: {
    signIn: '/catha/login',
    error: '/catha/login',
  },
})

// Export auth function for use in API routes
export const { auth } = cathaAuth

// Helper functions for API route protection
export async function requireCathaSession() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

/** Check if user has permission for a page+action. Returns { allowed, response } for API routes. */
export async function requireCathaPermission(
  pageKey: string,
  action: PermissionAction
): Promise<{ allowed: boolean; response?: import('next/server').NextResponse; session?: Awaited<ReturnType<typeof auth>> }> {
  try {
    const session = await auth()
    if (!session?.user) {
      return {
        allowed: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }

    const user = session.user as any
    const role = user.role
    const permissions = user.permissions as import('@/lib/permissions').PagePermissionEntry[] | undefined
    const routePermissions = user.routePermissions as string[] | undefined

    // Super admin bypasses all permission checks
    if (role === 'super_admin') {
      return { allowed: true, session }
    }

    // Cashier/manager: check page permissions
    if (role === 'cashier_admin' || role === 'manager_admin') {
      const { hasPagePermission } = await import('@/lib/permissions')
      const { PERMISSION_PAGE_ROUTES } = await import('@/lib/permissions')

      // Primary: use permissions array (view/create/edit/delete)
      if (hasPagePermission(permissions, pageKey, action)) {
        return { allowed: true, session }
      }

      // Fallback: for 'view' only, check routePermissions (e.g. when permissions not in session)
      if (action === 'view' && routePermissions?.length) {
        const route = PERMISSION_PAGE_ROUTES[pageKey as keyof typeof PERMISSION_PAGE_ROUTES]
        if (route && routePermissions.some((r) => r === route || route.startsWith(r + '/'))) {
          return { allowed: true, session }
        }
      }

      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions' },
          { status: 403 }
        ),
      }
    }

    // Pending or other roles: no access
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      ),
    }
  } catch (err: any) {
    console.error('[requireCathaPermission] Error:', err?.message)
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Internal Server Error', message: err?.message || 'Authentication failed' },
        { status: 500 }
      ),
    }
  }
}

/** Allow if user has ANY of the given page+action permissions. Used for APIs shared by multiple pages (e.g. inventory for POS + inventory page). */
export async function requireCathaPermissionAny(
  checks: Array<{ pageKey: string; action: PermissionAction }>
): Promise<{ allowed: boolean; response?: import('next/server').NextResponse; session?: Awaited<ReturnType<typeof auth>> }> {
  const result = await requireCathaPermission(checks[0].pageKey, checks[0].action)
  if (result.allowed) return result
  for (let i = 1; i < checks.length; i++) {
    const r = await requireCathaPermission(checks[i].pageKey, checks[i].action)
    if (r.allowed) return r
  }
  return {
    allowed: false,
    response: NextResponse.json(
      { error: 'Forbidden', message: 'Insufficient permissions' },
      { status: 403 }
    ),
  }
}

/** For public ecommerce: allow unauthenticated OR require permission if logged in. Use for inventory/settings GET (shop, home, product detail, checkout). */
export async function requireCathaPermissionOrPublic(
  checks: Array<{ pageKey: string; action: PermissionAction }>
): Promise<{ allowed: boolean; response?: import('next/server').NextResponse; session?: Awaited<ReturnType<typeof auth>> }> {
  try {
    const session = await auth()
    if (!session?.user) {
      return { allowed: true }
    }
    return requireCathaPermissionAny(checks)
  } catch {
    return { allowed: true }
  }
}

export async function requireSuperAdminCatha(): Promise<{
  session?: Awaited<ReturnType<typeof auth>>
  response?: import('next/server').NextResponse
}> {
  try {
    const session = await auth()
    if (!session?.user) {
      return {
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }
    const user = session.user as any
    if (user.role !== 'super_admin') {
      return {
        response: NextResponse.json(
          { error: 'Forbidden', message: 'Super admin access required' },
          { status: 403 }
        ),
      }
    }
    return { session }
  } catch (err: any) {
    console.error('[requireSuperAdminCatha] Error:', err?.message)
    return {
      response: NextResponse.json(
        { error: 'Internal Server Error', message: err?.message || 'Authentication failed' },
        { status: 500 }
      ),
    }
  }
}
