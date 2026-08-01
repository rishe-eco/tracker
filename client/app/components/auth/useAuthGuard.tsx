import { useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthContext, useAuth } from "./AuthContext";

export function useAuthGuard() {
  // const { isAuthenticated, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const context = useContext(AuthContext);

  console.log('b')
  useEffect(() => {
    console.log('a')
    console.log(context)
    if (!context) return;
    if (!context.isAuthenticated) {
      navigate("/login", { state: { from: location }, replace: true });
    }
  }, [context, location, navigate]);
}
