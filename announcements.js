import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZy9hSB6JRmsmduheEIBZnG4q6GatPd5c",
  authDomain: "czxx-8392d.firebaseapp.com",
  databaseURL: "https://czxx-8392d-default-rtdb.firebaseio.com",
  projectId: "czxx-8392d",
  storageBucket: "czxx-8392d.firebasestorage.app",
  messagingSenderId: "216434211403",
  appId: "1:216434211403:web:96c8b687ad2a7e8cf1abce",
  measurementId: "G-MR4F9DEVVR"
};

try {
  const app = initializeApp(firebaseConfig, "czxAnnouncementsPublic");
  const db = getDatabase(app);
  let banner = null;
  let currentStamp = "";

  function removeBanner() {
    if (banner) banner.remove();
    banner = null;
  }

  function showBanner(data) {
    if (!data || typeof data.text !== "string" || !data.text.trim()) {
      removeBanner();
      return;
    }
    const stamp = String(data.updatedAt || data.text);
    currentStamp = stamp;
    try {
      if (sessionStorage.getItem("czxAnnouncementDismissed") === stamp) {
        removeBanner();
        return;
      }
    } catch {}
    if (!banner) {
      banner = document.createElement("aside");
      banner.setAttribute("role", "status");
      banner.setAttribute("aria-live", "polite");
      banner.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(680px,calc(100vw - 24px));box-sizing:border-box;display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:#170d28;color:#fff;border:1px solid rgba(177,115,255,.65);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);z-index:2147483000;font:14px/1.45 system-ui,sans-serif";
      const content = document.createElement("div");
      content.style.cssText = "flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere";
      const heading = document.createElement("strong");
      heading.textContent = "📢 czX Announcement";
      heading.style.cssText = "display:block;margin-bottom:4px;color:#d7b8ff";
      const message = document.createElement("div");
      message.dataset.announcementMessage = "true";
      content.append(heading, message);
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", "Dismiss announcement");
      close.style.cssText = "flex:0 0 auto;border:0;background:transparent;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:0 2px";
      close.addEventListener("click", () => {
        try { sessionStorage.setItem("czxAnnouncementDismissed", currentStamp); } catch {}
        removeBanner();
      });
      banner.append(content, close);
      document.body.appendChild(banner);
    }
    banner.querySelector("[data-announcement-message]").textContent = data.text.trim();
  }

  onValue(ref(db, "czxAnnouncements/current"), snap => showBanner(snap.val()), () => removeBanner());
} catch (error) {
  console.error("czX announcements could not start:", error);
}
