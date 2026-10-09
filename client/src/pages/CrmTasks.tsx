import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, ListTodo, Mail, Phone, RefreshCw, Search } from "lucide-react";

type Source="outreach"|"opportunities";
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
  const [jobId,setJobId]=useState<string|null>(null);
  const params={status,action,due,search,offset:page*50,limit:50};
  const outreach=trpc.crmTasks.outreach.useQuery(params,{enabled:source==="outreach"});
  const opportunities=trpc.crmTasks.opportunities.useQuery(params,{enabled:source==="opportunities"});
  const utils=trpc.useUtils();
  const refresh=()=>{void utils.crmTasks.outreach.invalidate();void utils.crmTasks.opportunities.invalidate();};
  const done=trpc.crmFollowups.complete.useMutation({onSuccess:()=>{setNotice("Outcome saved.");refresh();},onError:e=>setNotice(e.message)});
  const assign=trpc.crmFollowups.assignToMe.useMutation({onSuccess:()=>{setNotice("Assigned to you.");refresh();},onError:e=>setNotice(e.message)});
  const assignAll=trpc.crmFollowups.assignAllToMe.useMutation({onSuccess:r=>{setNotice(`${r.assigned} tasks assigned to you.`);refresh();},onError:e=>setNotice(e.message)});
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
  return <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold flex items-center gap-2"><ListTodo className="h-6 w-6"/>Tasks</h1>
        <p className="text-sm text-slate-600">Calls, email reviews, and follow-up actions. Keep conversations in Communications.</p></div>
      {source==="outreach"&&<div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={assignAll.isPending} onClick={()=>assignAll.mutate()}>Assign all to me</Button>
        <Button variant="outline" disabled={sync.isPending||Boolean(jobId)} onClick={()=>sync.mutate({lookbackDays:35})}><RefreshCw className="h-4 w-4 mr-2"/>Sync outreach tasks</Button>
      </div>}
    </div>
    <div className="flex gap-2 border-b pb-2" role="tablist">
      {([["outreach","Prospect follow-ups"],["opportunities","Opportunity actions"]] as const).map(([id,label])=>
        <button key={id} role="tab" aria-selected={source===id} onClick={()=>{setSource(id);setPage(0);}}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${source===id?"bg-blue-100 text-blue-900":"hover:bg-slate-100 text-slate-600"}`}>{label}</button>)}
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
    {notice&&<p role="status" className="bg-slate-100 rounded-md p-3 text-sm">{notice}</p>}
    {selected.error&&<p role="alert" className="text-red-700 text-sm">{selected.error.message}</p>}
    <section className="rounded-xl border bg-white overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold">{source==="outreach"?"30-day prospect follow-ups":"Opportunity tasks"}</h2>
        <span className="text-sm text-slate-600">{total} matching tasks</span>
      </div>
      {selected.isLoading&&<p className="p-5 text-sm">Loading tasks…</p>}
      {!selected.isLoading&&total===0&&<p className="p-5 text-sm text-slate-500">No tasks match these filters.</p>}
