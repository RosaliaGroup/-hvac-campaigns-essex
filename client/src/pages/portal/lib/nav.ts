import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  ReceiptText,
  CreditCard,
  CalendarClock,
  Wrench,
  AirVent,
  ShieldCheck,
  BadgeCheck,
  FolderOpen,
  MessagesSquare,
} from "lucide-react";

export type PortalNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

/** The 11 Customer Portal sections, in display order. */
export const PORTAL_NAV: PortalNavItem[] = [
  { label: "Dashboard", path: "/portal", icon: LayoutDashboard },
  { label: "Estimates", path: "/portal/estimates", icon: FileText },
  { label: "Invoices", path: "/portal/invoices", icon: ReceiptText },
  { label: "Payments", path: "/portal/payments", icon: CreditCard },
  { label: "Appointments", path: "/portal/appointments", icon: CalendarClock },
  { label: "Service History", path: "/portal/service-history", icon: Wrench },
  { label: "Equipment", path: "/portal/equipment", icon: AirVent },
  { label: "Warranties", path: "/portal/warranties", icon: ShieldCheck },
  { label: "Maintenance", path: "/portal/maintenance", icon: BadgeCheck },
  { label: "Documents", path: "/portal/documents", icon: FolderOpen },
  { label: "Messages", path: "/portal/messages", icon: MessagesSquare },
];
