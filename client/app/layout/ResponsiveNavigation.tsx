import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "~/lib/utils";

// --- Types ---
type SidebarNavItem = {
  id: string;
  title: string;
  href: string;
  icon: ReactNode;
  children?: SidebarNavItem[];
};

type BottomBarNavItem = {
  id: string;
  icon: ReactNode;
  href: string;
  title?: string;
};

type ResponsiveNavigationProps = {
  sidebarItems: SidebarNavItem[];
  bottomBarItems: BottomBarNavItem[];
  /** When true, hide the bottom bar (e.g. on internal/detail pages). */
  hideBottomBar?: boolean;
};

// --- Component ---
export default function ResponsiveNavigation({
  sidebarItems,
  bottomBarItems,
  hideBottomBar = false,
}: ResponsiveNavigationProps) {
  const location = useLocation();

  return (
    <>
      {/* Sidebar Navigation (md and up) */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-white p-4">
        <nav className="space-y-2">
          {sidebarItems.map((item) => (
            <SidebarItem key={item.id} item={item} currentPath={location.pathname} />
          ))}
        </nav>
      </aside>

      {/* Bottom Bar Navigation (mobile) - hidden on internal pages */}
      {!hideBottomBar && (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t bg-white p-2 md:hidden">
          {bottomBarItems.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              aria-label={item.title}
              className={cn(
                "flex flex-col items-center text-sm text-muted-foreground",
                location.pathname === item.href && "text-primary"
              )}
            >
              {item.icon}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

// --- Sidebar Item Renderer ---
function SidebarItem({ item, currentPath }: { item: SidebarNavItem; currentPath: string }) {
  const isActive = currentPath === item.href;

  return (
    <div>
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted",
          isActive && "bg-muted text-primary"
        )}
      >
        {item.icon}
        <span>{item.title}</span>
      </Link>
      {item.children && (
        <div className="ms-6 mt-1 space-y-1">
          {item.children.map((child) => (
            <SidebarItem key={child.id} item={child} currentPath={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
}
