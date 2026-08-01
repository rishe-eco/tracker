import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type InternalPageLayoutProps = {
  /** Optional back link (shown at top for navigation). */
  backLink?: { to: string; label: string };
  /** Page title (e.g. "Edit Project", "New Action"). */
  title: ReactNode;
  /** Optional actions (buttons) next to the title. */
  actions?: ReactNode;
  /** Main content. */
  children: ReactNode;
  /** Extra class for the main content area. */
  contentClassName?: string;
  /** Max width for content (e.g. max-w-xl, max-w-2xl). Default: none. */
  maxWidth?: string;
};

/**
 * Layout for internal/detail pages: top space for nav, then title + buttons, then content.
 * Use on form and detail pages (not on list pages).
 */
export default function InternalPageLayout({
  backLink,
  title,
  actions,
  children,
  contentClassName,
  maxWidth,
}: InternalPageLayoutProps) {
  return (
    <main className={cn("flex flex-col flex-1 min-h-0 overflow-hidden", maxWidth && "mx-auto w-full", maxWidth)}>
      {/* Top: space for navigation (back link only) */}
      <div className="flex-shrink-0 pt-4 px-4 md:pt-6 md:px-6">
        {backLink && (
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link to={backLink.to}>{backLink.label}</Link>
          </Button>
        )}
        {/* Title and optional actions — w-full so custom title content can span and push actions to the right */}
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          {typeof title === "string" ? (
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          ) : (
            <div className="text-2xl font-bold tracking-tight w-full min-w-0">{title}</div>
          )}
          {actions != null && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
      {/* Scrollable content: pt-6 for consistent gap below page title */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-auto pt-6 px-4 pb-6 md:px-6",
          contentClassName
        )}
      >
        {children}
      </div>
    </main>
  );
}
