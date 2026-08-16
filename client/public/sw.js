/**
 * Service worker — exists solely to receive web push and open the right screen.
 *
 * Deliberately does NOT cache anything. This is a CRM whose whole value is showing the
 * current state of leads and bids; a stale cached shell would be worse than a slow load.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Mechanical Enterprise", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Mechanical Enterprise";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces an earlier alert about the same record instead of stacking.
      tag: data.tag || undefined,
      data: { link: data.link || "/" },
    }),
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";

  // Focus an already-open window rather than opening a second copy of the app.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
