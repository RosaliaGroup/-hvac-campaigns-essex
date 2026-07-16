/**
 * /field/profile — Field App "My Profile"
 *
 * A phone-first screen where the logged-in technician views and updates their
 * OWN contact details: mobile phone, address, emergency contact, preferred
 * contact method, preferred language, and profile photo.
 *
 * Guardrail: this screen can ONLY change contact fields. Name, work email,
 * role/permissions, account status, and work assignments are read-only here —
 * the tRPC `updateMyProfile` mutation is whitelisted to contact fields, so the
 * server enforces this regardless of the UI.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, UserRound, ShieldCheck } from "lucide-react";
import { ContactFields } from "@/components/ContactFields";
import { contactFieldsFrom, contactFieldsToPayload, emptyContactFields, type ContactFieldsValue } from "@/lib/contactOptions";
import { isValidUsPhone } from "@shared/validation";

export default function FieldProfile() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: me, isLoading, isError, error } = trpc.teamAuth.me.useQuery();
  const [form, setForm] = useState<ContactFieldsValue>(emptyContactFields);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  // Seed the form once the profile loads.
  useEffect(() => {
    if (me) setForm(contactFieldsFrom(me));
  }, [me]);

  const saveMutation = trpc.teamAuth.updateMyProfile.useMutation({
    onSuccess: (updated) => {
      setSaved(true);
      setFormError("");
      if (updated) setForm(contactFieldsFrom(updated));
      utils.teamAuth.me.invalidate();
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => { setFormError(err.message); setSaved(false); },
  });

  const patch = (p: Partial<ContactFieldsValue>) => {
    setForm((f) => ({ ...f, ...p }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (form.mobilePhone.trim() && !isValidUsPhone(form.mobilePhone)) {
      setFormError("Enter a valid 10-digit US mobile phone number.");
      return;
    }
    if (form.emergencyContactPhone.trim() && !isValidUsPhone(form.emergencyContactPhone)) {
      setFormError("The emergency contact phone isn't a valid US number.");
      return;
    }
    saveMutation.mutate(contactFieldsToPayload(form));
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-3">
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => navigate("/field/today")} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold leading-tight">My Profile</h1>
            <p className="text-xs text-muted-foreground">Keep your contact details up to date</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-3 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
            <p className="text-sm">Loading your profile…</p>
          </div>
        ) : isError ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-center text-sm text-red-600">
              Couldn't load your profile. {error?.message}
            </CardContent>
          </Card>
        ) : !me ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-6 text-center">
              <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Your login isn't linked to a technician profile.</p>
              <p className="text-xs text-muted-foreground">
                Ask your team admin to add you as a technician, then sign in again.
              </p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Read-only identity */}
            <Card className="rounded-2xl">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                  {form.profilePhoto ? (
                    <img src={form.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserRound className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{me.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{me.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{me.role} · {me.status}</p>
                </div>
              </CardContent>
            </Card>

            <Alert className="rounded-2xl border-muted">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription className="text-xs text-muted-foreground">
                Your name, email, role, and work assignments are managed by your admin. You can update the fields below.
              </AlertDescription>
            </Alert>

            {formError && (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <ContactFields value={form} onChange={patch} idPrefix="fp" />
              </CardContent>
            </Card>

            {/* Sticky save bar */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-3 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-xl items-center gap-3">
                {saved && (
                  <span className="text-sm font-medium text-green-600">Saved ✓</span>
                )}
                <Button
                  type="submit"
                  className="ml-auto h-12 min-w-40 bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-base"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
