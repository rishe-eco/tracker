import {
  isRouteErrorResponse,
  Links,
  Meta,
  Navigate,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { LinksFunction } from "react-router";
import OnboardingSlideshow from "~/components/onboarding/OnboardingSlideshow";
import { OnboardingTourProvider } from "~/components/onboarding/OnboardingTourContext";
import "./app.css";
import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import ResponsiveNavigation from "./layout/ResponsiveNavigation";
import { getSidebarItems, getBottomBarItems } from "./layout/navigationItems";
import { isInternalPage } from "./layout/pathUtils";
import { useAuth } from "./components/auth/AuthContext";

export function ProtectedAppLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();

  const publicRoutes = ["/login", "/register"];
  const isPublic = publicRoutes.includes(location.pathname);

  if (!ready) return null; // wait for hydration

  if (!isAuthenticated && !isPublic) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const internal = isInternalPage(location.pathname);
  return (
    // The provider spans both the tour and the <Outlet />, so the module intros
    // rendered by pages can wait for the tour to clear.
    <OnboardingTourProvider enabled={isAuthenticated}>
    {isAuthenticated && <OnboardingSlideshow />}
    <div className="flex h-screen flex-col md:flex-row">
      <ResponsiveNavigation
        sidebarItems={getSidebarItems(t)}
        bottomBarItems={getBottomBarItems(t)}
        hideBottomBar={internal}
      />
      <div className={cn("flex-1 flex flex-col min-h-0", !internal && "pb-16")}>
        <Outlet />
      </div>
    </div>
    </OnboardingTourProvider>
  );
}

// export default function App() {
//   console.log('app')
//   return (
//     <AuthProvider>
//       <ProtectedAppLayout />
//     </AuthProvider>
//   );
// }

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// {/* <link rel="manifest" href="/manifest.json" /> */}
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const { t } = useTranslation();
  let message = t("common.oops");
  let details = t("common.unexpectedError");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? t("common.notFound")
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
