import { useState } from "react";
import { ExternalLink, Phone, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import type { ContactProfile } from "@shared/contactProfile";
import LushaContactEnrichment from "./LushaContactEnrichment";

type Social = NonNullable<ContactProfile["companySocial"]>[number];
function SocialFollow({ contactId, item, followed, onUpdated }: {
  contactId: number; item: Social; followed: boolean; onUpdated: () => void;
}) {
  const [opened,setOpened] = useState(false);
  const [error,setError] = useState("");
  const update = trpc.crmContactEnrichment.confirmFollow.useMutation({
    onSuccess: () => {setError("");onUpdated();},
    onError: e => setError(e.message),
  });
  return <div className="rounded border p-2 text-xs space-y-2">
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium">{item.platform} {followed?"· Followed (user-confirmed)":""}</span>
      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={()=>setOpened(true)}
        className="text-blue-700 flex items-center gap-1 hover:underline">Open profile <ExternalLink size={12}/></a>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={update.isPending||(!followed&&!opened)}
        onClick={()=>{
          if(!followed&&!window.confirm("Confirm you actually followed this profile using your social account. Opening the profile alone does not count."))return;
          update.mutate({contactId,url:item.url,followed:!followed});
        }}>{followed?"Undo follow confirmation":"Mark followed"}</Button>
      {!followed&&!opened&&<span className="text-slate-500">Open the verified profile and follow it first</span>}
      <a href={item.source} target="_blank" rel="noopener noreferrer" className="text-slate-500 underline">Verification source</a>
    </div>
    {error&&<p className="text-red-700" role="alert">{error}</p>}
  </div>;
}
export default function ContactEnrichmentControls({
  contactId, profile,
}: { contactId: number; profile: ContactProfile | null | undefined }) {
  const utils = trpc.useUtils();
  const data = trpc.crmContactEnrichment.get.useQuery({contactId});
  const [phoneType,setPhoneType]=useState<"business"|"cell"|"unknown">("unknown");
  const [source,setSource]=useState("");
  const [error,setError]=useState("");
  const update = trpc.crmContactEnrichment.classifyPhone.useMutation({
    onSuccess:()=>{setError("");void data.refetch();},
    onError:e=>setError(e.message),
  });
  const save = () => {
    if(phoneType!=="unknown"&&!window.confirm(`Confirm that you verified this is a ${phoneType==="cell"?"mobile":"business"} number. This does not grant SMS consent.`))return;
    update.mutate({contactId,phoneType,sourceUrl:source.trim()||undefined,confirmedByUser:phoneType!=="unknown"});
  };
  const profiles = [...(profile?.social??[]),...(profile?.companySocial??[])];
  const followed = new Set(data.data?.followed.map(x=>x.url)??[]);
  return <section className="rounded-md border bg-white p-4 space-y-3">
    <h2 className="font-semibold flex items-center gap-2"><Phone size={16}/>Phone & social enrichment</h2>
    {data.error&&<p role="alert" className="text-red-700 text-xs">{data.error.message}</p>}
    <div className="text-sm">
      <strong>Phone:</strong> {data.data?.phone??"Missing — needs research"}
      <span className="ml-2 text-xs rounded bg-slate-100 px-2 py-1">
        {data.data?.phoneType==="cell"?"Cell (verified)":
          data.data?.phoneType==="business"?"Business (verified)":
          data.data?.phoneType==="missing"?"Missing":"Type not verified"}
      </span>
    </div>
    {data.data?.phoneSource&&<a href={data.data.phoneSource} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline">Phone source</a>}
    {data.data?.phone&&<div className="space-y-2">
      <label className="text-xs font-medium block">Verify phone type
        <select value={phoneType} onChange={e=>setPhoneType(e.target.value as typeof phoneType)}
          className="mt-1 block w-full border rounded-md bg-white px-3 py-2">
          <option value="unknown">Unknown</option><option value="business">Business / office</option><option value="cell">Cell / mobile</option>
        </select>
      </label>
      <input className="border rounded-md px-3 py-2 w-full text-xs" type="url"
        placeholder="Public verification source URL (optional for manual verification)"
        value={source} onChange={e=>setSource(e.target.value)} aria-label="Phone verification source"/>
      <Button size="sm" variant="outline" disabled={update.isPending} onClick={save}>Save verified type</Button>
      <p className="text-xs text-slate-500">Mobile classification is not SMS consent. Never text without recorded opt-in.</p>
    </div>}
    <LushaContactEnrichment contactId={contactId} onUpdated={()=>{void data.refetch();void utils.crmCommunications.profile.invalidate({contactId});}} />
    <div className="border-t pt-3 space-y-2">
      <h3 className="font-medium flex items-center gap-2"><UserCheck size={15}/>Verified social profiles</h3>
      {profiles.length===0&&<p className="text-xs text-amber-700">No verified social profile found. Refresh the contact profile or research manually; do not guess links.</p>}
      {profile?.social?.length? <p className="text-xs font-medium text-slate-600">Person</p>:null}
      {profile?.social?.map(item=><SocialFollow key={item.url} contactId={contactId} item={item}
        followed={followed.has(item.url)} onUpdated={()=>void data.refetch()}/>)}
      {profile?.companySocial?.length?<p className="text-xs font-medium text-slate-600">Company</p>:null}
      {profile?.companySocial?.map(item=><SocialFollow key={item.url} contactId={contactId} item={item}
        followed={followed.has(item.url)} onUpdated={()=>void data.refetch()}/>)}
      <p className="text-xs text-slate-500">Following happens on the social platform. The CRM only records your confirmation after you follow.</p>
    </div>
    {error&&<p className="text-red-700 text-xs" role="alert">{error}</p>}
  </section>;
}
