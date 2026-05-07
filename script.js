/* ─────────────────────────────────────────
   76 PDF Suite — script.js
   ───────────────────────────────────────── */

// Updated to root path for main branch
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

/* ── NAVIGATION ── */
function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + panelId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
    if (nav.getAttribute('data-panel') === panelId) nav.classList.add('active');
  });

  const titles = { home: "Home", merge: "Merge PDFs", split: "Split PDF", 'img-to-pdf': "Image to PDF", editor: "PDF Editor", privacy: "Privacy Policy" };
  document.getElementById('topbar-title').textContent = titles[panelId] || "76 PDF Suite";

  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' }); // Navigation reset
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

/* ── INITIALIZATION ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.getAttribute('data-panel')));
  });

  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => showPanel(card.getAttribute('data-goto')));
  });

  document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  showPanel('home');
});

// Helper for UI feedback
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}
