import { useEffect, useState } from "react";
import { Link } from "wouter";
import TaskCallActions from "@/components/TaskCallActions";
import ContactEnrichmentQueue from "@/components/ContactEnrichmentQueue";
import FollowupDeliveryDiagnostics from "@/components/FollowupDeliveryDiagnostics";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, ListTodo, Mail, Phone, RefreshCw, Search } from "lucide-react";

type Source="outreach"|"opportunities"|"enrichment";
type Status="open"|"done"|"cancelled"|"all";
type Action="all"|"call"|"email"|"text";
type Due="all"|"overdue"|"today"|"upcoming";
const labels:Record<number,string>={
  2:"Personal introduction call",3:"Brief email check-in",4:"Second personal call",
  5:"Maintenance insight",6:"Upcoming project conversation",7:"Replacement planning",
  8:"Relationship check-in",9:"Final value-based email",10:"Final personal check-in",
};
const formatDate=(date:Date|string)=>new Date(date).toLocaleString("en-US",{
  timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
})+" ET";

export default function CrmTasks(){
  const [source,setSource]=useState<Source>("outreach");
  const [status,setStatus]=useState<Status>("open");
  const [action,setAction]=useState<Action>("all");
  const [due,setDue]=useState<Due>("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(0);
  const [notice,setNotice]=useState("");
  const [assignmentRefreshMessage,setAssignmentRefreshMessage]=useState("");
  const [assignmentReceipt,setAssignmentReceipt]=useState<{assigned:number;remaining:number;at:string}|null>(null);
  const [jobId,setJobId]=useState<string|null>(null);
  const params={status,action,due,search,offset:page*50,limit:50};
  const outreach=trpc.crmTasks.outreach.useQuery(params,{enabled:source==="outreach"});
  const opportunities=trpc.crmTasks.opportunities.useQuery(params,{enabled:source==="opportunities"});
  const utils=trpc.useUtils();
  const assignmentStatus=trpc.crmFollowups.assignmentStatus.useQuery(undefined,{enabled:source==="outreach",retry:false});
  const refresh=()=>{void utils.crmTasks.outreach.invalidate();void utils.crmTasks.opportunities.invalidate();void assignmentStatus.refetch();};
  const done=trpc.crmFollowups.complete.useMutation({onSuccess:()=>{setNotice("Outcome saved.");refresh();},onError:e=>setNotice(e.message)});
  const assign=trpc.crmFollowups.assignToMe.useMutation({onSuccess:()=>{setNotice("Assigned to you.");refresh();},onError:e=>setNotice(e.message)});
  const assignAll=trpc.crmFollowups.assignAllToMe.useMutation({onSuccess:r=>{setAssignmentReceipt({assigned:r.assigned,remaining:r.remainingUnassigned,at:new Date().toLocaleString()});setNotice(`Assignment completed: ${r.assigned} tasks updated; ${r.remainingUnassigned} still unassigned.`);refresh();},onError:e=>{setAssignmentReceipt(null);setNotice(`Assignment failed: ${e.message}`);}});
  const oppDone=trpc.opportunities.completeTask.useMutation({onSuccess:()=>{setNotice("Opportunity task completed.");refresh();},onError:e=>setNotice(e.message)});
  const oppSnooze=trpc.opportunities.snoozeTask.useMutation({onSuccess:()=>{setNotice("Snoozed one day.");refresh();},onError:e=>setNotice(e.message)});
  const sync=trpc.crmFollowups.syncOutreach.useMutation({onSuccess:r=>{setJobId(r.jobId);setNotice("Checking Gmail outreach…");},onError:e=>setNotice(e.message)});
  const job=trpc.crmFollowups.syncJob.useQuery({jobId:jobId??""},{enabled:Boolean(jobId),refetchInterval:jobId?1500:false});
  useEffect(()=>{
    if(!jobId||job.isFetching)return;
    if(job.data?.status==="done"){
      const r=job.data.result as {created?:number;scanned?:number}|null;
      setNotice(`Gmail scan completed: ${r?.created??0} tasks created from ${r?.scanned??0} messages.`);
      setJobId(null);refresh();
    }else if(job.data?.status==="error"||job.error){
      setNotice(job.data?.error??job.error?.message??"Gmail sync failed.");setJobId(null);
    }
  },[job.data,job.error,job.isFetching,jobId]);
  const selected=source==="outreach"?outreach:opportunities;
  const result=source==="outreach"?outreach.data:opportunities.data;
  const total=result?.total??0;
  const busy=done.isPending||assign.isPending||oppDone.isPending||oppSnooze.isPending;
  return <div className="mx-auto max-w-7xl p-0 sm:p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold flex items-center gap-2"><ListTodo className="h-6 w-6"/>Tasks</h1>
        <p className="text-sm text-slate-600">Calls, email reviews, and follow-up actions. Keep conversations in Communications.</p></div>
      {source==="outreach"&&<div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={assignAll.isPending} onClick={()=>{if(window.confirm("Assign all currently unassigned open prospect follow-ups to your signed-in CRM account?"))assignAll.mutate();}}>Assign all to me</Button>
        <Button variant="outline" disabled={sync.isPending||Boolean(jobId)} onClick={()=>sync.mutate({lookbackDays:35})}><RefreshCw className="h-4 w-4 mr-2"/>Sync outreach tasks</Button>
      </div>}
    </div>
    <div className="flex gap-2 overflow-x-auto border-b pb-2" role="tablist">
      {([["outreach","Prospect follow-ups"],["opportunities","Opportunity actions"],["enrichment","Contact enrichment"]] as const).map(([id,label])=>
        <button key={id} role="tab" aria-selected={source===id} onClick={()=>{setSource(id);setPage(0);}}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${source===id?"bg-blue-100 text-blue-900":"hover:bg-slate-100 text-slate-600"}`}>{label}</button>)}
    </div>
    {source==="enrichment"&&<ContactEnrichmentQueue/>}
    {source==="outreach"&&<FollowupDeliveryDiagnostics/>}
    {source!=="enrichment"&&<>
    <div className="flex gap-2 overflow-x-auto pb-1 sm:hidden" aria-label="Quick due filters">
      {([["overdue","Overdue"],["today","Today"],["upcoming","Upcoming"],["all","All"]] as const).map(([value,label])=>
        <button type="button" key={value} aria-pressed={due===value} onClick={()=>{setDue(value);setPage(0);}}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${due===value?"bg-blue-700 text-white border-blue-700":"bg-white text-slate-700"}`}>{label}</button>)}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <label className="text-xs font-medium">Search
        <div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
          <Input className="pl-9" value={search} placeholder="Contact, company, task" onChange={e=>{setSearch(e.target.value);setPage(0);}}/></div>
      </label>
      <label className="text-xs font-medium">Status<select className="mt-1 block w-full h-10 border rounded-md px-3 bg-white" value={status} onChange={e=>{setStatus(e.target.value as Status);setPage(0);}}>
        <option value="open">Open</option><option value="done">Completed</option><option value="cancelled">Cancelled</option><option value="all">All</option>
      </select></label>
      <label className="text-xs font-medium">Due<select className="mt-1 block w-full h-10 border rounded-md px-3 bg-white" value={due} onChange={e=>{setDue(e.target.value as Due);setPage(0);}}>
        <option value="all">All dates</option><option value="overdue">Overdue</option><option value="today">Today</option><option value="upcoming">Upcoming</option>
      </select></label>
      <label className="text-xs font-medium">Action<select className="mt-1 block w-full h-10 border rounded-md px-3 bg-white" value={action} onChange={e=>{setAction(e.target.value as Action);setPage(0);}}>
        <option value="all">All actions</option><option value="call">Calls</option><option value="email">Email reviews</option><option value="text">Texts</option>
      </select></label>
    </div>
    {source==="outreach"&&<section className="rounded-lg border bg-white p-4 space-y-2" aria-label="Live CRM assignment status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Live follow-up assignment status</h2>
        <Button type="button" size="sm" variant="outline" onClick={async ()=>{setAssignmentRefreshMessage("Checking live CRM database…");try{const result=await assignmentStatus.refetch();setAssignmentRefreshMessage(result.error ? `Refresh failed: ${result.error.message}` : result.data ? `Checked at ${new Date().toLocaleTimeString()}: ${result.data.mine} assigned to you; ${result.data.unassigned} unassigned.` : "No assignment data returned. Please sign in again.");}catch(error){setAssignmentRefreshMessage(`Refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`);}}} disabled={assignmentStatus.isFetching}>{assignmentStatus.isFetching?"Refreshing…":"Refresh assignment counts"}</Button>
      </div>
      {assignmentRefreshMessage&&<p role="status" aria-live="polite" className="text-sm font-medium">{assignmentRefreshMessage}</p>}
      {assignmentStatus.isLoading&&<p role="status" className="text-sm">Reading CRM assignment counts…</p>}
      {assignmentStatus.error&&<p role="alert" className="text-sm text-red-700">Could not read assignment counts: {assignmentStatus.error.message}</p>}
      {assignmentStatus.data&&!assignmentStatus.data.authenticatedOwnerValid&&<p role="alert" className="text-sm text-red-700">Your CRM session is not linked to a valid authenticated user record. Assignment is blocked until the administrator login is linked correctly.</p>}
      {assignmentStatus.data&&<p role="status" className="text-sm">
        {assignmentStatus.data.total} open tasks · {assignmentStatus.data.mine} assigned to your login · {assignmentStatus.data.unassigned} unassigned or invalid owner IDs
      </p>}
      <p className="text-xs text-slate-600">These numbers come from the CRM database and remain visible after refreshing the page. Assigning tasks does not send emails.</p>
    </section>}
    {assignmentReceipt&&source==="outreach"&&<section role="status" aria-live="polite" className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-950 space-y-1">
      <p className="font-semibold">Task assignment confirmed by CRM</p>
      <p>{assignmentReceipt.assigned} task records updated; {assignmentReceipt.remaining} remain unassigned.</p>
      <p>Confirmed at {assignmentReceipt.at}. The task list remains open until tasks are completed.</p>
      <Button variant="outline" size="sm" type="button" onClick={()=>setAssignmentReceipt(null)}>Dismiss confirmation</Button>
    </section>}
    {notice&&<p role="status" className="bg-slate-100 rounded-md p-3 text-sm">{notice}</p>}
    {selected.error&&<p role="alert" className="text-red-700 text-sm">{selected.error.message}</p>}
    <section className="rounded-xl border bg-white overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold">{source==="outreach"?"30-day prospect follow-ups":"Opportunity tasks"}</h2>
        <span className="text-sm text-slate-600">{total} matching tasks</span>
      </div>
      {selected.isLoading&&<p className="p-5 text-sm">Loading tasks…</p>}
      {!selected.isLoading&&total===0&&<p className="p-5 text-sm text-slate-500">No tasks match these filters.</p>}
      {source==="outreach"&&outreach.data?.items.map(task=><div key={task.id}
        className="border-b last:border-b-0 p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center flex-wrap gap-2">
            {task.kind==="human"?<Phone className="h-4 w-4 text-blue-700"/>:<Mail className="h-4 w-4 text-blue-700"/>}
            <strong>{labels[task.touchNumber]??"Follow-up"}</strong>
            <span className="text-xs bg-slate-100 rounded px-2 py-1">Touch {task.touchNumber}/10</span>
            {task.status!=="open"&&<span className="text-xs text-slate-600">{task.status} · {task.outcome?.replaceAll("_"," ")}</span>}
          </div>
          <div className="text-sm">
            <Link href={`/contacts/communications?contactId=${task.externalContactId}`}
              className="text-blue-700 font-medium hover:underline">
              {task.name&&task.name!==task.recipientEmail?task.name:task.recipientEmail}
            </Link>
            {task.company&&<span className="text-slate-600"> · {task.company}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className={task.status==="open"&&new Date(task.dueAt)<new Date()?"text-red-700 font-semibold":""}>
              <CalendarClock className="h-3 w-3 inline mr-1"/>Due {formatDate(task.dueAt)}
            </span>
            <span>Assigned: {task.assignedToUserId?task.assignedToName:"Unassigned"}</span>
            <a className="text-blue-700 hover:underline" target="_blank" rel="noreferrer"
              href={`https://mail.google.com/mail/u/?authuser=sales%40mechanicalenterprise.com#all/${encodeURIComponent(task.introThreadId)}`}>
              Original Gmail thread</a>
          </div>
        </div>
        {task.status==="open"&&<div className="flex flex-wrap gap-2 w-full xl:w-auto xl:shrink-0">
          {!task.assignedToUserId&&<Button size="sm" variant="outline" disabled={busy}
            onClick={()=>assign.mutate({id:task.id})}>Assign to me</Button>}
          {task.kind==="human"?<TaskCallActions
            contactId={task.externalContactId}
            contactName={task.name || task.recipientEmail}
            phone={task.phone}
            phoneType={task.phoneType}
            disabled={busy}
            onRefresh={refresh}
            onOutcome={(outcome,note)=>done.mutate({id:task.id,outcome,note})}
          />:<>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={()=>done.mutate({id:task.id,outcome:"reviewed_no_send"})}>Reviewed · no send</Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={()=>done.mutate({id:task.id,outcome:"sent_verified"})}>Verify sent email</Button>
          </>}
        </div>}
      </div>)}
      {source==="opportunities"&&opportunities.data?.items.map(task=><div key={task.id}
        className="border-b last:border-b-0 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            {task.type==="call"?<Phone className="h-4 w-4 text-blue-700"/>:<Mail className="h-4 w-4 text-blue-700"/>}
            {task.title}
          </div>
          <Link href={`/opportunities/${task.opportunityId}`} className="text-blue-700 text-sm hover:underline">
            {task.customerName||task.company||task.opportunityTitle||`Opportunity #${task.opportunityId}`}
          </Link>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span>Due {formatDate(task.dueAt)}</span><span>{task.type}</span><span>{task.status}</span>
          </div>
        </div>
        {task.status==="open"&&<div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy}
            onClick={()=>oppSnooze.mutate({taskId:task.id,days:1})}>Snooze 1 day</Button>
          <Button size="sm" disabled={busy} onClick={()=>oppDone.mutate({taskId:task.id})}>Mark complete</Button>
        </div>}
      </div>)}
      {total>50&&<div className="flex items-center justify-between gap-3 p-4 border-t text-sm">
        <span>Showing {page*50+1}–{Math.min((page+1)*50,total)} of {total}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous</Button>
          <Button size="sm" variant="outline" disabled={(page+1)*50>=total} onClick={()=>setPage(p=>p+1)}>Next</Button>
        </div>
      </div>}
    </section>
    </>}
  </div>;
}
