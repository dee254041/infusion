import { NextResponse } from 'next/server'
import { requireSuperAdminCatha } from '@/lib/auth-catha'
import { getBarUserById, updateBarUser, deleteBarUser } from '@/lib/models/bar-user'
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSuperAdminCatha()
  if (response) return response
  const { id } = await params
  try {
    const user = await getBarUserById(id)
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, user: formatBarUser(user) })
  } catch (error) {
    console.error('[catha/users/[id]] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 })
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSuperAdminCatha()
  if (response) return response
  const { id } = await params
  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.name === 'string') updates.name = body.name
    if (typeof body.email === 'string') updates.email = body.email
    if (body.username !== undefined) updates.username = body.username
    if (body.phone !== undefined) updates.phone = body.phone
    if (['active', 'disabled'].includes(body.status)) updates.status = body.status
    if (typeof body.approved === 'boolean') updates.approved = body.approved

    // Role update: auto-apply permission template when switching to cashier_admin/manager_admin with empty permissions
    if (['pending', 'cashier_admin', 'manager_admin', 'super_admin'].includes(body.role)) {
      updates.role = body.role
      const newRole = body.role as string
      const permissionsProvided = Array.isArray(body.permissions)
      const hasViewPermissions = permissionsProvided && (body.permissions as PagePermissionEntry[]).some((p: PagePermissionEntry) => p.actions?.view)

      if ((newRole === 'cashier_admin' || newRole === 'manager_admin') && (!permissionsProvided || !hasViewPermissions)) {
        const template = newRole === 'cashier_admin' ? getCashierTemplate() : getManagerTemplate()
        updates.permissions = template
        updates.routePermissions = permissionsToRoutes(template)
      } else if (permissionsProvided) {
        updates.permissions = body.permissions
        updates.routePermissions = Array.isArray(body.routePermissions) ? body.routePermissions : permissionsToRoutes(body.permissions)
      }
    } else if (Array.isArray(body.permissions)) {
      updates.permissions = body.permissions
      updates.routePermissions = Array.isArray(body.routePermissions) ? body.routePermissions : permissionsToRoutes(body.permissions)
    } else if (Array.isArray(body.routePermissions)) {
      updates.routePermissions = body.routePermissions
    }

    const user = await updateBarUser(id, updates)
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, user: formatBarUser(user) })
  } catch (error) {
    console.error('[catha/users/[id]] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSuperAdminCatha()
  if (response) return response
  const { id } = await params
  try {
    const ok = await deleteBarUser(id)
    if (!ok) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[catha/users/[id]] DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 })
  }
}
