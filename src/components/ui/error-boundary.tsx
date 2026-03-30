"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="border-red-100">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-purple-400" />
            <h3 className="text-base font-semibold text-gray-900">
              Something went wrong
            </h3>
            <p className="mb-4 mt-1 max-w-xs text-sm text-gray-500">
              This section failed to load. Please try again.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
