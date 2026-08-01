import { useTranslation } from "react-i18next";
import InternalPageLayout from "~/layout/InternalPageLayout";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold border-b pb-1">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-muted pl-3">
      {children}
    </p>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground shrink-0">{label}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

export default function ConceptsPage() {
  const { t } = useTranslation();

  return (
    <InternalPageLayout title={t("concepts.pageTitle")} maxWidth="max-w-2xl">
      <div className="space-y-10 pb-16">

        {/* Philosophy */}
        <Section id="philosophy" title={t("concepts.philosophy.title")}>
          <P>{t("concepts.philosophy.body")}</P>
        </Section>

        {/* Hierarchy */}
        <Section id="hierarchy" title={t("concepts.hierarchy.title")}>
          <P>{t("concepts.hierarchy.intro")}</P>

          {/* ASCII diagram */}
          <pre className="text-xs font-mono text-muted-foreground bg-muted rounded-md px-4 py-3 leading-5 overflow-x-auto">
{`Goal
 └── Milestone 1
 │    └── Project A  ──→  Action, Action, Action
 └── Milestone 2 (last)
      └── Project B  ──→  Action, Action`}
          </pre>

          <div className="space-y-2 pt-1">
            <P>{t("concepts.hierarchy.goalDesc")}</P>
            <P>{t("concepts.hierarchy.milestoneDesc")}</P>
            <P>{t("concepts.hierarchy.projectDesc")}</P>
            <P>{t("concepts.hierarchy.actionDesc")}</P>
          </div>
          <Example>{t("concepts.hierarchy.example")}</Example>
        </Section>

        {/* Goal Groups */}
        <Section id="goal-groups" title={t("concepts.goalGroups.title")}>
          <P>{t("concepts.goalGroups.regular")}</P>
          <P>{t("concepts.goalGroups.group")}</P>
          <Example>{t("concepts.goalGroups.example")}</Example>
        </Section>

        {/* Intervals vs Routines */}
        <Section id="intervals-routines" title={t("concepts.intervals.title")}>
          <P>{t("concepts.intervals.intro")}</P>
          <P>{t("concepts.intervals.intervalDesc")}</P>
          <P>{t("concepts.intervals.routineDesc")}</P>
          <P>{t("concepts.intervals.gathering")}</P>
          <Example>{t("concepts.intervals.example")}</Example>
        </Section>

        {/* Daily Flow */}
        <Section id="daily-flow" title={t("concepts.dailyFlow.title")}>
          <P>{t("concepts.dailyFlow.intro")}</P>
          <div className="space-y-2 pl-1">
            <Item label={`1. ${t("concepts.dailyFlow.step1Title")}`}>
              {t("concepts.dailyFlow.step1Body")}
            </Item>
            <Item label={`2. ${t("concepts.dailyFlow.step2Title")}`}>
              {t("concepts.dailyFlow.step2Body")}
            </Item>
            <Item label={`3. ${t("concepts.dailyFlow.step3Title")}`}>
              {t("concepts.dailyFlow.step3Body")}
            </Item>
          </div>
          <P>{t("concepts.dailyFlow.skipping")}</P>
        </Section>

        {/* Priority */}
        <Section id="priority" title={t("concepts.priority.title")}>
          <P>{t("concepts.priority.intro")}</P>
          <div className="space-y-1 pl-1">
            <Item label="P">{t("concepts.priority.p").replace(/^P — /, "")}</Item>
            <Item label="S">{t("concepts.priority.s").replace(/^S — /, "")}</Item>
            <Item label="O">{t("concepts.priority.o").replace(/^O — /, "")}</Item>
            <Item label="B">{t("concepts.priority.b").replace(/^B — /, "")}</Item>
          </div>
          <P>{t("concepts.priority.advice")}</P>
        </Section>

        {/* Action Fates */}
        <Section id="action-fates" title={t("concepts.actionFates.title")}>
          <P>{t("concepts.actionFates.intro")}</P>
          <div className="space-y-1 pl-1">
            <P>{t("concepts.actionFates.postponed")}</P>
            <P>{t("concepts.actionFates.outsource")}</P>
            <P>{t("concepts.actionFates.backlog")}</P>
            <P>{t("concepts.actionFates.bucketList")}</P>
            <P>{t("concepts.actionFates.archived")}</P>
          </div>
        </Section>

        {/* DayState */}
        <Section id="daystate" title={t("concepts.dayState.title")}>
          <P>{t("concepts.dayState.intro")}</P>
          <div className="space-y-1 pl-1">
            <P>{t("concepts.dayState.state1")}</P>
            <P>{t("concepts.dayState.state2")}</P>
            <P>{t("concepts.dayState.state3")}</P>
            <P>{t("concepts.dayState.state4")}</P>
          </div>
          <P>{t("concepts.dayState.closing")}</P>
        </Section>

      </div>
    </InternalPageLayout>
  );
}
