import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

/**
 * The breakdown canvas — the one genuinely new component in this tool
 * (03a-decomposition-lab-wireframes.html, plate 5).
 *
 * Three rules that are load-bearing, not stylistic:
 *
 * 1. **No suggestion affordance of any kind.** No autocomplete, no "generate
 *    a breakdown", no template gallery. Decomposition is the most
 *    offloadable skill in the stack — a model produces a plausible
 *    breakdown instantly, and any assist here would train the offloading
 *    instead of the skill.
 * 2. **Enforced level structure, not a free canvas.** A node is depth 1 or
 *    depth 2, with a real parent — not a visual impression of nesting. D2
 *    (breadth-first index) is unmeasurable without "level" being a real
 *    thing.
 * 3. **The done-condition badge reports absence only.** "No done condition
 *    yet" is the only state it shows; there is no green "checkable"
 *    affirmation, because a detector can prove a feature missing but never
 *    prove that a piece ticking the box is a real unit of work.
 *
 * Containment (nesting), sequence (the numbered badge) and dependency (the
 * dashed chip) render as three visually distinct notations on purpose —
 * published decomposition diagrams blend hierarchy and sequence and become
 * unscoreable, and a canvas with one arrow type would reproduce that.
 */

export type CanvasNode = {
  id: string;
  parentId: string | null;
  label: string;
  doneWhen: string;
  dependsOn: string[];
};

export type PalettePiece = { id: string; label: string };

type Props = {
  nodes: CanvasNode[];
  /** Arrangement only: the candidate pieces. Placing one removes it from here. */
  palette?: PalettePiece[];
  /** Breakdown, repair and control: the learner types new piece labels. Arrangement: palette only. */
  freeAuthoring: boolean;
  disabled: boolean;
  onAdd: (input: { id: string; label: string; parentId: string | null }) => void;
  onRemove: (id: string) => void;
  onRelabel: (id: string, label: string) => void;
  onDoneWhenChange: (id: string, doneWhen: string) => void;
  onReparent: (id: string, parentId: string | null) => void;
  onDependsOnChange: (id: string, dependsOn: string[]) => void;
};

let freeNodeCounter = 0;
function freshNodeId(): string {
  freeNodeCounter += 1;
  return `node-${Date.now()}-${freeNodeCounter}`;
}

