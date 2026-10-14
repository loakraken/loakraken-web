// Price alerts (M33): shows what the backend pushes. Nothing else — no fetch
// handler, no cache. Bodies are JSON from LOAKraken's backend only (the push
// service delivers what our VAPID key signed): {"type":"SUBSCRIBED"} once when
// alerts are turned on, and {"type":"PRICE", itemId, itemName, price,
// comparator, threshold} when an item crosses its line.
const gold = (value) =>
  `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}G`;

function notice(data) {
  if (data && data.type === "PRICE" && typeof data.itemName === "string") {
    const line = data.comparator === "AT_OR_ABOVE" ? "이상" : "이하";
    return {
      title: `${data.itemName} ${gold(data.price)}`,
      body: `알림 기준 ${gold(data.threshold)} ${line}가 됐어요. 거래소 판매 최저가 기준이에요.`,
      tag: `price-${data.itemId}`,
      url: "/market/alerts",
    };
  }
  // SUBSCRIBED, or anything unexpected: a plain confirmation (a push must show something).
  return {
    title: "LOAKraken 시세 알림",
    body: "이 브라우저로 시세 알림을 받을 수 있어요.",
    tag: "subscribed",
    url: "/market/alerts",
  };
}

self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  const { title, body, tag, url } = notice(data);
  event.waitUntil(
    self.registration.showNotification(title, { body, tag, data: { url }, icon: "/apple-icon.png", lang: "ko" }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/market/alerts";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
