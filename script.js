/* ─────────────────────────────────────────
   76 PDF Suite — script.js
   ───────────────────────────────────────── */

// CRITICAL: Point to local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

/* ── STATE ── */
let mergeFilesArray = [];
let imgFilesArray   = [];
let splitFile       = null;
let wmFile          = null;
let metaFile        = null;
let p2iFile         = null;
let currentEditorFile = null;
let editorPdfDoc      = null;
let allCanvases       = {};

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
  window.scrollTo({ top: 0, behavior: 'smooth' }); // Fixes scroll position
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

/* ── INIT ── */
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

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}
