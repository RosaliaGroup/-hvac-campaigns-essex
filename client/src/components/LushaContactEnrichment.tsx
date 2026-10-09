import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type Preview = {
  status:string; message:string; phoneRevealCredits:number;
  linkedin:string|null; hasPhoneAvailable:boolean;
};
/** Lusha search/reveal is explicitly user-initiated; never fires on mount. */
export default function LushaContactEnrichment({contactId,onUpdated}:{
  contactId:number;onUpdated:()=>void;
}) {
  const [preview,setPreview]=useState<Preview|null>(null);
  const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState("");
  const [company,setCompany]=useState("");
  const card=trpc.crmCommunications.contactCard.useQuery({id:contactId});
  const utils=trpc.useUtils();
  const updateIdentity=trpc.crmCommunications.upsertContact.useMutation({
    onSuccess:async()=>{
      try {
        const saved=await utils.crmCommunications.contactCard.fetch({id:contactId});
        if(saved.name!==name.trim()||saved.company!==company.trim())throw new Error("CRM identity readback did not match.");
        setNotice("Verified contact name and company saved.");setEditing(false);setPreview(null);
        await utils.crmContactEnrichment.queue.invalidate();
      }catch(e){setNotice(e instanceof Error?e.message:"CRM identity could not be verified.");}
    },onError:e=>setNotice(e.message),
  });
  const status=trpc.crmContactEnrichment.lushaStatus.useQuery();
  const search=trpc.crmContactEnrichment.lushaPreview.useMutation({
    onSuccess:r=>{setPreview(r);setNotice(r.message);},
    onError:e=>setNotice(e.message),
  });
  const reveal=trpc.crmContactEnrichment.lushaRevealPhone.useMutation({
    onSuccess:r=>{setNotice(r.message);setPreview(null);onUpdated();},
    onError:e=>setNotice(e.message),
  });
  const saveLinkedIn=trpc.crmContactEnrichment.lushaSaveLinkedIn.useMutation({
    onSuccess:()=>{setNotice("Verified LinkedIn saved to the CRM. This did not follow the profile.");onUpdated();},
    onError:e=>setNotice(e.message),
  });
  useEffect(()=>{setPreview(null);setNotice("");setEditing(false);},[contactId]);
  useEffect(()=>{setName(card.data?.name??"");setCompany(card.data?.company??"");},[card.data?.name,card.data?.company]);
  const busy=search.isPending||reveal.isPending||saveLinkedIn.isPending;
  const configured=status.data?.configured===true;
  return <section className="rounded-lg border p-3 space-y-2">
    <h3 className="text-sm font-semibold">Lusha verification</h3>
    <p className="text-xs text-slate-600">Matches the contact's full name and current company. Mismatches and compliance restrictions are not saved or retried.</p>
    <div className="text-xs text-slate-600">
      CRM identity: {card.data?.name||"Missing name"} · {card.data?.company||"Missing company"}
      <Button size="sm" variant="ghost" onClick={()=>setEditing(v=>!v)}>Edit verified identity</Button>
    </div>
    {editing&&<div className="rounded bg-slate-50 p-3 space-y-2">
      <Input aria-label="Verified contact full name" placeholder="Full name" value={name}
        onChange={e=>setName(e.target.value)} />
      <Input aria-label="Verified company name" placeholder="Current company" value={company}
        onChange={e=>setCompany(e.target.value)} />
      <Button size="sm" disabled={!card.data?.email||!name.trim()||!company.trim()||updateIdentity.isPending}
        onClick={()=>{
          if(!card.data?.email)return;
          if(!window.confirm("Confirm the full name and current company are verified for this exact email address."))return;
          updateIdentity.mutate({name:name.trim(),company:company.trim(),email:card.data.email,source:"verified-manual"});
        }}>Save verified identity</Button>
    </div>}
    {!configured&&<p className="text-xs text-amber-700" role="status">
      {status.data?.message??"Checking Lusha CRM API connection…"}
      {" "}Set the LUSHA_API_KEY secret in Railway; the connected ChatGPT Lusha app is separate.
    </p>}
    <Button size="sm" variant="outline" disabled={!configured||busy}
      onClick={()=>{
        if(!window.confirm("Lusha contact search may use a search credit. Check this person's name and company in CRM before continuing."))return;
        setPreview(null);search.mutate({contactId,approveSearchCost:true});
      }}>Check contact with Lusha</Button>
    {preview&&<div className="text-xs space-y-2 rounded bg-slate-50 p-3">
      <p className={preview.status==="matched"?"text-green-800":"text-amber-800"}>
        {preview.status.replaceAll("_"," ")}: {preview.message}
      </p>
      {preview.status==="matched"&&<>
        {preview.linkedin&&<div className="flex flex-wrap gap-2 items-center">
          <a href={preview.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
            View matched LinkedIn
          </a>
          <Button size="sm" variant="outline" disabled={busy} onClick={()=>{
            if(window.confirm("Save this matched LinkedIn URL in CRM? This will not follow the person."))
              saveLinkedIn.mutate({contactId});
          }}>Save verified LinkedIn</Button>
        </div>}
        {preview.hasPhoneAvailable&&<Button size="sm" disabled={busy} onClick={()=>{
          if(window.confirm(`Lusha will charge approximately ${preview.phoneRevealCredits} credits to reveal this contact's phone. Reveal and save only if the CRM number is missing?`))
            reveal.mutate({contactId,approvePhoneCredits:true});
        }}>Reveal phone · {preview.phoneRevealCredits} credits</Button>}
        {!preview.hasPhoneAvailable&&<p>No phone available to reveal.</p>}
      </>}
    </div>}
    {notice&&<p role="status" className="text-xs text-slate-700">{notice}</p>}
    <p className="text-xs text-slate-500">Phone type is verified from Lusha's direct/business/mobile classification. SMS consent is never inferred.</p>
  </section>;
}
