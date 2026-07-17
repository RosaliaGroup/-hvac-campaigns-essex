import { useRef, useState } from "react";
import { FolderOpen, Download, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { AsyncSection, PortalPageHeader, StatusBadge, InlineSpinner } from "../components/common";
import { formatDate, humanize } from "../lib/format";

const MAX_BYTES = 15 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export default function PortalDocuments() {
  const query = trpc.portal.documents.list.useQuery(undefined, { retry: false });
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = trpc.portal.documents.upload.useMutation();
  const getUrl = trpc.portal.documents.getDownloadUrl.useMutation({
    onSuccess: (res) => window.open(res.url, "_blank", "noopener,noreferrer"),
    onError: (err) => toast({ variant: "destructive", title: "Download unavailable", description: err.message }),
  });

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "File too large", description: "Please choose a file 15 MB or smaller." });
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await readAsBase64(file);
      await upload.mutateAsync({
        title: file.name,
        fileName: file.name,
        category: "other",
        mimeType: file.type || undefined,
        dataBase64,
      });
      toast({ title: "Uploaded", description: `${file.name} was added to your documents.` });
      await utils.portal.documents.list.invalidate();
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Documents"
        description="Proposals, permits, warranties and files we've shared — plus anything you upload."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
              aria-hidden="true"
            />
            <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <InlineSpinner className="mr-2" /> : <Upload className="mr-1.5 h-4 w-4" />} Upload
            </Button>
          </>
        }
      />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No documents yet"
        emptyDescription="Files we share with you — or that you upload — will be listed here."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <FolderOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {humanize(d.category)} · {formatDate(d.createdAt)}
                        {d.uploadedBy === "customer" ? " · uploaded by you" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge label={humanize(d.category)} tone="neutral" />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={getUrl.isPending}
                      onClick={() => getUrl.mutate({ id: d.id })}
                    >
                      <Download className="mr-1.5 h-4 w-4" /> Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
