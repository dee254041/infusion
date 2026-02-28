"use client"

import { useState, useMemo, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Save,
  UserPlus,
  Loader2,
  Clock,
  UserX,
  CheckCircle,
  AlertCircle,
  X,
  Settings,
  ShoppingCart,
  Store,
  ChevronDown,
} from "lucide-react"
import {
  PERMISSION_PAGE_KEYS,
  PERMISSION_PAGE_LABELS,
  createEmptyPermissions,
  getCashierTemplate,
  getManagerTemplate,
  getSuperAdminTemplate,
  type PagePermissionEntry,
  type PermissionPageKey,
} from "@/lib/permissions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface CathaUser {
  id: string
  name: string
  email: string
  username: string
  phone?: string
  role: "pending" | "cashier_admin" | "manager_admin" | "super_admin"
  status: "active" | "disabled"
  permissions: PagePermissionEntry[]
  approved?: boolean
  routePermissions?: string[]
  createdAt: string
  lastLogin: string | null
}

const ROLE_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "cashier_admin", label: "Cashier Admin" },
  { value: "manager_admin", label: "Manager Admin" },
  { value: "super_admin", label: "Super Admin" },
] as const

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
] as const

// Role template definitions
const ROLE_TEMPLATES = {
  cashier_admin: {
    label: "Cashier Admin",
    description: "Sell, create orders, limited edits",
    icon: ShoppingCart,
    template: getCashierTemplate,
  },
  manager_admin: {
    label: "Manager Admin",
    description: "Manage stock, suppliers, view reports, etc",
    icon: Store,
    template: getManagerTemplate,
  },
  super_admin: {
    label: "Super Admin",
    description: "Complete access + manage users & permissions",
    icon: Shield,
    template: getSuperAdminTemplate,
  },
} as const

// Permission groups for accordion
const PERMISSION_GROUPS = {
  Sales: ["pos", "orders"],
  Operations: ["tables", "qr-tables"],
  Inventory: ["inventory", "suppliers", "stock-movement"],
  Financial: ["mpesa-transactions", "expenses"],
  Management: ["clients", "distributor-requests", "reports"],
  System: ["dashboard", "users", "settings"],
} as const

