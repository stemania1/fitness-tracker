"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
  /** Set once a DialogDescription renders, so aria-describedby is only
   *  applied when there is something to describe. */
  hasDescription: boolean
  registerDescription: () => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
  undefined
)

function useDialogContext() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog provider")
  }
  return context
}

export interface DialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen

  // Per-instance ids. These used to be one hardcoded module constant, so
  // every dialog claimed id="dialog-title" and every DialogContent pointed
  // aria-labelledby at it — ambiguous the moment two dialogs mount.
  const reactId = React.useId()
  const titleId = `${reactId}-title`
  const descriptionId = `${reactId}-description`

  const [hasDescription, setHasDescription] = React.useState(false)
  const registerDescription = React.useCallback(
    () => setHasDescription(true),
    []
  )

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(value)
      }
      onOpenChange?.(value)
    },
    [controlledOpen, onOpenChange]
  )

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        titleId,
        descriptionId,
        hasDescription,
        registerDescription,
      }}
    >
      {children}
    </DialogContext.Provider>
  )
}

export interface DialogTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function DialogTrigger({ children, onClick, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialogContext()

  return (
    <button
      onClick={(e) => {
        setOpen(true)
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Focusable descendants, in DOM order, skipping anything not tabbable.
 *
 * Deliberately does not consult layout (`offsetParent` / `getClientRects`):
 * everything inside an open modal panel is visible by construction, and both
 * of those report nothing under jsdom and are unreliable inside a
 * `position: fixed` subtree. Attribute-level checks are enough here.
 */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",")
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("hidden") && !el.closest('[aria-hidden="true"]')
  )
}

function DialogContent({ className, children, ...props }: DialogContentProps) {
  const { open, setOpen, titleId, descriptionId, hasDescription } =
    useDialogContext()
  const [mounted, setMounted] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Move focus into the dialog on open and put it back on close. Without
  // this, focus stayed on the trigger behind the overlay: Tab walked into
  // the page underneath, and closing left focus nowhere useful.
  React.useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (panel) {
      // Prefer the first real control; fall back to the panel itself, which
      // is focusable via tabIndex={-1} so the dialog is never focus-less.
      const [first] = focusableWithin(panel)
      ;(first ?? panel).focus()
    }
    return () => previouslyFocused?.focus?.()
  }, [open])

  // Trap Tab inside the panel. aria-modal alone does not stop keyboard focus
  // from leaving — it only hints at the semantics.
  React.useEffect(() => {
    if (!open) return
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return
      const focusable = focusableWithin(panel)
      if (focusable.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleTab)
    return () => document.removeEventListener("keydown", handleTab)
  }, [open])

  // Scroll-lock the app shell's scroller, not <body>. The authenticated
  // layout makes <main data-app-scroll> the only scrolling element, so
  // locking <body> stopped having any effect on the content behind a modal.
  // Falls back to <body> for surfaces rendered outside that shell (auth,
  // onboarding), which do scroll the document.
  React.useEffect(() => {
    const scroller: HTMLElement =
      document.querySelector<HTMLElement>("[data-app-scroll]") ?? document.body
    if (open) {
      scroller.style.overflow = "hidden"
    } else {
      scroller.style.overflow = ""
    }
    return () => {
      scroller.style.overflow = ""
    }
  }, [open])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [open, setOpen])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      {/* Content */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-50 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg",
          "animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      >
        {/* Close button */}
        <button
          className="absolute right-4 top-4 rounded-sm text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  id,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialogContext()
  return (
    <h2
      id={id ?? titleId}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  id,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId, registerDescription } = useDialogContext()

  // Tells DialogContent it has something to point aria-describedby at.
  React.useEffect(registerDescription, [registerDescription])

  return (
    <p
      id={id ?? descriptionId}
      className={cn("text-sm text-gray-500", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
