"use client"

import { signIn } from "next-auth/react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wine } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    document.title = "Catha Lounge | Sign Up"
  }, [])

  // Set server-side cookie to indicate this is a bar user sign-up
  useEffect(() => {
    fetch('/api/auth/bar-setup').catch(console.error)
    document.cookie = "auth_context=bar; path=/; max-age=3600" // 1 hour
  }, [])

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true)
      await signIn("google", {
        callbackUrl: "/catha",
        redirect: true,
      })
    } catch (error) {
      console.error("Sign up error:", error)
      setIsLoading(false)
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
            Create an account to manage orders, menu, and operations.
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
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl sm:text-3xl font-medium text-stone-800 tracking-tight">
                Create your account
              </CardTitle>
              <CardDescription className="text-stone-500 mt-1">
                Sign up to access the restaurant & bar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <Button
                onClick={handleGoogleSignUp}
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
                    Signing up...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign up with Google
                  </span>
                )}
              </Button>
              <div className="text-center text-sm text-stone-600 pt-1">
                Already have an account?{" "}
                <Link href="/catha/login" className="text-amber-700 hover:text-amber-800 font-medium transition-colors">
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-center text-stone-400 pt-2">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

