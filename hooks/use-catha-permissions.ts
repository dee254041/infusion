"use client"

import { useSession } from "next-auth/react"
import { useMemo } from "react"
import { hasPagePermission } from "@/lib/permissions"
import type { PagePermissionEntry } from "@/lib/permissions"
import type { PermissionPageKey } from "@/lib/permissions"

export interface PagePermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * Returns permission flags for the current user for a given page.
 * Super_admin gets all true; cashier_admin and manager_admin use their permissions array; others get all false.
 */
export function useCathaPermissions(pageKey: PermissionPageKey): PagePermissions {
  const { data: session, status } = useSession()
  return useMemo(() => {
    if (status === "loading" || !session?.user) {
      return { canView: false, canCreate: false, canEdit: false, canDelete: false }
    }
    const role = session.user.role
    const permissions = (session.user as { permissions?: PagePermissionEntry[] }).permissions
    if (role === "super_admin") {
      return { canView: true, canCreate: true, canEdit: true, canDelete: true }
    }
    // Check permissions for cashier_admin and manager_admin
    if (role === "cashier_admin" || role === "manager_admin") {
      return {
        canView: hasPagePermission(permissions, pageKey, "view"),
        canCreate: hasPagePermission(permissions, pageKey, "create"),
        canEdit: hasPagePermission(permissions, pageKey, "edit"),
        canDelete: hasPagePermission(permissions, pageKey, "delete"),
      }
    }
    // For other roles (pending, etc.), no access
    return { canView: false, canCreate: false, canEdit: false, canDelete: false }
  }, [session?.user, status, pageKey])
}