export default function BreakdownCanvas({
  nodes,
  palette,
  freeAuthoring,
  disabled,
  onAdd,
  onRemove,
  onRelabel,
  onDoneWhenChange,
  onReparent,
  onDependsOnChange,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const topLevel = nodes.filter((n) => n.parentId === null);
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const orderOf = (id: string) => nodes.findIndex((n) => n.id === id) + 1;
  const usedPaletteIds = new Set(nodes.map((n) => n.id));

  const addFreeNode = (parentId: string | null) => {
    if (!draft.trim()) return;
    onAdd({ id: freshNodeId(), label: draft.trim(), parentId });
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {topLevel.map((node) => (
          <NodeRow
            key={node.id}
            node={node}
            depth={1}
            order={orderOf(node.id)}
            allNodes={nodes}
            disabled={disabled}
            onRemove={onRemove}
            onRelabel={onRelabel}
            onDoneWhenChange={onDoneWhenChange}
            onDependsOnChange={onDependsOnChange}
            readOnlyLabel={!freeAuthoring}
          >
            {childrenOf(node.id).map((child) => (
              <NodeRow
                key={child.id}
                node={child}
                depth={2}
                order={orderOf(child.id)}
                allNodes={nodes}
                disabled={disabled}
                onRemove={onRemove}
                onRelabel={onRelabel}
                onDoneWhenChange={onDoneWhenChange}
                onDependsOnChange={onDependsOnChange}
                readOnlyLabel={!freeAuthoring}
              />
            ))}
            {!disabled && (
              <NestUnder
                node={node}
                nodes={nodes}
                freeAuthoring={freeAuthoring}
                palette={palette}
                usedPaletteIds={usedPaletteIds}
                onAdd={onAdd}
                onReparentPick={(childId) => onReparent(childId, node.id)}
              />
            )}
          </NodeRow>
        ))}
      </div>

      {!disabled && freeAuthoring && (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("decomposition.canvas.addPiecePlaceholder")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => addFreeNode(null)} disabled={!draft.trim()}>
            <Plus className="me-1 h-3.5 w-3.5" aria-hidden />
            {t("decomposition.canvas.addTopLevel")}
          </Button>
        </div>
      )}

      {!disabled && !freeAuthoring && palette && palette.length > 0 && (
        <div className="rounded-md border border-dashed p-2">
          <p className="mb-1.5 text-[11px] text-muted-foreground">{t("decomposition.canvas.paletteHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {palette
              .filter((p) => !usedPaletteIds.has(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAdd({ id: p.id, label: p.label, parentId: null })}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Stated because it will look like a missing feature: an assist here would train offloading, not the skill. */}
      <p className="text-[11px] text-muted-foreground">{t("decomposition.canvas.noAssistNote")}</p>
    </div>
  );
}

function NestUnder({
  node,
  nodes,
  freeAuthoring,
  palette,
  usedPaletteIds,
  onAdd,
  onReparentPick,
}: {
  node: CanvasNode;
  nodes: CanvasNode[];
  freeAuthoring: boolean;
  palette?: PalettePiece[];
  usedPaletteIds: Set<string>;
  onAdd: (input: { id: string; label: string; parentId: string | null }) => void;
  onReparentPick: (childId: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const otherTopLevel = nodes.filter((n) => n.parentId === null && n.id !== node.id);

  if (!open) {
    return (
      <button
        type="button"
        className="ms-4 w-fit rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
        onClick={() => setOpen(true)}
      >
        + {t("decomposition.canvas.addNestedPiece")}
      </button>
    );
  }

  return (
    <div className="ms-4 flex items-center gap-2 rounded-md border border-dashed p-2">
      {freeAuthoring ? (
        <>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("decomposition.canvas.addPiecePlaceholder")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!draft.trim()}
            onClick={() => {
              onAdd({ id: freshNodeId(), label: draft.trim(), parentId: node.id });
              setDraft("");
              setOpen(false);
            }}
          >
            {t("decomposition.canvas.addNested")}
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(palette ?? [])
            .filter((p) => !usedPaletteIds.has(p.id))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAdd({ id: p.id, label: p.label, parentId: node.id });
                  setOpen(false);
                }}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                {p.label}
              </button>
            ))}
          {otherTopLevel.length === 0 && (palette ?? []).every((p) => usedPaletteIds.has(p.id)) && (
            <span className="text-[11px] text-muted-foreground">{t("decomposition.canvas.nothingLeft")}</span>
          )}
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        {t("decomposition.canvas.cancel")}
      </Button>
    </div>
  );
}

function NodeRow({
  node,
  depth,
  order,
  allNodes,
  disabled,
  readOnlyLabel,
  onRemove,
  onRelabel,
  onDoneWhenChange,
  onDependsOnChange,
  children,
}: {
  node: CanvasNode;
  depth: 1 | 2;
  order: number;
  allNodes: CanvasNode[];
  disabled: boolean;
  readOnlyLabel: boolean;
  onRemove: (id: string) => void;
  onRelabel: (id: string, label: string) => void;
  onDoneWhenChange: (id: string, doneWhen: string) => void;
  onDependsOnChange: (id: string, dependsOn: string[]) => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [doneWhenOpen, setDoneWhenOpen] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);

  const candidates = allNodes.filter((n) => n.id !== node.id);
  const hasDoneWhen = node.doneWhen.trim().length > 0;

  return (
    <div className={depth === 2 ? "ms-6 border-s-2 ps-3" : ""}>
      <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
        {/* Sequence notation: a numbered badge. Distinct from nesting (indent) and dependency (chip). */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground">
          {order}
        </span>

        {readOnlyLabel ? (
          <span className="flex-1 text-sm">{node.label}</span>
        ) : (
          <input
            value={node.label}
            onChange={(e) => onRelabel(node.id, e.target.value)}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 border-0 bg-transparent text-sm outline-none focus:ring-0"
          />
        )}

        {/* D4 badge: absence only, never a green "checkable" affirmation — a
            detector can prove the condition missing, never that one present
            is a real unit of work. So the filled state shows the learner's
            own text back to them (information), not a verdict; only the
            empty state carries any evaluative colour at all. */}
        <button
          type="button"
          onClick={() => !disabled && setDoneWhenOpen((v) => !v)}
          className={`min-w-0 max-w-[9rem] shrink-0 truncate rounded px-1.5 py-0.5 font-mono text-[10px] ${
            hasDoneWhen ? "text-muted-foreground" : "text-amber-600 dark:text-amber-500"
          }`}
          title={hasDoneWhen ? node.doneWhen : undefined}
        >
          {hasDoneWhen ? node.doneWhen : t("decomposition.canvas.noDoneWhenYet")}
        </button>

        {/* Dependency notation: a dashed chip, never the same visual as the sequence badge or nesting. */}
        <button
          type="button"
          onClick={() => !disabled && setDepsOpen((v) => !v)}
          className={`shrink-0 rounded-full border border-dashed px-2 py-0.5 font-mono text-[10px] ${
            node.dependsOn.length > 0 ? "border-primary text-primary" : "text-muted-foreground"
          }`}
        >
          {node.dependsOn.length > 0
            ? t("decomposition.canvas.blockedByCount", { count: node.dependsOn.length })
            : t("decomposition.canvas.noDependency")}
        </button>

        {!disabled && (
          <button
            type="button"
            onClick={() => onRemove(node.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={t("decomposition.canvas.removePiece")}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {doneWhenOpen && (
        <div className="mt-1 ms-7">
          <Input
            value={node.doneWhen}
            onChange={(e) => onDoneWhenChange(node.id, e.target.value)}
            disabled={disabled}
            placeholder={t("decomposition.canvas.doneWhenPlaceholder")}
            autoComplete="off"
            className="h-8 text-xs"
          />
        </div>
      )}

      {depsOpen && candidates.length > 0 && (
        <div className="mt-1 ms-7 flex flex-wrap gap-1.5 rounded-md border border-dashed p-2">
          {candidates.map((c) => (
            <label key={c.id} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                disabled={disabled}
                checked={node.dependsOn.includes(c.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...node.dependsOn, c.id]
                    : node.dependsOn.filter((id) => id !== c.id);
                  onDependsOnChange(node.id, next);
                }}
              />
              {c.label || c.id}
            </label>
          ))}
        </div>
      )}

      {children && <div className="mt-1.5 flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}
