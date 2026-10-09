import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

/** Explicit contact intake: Gmail is selection-only, never an auto-import. */
export default function ContactIntakePanel() {
  const [open,setOpen]=useState(false);
  const [from,setFrom]=useState<"manual"|"gmail">("manual");
  const [search,setSearch]=useState("");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [company,setCompany]=useState("");
  const [title,setTitle]=useState("");
  const [notice,setNotice]=useState("");
  const [savedId,setSavedId]=useState<number|null>(null);
  const utils=trpc.useUtils();
  const candidates=trpc.crmCommunications.gmailContactCandidates.useQuery(
    {search},{enabled:open&&from==="gmail"}
  );
  const create=trpc.crmCommunications.addSelectedContact.useMutation({
    onSuccess:async result=>{
      setNotice("Contact saved with email and phone. Automatic enrichment has started.");
      setSavedId(result.contactId);
      await Promise.all([
        utils.crmCommunications.contacts.invalidate(),
        utils.crmContactEnrichment.queue.invalidate(),
      ]);
    },
    onError:e=>setNotice(e.message),
  });
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPhone=phone.replace(/\D/g,"").length>=10&&phone.replace(/\D/g,"").length<=15;
  return <section className="rounded-xl border bg-white p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-semibold">Add a qualified contact</h3>
        <p className="text-xs text-slate-600">Task prospects enrich automatically. Other Gmail correspondents enter Contacts only when you select them.</p>
      </div>
      <Button size="sm" variant="outline" onClick={()=>setOpen(v=>!v)}>
        {open?"Close":"Add contact"}
      </Button>
    </div>
    {open&&<div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={from==="manual"?"default":"outline"}
          onClick={()=>{setFrom("manual");setSavedId(null);setEmail("");}}>Add manually</Button>
        <Button size="sm" variant={from==="gmail"?"default":"outline"}
          onClick={()=>{setFrom("gmail");setSavedId(null);setEmail("");}}>Select from Gmail</Button>
      </div>
      {from==="gmail"&&<div className="rounded-md border p-3 space-y-2">
        <p className="text-xs text-slate-600">Only synced Gmail correspondents are listed. Selecting someone does not import them until you save their complete contact details.</p>
        <Input aria-label="Search synced Gmail email addresses" placeholder="Search email address"
          value={search} onChange={e=>setSearch(e.target.value)}/>
        {candidates.isLoading&&<p className="text-xs">Loading synced Gmail correspondents…</p>}
        {candidates.error&&<p role="alert" className="text-xs text-red-700">{candidates.error.message}</p>}
        <select aria-label="Choose a Gmail correspondent" className="w-full rounded border p-2 text-sm"
          value={email} onChange={e=>setEmail(e.target.value)}>
          <option value="">Select an email address</option>
          {candidates.data?.map(item=><option key={item.email} value={item.email}>
            {item.email}{item.alreadySaved?" (already in CRM)":""}
          </option>)}
        </select>
        {candidates.data?.length===0&&<p className="text-xs text-slate-500">
          No synced correspondents match. Sync Gmail in Communications first.
        </p>}
      </div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs font-medium">Full name *
          <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Verified decision-maker"/>
        </label>
        <label className="text-xs font-medium">Business email *
          <Input type="email" disabled={from==="gmail"} value={email}
            onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/>
        </label>
        <label className="text-xs font-medium">Phone number *
          <Input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
            placeholder="Business or verified mobile number"/>
        </label>
        <label className="text-xs font-medium">Company
          <Input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Employer"/>
        </label>
        <label className="text-xs font-medium">Job title
          <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Property manager"/>
        </label>
      </div>
      <p className="text-xs text-slate-600">Phone type and LinkedIn/social details will be researched automatically. A cell number does not imply permission to text.</p>
      <Button disabled={create.isPending||name.trim().length<2||!validEmail||!validPhone}
        onClick={()=>{setNotice("");setSavedId(null);create.mutate({
          from,name:name.trim(),email:email.trim(),phone:phone.trim(),
          company:company.trim()||undefined,title:title.trim()||undefined,
        });}}>
        {create.isPending?"Saving…":"Save and enrich contact"}
      </Button>
      {notice&&<p role="status" className="text-sm">{notice}</p>}
      {savedId&&<Link className="text-sm text-blue-700 underline"
        href={`/contacts/communications?contactId=${savedId}`}>Open saved contact</Link>}
    </div>}
  </section>;
}
