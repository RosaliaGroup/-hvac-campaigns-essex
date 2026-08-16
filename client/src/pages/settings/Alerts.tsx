/**
 * Settings → Alerts. The screen that lets someone turn on phone notifications.
 *
 * Web push has a lot of ways to be unavailable — unsupported browser, permission denied,
 * server keys missing, iOS Safari refusing outside an installed app. Each of those gets
 * its own message rather than a dead toggle, because "it doesn't work" with no reason is
 * the thing people give up on.
 */
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Smartphone } from "lucide-react";

/** VAPID keys travel as base64url but the browser wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

/** iOS only allows web push from an app installed to the home screen. */
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export default function AlertSettings() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    pushSupported() ? Notification.permission : "unsupported",
  );
  const [busy, setBusy] = useState(false);
  const [thisDevice, setThisDevice] = useState(false);

  const { data: vapid } = trpc.notifications.vapidKey.useQuery();
  const { data: deviceCount = 0 } = trpc.notifications.deviceCount.useQuery();
  const subscribe = trpc.notifications.subscribe.useMutation();
  const unsubscribe = trpc.notifications.unsubscribe.useMutation();
  const sendTest = trpc.notifications.sendTest.useMutation();

  // Reflect what this particular device is actually subscribed to, not just permission —
  // permission can be "granted" while the subscription was cleared server-side.
  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.getRegistration().then(async reg => {
      const sub = await reg?.pushManager.getSubscription();
      setThisDevice(!!sub);
    });
  }, []);

  const enable = async () => {
    if (!vapid?.key) {
      toast({ title: "Push isn't configured on the server", description: "VAPID keys are missing.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast({ title: "Notifications not allowed", description: "You can change this in your browser settings.", variant: "destructive" });
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.key),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Incomplete subscription");

      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 255),
      });
      setThisDevice(true);
      utils.notifications.deviceCount.invalidate();
      toast({ title: "Alerts enabled on this device" });
    } catch (err) {
      toast({ title: "Couldn't enable alerts", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribe.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setThisDevice(false);
      utils.notifications.deviceCount.invalidate();
      toast({ title: "Alerts turned off on this device" });
    } catch (err) {
      toast({ title: "Couldn't turn alerts off", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const iosBlocked = isIos() && !isInstalled();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold"><Bell className="h-5 w-5" /> Alerts</h1>
          <p className="text-sm text-muted-foreground">Get notified on this device when something needs you.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" /> This device
              {thisDevice ? <Badge className="bg-green-600">On</Badge> : <Badge variant="secondary">Off</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {permission === "unsupported" ? (
              <p className="text-sm text-muted-foreground">
                This browser doesn't support push notifications. The bell in the header still works.
              </p>
            ) : iosBlocked ? (
              <p className="text-sm text-amber-700">
                On iPhone, notifications only work once the app is added to your home screen.
                Tap Share → Add to Home Screen, open it from the icon, then come back here.
              </p>
            ) : !vapid?.key ? (
              <p className="text-sm text-amber-700">
                Push isn't configured on the server yet (VAPID keys missing). The bell still works.
              </p>
            ) : permission === "denied" ? (
              <p className="text-sm text-red-700">
                Notifications are blocked for this site. Allow them in your browser settings, then reload.
              </p>
            ) : thisDevice ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy} onClick={disable}>
                  <BellOff className="mr-1 h-4 w-4" /> Turn off on this device
                </Button>
                <Button
                  variant="secondary"
                  disabled={sendTest.isPending}
                  onClick={() =>
                    sendTest.mutate(undefined, {
                      onSuccess: r =>
                        toast({
                          title: r.sent ? "Test sent" : "Nothing sent",
                          description: r.sent ? "Check your notifications." : "No devices registered.",
                        }),
                    })
                  }
                >
                  Send test notification
                </Button>
              </div>
            ) : (
              <Button disabled={busy} onClick={enable}>
                <Bell className="mr-1 h-4 w-4" /> {busy ? "Enabling…" : "Turn on alerts"}
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              Alerts on {deviceCount} device{deviceCount === 1 ? "" : "s"} for your account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">What you'll be alerted about</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• A task assigned to you</li>
              <li>• A comment on a bid you're a member of</li>
              <li>• A customer texting in, or opting out</li>
              <li>• A follow-up email or text of yours being sent</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
