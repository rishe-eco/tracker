import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./components/auth/AuthContext";
import { RouterProvider, createBrowserRouter } from "react-router";
import { ProtectedAppLayout } from "./root";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import protectedRoutes from "./protectedRoutes";
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import "./i18n/config";

const root = document.getElementById("root")!;
// const { ApolloClient, InMemoryCache, ApolloProvider } = await import("@apollo/client");

const client = new ApolloClient({
  uri: import.meta.env.VITE_API_URL || "http://localhost:4000/graphql",
  cache: new InMemoryCache(),
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedAppLayout />,
    children: protectedRoutes,
    // children: [
    //   { path: "today", element: <TodayPage /> },
    //   // other child routes like /activities, /projects, etc.
    // ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
]);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ApolloProvider>
  </React.StrictMode>
);


