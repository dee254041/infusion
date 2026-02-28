import { NextResponse } from 'next/server'
import { requireSuperAdminCatha } from '@/lib/auth-catha'
import { getAllBarUsers, createBarUser } from '@/lib/models/bar-user'
import { getCashierTemplate, getManagerTemplate, PERMISSION_PAGE_ROUTES } from '@/lib/permissions'
import type { PagePermissionEntry } from '@/lib/permissions'

function formatBarUser(u: { _id?: { toString: () => string }; name: string; email: string; username?: string; phone?: string; role?: string; status?: string; approved?: boolean; permissions?: PagePermissionEntry[]; routePermissions?: string[]; createdAt: Date; lastLogin?: Date }) {
  return {
    id: u._id?.toString(),
    name: u.name,
    email: u.email,
    username: u.username ?? u.email.split('@')[0],
    phone: u.phone ?? '',
    role: u.role ?? 'pending',
    status: u.status ?? 'active',
    approved: u.approved ?? (u.role === 'cashier_admin' || u.role === 'manager_admin' || u.role === 'super_admin'),
    permissions: u.permissions ?? [],
    routePermissions: u.routePermissions ?? [],
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    lastLogin: u.lastLogin ? (u.lastLogin instanceof Date ? u.lastLogin.toISOString() : u.lastLogin) : null,
  }
}

export async function GET() {
  const { session, response } = await requireSuperAdminCatha()
  if (response) return response
  try {
    const users = await getAllBarUsers()
    const formatted = users.map(formatBarUser)
    return NextResponse.json({ success: true, users: formatted })
  } catch (error) {
    console.error('[catha/users] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}

function permissionsToRoutes(permissions: PagePermissionEntry[]): string[] {
  const routes: string[] = []
  permissions.forEach((perm) => {
    if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
      routes.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
    }
  })
  return routes
}

export async function POST(request: Request) {
  const { session, response } = await requireSuperAdminCatha()
  if (response) return response
  try {
    const body = await request.json()
    const { name, email, username, phone, role, status, permissions } = body
    if (!name || !email) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 })
    }
    const validRoles = ['pending', 'cashier_admin', 'manager_admin', 'super_admin']
    const validStatuses = ['active', 'disabled']
    const r = validRoles.includes(role) ? role : 'pending'
    const s = validStatuses.includes(status) ? status : 'active'

    let perms = Array.isArray(permissions) ? permissions : []
    const hasViewPermissions = perms.some((p: PagePermissionEntry) => p.actions?.view)
    if ((r === 'cashier_admin' || r === 'manager_admin') && !hasViewPermissions) {
      perms = r === 'cashier_admin' ? getCashierTemplate() : getManagerTemplate()
    }
    const routePerms = permissionsToRoutes(perms)

    const user = await createBarUser({
      name,
      email,
      username: username || email.split('@')[0],
      phone: phone || undefined,
      role: r,
      status: s,
      permissions: perms,
      routePermissions: routePerms,
    })
    return NextResponse.json({
      success: true,
      user: formatBarUser(user),
    })
  } catch (error) {
    console.error('[catha/users] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 })
  }
}
