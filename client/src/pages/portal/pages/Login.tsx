import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { InlineSpinner } from "../components/common";
import { usePortalAuth } from "../hooks/usePortalAuth";

/** Portal sign-in: password, passwordless magic link, or first-time account claim. */
export default function PortalLogin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = usePortalAuth();
  const utils = trpc.useUtils();

  // If already signed in, skip the form.
  if (!loading && isAuthenticated) {
    setLocation("/portal");
  }

  const afterAuth = async () => {
    await utils.portal.auth.me.invalidate();
    setLocation("/portal");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff6b35] text-lg font-bold text-white">
            ME
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Customer Portal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Mechanical Enterprise</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Welcome back</CardTitle>
            <CardDescription>Sign in to view your estimates, invoices, appointments and more.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="magic">Email link</TabsTrigger>
                <TabsTrigger value="register">Create</TabsTrigger>
              </TabsList>

              <TabsContent value="password">
                <PasswordForm onSuccess={afterAuth} />
              </TabsContent>
              <TabsContent value="magic">
                <MagicLinkForm />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm onSuccess={afterAuth} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          Trouble signing in? Call us at (551) 600-7027 and we'll get you set up.
        </p>
      </div>
    </div>
  );
}

function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
      {message}
    </p>
  );
}

function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.portal.auth.login.useMutation({ onSuccess });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">Password</Label>
        <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <FormError message={login.error?.message} />
      <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={login.isPending}>
        {login.isPending ? <InlineSpinner className="mr-2" /> : null} Sign in
      </Button>
    </form>
  );
}

function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const magic = trpc.portal.auth.requestMagicLink.useMutation();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    magic.mutate({ email, origin: window.location.origin });
  };

  if (magic.isSuccess) {
    return (
      <div className="mt-4 rounded-md bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        If that email matches an account, we've sent a secure sign-in link. Check your inbox.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="magic-email">Email</Label>
        <Input id="magic-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">We'll email you a one-time link — no password needed.</p>
      <FormError message={magic.error?.message} />
      <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={magic.isPending}>
        {magic.isPending ? <InlineSpinner className="mr-2" /> : null} Email me a link
      </Button>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = trpc.portal.auth.register.useMutation({ onSuccess });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate({ email, password, name: name || undefined });
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-name">Name</Label>
        <Input id="reg-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">Email</Label>
        <Input id="reg-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-password">Password</Label>
        <Input id="reg-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-xs text-slate-400">At least 8 characters. Use the email we have on file for you.</p>
      </div>
      <FormError message={register.error?.message} />
      <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={register.isPending}>
        {register.isPending ? <InlineSpinner className="mr-2" /> : null} Create account
      </Button>
    </form>
  );
}