export default function UsersPage() {
  const [users, setUsers] = useState<CathaUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<CathaUser | null>(null)
  const [editingUser, setEditingUser] = useState<Partial<CathaUser>>({})
  const [editingPermissions, setEditingPermissions] = useState<PagePermissionEntry[]>([])
  const [selectedRoleTemplate, setSelectedRoleTemplate] = useState<"cashier_admin" | "manager_admin" | "super_admin" | null>(null)
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { data: session } = useSession()
  const currentUserEmail = session?.user?.email?.toLowerCase() ?? null

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/catha/users")
      const data = await res.json()
      if (data.success && data.users) {
        setUsers(data.users)
      }
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const pendingUsers = useMemo(() => {
    return users.filter((u) => u.role === "pending" || !u.approved)
  }, [users])

  const filteredUsers = useMemo(() => {
    const baseUsers = activeTab === "pending" ? pendingUsers : users
    return baseUsers.filter((user) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        user.name.toLowerCase().includes(q) ||
        (user.username || "").toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus = statusFilter === "all" || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, pendingUsers, searchQuery, roleFilter, statusFilter, activeTab])

  const stats = useMemo(() => {
    return {
      total: users.length,
      pending: pendingUsers.length,
      admins: users.filter((u) => u.role === "cashier_admin" || u.role === "manager_admin" || u.role === "super_admin").length,
      disabled: users.filter((u) => u.status === "disabled").length,
    }
  }, [users, pendingUsers])

  const handleAddUser = () => {
    setEditingUser({
      name: "",
      email: "",
      username: "",
      phone: "",
      role: "pending",
      status: "active",
      permissions: createEmptyPermissions(),
    })
    setIsAddModalOpen(true)
  }

  const handleEditUser = (user: CathaUser) => {
    if (currentUserEmail && user.email?.toLowerCase() === currentUserEmail) return
    setEditingUser({ ...user })
    setIsEditModalOpen(true)
  }

  const handleApproveUser = (user: CathaUser) => {
    if (currentUserEmail && user.email?.toLowerCase() === currentUserEmail) return
    setSelectedUser(user)
    setSelectedRoleTemplate(null)
    setShowAdvancedPermissions(false)
    setEditingPermissions(createEmptyPermissions())
    setIsApproveModalOpen(true)
  }

  const handleOpenPermissions = (user: CathaUser) => {
    if (currentUserEmail && user.email?.toLowerCase() === currentUserEmail) return
    setSelectedUser(user)
    const hasViewPermissions = Array.isArray(user.permissions) && user.permissions.some((p) => p.actions?.view)
    setEditingPermissions(
      user.role === "super_admin"
        ? getSuperAdminTemplate()
        : hasViewPermissions
          ? user.permissions!.map((p) => ({ ...p, actions: { ...p.actions } }))
          : user.role === "cashier_admin"
            ? getCashierTemplate().map((p) => ({ ...p, actions: { ...p.actions } }))
            : user.role === "manager_admin"
              ? getManagerTemplate().map((p) => ({ ...p, actions: { ...p.actions } }))
              : createEmptyPermissions()
    )
    setIsPermissionsModalOpen(true)
  }

  const handleRoleTemplateSelect = (template: "cashier_admin" | "manager_admin" | "super_admin") => {
    setSelectedRoleTemplate(template)
    const templateFn = ROLE_TEMPLATES[template].template
    setEditingPermissions(templateFn().map((p) => ({ ...p, actions: { ...p.actions } })))
  }

  const handleApproveAndSave = async () => {
    if (!selectedUser || !selectedRoleTemplate) return
    setSaving(true)
    try {
      // Convert permissions to routePermissions for middleware
      const { PERMISSION_PAGE_ROUTES } = await import("@/lib/permissions")
      const routePermissions: string[] = []
      editingPermissions.forEach((perm) => {
        if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
          routePermissions.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
        }
      })

      const res = await fetch(`/api/catha/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRoleTemplate,
          approved: true,
          permissions: editingPermissions,
          routePermissions: routePermissions,
        }),
      })
      const data = await res.json()
      if (data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? data.user : u)))
        setIsApproveModalOpen(false)
        setSelectedUser(null)
        setSelectedRoleTemplate(null)
        await fetchUsers()
      }
    } catch (err) {
      console.error("Failed to approve user:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveUser = async () => {
    if (!editingUser.name || !editingUser.email) return
    setSaving(true)
    try {
      if (isAddModalOpen) {
        const res = await fetch("/api/catha/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingUser.name,
            email: editingUser.email,
            username: editingUser.username || editingUser.email.split("@")[0],
            phone: editingUser.phone || undefined,
            role: editingUser.role || "pending",
            status: editingUser.status || "active",
            permissions: (editingUser.role === "cashier_admin" || editingUser.role === "manager_admin") ? editingUser.permissions || [] : [],
          }),
        })
        const data = await res.json()
        if (data.success && data.user) {
          setUsers((prev) => [data.user, ...prev])
          setIsAddModalOpen(false)
          setEditingUser({})
        } else {
          console.error(data.error || "Failed to create user")
        }
      } else {
        const id = editingUser.id
        if (!id) return
        const res = await fetch(`/api/catha/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingUser.name,
            email: editingUser.email,
            username: editingUser.username,
            phone: editingUser.phone,
            role: editingUser.role,
            status: editingUser.status,
            permissions: (editingUser.role === "cashier_admin" || editingUser.role === "manager_admin") ? editingUser.permissions || [] : undefined,
          }),
        })
        const data = await res.json()
        if (data.success && data.user) {
          setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)))
          setIsEditModalOpen(false)
          setEditingUser({})
        } else {
          console.error(data.error || "Failed to update user")
        }
      }
    } catch (err) {
      console.error("Failed to save user:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      // Convert permissions to routePermissions for middleware
      const { PERMISSION_PAGE_ROUTES } = await import("@/lib/permissions")
      const routePermissions: string[] = []
      editingPermissions.forEach((perm) => {
        if (perm.actions?.view && PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES]) {
          routePermissions.push(PERMISSION_PAGE_ROUTES[perm.pageKey as keyof typeof PERMISSION_PAGE_ROUTES])
        }
      })

      const res = await fetch(`/api/catha/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions: editingPermissions,
          routePermissions: routePermissions,
        }),
      })
      const data = await res.json()
      if (data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? data.user : u)))
        setIsPermissionsModalOpen(false)
        setSelectedUser(null)
      }
    } catch (err) {
      console.error("Failed to save permissions:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find((u) => u.id === userId)
    if (userToDelete && currentUserEmail && userToDelete.email?.toLowerCase() === currentUserEmail) return
    try {
      const res = await fetch(`/api/catha/users/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        setDeleteConfirmId(null)
      }
    } catch (err) {
      console.error("Failed to delete user:", err)
    }
  }

  const handleToggleStatus = async (user: CathaUser) => {
    if (currentUserEmail && user.email?.toLowerCase() === currentUserEmail) return
    const newStatus = user.status === "active" ? "disabled" : "active"
    try {
      const res = await fetch(`/api/catha/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)))
      }
    } catch (err) {
      console.error("Failed to toggle status:", err)
    }
  }

  const getRoleLabel = (role: CathaUser["role"]) => {
    switch (role) {
      case "cashier_admin":
        return "Cashier Admin"
      case "manager_admin":
        return "Manager Admin"
      case "super_admin":
        return "Super Admin"
      case "pending":
        return "Pending"
      default:
        return role
    }
  }

  const getRoleBadgeClass = (role: CathaUser["role"]) => {
    switch (role) {
      case "super_admin":
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
      case "cashier_admin":
        return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
      case "manager_admin":
        return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusBadgeClass = (status: CathaUser["status"]) => {
    return status === "active"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-stone-200 text-stone-700 border-stone-400 dark:bg-stone-800 dark:text-stone-400"
  }

  const formatDate = (s: string | null) => {
    if (!s) return "Never"
    try {
      const d = new Date(s)
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "—"
    }
  }

  return (
    <>
      <Header title="User Management" subtitle="Approve users and manage permissions" />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden max-w-[1600px] mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && (
          <>
            {/* Top Bar: Title + Search + Add User */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Users</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage user access and permissions</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-11 rounded-xl border-border bg-background"
                  />
                </div>
                <Button onClick={handleAddUser} className="h-11 px-5 rounded-xl gap-2 shrink-0">
                  <UserPlus className="h-4 w-4" />
                  Add User
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-4 md:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden border-amber-300 dark:border-amber-700">
                <CardContent className="p-4 md:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.pending}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-4 md:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Admins</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.admins}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-4 md:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Disabled</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.disabled}</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
                    <UserX className="h-6 w-6 text-stone-600 dark:text-stone-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters Row */}
            <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
              <CardHeader className="pb-4 px-4 md:px-6 border-b border-border/50">
                <div className="flex flex-col gap-4">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "all")} className="w-full">
                    <TabsList className="grid w-full sm:w-auto grid-cols-2">
                      <TabsTrigger value="pending" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Pending ({stats.pending})
                      </TabsTrigger>
                      <TabsTrigger value="all" className="gap-2">
                        <Users className="h-4 w-4" />
                        All Users
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-xl border-border">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-xl border-border">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-xl"
                        onClick={() => {
                          setSearchQuery("")
                          setRoleFilter("all")
                          setStatusFilter("all")
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Mobile: Stacked Cards with Sections */}
                <div className="md:hidden p-4 space-y-6">
                  {(() => {
                    // Group users by status/role
                    const pendingUsers = filteredUsers.filter((u) => u.role === "pending" || !u.approved)
                    const adminUsers = filteredUsers.filter(
                      (u) => (u.role === "cashier_admin" || u.role === "manager_admin" || u.role === "super_admin") && u.status === "active"
                    )
                    const regularUsers = filteredUsers.filter(
                      (u) => u.role !== "pending" && u.role !== "cashier_admin" && u.role !== "manager_admin" && u.role !== "super_admin" && u.status === "active"
                    )
                    const disabledUsers = filteredUsers.filter((u) => u.status === "disabled")

                    if (filteredUsers.length === 0) {
                      return (
                        <div className="py-12 text-center text-muted-foreground">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p className="text-sm font-medium">No users found</p>
                        </div>
                      )
                    }

                    return (
                      <>
                        {/* Pending Approval Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Pending Approval</h3>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              {pendingUsers.length}
                            </Badge>
                          </div>
                          {pendingUsers.length > 0 ? (
                            <div className="space-y-4">
                              {pendingUsers.map((user) => (
                                <UserCardMobile
                                  key={user.id}
                                  user={user}
                                  currentUserEmail={currentUserEmail}
                                  onApprove={() => handleApproveUser(user)}
                                  onPermissions={() => handleOpenPermissions(user)}
                                  onToggleStatus={() => handleToggleStatus(user)}
                                  onDelete={() => setDeleteConfirmId(user.id)}
                                  formatDate={formatDate}
                                  getRoleLabel={getRoleLabel}
                                  getRoleBadgeClass={getRoleBadgeClass}
                                  getStatusBadgeClass={getStatusBadgeClass}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No pending users</p>
                          )}
                        </div>

                        {/* Admins Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Admins</h3>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              {adminUsers.length}
                            </Badge>
                          </div>
                          {adminUsers.length > 0 ? (
                            <div className="space-y-4">
                              {adminUsers.map((user) => (
                                <UserCardMobile
                                  key={user.id}
                                  user={user}
                                  currentUserEmail={currentUserEmail}
                                  onApprove={() => handleApproveUser(user)}
                                  onPermissions={() => handleOpenPermissions(user)}
                                  onToggleStatus={() => handleToggleStatus(user)}
                                  onDelete={() => setDeleteConfirmId(user.id)}
                                  formatDate={formatDate}
                                  getRoleLabel={getRoleLabel}
                                  getRoleBadgeClass={getRoleBadgeClass}
                                  getStatusBadgeClass={getStatusBadgeClass}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No admins</p>
                          )}
                        </div>

                        {/* Regular Users Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Users</h3>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              {regularUsers.length}
                            </Badge>
                          </div>
                          {regularUsers.length > 0 ? (
                            <div className="space-y-4">
                              {regularUsers.map((user) => (
                                <UserCardMobile
                                  key={user.id}
                                  user={user}
                                  currentUserEmail={currentUserEmail}
                                  onApprove={() => handleApproveUser(user)}
                                  onPermissions={() => handleOpenPermissions(user)}
                                  onToggleStatus={() => handleToggleStatus(user)}
                                  onDelete={() => setDeleteConfirmId(user.id)}
                                  formatDate={formatDate}
                                  getRoleLabel={getRoleLabel}
                                  getRoleBadgeClass={getRoleBadgeClass}
                                  getStatusBadgeClass={getStatusBadgeClass}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No users</p>
                          )}
                        </div>

                        {/* Disabled Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Disabled</h3>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              {disabledUsers.length}
                            </Badge>
                          </div>
                          {disabledUsers.length > 0 ? (
                            <div className="space-y-4">
                              {disabledUsers.map((user) => (
                                <UserCardMobile
                                  key={user.id}
                                  user={user}
                                  currentUserEmail={currentUserEmail}
                                  onApprove={() => handleApproveUser(user)}
                                  onPermissions={() => handleOpenPermissions(user)}
                                  onToggleStatus={() => handleToggleStatus(user)}
                                  onDelete={() => setDeleteConfirmId(user.id)}
                                  formatDate={formatDate}
                                  getRoleLabel={getRoleLabel}
                                  getRoleBadgeClass={getRoleBadgeClass}
                                  getStatusBadgeClass={getStatusBadgeClass}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No disabled users</p>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Desktop: Row Cards Table */}
                <div className="hidden md:block">
                  <div className="divide-y divide-border/50">
                    {filteredUsers.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">No users found</p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <UserRowCard
                          key={user.id}
                          user={user}
                          currentUserEmail={currentUserEmail}
                          onApprove={() => handleApproveUser(user)}
                          onEdit={() => handleEditUser(user)}
                          onPermissions={() => handleOpenPermissions(user)}
                          onToggleStatus={() => handleToggleStatus(user)}
                          onDelete={() => setDeleteConfirmId(user.id)}
                          formatDate={formatDate}
                          getRoleLabel={getRoleLabel}
                          getRoleBadgeClass={getRoleBadgeClass}
                          getStatusBadgeClass={getStatusBadgeClass}
                        />
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Approve User Modal - Redesigned */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl p-4 md:p-6">
          <DialogHeader className="pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                Approve user
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setIsApproveModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selectedUser && (
              <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 rounded-xl shrink-0">
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm md:text-base">
                      {selectedUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm md:text-base truncate">{selectedUser.name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Role Template Selector */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Choose Role Template</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(ROLE_TEMPLATES).map(([key, template]) => {
                  const Icon = template.icon
                  const isSelected = selectedRoleTemplate === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleRoleTemplateSelect(key as "cashier_admin" | "manager_admin" | "super_admin")}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{template.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: Advanced Permissions (Collapsed) */}
            {selectedRoleTemplate && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Customize Permissions</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedPermissions(!showAdvancedPermissions)}
                    className="h-8 gap-2"
                  >
                    {showAdvancedPermissions ? "Hide" : "Show"} Advanced
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedPermissions ? "rotate-180" : ""}`} />
                  </Button>
                </div>
                {showAdvancedPermissions && (
                  <PermissionsEditorAccordion
                    permissions={editingPermissions}
                    setPermissions={setEditingPermissions}
                    readOnly={selectedRoleTemplate === "super_admin"}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)} className="rounded-xl h-11 w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleApproveAndSave}
              disabled={saving || !selectedRoleTemplate}
              className="rounded-xl h-11 gap-2 w-full sm:w-auto"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve & Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add User</DialogTitle>
            <DialogDescription>Create a new user. They can sign in with Google using this email.</DialogDescription>
          </DialogHeader>
          <UserFormFields
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            showPermissions={editingUser.role === "cashier_admin" || editingUser.role === "manager_admin"}
          />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl h-11">
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={saving} className="rounded-xl h-11 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit User</DialogTitle>
            <DialogDescription>Update user details, role, and status.</DialogDescription>
          </DialogHeader>
          <UserFormFields
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            showPermissions={editingUser.role === "cashier_admin" || editingUser.role === "manager_admin"}
          />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl h-11">
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={saving} className="rounded-xl h-11 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={isPermissionsModalOpen} onOpenChange={setIsPermissionsModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl p-4 md:p-6">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 md:h-5 md:w-5" />
              <span className="truncate">Permissions — {selectedUser?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">Configure page access and actions for this user.</DialogDescription>
          </DialogHeader>
          <PermissionsEditorAccordion
            permissions={editingPermissions}
            setPermissions={setEditingPermissions}
            readOnly={selectedUser?.role === "super_admin"}
          />
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsPermissionsModalOpen(false)} className="rounded-xl h-11 w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving} className="rounded-xl h-11 gap-2 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="rounded-xl h-11">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteUser(deleteConfirmId)} className="rounded-xl h-11">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Mobile User Card Component
function UserCardMobile({
  user,
  currentUserEmail,
  onApprove,
  onPermissions,
  onToggleStatus,
  onDelete,
  formatDate,
  getRoleLabel,
  getRoleBadgeClass,
  getStatusBadgeClass,
}: {
  user: CathaUser
  currentUserEmail: string | null
  onApprove: () => void
  onPermissions: () => void
  onToggleStatus: () => void
  onDelete: () => void
  formatDate: (s: string | null) => string
  getRoleLabel: (role: CathaUser["role"]) => string
  getRoleBadgeClass: (role: CathaUser["role"]) => string
  getStatusBadgeClass: (status: CathaUser["status"]) => string
}) {
  const isCurrentUser = currentUserEmail === user.email?.toLowerCase()
  const isPending = user.role === "pending"

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-card shadow-sm hover:shadow-md transition-shadow p-4">
      {/* Row 1: Avatar + Name + Status pill (right) */}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 rounded-xl border-2 border-border/50 shrink-0">
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
        </div>
        <Badge className={`text-[10px] rounded-lg border shrink-0 ${getStatusBadgeClass(user.status)}`}>
          {user.status === "active" ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 inline" /> : <XCircle className="h-2.5 w-2.5 mr-0.5 inline" />}
          {user.status}
        </Badge>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50 my-3" />

      {/* Row 2: Email */}
      <div className="mt-3">
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>

      {/* Row 3: Role pill (left) + Last login (right) */}
      <div className="flex items-center justify-between mt-3">
        <Badge className={`text-[10px] rounded-lg border ${getRoleBadgeClass(user.role)}`}>
          {getRoleLabel(user.role)}
        </Badge>
        <p className="text-[10px] text-muted-foreground">Last: {formatDate(user.lastLogin)}</p>
      </div>

      {/* Row 4: Primary button (full width) + 3-dots menu */}
      {!isCurrentUser && (
        <div className="flex gap-2 mt-3">
          {isPending ? (
            <Button onClick={onApprove} size="sm" className="flex-1 rounded-xl h-9 gap-1.5 text-xs">
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
          ) : (
            <Button onClick={onPermissions} variant="default" size="sm" className="flex-1 rounded-xl h-9 gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" />
              Manage Permissions
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleStatus}>
                {user.status === "active" ? <UserX className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {user.status === "active" ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {isCurrentUser && (
        <div className="text-xs text-muted-foreground text-center py-2 mt-3">You cannot edit your own account</div>
      )}
    </div>
  )
}

// Desktop User Row Card Component
function UserRowCard({
  user,
  currentUserEmail,
  onApprove,
  onEdit,
  onPermissions,
  onToggleStatus,
  onDelete,
  formatDate,
  getRoleLabel,
  getRoleBadgeClass,
  getStatusBadgeClass,
}: {
  user: CathaUser
  currentUserEmail: string | null
  onApprove: () => void
  onEdit: () => void
  onPermissions: () => void
  onToggleStatus: () => void
  onDelete: () => void
  formatDate: (s: string | null) => string
  getRoleLabel: (role: CathaUser["role"]) => string
  getRoleBadgeClass: (role: CathaUser["role"]) => string
  getStatusBadgeClass: (status: CathaUser["status"]) => string
}) {
  const isCurrentUser = currentUserEmail === user.email?.toLowerCase()

  return (
    <div className="p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-4">
        {/* Left: Avatar + Name + Email */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 rounded-xl border-2 border-border/50 shrink-0">
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        {/* Middle: Role + Status */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`rounded-lg border text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
            {getRoleLabel(user.role)}
          </Badge>
          <Badge className={`rounded-lg border text-xs font-medium gap-1 ${getStatusBadgeClass(user.status)}`}>
            {user.status === "active" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {user.status}
          </Badge>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isCurrentUser ? (
            <>
              {user.role === "pending" ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onApprove}
                  className="rounded-xl h-9 gap-1.5 text-xs"
                  title="Approve & Set Permissions"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPermissions}
                  className="rounded-xl h-9 gap-1.5 text-xs border-border hover:bg-primary/10 hover:border-primary/30"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Permissions
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onEdit} title="Edit user">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={onToggleStatus}
                title={user.status === "active" ? "Disable" : "Enable"}
              >
                {user.status === "active" ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">You</span>
          )}
        </div>
      </div>
    </div>
  )
}

// User Form Fields Component
function UserFormFields({
  editingUser,
  setEditingUser,
  showPermissions,
}: {
  editingUser: Partial<CathaUser>
  setEditingUser: (u: Partial<CathaUser> | ((prev: Partial<CathaUser>) => Partial<CathaUser>)) => void
  showPermissions: boolean
}) {
  const update = (part: Partial<CathaUser>) => setEditingUser((prev) => ({ ...prev, ...part }))
  const isSuperAdmin = editingUser.role === "super_admin"
  const permissions = isSuperAdmin
    ? getSuperAdminTemplate()
    : Array.isArray(editingUser.permissions)
      ? editingUser.permissions
      : createEmptyPermissions()

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={editingUser.name || ""} onChange={(e) => update({ name: e.target.value })} placeholder="Jane Doe" className="rounded-xl h-11" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={editingUser.email || ""} onChange={(e) => update({ email: e.target.value })} placeholder="jane@example.com" className="rounded-xl h-11" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Username (optional)</Label>
          <Input value={editingUser.username || ""} onChange={(e) => update({ username: e.target.value })} placeholder="jane" className="rounded-xl h-11" />
        </div>
        <div className="space-y-2">
          <Label>Phone (optional)</Label>
          <Input value={editingUser.phone || ""} onChange={(e) => update({ phone: e.target.value })} placeholder="+254..." className="rounded-xl h-11" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={editingUser.role || "pending"} onValueChange={(v: CathaUser["role"]) => update({ role: v })}>
            <SelectTrigger className="rounded-xl h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={editingUser.status || "active"} onValueChange={(v: CathaUser["status"]) => update({ status: v })}>
            <SelectTrigger className="rounded-xl h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {showPermissions && (
        <PermissionsEditorAccordion
          permissions={permissions}
          setPermissions={(p) => update({ permissions: p })}
          readOnly={isSuperAdmin}
        />
      )}
    </div>
  )
}

// Permissions Editor with Accordion
function PermissionsEditorAccordion({
  permissions,
  setPermissions,
  readOnly = false,
}: {
  permissions: PagePermissionEntry[]
  setPermissions: React.Dispatch<React.SetStateAction<PagePermissionEntry[]>> | ((p: PagePermissionEntry[]) => void)
  readOnly?: boolean
}) {
  const set = (updater: (prev: PagePermissionEntry[]) => PagePermissionEntry[]) => {
    const next = updater(permissions)
    setPermissions(next)
  }
  const displayPermissions = readOnly ? getSuperAdminTemplate() : permissions

  return (
    <div className="space-y-3">
      {readOnly && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs md:text-sm text-amber-800 dark:text-amber-300">
            <Shield className="h-3 w-3 md:h-4 md:w-4 inline mr-2" />
            Super Admin has full access to all pages. Permissions cannot be changed.
          </p>
        </div>
      )}
      <Accordion type="multiple" className="w-full">
        {Object.entries(PERMISSION_GROUPS).map(([groupName, pageKeys]) => {
          const groupPages = pageKeys.filter((key) => PERMISSION_PAGE_KEYS.includes(key as PermissionPageKey))
          if (groupPages.length === 0) return null

          return (
            <AccordionItem key={groupName} value={groupName} className="border-border">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {groupName}
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-2">
                {groupPages.map((pageKey) => {
                  const entry = displayPermissions.find((p) => p.pageKey === pageKey) || {
                    pageKey,
                    actions: { view: false, create: false, edit: false, delete: false },
                  }
                  const label = PERMISSION_PAGE_LABELS[pageKey as PermissionPageKey] ?? pageKey
                  return (
                    <div key={pageKey} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/20">
                      <span className="text-sm font-medium text-foreground flex-1">{label}</span>
                      <div className="flex items-center gap-3">
                        {(["view", "create", "edit", "delete"] as const).map((action) => (
                          <div key={action} className="flex items-center gap-1.5">
                            <Checkbox
                              checked={entry.actions[action]}
                              disabled={readOnly}
                              onCheckedChange={(checked) =>
                                set((prev) =>
                                  prev.map((p) =>
                                    p.pageKey === pageKey ? { ...p, actions: { ...p.actions, [action]: !!checked } } : p
                                  )
                                )
                              }
                              className="h-4 w-4"
                            />
                            <span className="text-[10px] text-muted-foreground uppercase w-12 text-right">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}

