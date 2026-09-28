import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, onValue, ref } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const config = {
  apiKey: "AIzaSyCZy9hSB6JRmsmduheEIBZnG4q6GatPd5c",
  authDomain: "czxx-8392d.firebaseapp.com",
  databaseURL: "https://czxx-8392d-default-rtdb.firebaseio.com",
  projectId: "czxx-8392d",
  storageBucket: "czxx-8392d.firebasestorage.app",
  messagingSenderId: "216434211403",
  appId: "1:216434211403:web:96c8b687ad2a7e8cf1abce",
  measurementId: "G-MR4F9DEVVR"
};

const app = getApps().length ? getApp() : initializeApp(config);
const db = getDatabase(app);
const style = document.createElement("style");
style.textContent = `
#czx-announcement-host{position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(900px,calc(100% - 24px));z-index:1000000;font-family:Inter,system-ui,sans-serif}
#czx-announcement-host[hidden]{display:none}
.czx-announcement{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:1px solid rgba(181,124,255,.55);border-radius:16px;background:rgba(18,8,34,.97);box-shadow:0 14px 48px rgba(0,0,0,.45);color:#fff;backdrop-filter:blur(14px)}
.czx-announcement[data-type="warning"]{border-color:#e8b64c;background:rgba(40,27,7,.97)}
.czx-announcement[data-type="urgent"]{border-color:#ff647d;background:rgba(42,7,19,.97)}
.czx-announcement-icon{font-size:20px;line-height:1.3}
.czx-announcement-copy{flex:1;min-width:0}
.czx-announcement-title{font-size:14px;font-weight:900;margin:0 0 3px}
.czx-announcement-message{font-size:13px;line-height:1.5;color:#e8e0f1;white-space:pre-wrap;overflow-wrap:anywhere}
.czx-announcement-close{flex:0 0 auto;border:0;border-radius:9px;background:rgba(255,255,255,.09);color:#fff;width:32px;height:32px;font-size:20px;cursor:pointer}
@media(max-width:520px){#czx-announcement-host{top:6px;width:calc(100% - 12px)}.czx-announcement{padding:11px 12px;gap:9px}.czx-announcement-message{font-size:12px}}
`;
document.head.appendChild(style);
const host = document.createElement("div");
host.id = "czx-announcement-host";
host.hidden = true;
host.setAttribute("aria-live", "polite");
document.body.prepend(host);

let currentKey = "";
let currentData = null;
function render(data) {
  currentData = data || null;
  if (!data || !String(data.title || "").trim() || !String(data.message || "").trim()) {
    host.hidden = true;
    host.replaceChildren();
    currentKey = "";
    return;
  }
  const key = String(data.createdAt || "") + "|" + data.title + "|" + data.message;
  currentKey = key;
  if (sessionStorage.getItem("czxAnnouncementDismissed") === key) {
    host.hidden = true;
    return;
  }
  const card = document.createElement("div");
  card.className = "czx-announcement";
  card.dataset.type = ["info", "warning", "urgent"].includes(data.type) ? data.type : "info";
  const icon = document.createElement("span");
  icon.className = "czx-announcement-icon";
  icon.textContent = card.dataset.type === "urgent" ? "🚨" : card.dataset.type === "warning" ? "⚠️" : "📢";
  const copy = document.createElement("div");
  copy.className = "czx-announcement-copy";
  const title = document.createElement("div");
  title.className = "czx-announcement-title";
  title.textContent = data.title;
  const message = document.createElement("div");
  message.className = "czx-announcement-message";
  message.textContent = data.message;
  copy.append(title, message);
  const close = document.createElement("button");
  close.className = "czx-announcement-close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss announcement");
  close.textContent = "×";
  close.addEventListener("click", () => {
    sessionStorage.setItem("czxAnnouncementDismissed", key);
    host.hidden = true;
  });
  card.append(icon, copy, close);
  host.replaceChildren(card);
  host.hidden = false;
}
onValue(ref(db, "czxAnnouncements/current"), snapshot => render(snapshot.val()), () => {
  host.hidden = true;
});
