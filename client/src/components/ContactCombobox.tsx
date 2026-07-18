/**
 * Searchable Customer/Lead selector for the appointment dialog. Server-driven
 * search (customers + leads by name, company, phone, email, address), so cmdk's
 * built-in filtering is disabled. Also offers a "New contact…" action.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown, UserPlus, User, Building2 } from "lucide-react";

export interface SchedulingContact {
  kind: "customer" | "lead";
  key: string;
  customerId: number | null;
  refId: number;
  displayName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  propertyType: "residential" | "commercial";
  address: string;
}

export default function ContactCombobox({
  triggerLabel,
  onSelect,
  onNewContact,
}: {
  triggerLabel?: string;
  onSelect: (c: SchedulingContact) => void;
  onNewContact?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ready = q.trim().length >= 2;
  const { data, isFetching } = trpc.customers.searchForScheduling.useQuery(
    { q: q.trim(), limit: 10 },
    { enabled: open && ready },
  );
  const results = (data?.results ?? []) as SchedulingContact[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate text-muted-foreground">{triggerLabel || "Search customer or lead…"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Name, company, phone, email, address…" value={q} onValueChange={setQ} />
          <CommandList>
            {!ready ? (
              <CommandEmpty>Type at least 2 characters…</CommandEmpty>
            ) : isFetching && results.length === 0 ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No matches.</CommandEmpty>
            ) : (
              <CommandGroup heading="Matches">
                {results.map(r => (
                  <CommandItem key={r.key} value={r.key} onSelect={() => { onSelect(r); setOpen(false); }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {r.propertyType === "commercial"
                        ? <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        : <User className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {r.displayName}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {r.kind === "lead" ? (r.customerId ? "Lead · converted" : "Lead") : "Customer"}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.phone, r.email, r.address].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {onNewContact && (
              <CommandGroup>
                <CommandItem value="__new_contact__" onSelect={() => { onNewContact(); setOpen(false); }}>
                  <UserPlus className="h-4 w-4 mr-2" /> New contact…
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
