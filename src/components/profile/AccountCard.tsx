"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { User, LogOut, Trash2, KeyRound } from "lucide-react"
import { getAuthUser, getAuthUserId } from "@/lib/supabase/user-query"
import type { ProfileFeedback } from "./feedback"

const supabase = createClient()

interface AccountCardProps {
  /** Surfaced in the profile page's shared banner. */
  onFeedback: (feedback: ProfileFeedback) => void
}

/**
 * The Account section: email readout, change password, sign out, and the
 * delete-account confirmation flow.
 *
 * Self-fetching — it reads the auth user itself and owns the delete mutation
 * and its confirmation dialog, so the page doesn't carry sign-out/delete
 * handlers for a section that never touches the rest of its state.
 */
export function AccountCard({ onFeedback }: AccountCardProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: getAuthUser,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const userId = await getAuthUserId()
      // Delete profile (cascade should handle related data)
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId)
      if (error) throw error
      await supabase.auth.signOut()
    },
    onSuccess: () => {
      router.push("/")
    },
    onError: (err: Error) => {
      onFeedback({
        type: "error",
        text: err.message || "Failed to delete account.",
      })
      setDeleteDialogOpen(false)
    },
  })

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-purple-500" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label>Email</Label>
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {authUser?.email ?? "..."}
          </p>
        </div>

        {/* Change Password */}
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push("/update-password")}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Change Password
        </Button>

        {/* Sign Out */}
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>

        {/* Delete Account */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Are you sure you want to delete your account? This action cannot
              be undone. All your workout data, progress, and settings will be
              permanently removed.
            </p>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending
                  ? "Deleting..."
                  : "Yes, Delete My Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
