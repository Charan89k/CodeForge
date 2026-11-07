"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Send,
} from "lucide-react";
import { useTheme } from "next-themes";
// react-resizable-panels v4 renamed PanelGroup -> Group and
// PanelResizeHandle -> Separator, and `direction` -> `orientation`.
import { Group, Panel, Separator } from "react-resizable-panels";

import { useIsMobile } from "@/hooks/use-mobile";

import { runCodeAction, submitCodeAction } from "@/app/(shell)/problems/actions";
import {
  LiveVisualizer,
  type VisualSample,
} from "@/components/live-visual/live-visualizer";
import { TestResults } from "@/components/problems/test-results";
import { TutorLauncher } from "@/components/tutor/tutor-launcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Language } from "@/generated/prisma/enums";
import { describeWireFormat } from "@/lib/code-execution/custom-input";
import { CUSTOM_INPUT_LIMITS } from "@/lib/code-execution/limits";
import {
  LANGUAGE_LABEL,
  SUPPORTED_LANGUAGES,
  type Signature,
} from "@/lib/code-execution/signature";
import { isTraceable } from "@/lib/trace/types";
import { cn } from "@/lib/utils";
import type {
  TutorContextLabel,
  TutorQuickAction,
  TutorCodeState,
} from "@/lib/tutor/types";
import type { SubmitOutcome, RunOutcome } from "@/services/submissions";

/**
 * The coding workspace: editor, controls, and results.
 *
 * Monaco is loaded dynamically because it is by far the largest dependency
 * in the app, and nothing else in the product needs it.
 *
 * Draft code is kept in localStorage per problem and language, so a refresh
 * or an accidental navigation does not lose work. It is explicitly a
 * convenience, not storage: it is per-browser, never synced, and every
 * access is guarded because a private window can refuse it.
 */
const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then((m) => m.CodeEditor),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> }
);

type Props = {
  slug: string;
  starterCode: Record<string, string>;
  defaultLanguage: Language;
  signedIn: boolean;
  /** Rendered in the left pane on desktop, and in a tab on mobile. */
  description: React.ReactNode;
  /** Drives the live visualizer; null when the problem has none stored. */
  signature: Signature | null;
  samples: VisualSample[];
  /**
   * Tutor wiring.
   *
   * The tutor lives inside the workspace rather than beside it because
   * this component owns the two things that make it code-aware: the
   * editor buffer and the outcome of the last run. Lifting either of
   * those out to a sibling would mean duplicating editor state, and two
   * sources of truth for "what is in the editor" is exactly the bug that
   * makes a code tutor answer about code the learner is not looking at.
   */
  tutor: {
    label: TutorContextLabel;
    quickActions: TutorQuickAction[];
    enabled: boolean;
  };
  /** Whether this deployment runs code, and the limits each test runs under. */
  execution: {
    available: boolean;
    reason?: string;
    timeLimitSeconds: number;
    memoryLimitMb: number;
  };
  /** The server's guess at a phone, so hydration starts in the right layout. */
  likelyMobile?: boolean;
};

const subscribeToNothing = () => () => {};

function draftKey(slug: string, language: Language) {
  return `tech-epitome:draft:${slug}:${language}`;
}

/**
 * Reads a saved draft, falling back to the starter code.
 *
 * Every access is guarded: a private window, cleared site data or a blocked
 * storage policy all throw here, and none of them should stop the editor
 * from opening.
 */
function loadDraft(
  slug: string,
  language: Language,
  starterCode: Record<string, string>
): string {
  try {
    const saved = window.localStorage.getItem(draftKey(slug, language));
    if (saved !== null) return saved;
  } catch {
    // Fall through to the starter code.
  }
  return starterCode[language] ?? "";
}

