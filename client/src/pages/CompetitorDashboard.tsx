import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Check, ExternalLink, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardFooter from "@/components/DashboardFooter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { resolveNavRole } from "@/lib/navigation";
import { adLibraryLinks, brandMetricSource, brandTermsFor, brandValue, keywordGap, shareOfSearch, type DomainMetrics } from "@shared/competitorDashboard";

/**
 * Competitors dashboard — a Similarweb-style view built only from free sources
 * (server/services/seo/intel/competitorDashboard.ts). Brand-search demand stands in for
 * "traffic": nobody outside a company has its visit counts for free, so the page says so.
 */

// Reference categorical palette (dataviz skill, validated light/dark). Slot order is fixed by
// the domain's position in the list (us first), so a competitor keeps its color as others come and go.
const VIZ_CSS = `
.viz-root { --series-1:#2a78d6; --series-2:#eb6834; --series-3:#1baf7a; --series-4:#eda100; --series-5:#e87ba4; --series-6:#008300; --series-7:#6250d6; --series-8:#e34948; --viz-neutral:#a3a29b; --viz-grid:#e6e4dd; --viz-ink:#5f5e57; }
.dark .viz-root { --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70; --series-4:#c98500; --series-5:#d55181; --series-6:#008300; --series-7:#9085e9; --series-8:#e66767; --viz-neutral:#6f6e68; --viz-grid:#2e2e2b; --viz-ink:#c3c2b7; }
`;
const seriesVar = (i: number) => `var(--series-${(i % 8) + 1})`;

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());
const pct = (n: number) => `${Math.round(n * 100)}%`;

