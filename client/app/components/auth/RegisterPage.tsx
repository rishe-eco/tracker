import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useAuth } from "./AuthContext";
import { Link, useLocation, useNavigate } from "react-router";
import { useApi } from "~/api/useApi";
import { REGISTER_MUTATION } from "~/api/queries";
import { useTranslation } from "react-i18next";
import { useSubmitGuard } from "~/utils/useSubmitGuard";



export default function RegisterPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.from?.pathname || "/today";
  const { call, getLastError, loading } = useApi(REGISTER_MUTATION);
  const { submitting, run } = useSubmitGuard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.errors.passwordMismatch"));
      return;
    }

    await run(async () => {
      try {
        const res = await call({ variables: { email, password } });

        if (!res?.register) {
          setError(getLastError() || t("auth.errors.registrationFailed"));
          return;
        }

        const { token } = res.register;
        login(token);
        navigate(fromPath, { replace: true });
      } catch (err: any) {
        setError(err?.message || t("auth.errors.registrationFailed"));
        console.error(err);
      }
    });
  };

  return (
    <main className="p-6 max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("auth.register")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          type="password"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={1}
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder={t("auth.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={1}
          autoComplete="new-password"
        />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <Button type="submit" className="w-full" loading={submitting || loading}>
          {submitting || loading ? t("auth.registering") : t("auth.register")}
        </Button>
      </form>
      <Button variant="link" className="text-yellow-700">
        <Link to="/login">{t("auth.logIn")}</Link>
      </Button>
    </main>
  );
}
