"use client";

import { useEffect, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";

import type { Language } from "@/generated/prisma/enums";
import { MONACO_LANGUAGE } from "@/lib/code-execution/signature";

/**
 * Monaco, configured for solving a problem rather than editing a project.
 *
 * Accessibility: Monaco traps Tab by default so the key can indent, which
 * makes the editor a keyboard trap. `tabFocusMode` is enabled on mount and
 * the shortcut to toggle it is documented beneath the editor, so a keyboard
 * user can always get out. That is the single most important thing to get
 * right when embedding a code editor in a page.
 */
export function CodeEditor({
  language,
  value,
  onChange,
  readOnly = false,
  highlight = null,
  theme,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  /**
   * A line to mark: the one the live trace is on, or the one an error came
   * from. Drawn as a whole-line tint plus a gutter marker, and scrolled into
   * view only when it is off screen, so stepping does not yank the editor.
   */
  highlight?: { line: number; kind: "step" | "error" } | null;
  /** Overrides the site theme. */
  theme?: "light" | "dark";
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const decorationsRef = useRef<ReturnType<
    Parameters<OnMount>[0]["createDecorationsCollection"]
  > | null>(null);

  const highlightLine = highlight?.line ?? null;
  const highlightKind = highlight?.kind ?? "step";

  useEffect(() => {
    const editor = editorRef.current;
    const decorations = decorationsRef.current;
    if (!editor || !decorations) return;
    const lineCount = editor.getModel()?.getLineCount() ?? 0;
    if (highlightLine === null || highlightLine < 1 || highlightLine > lineCount) {
      decorations.clear();
      return;
    }
    decorations.set([
      {
        range: {
          startLineNumber: highlightLine,
          startColumn: 1,
          endLineNumber: highlightLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: highlightKind === "error" ? "trace-line-error" : "trace-line",
          linesDecorationsClassName:
            highlightKind === "error" ? "trace-gutter-error" : "trace-gutter",
        },
      },
    ]);
    editor.revealLineInCenterIfOutsideViewport(highlightLine);
  }, [highlightLine, highlightKind]);

  const { resolvedTheme } = useTheme();
  const editorTheme =
    (theme ?? resolvedTheme) === "light" ? "tech-epitome-light" : "tech-epitome-dark";

  // Both themes match --card so the editor sits flush with its panel; the
  // `theme` prop switches between them when the site theme changes.
  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("tech-epitome-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0d1524",
        "editorGutter.background": "#0d1524",
        "editorLineNumber.foreground": "#7e8aa3",
        "editorLineNumber.activeForeground": "#c7d2fe",
        "editor.lineHighlightBackground": "#111b2e",
        "editorCursor.foreground": "#818cf8",
        "editor.selectionBackground": "#6557f555",
      },
    });
    monaco.editor.defineTheme("tech-epitome-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#ffffff",
        "editorGutter.background": "#ffffff",
        "editorLineNumber.foreground": "#5e6a82",
        "editorLineNumber.activeForeground": "#312e81",
        "editor.lineHighlightBackground": "#eef2fa",
        "editorCursor.foreground": "#4f46e5",
        "editor.selectionBackground": "#4f46e533",
      },
    });
  };

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection();

    // Tab moves focus instead of indenting, so the editor is not a trap.
    // Ctrl+M toggles it back for anyone who wants Tab to indent.
    editor.updateOptions({ tabFocusMode: true });
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={MONACO_LANGUAGE[language]}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        beforeMount={beforeMount}
        onMount={onMount}
        theme={editorTheme}
        loading={
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading editor…
          </div>
        }
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontLigatures: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          lineNumbersMinChars: 3,
          renderLineHighlight: "line",
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          // The editor is a text field, not an IDE: suggestions from a
          // language service that has no project context are mostly noise.
          quickSuggestions: false,
          wordBasedSuggestions: "currentDocument",
          accessibilitySupport: "auto",
        }}
      />
    </div>
  );
}
