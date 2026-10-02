import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiVisibilitySection } from "@shared/aiVisibility";

const ENGINE_LABEL: Record<string, string> = { perplexity: "Perplexity", openai: "OpenAI (web search)", google_ai_overview: "Google AI Overviews" };
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** Weekly AI-visibility card for the market-intel report: named-for counts per engine, week-over-week, competitors, cited sources, gaps. */
export default function AiVisibilityCard({ section }: { section: AiVisibilitySection }) {
  if (!section.checked || !section.current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI visibility</CardTitle>
          <CardDescription>{section.reason}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const cur = section.current;
  const change = section.change;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI visibility — week of {cur.weekOf}</CardTitle>
        <CardDescription>
          Whether AI answer engines name Mechanical Enterprise for our target queries. Checked weekly.
          {change ? ` Named for ${cur.namedQueries.length} queries (${signed(change.namedQueriesDelta)} vs last week).` : ` Named for ${cur.namedQueries.length} queries (first week recorded).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          {(Object.keys(cur.engines) as Array<keyof typeof cur.engines>).map((e) => {
            const t = cur.engines[e]!;
            const p = section.previous?.engines[e];
            return (
              <div key={e} data-testid={`ai-engine-${e}`}>
                <span className="font-medium">{ENGINE_LABEL[e] ?? e}</span>: named in {t.named} of {t.checked} answers
                {p ? ` (${signed(t.named - p.named)} vs last week)` : ""}
                {t.failed > 0 && <span className="text-destructive"> · {t.failed} failed</span>}
              </div>
            );
          })}
        </div>
        {change && (change.gained.length > 0 || change.lost.length > 0) && (
          <div>
            {change.gained.map((q) => <div key={`g-${q}`}><Badge className="mr-2">gained</Badge>{q}</div>)}
            {change.lost.map((q) => <div key={`l-${q}`}><Badge variant="destructive" className="mr-2">lost</Badge>{q}</div>)}
          </div>
        )}
        {Object.keys(cur.competitorCounts).length > 0 && (
          <div>
            <div className="font-medium">Competitors named</div>
            {Object.entries(cur.competitorCounts).sort((a, b) => b[1] - a[1]).map(([name, n]) => <div key={name}>{name} — {n} answer{n === 1 ? "" : "s"}</div>)}
          </div>
        )}
        {cur.topCited.length > 0 && (
          <div>
            <div className="font-medium">Sources cited ({(cur.reviewPlatformShare * 100).toFixed(0)}% review/directory platforms)</div>
            <div>{cur.topCited.map((d) => `${d.domain} (${d.count})`).join(", ")}</div>
          </div>
        )}
        {section.gaps.length > 0 && (
          <div>
            <div className="font-medium">Not named for ({section.gaps.length})</div>
            {section.gaps.slice(0, 10).map((g) => <div key={g.query}>{g.query}{g.competitors.length ? ` — instead: ${g.competitors.join(", ")}` : ""}</div>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