function YesNo({ on, label }: { on: boolean | undefined; label?: string }) {
  if (on === undefined) return <span className="text-muted-foreground">—</span>;
  return on ? (
    <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" aria-hidden />{label ?? "Yes"}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground"><X className="h-3.5 w-3.5" aria-hidden />No</span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function CompetitorDashboard() {
  const { user } = useAuth();
  const isAdmin = resolveNavRole(user) === "admin";
  const utils = trpc.useUtils();
  const q = trpc.marketIntel.competitorDashboard.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.job?.status === "running" ? 4000 : false),
  });
  const data = q.data;
  const running = data?.job?.status === "running";

  const lastFinish = useRef<number | null>(null);
  useEffect(() => {
    const j = data?.job as { status?: string; finishedAt?: number | null; error?: string | null } | undefined;
    if (!j || j.status === "running" || !j.finishedAt || j.finishedAt === lastFinish.current) return;
    if (lastFinish.current !== null) {
      if (j.status === "done") toast.success("Competitor data refreshed.");
      if (j.status === "error") toast.error(j.error ?? "Refresh failed");
    }
    lastFinish.current = j.finishedAt;
  }, [data?.job]);

  const refresh = trpc.marketIntel.refreshCompetitors.useMutation({
    onSuccess: (r) => {
      if (!r.started) toast.message("A refresh is already running.");
      else toast.message("Refreshing — this takes a few minutes (speed checks are slow).");
      utils.marketIntel.competitorDashboard.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const save = trpc.marketIntel.saveCompetitor.useMutation({
    onSuccess: () => { toast.success("Saved."); utils.marketIntel.competitorDashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const current = (data?.current ?? []) as DomainMetrics[];
  const ordered = useMemo(() => [...current].sort((a, b) => (a.isUs ? -1 : b.isUs ? 1 : a.name.localeCompare(b.name))), [current]);
  const colorIndex = useMemo(() => new Map(ordered.map((m, i) => [m.domain, i])), [ordered]);
  const share = useMemo(() => shareOfSearch(current), [current]);
  const source = useMemo(() => brandMetricSource(current), [current]);
  const isTrends = source === "google_trends";
  const brandNum = (m: DomainMetrics | undefined) => (m ? brandValue(m, source) : null);
  const fmtBrand = (n: number | null | undefined) => (n == null ? "—" : isTrends ? (Math.round(n * 10) / 10).toString() : n.toLocaleString());
  const us = current.find((m) => m.isUs);
  const ourShare = share.find((s) => s.isUs);
  const rivals = current.filter((m) => !m.isUs);

  const trendData = useMemo(() => {
    const months = new Set<string>();
    for (const m of ordered) for (const p of m.brandDemand?.monthly ?? []) months.add(p.month);
    return Array.from(months).sort().map((month) => {
      const row: Record<string, number | string> = { month };
      for (const m of ordered) {
        const v = m.brandDemand?.monthly.find((p) => p.month === month);
        if (v) row[m.domain] = v.searches;
      }
      return row;
    });
  }, [ordered]);
  // Top 5 by brand demand + us, so the line chart stays legible.
  const trendSeries = useMemo(() => {
    const top = [...rivals].sort((a, b) => (brandNum(b) ?? 0) - (brandNum(a) ?? 0)).slice(0, 5);
    return [...(us ? [us] : []), ...top].filter((m) => (m.brandDemand?.monthly.length ?? 0) > 0);
  }, [rivals, us, source]);

  const gap = useMemo(
    () => keywordGap(rivals.map((r) => ({ name: r.name, brandTerms: brandTermsFor(r.name), keywords: r.siteKeywords })), data?.ourQueries ?? []),
    [rivals, data?.ourQueries],
  );

  const allErrors = current.flatMap((m) => m.errors.map((e) => `${m.name}: ${e}`));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 viz-root">
      <style>{VIZ_CSS}</style>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/market-intel" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" />Market Intel</Link>
          <h1 className="text-2xl font-semibold mt-1">Competitors</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Built from free sources: Google Ads Keyword Planner (our account), competitors' public sitemaps and homepages, and Google PageSpeed.
            Refreshed every Monday 5:30 AM. {data?.weekOf ? `Showing week of ${data.weekOf}.` : ""}
          </p>
        </div>
        <Button onClick={() => refresh.mutate()} disabled={refresh.isPending || running || data?.setupNeeded}>
          {running || refresh.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {running ? "Refreshing…" : "Refresh now"}
        </Button>
      </div>

      {data?.setupNeeded && (
        <Card className="border-amber-500/50">
          <CardContent className="py-4 text-sm">
            One database step is pending: <code>drizzle/0084_competitor_dashboard.sql</code> (adds two new tables, changes nothing existing). Once it's applied, this page fills in.
          </CardContent>
        </Card>
      )}

      {!data?.setupNeeded && current.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No data yet. Confirm at least one competitor's website below, then click "Refresh now".
          </CardContent>
        </Card>
      )}

      {current.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isTrends ? (
              <Stat label="Our brand interest (Google Trends, NJ)" value={fmtBrand(brandNum(us))} hint="Relative to the other brands, not a count" />
            ) : (
              <Stat label="Our brand searches / month (NJ)" value={fmt(us?.brandDemand?.avgMonthly)} hint="People searching for us by name" />
            )}
            <Stat label="Our share of brand searches" value={ourShare ? pct(ourShare.share) : "—"} hint={`Among ${share.length} tracked brands`} />
            <Stat label="Competitors with a Google Ads tag" value={`${rivals.filter((r) => r.adTech?.googleAds).length} of ${rivals.length}`} hint="On their homepage — usually means they buy ads" />
            <Stat label="Competitors with a Meta pixel" value={`${rivals.filter((r) => r.adTech?.metaPixel).length} of ${rivals.length}`} hint="Usually means Facebook/Instagram ads" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Share of brand searches</CardTitle>
              <CardDescription>
                {isTrends
                  ? "How often people in New Jersey search Google for each company's name over the last 12 months, relative to each other (Google Trends). Shares are meaningful; the numbers are not search counts. Exact monthly counts appear once Google Ads API Basic access is approved."
                  : "Average monthly Google searches in New Jersey for each company's name. The closest free stand-in for \"who gets the most traffic\" — it is not a visit count."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ height: Math.max(160, share.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={share} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }} barCategoryGap={8}>
                    <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
                    <XAxis type="number" tick={{ fill: "var(--viz-ink)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--viz-ink)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }}
                      formatter={(v: number, _n, item) => [isTrends ? `${fmtBrand(v)} (${pct((item.payload as { share: number }).share)} share)` : `${v.toLocaleString()} / month (${pct((item.payload as { share: number }).share)})`, isTrends ? "Relative interest" : "Brand searches"]}
                    />
                    <Bar dataKey="searches" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey={isTrends ? "share" : "searches"} position="right" fill="var(--viz-ink)" fontSize={12} formatter={(v: number) => (isTrends ? pct(v) : v.toLocaleString())} />
                      {share.map((s) => <Cell key={s.domain} fill={s.isUs ? seriesVar(0) : "var(--viz-neutral)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Blue is Mechanical Enterprise. Small brands can show 0 — {isTrends ? "Google Trends reports very low interest as 0." : "Keyword Planner rounds low volumes down."}</p>
            </CardContent>
          </Card>

          {trendData.length > 1 && trendSeries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{isTrends ? "Brand interest over the last 12 months" : "Brand searches over the last 12 months"}</CardTitle>
                <CardDescription>Us and the five largest tracked competitors. Seasonal swings (summer AC, winter heat) affect everyone.</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--viz-ink)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--viz-ink)", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip />
                      <Legend />
                      {trendSeries.map((m) => (
                        <Line key={m.domain} dataKey={m.domain} name={m.name} stroke={seriesVar(colorIndex.get(m.domain) ?? 0)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Side by side</CardTitle>
              <CardDescription>Ads columns open each company in the free Google and Meta ad libraries, where you can see the ads they're running now.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">{isTrends ? "Brand interest (Trends)" : "Brand searches/mo"}</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead className="text-right">Updated in 30 days</TableHead>
                    <TableHead>Google Ads tag</TableHead>
                    <TableHead>Meta pixel</TableHead>
                    <TableHead>Call tracking</TableHead>
                    <TableHead>Financing shown</TableHead>
                    <TableHead>Chat</TableHead>
                    <TableHead className="text-right">Mobile speed</TableHead>
                    <TableHead>Enough real visitors for Chrome data</TableHead>
                    <TableHead>Their ads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map((m) => {
                    const links = adLibraryLinks(m.name, m.domain);
                    return (
                      <TableRow key={m.domain} className={m.isUs ? "bg-muted/40" : undefined}>
                        <TableCell>
                          <div className="font-medium">{m.name}{m.isUs && <Badge variant="outline" className="ml-2">Us</Badge>}</div>
                          <a href={`https://${m.domain}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">{m.domain}</a>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBrand(brandNum(m))}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.sitemap?.found ? fmt(m.sitemap.urlCount) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.sitemap?.found ? fmt(m.sitemap.updatedLast30) : "—"}</TableCell>
                        <TableCell><YesNo on={m.adTech?.googleAds} /></TableCell>
                        <TableCell><YesNo on={m.adTech?.metaPixel} /></TableCell>
                        <TableCell>{m.adTech ? (m.adTech.callTracking ?? <span className="text-muted-foreground">None seen</span>) : "—"}</TableCell>
                        <TableCell>{m.adTech ? (m.adTech.financing.length ? m.adTech.financing.join(", ") : <span className="text-muted-foreground">None seen</span>) : "—"}</TableCell>
                        <TableCell>{m.adTech ? (m.adTech.chat ?? <span className="text-muted-foreground">None seen</span>) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.speed?.mobileScore != null ? `${m.speed.mobileScore}/100` : "—"}</TableCell>
                        <TableCell>{m.speed ? <YesNo on={m.speed.hasFieldData} /> : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <a href={links.google} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google<ExternalLink className="h-3 w-3" /></a>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <a href={links.meta} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Meta<ExternalLink className="h-3 w-3" /></a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Keywords they're tied to that we don't show up for</CardTitle>
              <CardDescription>Searches Google associates with competitors' websites (Keyword Planner) where our site had no Search Console impressions. Their brand names are left out.</CardDescription>
            </CardHeader>
            <CardContent>
              {gap.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to show yet — this needs Google Ads connected and at least one confirmed competitor.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">NJ searches/mo</TableHead>
                      <TableHead>Competitors tied to it</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gap.map((g) => (
                      <TableRow key={g.keyword}>
                        <TableCell className="font-medium">{g.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.avgMonthly.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{g.competitors.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {rivals.some((r) => (r.sitemap?.recent.length ?? 0) > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Their most recently updated pages</CardTitle>
                <CardDescription>From each competitor's sitemap.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {rivals.filter((r) => (r.sitemap?.recent.length ?? 0) > 0).map((r) => (
                  <div key={r.domain}>
                    <div className="font-medium">{r.name}</div>
                    {r.sitemap!.recent.map((u) => (
                      <div key={u}><a href={u} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{u.replace(/^https?:\/\/(www\.)?/, "")}</a></div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!data?.setupNeeded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who we track</CardTitle>
            <CardDescription>
              Only confirmed websites are checked. Confirming also turns on the daily page-change watch in the Market Intel report.
              {!isAdmin && " Ask an admin to add or confirm competitors."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.competitors ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 flex-wrap text-sm">
                <span className="font-medium min-w-40">{c.name}</span>
                <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{c.domain}</a>
                <Badge variant={c.status === "confirmed" ? "default" : "secondary"}>{c.status === "confirmed" ? "Confirmed" : "Needs your OK"}</Badge>
                {isAdmin && c.status !== "confirmed" && (
                  <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ id: c.id, name: c.name, domain: c.domain, status: "confirmed" })}>Confirm</Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ id: c.id, name: c.name, domain: c.domain, status: "removed" })}>Remove</Button>
                )}
              </div>
            ))}
            {(data?.namesWithoutDomain?.length ?? 0) > 0 && (
              <p className="text-sm text-muted-foreground">
                No website on file yet for: {data!.namesWithoutDomain.join(", ")}. Add them below if you know their site.
              </p>
            )}
            {isAdmin && (
              <form
                className="flex gap-2 flex-wrap pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newName.trim() || !newDomain.trim()) return;
                  save.mutate({ name: newName.trim(), domain: newDomain.trim(), status: "confirmed" }, { onSuccess: () => { setNewName(""); setNewDomain(""); } });
                }}
              >
                <Input placeholder="Company name" value={newName} onChange={(e) => setNewName(e.target.value)} className="max-w-56" />
                <Input placeholder="Website, e.g. example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="max-w-64" />
                <Button type="submit" disabled={save.isPending}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {allErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What couldn't be checked this week</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            {allErrors.slice(0, 30).map((e, i) => <div key={i}>{e}</div>)}
          </CardContent>
        </Card>
      )}

      <DashboardFooter />
    </div>
  );
}
