"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Users,
  Bell,
  LogOut,
  Wine,
  Smartphone,
  Wallet2,
  UserCircle2,
  UserPlus2,
  Receipt,
  Grid3X3,
  QrCode,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { hasPagePermission, PERMISSION_PAGE_ROUTES } from "@/lib/permissions"
import type { PagePermissionEntry } from "@/lib/permissions"

const navigation: { name: string; href: string; icon: any; color: string; pageKey: string }[] = [
  { name: "Dashboard", href: "/catha", icon: LayoutDashboard, color: "indigo", pageKey: "dashboard" },
  { name: "POS Sales", href: "/catha/pos", icon: ShoppingCart, color: "emerald", pageKey: "pos" },
  { name: "Orders", href: "/catha/orders", icon: Receipt, color: "indigo", pageKey: "orders" },
  { name: "Tables", href: "/catha/tables", icon: Grid3X3, color: "blue", pageKey: "tables" },
  { name: "Table QR Codes", href: "/catha/qr-tables", icon: QrCode, color: "emerald", pageKey: "qr-tables" },
  { name: "Inventory", href: "/catha/inventory", icon: Package, color: "amber", pageKey: "inventory" },
  { name: "Suppliers", href: "/catha/suppliers", icon: Truck, color: "sky", pageKey: "suppliers" },
  { name: "Stock Movement", href: "/catha/stock-movement", icon: ArrowLeftRight, color: "violet", pageKey: "stock-movement" },
  { name: "M-Pesa Transactions", href: "/catha/mpesa-transactions", icon: Smartphone, color: "emerald", pageKey: "mpesa-transactions" },
  { name: "Expenses", href: "/catha/expenses", icon: Wallet2, color: "rose", pageKey: "expenses" },
  { name: "Clients", href: "/catha/clients", icon: UserCircle2, color: "sky", pageKey: "clients" },
  { name: "User Management", href: "/catha/users", icon: Users, color: "amber", pageKey: "users" },
  { name: "Distributor Requests", href: "/catha/distributor-requests", icon: UserPlus2, color: "violet", pageKey: "distributor-requests" },
  { name: "Reports", href: "/catha/reports", icon: BarChart3, color: "rose", pageKey: "reports" },
  { name: "Settings", href: "/catha/settings", icon: Settings, color: "slate", pageKey: "settings" },
]

const navSections: { title: string; items: { name: string; href: string; icon: any; pageKey: string }[] }[] = [
  { title: "Main", items: [
    { name: "Dashboard", href: "/catha", icon: LayoutDashboard, pageKey: "dashboard" },
    { name: "POS Sales", href: "/catha/pos", icon: ShoppingCart, pageKey: "pos" },
    { name: "Orders", href: "/catha/orders", icon: Receipt, pageKey: "orders" },
    { name: "Tables", href: "/catha/tables", icon: Grid3X3, pageKey: "tables" },
    { name: "Table QR Codes", href: "/catha/qr-tables", icon: QrCode, pageKey: "qr-tables" },
  ]},
  { title: "Inventory", items: [
    { name: "Inventory", href: "/catha/inventory", icon: Package, pageKey: "inventory" },
    { name: "Suppliers", href: "/catha/suppliers", icon: Truck, pageKey: "suppliers" },
    { name: "Stock Movement", href: "/catha/stock-movement", icon: ArrowLeftRight, pageKey: "stock-movement" },
  ]},
  { title: "Finance", items: [
    { name: "M-Pesa Transactions", href: "/catha/mpesa-transactions", icon: Smartphone, pageKey: "mpesa-transactions" },
    { name: "Expenses", href: "/catha/expenses", icon: Wallet2, pageKey: "expenses" },
    { name: "Reports", href: "/catha/reports", icon: BarChart3, pageKey: "reports" },
  ]},
  { title: "Admin", items: [
    { name: "Clients", href: "/catha/clients", icon: UserCircle2, pageKey: "clients" },
    { name: "User Management", href: "/catha/users", icon: Users, pageKey: "users" },
    { name: "Distributor Requests", href: "/catha/distributor-requests", icon: UserPlus2, pageKey: "distributor-requests" },
    { name: "Settings", href: "/catha/settings", icon: Settings, pageKey: "settings" },
  ]},
]

