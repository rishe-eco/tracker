import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { LoadingBlock } from "../ui/spinner";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useApi } from "~/api/useApi";
import { useSubmitGuard, useKeyedSubmitGuard } from "~/utils/useSubmitGuard";
import { CREATE_API_TOKEN, GET_API_TOKENS, REVOKE_API_TOKEN } from "~/api/queries";

type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  scope: "read" | "write";
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : format(d, "MMM d, yyyy");
}

export default function ApiTokensSection() {
  const { t } = useTranslation();
  const { call } = useApi();
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

  const { submitting: creating, run: runCreate } = useSubmitGuard();
  const { isSubmitting: isRevoking, run: runRevoke } = useKeyedSubmitGuard();

  const load = () =>
    call({ query: GET_API_TOKENS }).then((res: any) => setTokens(res?.apiTokens ?? []));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    await runCreate(async () => {
      try {
        const res: any = await call({
          query: CREATE_API_TOKEN,
          variables: { name: name.trim(), scope },
        });
        // The only moment this value exists in the app. It is deliberately not
        // persisted anywhere — losing it means issuing a new token.
        setIssued(res?.createApiToken?.token ?? null);
        setCopied(false);
        setName("");
        await load();
      } catch (err: any) {
        setError(err?.message ?? t("apiTokens.errors.createFailed"));
      }
    });
  };

  const handleCopy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      setError(t("apiTokens.errors.copyFailed"));
    }
  };

  const handleRevoke = async (token: ApiToken) => {
    await runRevoke(token.id, async () => {
      await call({ query: REVOKE_API_TOKEN, variables: { id: token.id } });
      await load();
    });
  };

  const list = (tokens ?? []) as ApiToken[];
  const active = list.filter((tk) => !tk.revokedAt);
  const revoked = list.filter((tk) => tk.revokedAt);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          {t("apiTokens.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("apiTokens.description")}</p>
      </div>

      {issued && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">{t("apiTokens.issuedTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("apiTokens.issuedWarning")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
              {issued}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("apiTokens.copied") : t("apiTokens.copy")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIssued(null)}>
              {t("apiTokens.dismiss")}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Label htmlFor="api-token-name">{t("apiTokens.nameLabel")}</Label>
          <Input
            id="api-token-name"
            value={name}
            maxLength={60}
            placeholder={t("apiTokens.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="api-token-scope">{t("apiTokens.scopeLabel")}</Label>
          <select
            id="api-token-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as "read" | "write")}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="read">{t("apiTokens.scopeRead")}</option>
            <option value="write">{t("apiTokens.scopeWrite")}</option>
          </select>
        </div>
        <Button type="submit" size="sm" loading={creating} disabled={!name.trim()}>
          {t("apiTokens.generate")}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {tokens == null ? (
        <LoadingBlock />
      ) : list.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t("apiTokens.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {[...active, ...revoked].map((token) => {
            const expiry = formatDate(token.expiresAt);
            const lastUsed = formatDate(token.lastUsedAt);
            return (
              <li
                key={token.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                  token.revokedAt ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {token.name}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {token.prefix}…
                    </code>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {token.scope === "write" ? t("apiTokens.scopeWrite") : t("apiTokens.scopeRead")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {token.revokedAt
                      ? t("apiTokens.revokedOn", { date: formatDate(token.revokedAt) })
                      : lastUsed
                        ? t("apiTokens.lastUsed", { date: lastUsed })
                        : t("apiTokens.neverUsed")}
                    {expiry && !token.revokedAt ? ` · ${t("apiTokens.expires", { date: expiry })}` : ""}
                  </p>
                </div>
                {!token.revokedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevokeTarget(token)}
                    loading={isRevoking(token.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("apiTokens.revoke")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={revokeTarget != null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={t("apiTokens.revokeConfirmTitle")}
        description={t("apiTokens.revokeConfirmBody", { name: revokeTarget?.name ?? "" })}
        confirmLabel={t("apiTokens.revoke")}
        variant="destructive"
        onConfirm={async () => {
          if (revokeTarget) await handleRevoke(revokeTarget);
        }}
      />
    </section>
  );
}
