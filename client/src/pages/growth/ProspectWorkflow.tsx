import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function ProspectWorkflow() {
  const status = trpc.growth.prospecting.status.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const [owner, setOwner] = useState(""),
    [jobId, setJobId] = useState(""),
    [error, setError] = useState("");
  const job = trpc.growth.prospecting.job.useQuery(
    { id: jobId },
    { enabled: !!jobId, refetchInterval: 3000 }
  );
  const refresh = () => {
    void status.refetch();
    setError("");
  };
  const configure = trpc.growth.prospecting.configure.useMutation({
    onSuccess: refresh,
    onError: e => setError(e.message),
  });
  const run = trpc.growth.prospecting.runNow.useMutation({
    onSuccess: r => setJobId(r.jobId),
    onError: e => setError(e.message),
  });
  const follow = trpc.growth.prospecting.followUp.useMutation({
    onSuccess: refresh,
    onError: e => setError(e.message),
  });
  const consent = trpc.growth.prospecting.smsConsent.useMutation({
    onSuccess: refresh,
    onError: e => setError(e.message),
  });
  const data = status.data;
  const selected = Number(
    owner ||
      data?.config?.ownerId ||
      data?.owners.find(o => /ana/i.test(o.name))?.id ||
      0
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prospecting & follow-up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Find verified North Jersey decision-makers, save them as CRM leads,
          send an introduction, and assign a follow-up for tomorrow. Research
          runs hourly, 9 AM–5 PM Eastern.
        </p>
        {status.error && (
          <p role="alert">Workflow unavailable: {status.error.message}</p>
        )}
        <div className="flex gap-2 flex-wrap items-center">
          <label>
            Follow-up owner{" "}
            <select
              aria-label="Follow-up owner"
              value={selected || ""}
              onChange={e => setOwner(e.target.value)}
              className="border rounded p-2"
            >
              <option value="">Choose owner</option>
              {data?.owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!selected || configure.isPending}
            onClick={() =>
              configure.mutate({
                enabled: !data?.config?.enabled,
                ownerId: selected,
              })
            }
          >
            {data?.config?.enabled ? "Pause workflow" : "Enable workflow"}
          </Button>
          <Button
            variant="outline"
            disabled={!selected || configure.isPending}
            onClick={() =>
              configure.mutate({
                enabled: !!data?.config?.enabled,
                ownerId: selected,
              })
            }
          >
            Save owner
          </Button>
          <Button
            variant="outline"
            disabled={
              !data?.config?.enabled ||
              run.isPending ||
              job.data?.status === "running"
            }
            onClick={() => run.mutate()}
          >
            Run now
          </Button>
        </div>
        <p className="text-sm">
          {data?.config?.enabled ? "Enabled" : "Paused"} · Last run:{" "}
          {data?.config?.lastRunAt
            ? new Date(data.config.lastRunAt).toLocaleString()
            : "None"}
        </p>
        {data?.config?.lastError && (
          <p role="alert" className="text-red-700">
            {data.config.lastError}
          </p>
        )}
        {job.data && (
          <p>
            Requested run: {job.data.status}
            {job.data.error ? ` — ${job.data.error}` : ""}
          </p>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          SMS introductions require a recorded opt-in. Complete the personal
          follow-up to start occasional email check-ins. Replies and delivery
          failures stop automated outreach.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Prospect</th>
                <th>Status</th>
                <th>Owner / follow-up</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">
                    <b>{r.name}</b>
                    <br />
                    {r.company}
                    <br />
                    {r.email}
                    <br />
                    <a
                      className="underline"
                      href={r.verificationUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Verification source
                    </a>
                  </td>
                  <td>
                    {r.state}
                    <br />
                    Email touches: {r.touchCount}
                    <br />
                    SMS: {r.smsState}
                    <br />
                    {r.lastError && <span>{r.lastError}</span>}
                  </td>
                  <td>
                    {data.owners.find(o => o.id === r.ownerId)?.name ||
                      "Unassigned"}
                    <br />
                    {r.followUpAt
                      ? new Date(r.followUpAt).toLocaleString()
                      : "After introduction"}
                    {r.followUpDoneAt && <p>Follow-up completed</p>}
                  </td>
                  <td>
                    {r.state === "waiting" && (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const note = window.prompt(
                              "Record your follow-up and why this lead should receive occasional check-ins:"
                            );
                            if (note)
                              follow.mutate({
                                id: r.id,
                                outcome: "nurture",
                                note,
                              });
                          }}
                        >
                          Followed up — keep warm
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            follow.mutate({
                              id: r.id,
                              outcome: "replied",
                              note: "Handed to personal conversation",
                            })
                          }
                        >
                          In conversation
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            follow.mutate({
                              id: r.id,
                              outcome: "opted_out",
                              note: "Do not contact",
                            })
                          }
                        >
                          Stop outreach
                        </Button>
                        {r.smsState === "consent_required" && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              const phone = window.prompt(
                                "Opted-in mobile number (+1…):"
                              );
                              if (!phone) return;
                              const evidence = window.prompt(
                                "Record when, where, and how this person opted in to introductory SMS:"
                              );
                              if (evidence)
                                consent.mutate({ id: r.id, phone, evidence });
                            }}
                          >
                            Record SMS opt-in
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