// Prefetch: debounced 250ms, once per session per API (avoids rate spikes / accidental triggers)
const PREFETCH_DEBOUNCE_MS = 250
const prefetchedThisSession = new Set<string>()
const prefetchTimeouts: Record<string, NodeJS.Timeout> = {}

function debouncedPrefetch(apiPath: string) {
  if (prefetchedThisSession.has(apiPath)) return
  if (prefetchTimeouts[apiPath]) clearTimeout(prefetchTimeouts[apiPath])
  prefetchTimeouts[apiPath] = setTimeout(() => {
    delete prefetchTimeouts[apiPath]
    prefetchedThisSession.add(apiPath)
    fetch(apiPath, { cache: "default" }).catch(() => {})
  }, PREFETCH_DEBOUNCE_MS)
}

function canViewPage(
  role: string | undefined,
  permissions: PagePermissionEntry[] | undefined,
  pageKey: string,
  routePermissions?: string[]
): boolean {
  if (role === "super_admin") return true
  // Check permissions for cashier_admin and manager_admin
  if (role === "cashier_admin" || role === "manager_admin") {
    // Primary: use permissions array
    if (hasPagePermission(permissions, pageKey, "view")) return true
    // Fallback: use routePermissions when permissions not in session (e.g. stale session)
    if (routePermissions && routePermissions.length > 0) {
      const route = PERMISSION_PAGE_ROUTES[pageKey as keyof typeof PERMISSION_PAGE_ROUTES]
      if (route) {
        return routePermissions.some((r) => r === route || route.startsWith(r + "/"))
      }
    }
    return false
  }
  // For other roles (pending, etc.), no access
  return false
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  const role = session?.user?.role
  const permissions = (session?.user as { permissions?: PagePermissionEntry[] })?.permissions
  const routePermissions = (session?.user as { routePermissions?: string[] })?.routePermissions

  const filteredNavigation = useMemo(() => {
    return navigation.filter((item) => canViewPage(role, permissions, item.pageKey, routePermissions))
  }, [role, permissions, routePermissions])

  const filteredNavSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canViewPage(role, permissions, item.pageKey, routePermissions)),
      }))
      .filter((section) => section.items.length > 0)
  }, [role, permissions, routePermissions])

  const userInitials = useMemo(() => {
    if (session?.user?.name) {
      return session.user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (session?.user?.email) {
      return session.user.email[0].toUpperCase()
    }
    return 'U'
  }, [session?.user?.name, session?.user?.email])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/catha/login' })
  }

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1280)
      if (width >= 1280) {
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const isDrawerMode = isMobile || isTablet

  useEffect(() => {
    if (isDrawerMode && isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('aside') && !target.closest('[data-sidebar-toggle]')) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDrawerMode, isOpen])

  useEffect(() => {
    if (isDrawerMode) setIsOpen(false)
  }, [pathname, isDrawerMode])

  return (
    <>
      {/* Overlay backdrop - mobile & tablet drawer mode */}
      {isDrawerMode && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 xl:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar Toggle Button - mobile & tablet (hidden when drawer is open) */}
      {isDrawerMode && !isOpen && (
        <button
          data-sidebar-toggle
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed top-3 left-3 z-50 xl:hidden h-12 w-12 rounded-xl bg-card/95 backdrop-blur-sm border-2 border-border/50 shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-200",
            "hover:bg-primary hover:text-primary-foreground hover:border-primary/50",
            "active:scale-95 touch-manipulation",
            "bg-gradient-to-br from-card to-card/90"
          )}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-transform duration-300 ease-out",
        "xl:translate-x-0",
        isDrawerMode ? (isOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0",
        "w-64 border-r border-sidebar-border bg-sidebar/95 bg-gradient-to-b from-sidebar to-sidebar/90 shadow-[0_0_40px_rgba(15,23,42,0.06)] backdrop-blur-sm",
        "xl:w-64"
      )}>
      <div className="flex h-full flex-col">
        {/* Logo / Drawer header */}
        <div className={cn(
          "flex h-16 items-center gap-3 bg-white px-5 shrink-0",
          isDrawerMode ? "border-b border-gray-100" : "border-b border-sidebar-border/80 bg-sidebar"
        )}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm shrink-0">
            <Wine className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={cn(
              "text-base font-semibold truncate",
              isDrawerMode ? "text-[#0f172a]" : "text-sidebar-foreground"
            )}>Catha Lounge</h1>
            <p className="text-[11px] text-[#94a3b8] truncate">Premium POS Suite</p>
          </div>
          {isDrawerMode && (
            <button 
              onClick={() => setIsOpen(false)} 
              className="xl:hidden p-2 rounded-lg text-[#94a3b8] opacity-70 hover:opacity-100 hover:text-[#64748b] transition-opacity shrink-0"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation - DESKTOP (xl): original flat list */}
        <nav className="flex-1 overflow-y-auto">
          {/* Desktop nav - hidden on mobile/tablet */}
          <div className="hidden xl:block space-y-1 px-3 py-4 text-sm">
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">Main menu</p>
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/catha" && pathname.startsWith(item.href))
              const prefetchApi = item.href === "/catha/pos" ? "/api/catha/inventory" : item.href === "/catha/orders" ? "/api/catha/orders" : null
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onMouseEnter={prefetchApi ? () => debouncedPrefetch(prefetchApi) : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all duration-200",
                    isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground/90",
                  )}
                >
                  <span className={cn("h-7 w-1 rounded-full bg-transparent transition-colors", isActive ? "bg-sidebar-primary-foreground/80" : "group-hover:bg-sidebar-accent-foreground/40")} />
                  <item.icon className={cn("h-5 w-5 transition-colors", item.color === "indigo" && (isActive ? "text-indigo-300" : "text-indigo-500 group-hover:text-indigo-400"), item.color === "emerald" && (isActive ? "text-emerald-300" : "text-emerald-500 group-hover:text-emerald-400"), item.color === "amber" && (isActive ? "text-amber-300" : "text-amber-500 group-hover:text-amber-400"), item.color === "sky" && (isActive ? "text-sky-300" : "text-sky-500 group-hover:text-sky-400"), item.color === "violet" && (isActive ? "text-violet-300" : "text-violet-500 group-hover:text-violet-400"), item.color === "rose" && (isActive ? "text-rose-300" : "text-rose-500 group-hover:text-rose-400"), item.color === "slate" && (isActive ? "text-slate-300" : "text-slate-500 group-hover:text-slate-400"), item.color === "blue" && (isActive ? "text-blue-300" : "text-blue-500 group-hover:text-blue-400"))} />
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Mobile/Tablet nav - grouped sections, slim active bar */}
          <div className="xl:hidden py-4 px-2">
                  {filteredNavSections.map((section) => (
              <div key={section.title} className="mb-6 last:mb-0">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8]">{section.title}</p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/catha" && pathname.startsWith(item.href))
                    const prefetchApi = item.href === "/catha/pos" ? "/api/catha/inventory" : item.href === "/catha/orders" ? "/api/catha/orders" : null
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onMouseEnter={prefetchApi ? () => debouncedPrefetch(prefetchApi) : undefined}
                        onClick={() => isDrawerMode && setIsOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                          isActive ? "bg-[#ecfdf5] text-[#059669] border-l-[3px] border-l-primary pl-[9px]" : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-[#64748b] group-hover:text-[#475569]")} />
                        <span className="flex-1 truncate">{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* User Section - DESKTOP: dropdown */}
        <div className="hidden xl:block border-t border-sidebar-border/80 bg-sidebar/98 p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-accent">
                <Avatar className="h-9 w-9 border border-sidebar-border/80 shadow-xs">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground">{session?.user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">
                    {session?.user?.role ? session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1).replace('_', ' ') : "User"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem><Users className="mr-2 h-4 w-4" />Profile</DropdownMenuItem>
              <DropdownMenuItem><Bell className="mr-2 h-4 w-4" />Notifications<Badge variant="secondary" className="ml-auto">3</Badge></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User Section - MOBILE/TABLET: profile card + logout */}
        <div className="xl:hidden border-t border-sidebar-border/80 p-4 bg-[#f8fafc]/50 shrink-0">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar className="h-10 w-10 shrink-0 border-2 border-white shadow-sm">
              <AvatarImage src={session?.user?.image || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0f172a] truncate">{session?.user?.name || "User"}</p>
              <p className="text-xs text-[#64748b] truncate">
                {session?.user?.role ? session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1).replace('_', ' ') : "User"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full mt-2 text-xs text-[#64748b] hover:text-[#dc2626] hover:bg-red-50/50 justify-start gap-2">
            <LogOut className="h-3.5 w-3.5" />Log out
          </Button>
        </div>
      </div>
    </aside>
    </>
  )
}
