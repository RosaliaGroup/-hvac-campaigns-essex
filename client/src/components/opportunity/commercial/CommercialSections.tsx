import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ChecklistSection from "./ChecklistSection";
import CommentsSection from "./CommentsSection";
import DocumentsSection from "./DocumentsSection";
import MembersSection from "./MembersSection";
import DescriptionSection from "./DescriptionSection";
import QuickFieldsSection from "./QuickFieldsSection";
import AskAISection from "./AskAISection";

/**
 * P2 commercial detail sections (Checklist / Members / Documents / Comments) rendered
 * inside the SHARED OpportunityDetailDrawer for commercial records only. Self-contained:
 * it fetches its own commercial detail (opportunities.commercial.get, which runs the
 * server-side assertCommercial guard), so the drawer needs only a one-line conditional
 * render — keeping that A2-shared file's diff tiny for a clean rebase.
 */
export default function CommercialSections({
  opportunityId, section = "work",
}: {
  opportunityId: number;
  /**
   * "work" renders the card body (Checklist / Members / Documents); "activity" renders
   * just the comment stream for the right-hand column; "quickfields" renders the chip row
   * that sits under the card title. All mount the same query, which react-query dedupes.
   */
  section?: "work" | "activity" | "quickfields" | "description";
}) {
  const q = trpc.opportunities.commercial.get.useQuery({ id: opportunityId }, { retry: false });
  const d = q.data;
  // Render nothing until commercial detail loads; non-commercial records resolve to
  // NOT_FOUND (assertCommercial) → q.data stays undefined → this stays invisible.
  if (!d) return null;

  if (section === "description") {
    return <DescriptionSection opportunityId={opportunityId} description={d.opportunity.description ?? null} />;
  }

  if (section === "quickfields") {
    return <QuickFieldsSection opportunityId={opportunityId} detail={d} />;
  }

  if (section === "activity") {
    return <CommentsSection opportunityId={opportunityId} comments={d.comments} members={d.members} />;
  }

  return (
    <div>
      <Tabs defaultValue="checklist">
        <TabsList>
          <TabsTrigger value="checklist">Checklist{d.checklist.length ? ` (${d.checklist.length})` : ""}</TabsTrigger>
          <TabsTrigger value="members">Members{d.members.length ? ` (${d.members.length})` : ""}</TabsTrigger>
          <TabsTrigger value="documents">Documents{d.documents.length ? ` (${d.documents.length})` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist" className="mt-3">
          <ChecklistSection opportunityId={opportunityId} items={d.checklist} groups={d.checklistGroups} members={d.members} />
        </TabsContent>
        <TabsContent value="members" className="mt-3">
          <MembersSection opportunityId={opportunityId} members={d.members} />
        </TabsContent>
        <TabsContent value="documents" className="mt-3">
          <DocumentsSection opportunityId={opportunityId} documents={d.documents} />
          <AskAISection opportunityId={opportunityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