export function ProblemWorkspace({
  slug,
  starterCode,
  defaultLanguage,
  signedIn,
  description,
  signature,
  samples,
  tutor,
  execution,
  likelyMobile = false,
}: Props) {
  // Only one layout is rendered at a time. Showing both and hiding one
  // with CSS would put two live Monaco instances on the page: double the
  // memory, and an ambiguous `getModels()[0]`. The server picks the first
  // layout from the request so a phone hydrates straight into the tabs
  // instead of swapping from desktop (which remounted the description and
  // detached any selection in it).
  const isMobile = useIsMobile(likelyMobile);

  const available = SUPPORTED_LANGUAGES.filter((language) => starterCode[language]);
  const initialLanguage = available.includes(defaultLanguage)
    ? defaultLanguage
    : (available[0] ?? "PYTHON");

  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [code, setCode] = useState(() => loadDraft(slug, initialLanguage, starterCode));
  const [loadedFor, setLoadedFor] = useState(initialLanguage);
  const [outcome, setOutcome] = useState<(RunOutcome & Partial<SubmitOutcome>) | null>(
    null
  );
  const [mode, setMode] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [focused, setFocused] = useState(false);

  // Dark unless the person chose light themselves. A light operating system
  // setting is not that choice. The server cannot know, so it renders dark.
  const { theme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  const editorTheme = hydrated && theme === "light" ? "light" : "dark";

  // Custom input: one test case the learner writes, in the same format as
  // the samples, run through the problem's own harness. Seeded with the
  // first sample so the format is shown by example, not just described.
  const [useCustom, setUseCustom] = useState(false);
  const [customInput, setCustomInput] = useState(() => samples[0]?.input ?? "");
  const customAvailable = signature !== null;
  const runsCustom = useCustom && customAvailable;

  // Live visualizer wiring: a token to request an auto-playing trace, the
  // line it is on (mirrored into the editor), and which pane is showing.
  const [runToken, setRunToken] = useState(0);
  const [highlight, setHighlight] = useState<{
    line: number;
    kind: "step" | "error";
  } | null>(null);
  const [leftPane, setLeftPane] = useState<"description" | "visualize">("description");
  const [mobilePane, setMobilePane] = useState("problem");
  const traceable = isTraceable(language);

  const onTraceLine = useCallback((line: number | null, kind: "step" | "error") => {
    setHighlight(line === null ? null : { line, kind });
  }, []);

  function visualize() {
    setRunToken((token) => token + 1);
    setLeftPane("visualize");
    setMobilePane("visual");
  }

  // Switching language loads that language's draft, or its starter code.
  // Adjusting state during render is React's documented way to respond to a
  // changed value; doing it in an effect renders the previous language's
  // code once first, which is a visible flash of the wrong source.
  if (language !== loadedFor) {
    setLoadedFor(language);
    setCode(loadDraft(slug, language, starterCode));
  }

  /**
   * Live editor state for the tutor.
   *
   * Recreated whenever the editor changes, which is the point: the tutor
   * must reason about the buffer as it is when the learner presses send,
   * not as it was when the panel mounted. The identity churn is harmless —
   * nothing subscribes to this function, it is only invoked.
   */
  const getTutorCode = useCallback((): TutorCodeState => {
    const result = outcome?.result;

    return {
      language,
      code,
      lastRun: result
        ? {
            mode: mode ?? "run",
            status: result.status,
            passed: result.passed,
            total: result.total,
            // Compile error first, then the first failing case's stderr.
            // Only sample cases carry stderr, so a hidden test's output
            // cannot reach the tutor through here.
            errorMessage:
              result.compileError ??
              result.results.find((test) => test.stderr)?.stderr ??
              null,
          }
        : undefined,
    };
  }, [code, language, outcome, mode]);

  const persist = useCallback(
    (next: string) => {
      setCode(next);
      try {
        window.localStorage.setItem(draftKey(slug, language), next);
      } catch {
        // Losing the draft is a minor inconvenience; breaking typing is not.
      }
    },
    [slug, language]
  );

  function reset() {
    const starter = starterCode[language] ?? "";
    setCode(starter);
    setOutcome(null);
    setError(null);
    try {
      window.localStorage.removeItem(draftKey(slug, language));
    } catch {
      // Ignored for the same reason as above.
    }
  }

  function execute(which: "run" | "submit") {
    // A run is also a trace: the picture should follow the code the
    // learner just ran, without a second click. Not for a custom input:
    // the visualizer traces a sample, which is not what they just ran.
    if (which === "run" && !runsCustom && traceable && signature) {
      setRunToken((token) => token + 1);
      setLeftPane("visualize");
    }
    setError(null);
    setMode(which);
    startTransition(async () => {
      const response =
        which === "submit"
          ? await submitCodeAction({ slug, language, code })
          : await runCodeAction({
              slug,
              language,
              code,
              ...(runsCustom ? { customInput } : {}),
            });
      if (response.ok) {
        setOutcome(response.data);
      } else {
        setOutcome(null);
        setError(response.error);
      }
    });
  }

  const tutorLauncher = (
    <TutorLauncher
      anchor={{ kind: "PROBLEM", problemSlug: slug }}
      label={tutor.label}
      quickActions={tutor.quickActions}
      getCode={getTutorCode}
      enabled={tutor.enabled}
      variant="ghost"
    />
  );

  const canRun = !pending && execution.available;
  const canSubmit = canRun && signedIn;

  // Capture phase, because Monaco claims Ctrl+Enter for itself. No dependency
  // list: `execute` closes over the current code, so it must never go stale.
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        if (canSubmit) execute("submit");
      } else if (canRun) {
        execute("run");
      }
    }
    window.addEventListener("keydown", onShortcut, true);
    return () => window.removeEventListener("keydown", onShortcut, true);
  });

  // Bubble phase, so Escape closes Monaco's suggestions before it leaves focus.
  useEffect(() => {
    if (!focused) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFocused(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [focused]);

  const controls = (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <Select
        value={language}
        onValueChange={(value) => setLanguage(value as Language)}
      >
        <SelectTrigger size="sm" className="h-8 w-36" aria-label="Language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {available.map((item) => (
            <SelectItem key={item} value={item}>
              {LANGUAGE_LABEL[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={reset}
        aria-label="Reset to starter code"
      >
        <RotateCcw className="size-3.5" />
        Reset
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {/* Desktop only. On a phone the editor lives behind a tab, and a
            tutor you can only reach from the Code tab is a tutor you
            cannot reach while reading the problem — so the mobile layout
            renders it in the persistent header below instead. Exactly one
            of the two is ever mounted, because only one layout is. */}
        {!isMobile && tutorLauncher}

        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setFocused((on) => !on)}
            aria-pressed={focused}
          >
            {focused ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
            Focus mode
          </Button>
        )}

        {signature && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-brand-300 hover:text-brand-200"
            onClick={visualize}
            disabled={!traceable}
            title={
              traceable
                ? "Run on an example and watch each line execute"
                : "Step-by-step tracing is available for Python and JavaScript"
            }
          >
            <Activity className="size-3.5" />
            Visualize
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => execute("run")}
          disabled={!canRun}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          {pending && mode === "run" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="size-3.5" />
          )}
          Run
        </Button>

        <Button
          size="sm"
          className="h-8"
          onClick={() => execute("submit")}
          disabled={!canSubmit}
          aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter"
          title={
            !execution.available
              ? execution.reason
              : signedIn
                ? undefined
                : "Sign in to submit"
          }
        >
          {pending && mode === "submit" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-3.5" />
          )}
          Submit
        </Button>
      </div>
    </div>
  );

  const editorPane = (
    <div
      className={cn(
        "flex h-full flex-col bg-background text-foreground",
        editorTheme === "dark" && "dark"
      )}
    >
      {controls}
      {!execution.available ? (
        <p
          role="status"
          className="border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {execution.reason} You can still read the problem, write code, use hints and
          the visualizer.
        </p>
      ) : (
        <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
          Limits per test: {execution.timeLimitSeconds} s CPU, {execution.memoryLimitMb}{" "}
          MB memory, 1 MB output. No network access.
        </p>
      )}
      <div className="min-h-0 flex-1">
        <CodeEditor
          language={language}
          value={code}
          onChange={persist}
          highlight={highlight}
          theme={editorTheme}
        />
      </div>
      <p className="border-t border-border px-3 py-1.5 text-[0.65rem] text-muted-foreground/70">
        Tab moves focus out of the editor. Press Ctrl+M to let Tab indent instead.
        Ctrl+Enter runs. Ctrl+Shift+Enter submits.
      </p>
    </div>
  );

  const resultsPane = (
    <section aria-labelledby="test-results-heading" className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 id="test-results-heading" className="text-xs font-medium">
          Test results
        </h2>
        {!signedIn && (
          <span className="text-[0.68rem] text-muted-foreground">
            Sign in to submit and record progress
          </span>
        )}
        {customAvailable && (
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id={`custom-input-${slug}`}
              checked={useCustom}
              onCheckedChange={setUseCustom}
              disabled={pending}
            />
            <Label
              htmlFor={`custom-input-${slug}`}
              className="text-[0.7rem] font-normal"
            >
              Run with custom input
            </Label>
          </div>
        )}
      </div>
      {runsCustom && signature && (
        <div className="space-y-2 border-b border-border px-3 py-2.5">
          <Textarea
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            maxLength={CUSTOM_INPUT_LIMITS.maxChars}
            rows={4}
            spellCheck={false}
            aria-label="Custom input"
            className="font-mono text-[0.72rem]"
          />
          <ul className="space-y-0.5 text-[0.65rem] leading-relaxed text-muted-foreground">
            {describeWireFormat(signature).map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>Run shows what your function returns. Submit still runs every test.</li>
          </ul>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <TestResults
            outcome={outcome}
            pending={pending}
            mode={mode}
            custom={runsCustom}
          />
        )}
      </div>
    </section>
  );

  const visualPane = signature ? (
    <LiveVisualizer
      signature={signature}
      samples={samples}
      language={language}
      code={code}
      runToken={runToken}
      onLine={onTraceLine}
    />
  ) : (
    <p className="p-6 text-sm text-muted-foreground">This problem has no visual yet.</p>
  );

  if (isMobile) {
    // Stacked tabs: a three-way split at 390px is unusable.
    return (
      <Tabs value={mobilePane} onValueChange={setMobilePane}>
        <div className="flex items-center justify-end border-b border-border px-2 py-1.5">
          {tutorLauncher}
        </div>

        <TabsList className="w-full rounded-none">
          <TabsTrigger value="problem" className="flex-1">
            Problem
          </TabsTrigger>
          <TabsTrigger value="code" className="flex-1">
            Code
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex-1">
            Visual
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1">
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="problem" className="mt-0 px-4 py-5">
          {description}
        </TabsContent>

        <TabsContent value="code" className="mt-0">
          <div className="h-[70dvh]">{editorPane}</div>
        </TabsContent>

        <TabsContent value="visual" className="mt-0">
          <div className="h-[75dvh]">{visualPane}</div>
        </TabsContent>

        <TabsContent value="results" className="mt-0">
          <div className="min-h-[50dvh]">{resultsPane}</div>
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div
      data-testid="problem-workspace"
      className={cn(
        "h-[calc(100dvh-3.5rem)]",
        focused && "fixed inset-0 z-50 h-dvh bg-background"
      )}
    >
      <Group orientation="horizontal" id="tech-epitome-problem-h" className="h-full">
        <Panel defaultSize="42%" minSize="25%">
          <Tabs
            value={leftPane}
            onValueChange={(value) => setLeftPane(value as typeof leftPane)}
            className="flex h-full flex-col gap-0"
          >
            <div className="flex items-center border-b border-border bg-card/40 px-2">
              <TabsList className="h-10 bg-transparent p-0">
                <PaneTab value="description" icon={FileText} label="Description" />
                <PaneTab
                  value="visualize"
                  icon={Activity}
                  label="Visualizer"
                  live={traceable}
                />
              </TabsList>
            </div>
            {/* forceMount keeps both mounted: the description holds draft
                notes and highlights, and the visualizer holds its trace. */}
            <TabsContent
              value="description"
              forceMount
              className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-6 data-[state=inactive]:hidden"
            >
              {description}
            </TabsContent>
            <TabsContent
              value="visualize"
              forceMount
              className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
            >
              {visualPane}
            </TabsContent>
          </Tabs>
        </Panel>

        <ResizeHandle orientation="horizontal" />

        <Panel defaultSize="58%" minSize="30%">
          <Group orientation="vertical" id="tech-epitome-problem-v" className="h-full">
            <Panel defaultSize="62%" minSize="25%">
              {editorPane}
            </Panel>
            <ResizeHandle orientation="vertical" />
            <Panel defaultSize="38%" minSize="15%">
              {resultsPane}
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}

function ResizeHandle({ orientation }: { orientation: "horizontal" | "vertical" }) {
  return (
    <Separator
      className={cn(
        "bg-border transition-colors hover:bg-brand-500/40 data-[state=dragging]:bg-brand-500/60",
        orientation === "horizontal"
          ? "w-px cursor-col-resize"
          : "h-px cursor-row-resize"
      )}
      aria-label={`Resize ${orientation === "horizontal" ? "panels" : "editor"}`}
    />
  );
}

function PaneTab({
  value,
  icon: Icon,
  label,
  live = false,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  live?: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative h-10 rounded-none border-0 bg-transparent px-3 text-xs shadow-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-brand-500"
    >
      <Icon className="size-3.5" />
      {label}
      {live && (
        <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
      )}
    </TabsTrigger>
  );
}
