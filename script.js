// Timetable Viewer (beginner-friendly)
// - Loads data.json once (cached in memory)
// - Search is case-insensitive and ignores spaces
// - Shows all matches (if roll appears multiple times)

let cachedData = null;
let dataPromise = null;

const STORAGE_KEY_LAST_ROLL = "timetable:lastRoll";

function normalizeRoll(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function setStatus(message) {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = message || "";
}

function setLoading(isLoading) {
  const btn = document.getElementById("searchBtn");
  const input = document.getElementById("rollInput");

  if (btn) btn.disabled = isLoading;
  if (input) input.disabled = isLoading;

  if (isLoading) setStatus("Loading timetable data…");
}

async function loadDataOnce() {
  if (cachedData) return cachedData;
  if (dataPromise) return dataPromise;

  dataPromise = (async () => {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load data.json (HTTP ${res.status})`);
    }
    const json = await res.json();

    // The file is expected to be an array of objects.
    cachedData = Array.isArray(json) ? json : [];
    return cachedData;
  })();

  return dataPromise;
}

function renderResults(results, normalizedRoll) {
  const resultDiv = document.getElementById("result");
  if (!resultDiv) return;

  if (!normalizedRoll) {
    resultDiv.innerHTML = "";
    return;
  }

  if (!results.length) {
    resultDiv.innerHTML = `<div class="notFound">Not Found</div>`;
    return;
  }

  const safe = (v) => (v === undefined || v === null || v === "" ? "-" : String(v));

  const rowsHtml = results
    .map((r) => {
      return `
        <tr>
          <td data-label="Date">${safe(r["Date"])}</td>
          <td data-label="Session">${safe(r["SESSION"])}</td>
          <td data-label="Room">${safe(r["Room No"])}</td>
          <td data-label="Course">${safe(r["Course No"])}</td>
        </tr>`;
    })
    .join("");

  resultDiv.innerHTML = `
    <div class="pill">Matches: ${results.length}</div>
    <div style="height: 10px;"></div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Session</th>
            <th>Room</th>
            <th>Course</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function findMatches(data, normalizedRoll) {
  const results = [];

  for (const item of data) {
    const students = item && item.students;
    if (!Array.isArray(students)) continue;

    // Check inside "students" array for this roll
    for (const student of students) {
      if (normalizeRoll(student) === normalizedRoll) {
        results.push(item);
        break; // don’t duplicate the same item if student appears twice inside one item
      }
    }
  }

  return results;
}

async function searchRoll() {
  const input = document.getElementById("rollInput");
  const normalizedRoll = normalizeRoll(input ? input.value : "");

  // store last searched roll (even if empty, we can clear it)
  try {
    localStorage.setItem(STORAGE_KEY_LAST_ROLL, input ? input.value : "");
  } catch {
    // localStorage can fail in some environments; ignore safely.
  }

  if (!normalizedRoll) {
    setStatus("Please enter a roll number.");
    renderResults([], "");
    return;
  }

  setLoading(true);
  renderResults([], normalizedRoll);

  try {
    const data = await loadDataOnce();
    const results = findMatches(data, normalizedRoll);

    setStatus(`Showing results for "${input.value.trim()}".`);
    renderResults(results, normalizedRoll);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Something went wrong.");
    const resultDiv = document.getElementById("result");
    if (resultDiv) resultDiv.innerHTML = `<div class="notFound">Not Found</div>`;
  } finally {
    setLoading(false);
  }
}

// Wire up UI events
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("rollInput");
  const btn = document.getElementById("searchBtn");

  // Restore last searched roll number
  try {
    const last = localStorage.getItem(STORAGE_KEY_LAST_ROLL);
    if (input && last) input.value = last;
  } catch {
    // ignore
  }

  if (btn) btn.addEventListener("click", searchRoll);

  // Pressing Enter triggers search
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchRoll();
    });
  }

  // Preload data in the background (fast subsequent searches)
  loadDataOnce().catch(() => {
    // Status will show error on actual search; no need to spam on load.
  });
});
