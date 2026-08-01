import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Pencil, Plus } from "lucide-react";
import ActionPreview from "~/components/actions/ActionPreview";
import type { Action } from "../actions/ActionsListPage";
import { useApi } from "~/api/useApi";
import { ADD_ACTION, DELETE_ACTION, GET_STANDALONE_ACTIONS } from "~/api/queries";
import { toLocalDateString } from "~/utils/dateUtils";
import { LoadingBlock } from "~/components/ui/spinner";

export default function TodayActionWidget() {
  const [actions, setActions] = useState<Action[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const { call } = useApi();
  const { t } = useTranslation();

  const todayISO = toLocalDateString(new Date());

  useEffect(() => {
    async function fetchStandaloneActions() {
      call({ query: GET_STANDALONE_ACTIONS, variables: { date: todayISO } })
        .then((res) => setActions(res?.standaloneActions ?? []))
        .finally(() => setLoading(false));
      // const res = await fetch("http://localhost:4000/graphql", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     query: STANDALONE_ACTIONS,
      //     variables: { date: todayISO },
      //   }),
      // });

      // const json = await res.json();
    }

    fetchStandaloneActions();
  }, []);

  async function handleAdd() {
    if (input.trim() === "") return;

    call({ query: ADD_ACTION, variables: { title: input.trim(), tbd: todayISO } }).then((res) => {
      const newAction = res?.addAction;
      if (newAction) setActions((prev) => [...prev, newAction]);
      setInput("");
    });

    // const res = await fetch("http://localhost:4000/graphql", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     query: `
    //       mutation AddAction($title: String!, $tbd: String) {
    //         addAction(title: $title, tbd: $tbd) {
    //           id
    //           title
    //           tbd
    //           done
    //         }
    //       }
    //     `,
    //   }),
    // });

    // const json = await res.json();
  }

  async function handleDelete(id: string) {
    call({ query: DELETE_ACTION, variables: { id } }).then(() => {
      setActions((prev) => prev.filter((action) => action.id !== id));
    });
    // await fetch("http://localhost:4000/graphql", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     query: ,
    //     variables: { id },
    //   }),
    // });

  }

  if (loading) return <LoadingBlock className="p-6" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Label htmlFor="today-widget-add-title" className="flex items-center gap-2 shrink-0 text-muted-foreground">
          <Pencil className="h-4 w-4" aria-hidden />
        </Label>
        <Input
          id="today-widget-add-title"
          placeholder={t("today.addActionForToday")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} size="icon" variant="default">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <ActionPreview
            key={action.id}
            action={action}
            onDelete={() => handleDelete(action.id as string)}
            onReschedule={() => console.log("Reschedule", action.id)}
          />
        ))}
      </div>
    </div>
  );
}
