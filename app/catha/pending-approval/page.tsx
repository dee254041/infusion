"use client"

import { useSession, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Clock, LogOut } from "lucide-react"
import Link from "next/link"

export default function PendingApprovalPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-stone-50 to-amber-50/30">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-stone-50 to-amber-50/30 p-4">
        <Card className="max-w-md w-full">
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-stone-50 to-amber-50/30 p-4">
      <Card className="max-w-lg w-full shadow-lg border-amber-200/50 bg-white/95">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
            <Clock className="h-7 w-7 text-amber-700" />
          </div>
          <CardTitle className="text-xl font-semibold text-stone-900">
            Your account is awaiting approval
          </CardTitle>
          <CardDescription className="text-base text-stone-600">
            Contact an administrator to get access to Catha Lounge. Once approved, you’ll be able to sign in and use the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-sm text-stone-500 text-center">
            Signed in as <span className="font-medium text-stone-700">{session.user.email}</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => signOut({ callbackUrl: "/catha/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
