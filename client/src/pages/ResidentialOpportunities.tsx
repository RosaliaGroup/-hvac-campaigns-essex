/**
 * /opportunities/residential — RETIRED (2026-08-22).
 *
 * The standalone Residential Board read the older stageId plumbing and drifted
 * from live stage data (won deals shown as sent, commercial rows included).
 * The truthful residential view is the Opportunity Center's Residential lens,
 * so this route now redirects there instead of showing stale columns.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ResidentialOpportunities() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/opportunities", { replace: true }); }, [navigate]);
  return null;
}
