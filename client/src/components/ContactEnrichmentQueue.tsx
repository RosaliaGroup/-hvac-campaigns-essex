import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type Filter = "all"|"missing_phone"|"unknown_type"|"needs_social";
export default function ContactEnrichmentQueue() {
  const [filter,setFilter]=useState<Filter>("missing_phone");
  const [page,setPage]=useState(0);
  const list=trpc.crmContactEnrichment.queue.useQuery({filter,offset:page*50,limit:50});
  return <section className="rounded-xl border bg-white overflow-hidden">
    <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">Contact enrichment</h2>
        <p className="text-xs text-slate-500">Review missing phone numbers, unverified business/cell types and social profiles. Never guess or treat a mobile number as SMS consent.</p></div>
      <label className="text-xs font-medium">Show
        <select className="ml-2 rounded border bg-white p-2 text-sm" value={filter}
          onChange={e=>{setFilter(e.target.value as Filter);setPage(0);}}>
          <option value="missing_phone">Missing phone</option>
          <option value="unknown_type">Phone type unverified</option>
          <option value="needs_social">No verified social link</option>
          <option value="all">All contacts</option>
        </select>
      </label>
    </div>
    {list.error&&<p className="p-4 text-sm text-red-700" role="alert">{list.error.message}</p>}
    {list.isLoading&&<p className="p-4 text-sm text-slate-600">Checking CRM contact records…</p>}
    <div className="px-4 py-2 text-xs text-slate-500">{list.data?.total??0} matching contacts</div>
    {list.data?.items.map(contact=><div key={contact.id} className="border-t p-4 flex flex-wrap justify-between gap-3">
      <div>
        <div className="font-medium text-sm">{contact.name||contact.email||`Contact #${contact.id}`}</div>
        <div className="text-xs text-slate-600">{[contact.company,contact.email].filter(Boolean).join(" · ")}</div>
        <div className="text-xs mt-1">
          {contact.phone?
            <span>{contact.phone} · {contact.savedType&&contact.savedPhone===contact.phone?contact.savedType:"Type unverified"}</span>:
            <span className="text-amber-700">Phone missing</span>}
          <span className="ml-3">{contact.hasSocial?"Verified social found":"Social profile needs research"}</span>
        </div>
      </div>
      <Link href={`/contacts/communications?contactId=${contact.id}`}
        className="rounded border px-3 py-2 text-xs font-medium text-blue-700 hover:bg-slate-50">Review contact</Link>
    </div>)}
    {list.data&&list.data.total>50&&<div className="flex justify-between items-center p-4 border-t text-xs">
      <span>Showing {page*50+1}–{Math.min((page+1)*50,list.data.total)} of {list.data.total}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous</Button>
        <Button size="sm" variant="outline" disabled={(page+1)*50>=list.data.total} onClick={()=>setPage(p=>p+1)}>Next</Button>
      </div>
    </div>}
  </section>;
}
