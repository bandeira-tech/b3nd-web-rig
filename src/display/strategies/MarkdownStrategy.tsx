/* eslint-disable react-refresh/only-export-components */
import { createElement, type ReactNode, useMemo } from "react";
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

/**
 * Minimal Markdown renderer. We avoid a dependency for now — solo
 * entrepreneurs don't need GFM tables on day one, and the rig stays
 * portable. Covers: ATX headings, fenced code blocks, inline code,
 * bold/italic, paragraphs, unordered lists, links.
 *
 * Anything more advanced (tables, MathJax, embedded HTML) can move to
 * a dedicated app under /apps later.
 */
function renderInline(text: string): ReactNode[] {
  // Order matters: links → code → bold → italic.
  const out: ReactNode[] = [];
  // Split on markdown link `[label](url)`, code `` `code` ``, bold `**x**`, italic `*x*`.
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      out.push(text.slice(cursor, match.index));
    }
    if (match[1] && match[2]) {
      out.push(
        <a
          key={`l-${i}`}
          href={match[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      out.push(
        <code key={`c-${i}`} className="px-1 bg-muted rounded text-xs">
          {match[3]}
        </code>,
      );
    } else if (match[4]) {
      out.push(<strong key={`b-${i}`}>{match[4]}</strong>);
    } else if (match[5]) {
      out.push(<em key={`i-${i}`}>{match[5]}</em>);
    }
    cursor = match.index + match[0].length;
    i++;
  }
  if (cursor < text.length) {
    out.push(text.slice(cursor));
  }
  return out;
}

function renderMarkdown(source: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = source.split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={`pre-${key++}`}
          className="bg-muted rounded-md p-3 text-xs overflow-x-auto"
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const tag = `h${level}`;
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-xs"];
      blocks.push(
        createElement(
          tag,
          {
            key: `h-${key++}`,
            className: `font-semibold ${sizes[level - 1]} mt-3 mb-1`,
          },
          ...renderInline(text),
        ),
      );
      i++;
      continue;
    }

    // Unordered list.
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc list-inside space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line: paragraph break.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: greedy until blank line.
    const paragraph: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^[-*#`]/.test(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${key++}`} className="leading-relaxed">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }
  return blocks;
}

function MarkdownView({ hint }: DisplayStrategyProps) {
  const text = typeof hint.payload === "string"
    ? hint.payload
    : String(hint.payload ?? "");
  const nodes = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      data-testid="display-markdown"
      className="prose-sm max-w-none space-y-2"
    >
      {nodes}
    </div>
  );
}

export const markdownStrategy: DisplayStrategy = {
  id: "core.markdown",
  kinds: ["markdown"],
  label: "Markdown",
  component: MarkdownView,
};
