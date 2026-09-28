import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, set, remove, get } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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

const panel = document.querySelector("#devOverlay .settings-panel");
if (panel) {
  const section = document.createElement("div");
  section.className = "setting";
  section.innerHTML = '<label for="czxAnnouncementText">Site announcement</label><p>Publish a message banner across czX pages. Keep it short and useful.</p><textarea id="czxAnnouncementText" maxlength="500" rows="3" class="text-input" placeholder="Write an announcement (max 500 characters)" style="width:100%;box-sizing:border-box;resize:vertical"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="save-button" id="czxPublishAnnouncement" type="button">📢 Publish announcement</button><button class="secondary-button" id="czxClearAnnouncement" type="button">Clear announcement</button></div><span class="saved-message" id="czxAnnouncementStatus" aria-live="polite"></span><div id="czxAnnouncementCurrent" style="font-size:12px;color:#aaa;margin-top:6px"></div>';
  panel.appendChild(section);

  const input = section.querySelector("#czxAnnouncementText");
  const publish = section.querySelector("#czxPublishAnnouncement");
  const clear = section.querySelector("#czxClearAnnouncement");
  const status = section.querySelector("#czxAnnouncementStatus");
  const current = section.querySelector("#czxAnnouncementCurrent");

  try {
    const app = initializeApp(firebaseConfig, "czxAnnouncementsAdmin");
    const auth = getAuth(app);
    const db = getDatabase(app);
    const ready = signInAnonymously(auth);

    async function loadCurrent() {
      try {
        await ready;
        const snap = await get(ref(db, "czxAnnouncements/current"));
        const data = snap.val();
        current.textContent = data && data.text ? "Currently published: " + data.text : "No announcement is currently published.";
        if (data && data.text && !input.value) input.value = data.text;
      } catch {
        current.textContent = "Could not read the current announcement. Check Firebase database rules.";
      }
    }

    publish.addEventListener("click", async () => {
      const message = input.value.trim();
      if (!message) { status.textContent = "Type an announcement first."; return; }
      publish.disabled = true;
      status.textContent = "Publishing...";
      try {
        await ready;
        await set(ref(db, "czxAnnouncements/current"), {
          text: message,
          updatedAt: Date.now(),
          username: (JSON.parse(localStorage.getItem("czxAccount") || "null") || {}).username || "Developer"
        });
        status.textContent = "Announcement published across czX pages.";
        await loadCurrent();
      } catch (error) {
        status.textContent = "Could not publish. Check Firebase database write rules.";
      } finally { publish.disabled = false; }
    });

    clear.addEventListener("click", async () => {
      if (!confirm("Remove the announcement from czX pages?")) return;
      clear.disabled = true;
      status.textContent = "Clearing...";
      try {
        await ready;
        await remove(ref(db, "czxAnnouncements/current"));
        input.value = "";
        current.textContent = "No announcement is currently published.";
        status.textContent = "Announcement cleared.";
      } catch {
        status.textContent = "Could not clear. Check Firebase database write rules.";
      } finally { clear.disabled = false; }
    });

    document.getElementById("devModeButton")?.addEventListener("click", loadCurrent);
    loadCurrent();
  } catch (error) {
    status.textContent = "Announcement controls could not start.";
    console.error("czX announcement controls could not start:", error);
  }
}
