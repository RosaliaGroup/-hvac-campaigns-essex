/**
 * Documents tab — metadata / external-link management only (no Google Drive, no
 * upload storage; there is no functioning upload system, so no upload button).
 * Add a link, set title + category + type, edit category/title, remove.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Trash2, Plus } from "lucide-react";
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from "@shared/commercialPipeline";
import { fmtDate } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

type Doc = CommercialDetail["documents"][number];

export default function DocumentsSection({ opportunityId, documents }: { opportunityId: number; documents: Doc[] }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState("miscellaneous");

  const invalidate = () => utils.opportunities.commercial.get.invalidate({ id: opportunityId });
  const onError = (err: { message: string }) => toast({ title: "Document error", description: err.message, variant: "destructive" });

  const create = trpc.opportunities.commercial.documents.create.useMutation({
    onSuccess: () => { setAdding(false); setUrl(""); setFileName(""); setCategory("miscellaneous"); invalidate(); },
    onError,
  });
  const remove = trpc.opportunities.commercial.documents.remove.useMutation({ onSuccess: invalidate, onError });
  const update = trpc.opportunities.commercial.documents.update.useMutation({ onSuccess: invalidate, onError });

  const validUrl = /^https?:\/\//i.test(url) || url.startsWith("/");

  return (
    <div className="space-y-3">
      {canWrite ? (
        adding ? (
          <div className="space-y-2 rounded-lg border p-3">
            <Input placeholder="https://… link to the document" value={url} onChange={e => setUrl(e.target.value)} />
            <Input placeholder="Title / file name (optional)" value={fileName} onChange={e => setFileName(e.target.value)} />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!validUrl || create.isPending}
                onClick={() => create.mutate({ opportunityId, category, kind: "link", url: url.trim(), fileName: fileName.trim() || null })}
              >
                {create.isPending ? "Linking…" : "Link document"}
              </Button>
            </div>
            {url && !validUrl ? <p className="text-xs text-red-600">Enter a valid http(s) URL or internal path.</p> : null}
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" /> Link a document</Button>
        )
      ) : null}

      {documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No documents linked.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {documents.map(d => (
            <li key={d.id} className="flex items-center gap-2 p-2.5">
              <Badge variant="secondary" className="shrink-0 text-[10px]">{documentCategoryLabel(d.category)}</Badge>
              <a href={d.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1 text-sm text-[#1e3a5f] hover:underline">
                <span className="truncate">{d.fileName || d.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(d.createdAt)}</span>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Select value={d.category} onValueChange={cat => update.mutate({ documentId: d.id, category: cat })}>
                    <SelectTrigger className="h-7 w-8 border-none p-1"><span className="sr-only">Category</span></SelectTrigger>
                    <SelectContent>{DOCUMENT_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <button aria-label="Remove" onClick={() => remove.mutate({ documentId: d.id })} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
