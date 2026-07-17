import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/common";

/** Portal-scoped 404 — keeps the customer inside the portal shell. */
export default function PortalNotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="That portal page doesn't exist."
      action={
        <Link href="/portal">
          <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">Back to dashboard</Button>
        </Link>
      }
    />
  );
}
