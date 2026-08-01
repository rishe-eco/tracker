import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useAuth } from "./AuthContext";
import { useApi } from "~/api/useApi";
import { LOGIN_MUTATION } from "~/api/queries";
import { useTranslation } from "react-i18next";
import { useSubmitGuard } from "~/utils/useSubmitGuard";



export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { call, getLastError } = useApi(LOGIN_MUTATION);
  const { submitting, run } = useSubmitGuard();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    await run(async () => {
      try {
        const res = await call({
          variables: { email, password },
        });

        if (!res?.login?.token) {
          setError(getLastError() || t("auth.errors.loginFailed"));
          return;
        }

        login(res.login.token);
        navigate(from, { replace: true });
      } catch (err: any) {
        setError(err?.message || t("auth.errors.somethingWrong"));
        console.error(err);
      }
    });
  };

  return (
    <main className="p-6 max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("auth.login")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <Button type="submit" className="w-full" loading={submitting}>
          {t("auth.login")}
        </Button>
      </form>
      <Button variant="link" className="text-yellow-600">
        <Link to="/register">{t("auth.register")}</Link>
      </Button>
    </main>
  );
}
