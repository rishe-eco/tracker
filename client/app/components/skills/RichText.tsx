import { Fragment, type ReactNode } from "react";

/**
 * Minimal markdown renderer for authored skill content.
 *
 * Item answers are written the way a real model answer reads, which means bold,
 * lists and code. Rendering them as plain text put literal asterisks and
 * backticks in front of the learner — a tell that has nothing to do with the
 * claim, and one that made the answer harder to read than the thing it is
 * imitating.
 *
 * Deliberately not a markdown library and deliberately not `dangerouslySet
 * InnerHTML`: the supported subset is exactly what the content pack uses, and
 * everything is emitted as React elements, so no authored string can become
 * markup.
 */

type Props = { text: string; className?: string };

export default function RichText({ text, className }: Props) {
  return <div className={className}>{renderBlocks(text)}</div>;
}

function renderBlocks(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre
          key={key++}
          dir="ltr"
          className="my-3 overflow-x-auto rounded-md bg-muted p-3 text-start text-xs leading-relaxed"
        >
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc space-y-1 ps-5">
          {items.map((item, n) => (
            <li key={n}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph — consecutive non-blank, non-structural lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 first:mt-0 last:mb-0">
        {renderInline(para.join(" "))}
      </p>
    );
  }

  return blocks;
}

/** `code`, **bold**, *italic* — in that precedence, so code spans stay literal. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(<Fragment key={key++}>{text.slice(last, match.index)}</Fragment>);
    const token = match[0];

    if (token.startsWith("`")) {
      out.push(
        <code key={key++} dir="ltr" className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      out.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}
