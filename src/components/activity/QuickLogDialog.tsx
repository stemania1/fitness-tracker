"use client"

import type { LucideIcon } from "lucide-react"
import type { UseMutationResult } from "@tanstack/react-query"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface QuickLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to drive the dialog from an external trigger (e.g. a picker flow). */
  trigger?: { icon: LucideIcon; label: string }
  /** Overrides the default secondary-button trigger styling. */
  triggerClassName?: string
  /** Overrides the trigger icon size (the inline chip trigger is smaller). */
  triggerIconClassName?: string
  title: string
  description: string
  /** Label for the confirm button. Defaults to "Save". */
  submitLabel?: string
  /** Disables submit — pass the form's own validity check. */
  submitDisabled?: boolean
  /** Any mutation; only isPending and error are read. */
  mutation: Pick<
    UseMutationResult<unknown, Error, void, unknown>,
    "isPending" | "isError" | "error"
  >
  onSubmit: () => void
  children: React.ReactNode
}

/**
 * The shell every quick-log dialog shares.
 *
 * Six of these existed — weight, caffeine, cardio, food, strength, fitness
 * test — and byte for byte they repeated the same trigger button, the same
 * `mx-4 max-w-sm` content box, the same preventDefault form wrapper, the same
 * error paragraph, and the same hand-rolled Cancel/Save footer. Only the
 * fields in the middle and the mutation ever differed.
 *
 * The footer buttons now come from `Button`. The hand-written versions had
 * drifted from `buttonVariants` and dropped its focus ring, so keyboard focus
 * was invisible on the primary action of all six logging flows.
 */
export function QuickLogDialog({
  open,
  onOpenChange,
  trigger,
  triggerClassName,
  triggerIconClassName = "h-4 w-4",
  title,
  description,
  submitLabel = "Save",
  submitDisabled = false,
  mutation,
  onSubmit,
  children,
}: QuickLogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "flex-1 gap-2",
            triggerClassName
          )}
        >
          <trigger.icon className={triggerIconClassName} aria-hidden="true" />
          {trigger.label}
        </DialogTrigger>
      )}
      <DialogContent className="mx-4 max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="mt-4 space-y-4"
        >
          {children}

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error).message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || submitDisabled}>
              {mutation.isPending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
