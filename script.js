/* ─────────────────────────────────────────
   76 PDF Suite — script.js
   ───────────────────────────────────────── */

/* ── LIBRARY SETUP (LOCAL PATH) ── */
// Points to your 'lib' folder on the lib branch
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

/* ── CONSTANTS ──────────────────────────── */
const LIMITS = {
  merge:  50,
  split:  100,
  img:    20,
  p2i:    50,
  wm:     100,
  meta:   100,
  editor: 50,
};

/* ── STATE ──────────────────────────────── */
let mergeFilesArray = [];
let imgFilesArray   = [];
let splitFile       = null;
let wmFile          = null;
let metaFile        = null;
let p2iFile         = null;
let p2iFormat       = 'jpg';
let p2iDpi          = 150;

// Editor State
let currentEditorFile = null;
let editorPdfDoc      = null;
let allCanvases       = {};

/* ── NAVIGATION ─────────────────────────── */
function showPanel(panelId) {
  // Hide all panels
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Show target panel
  const targetPanel = document.getElementById('panel-' + panelId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Update Sidebar Active State
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
    if (nav.getAttribute('data-panel') === panelId) {
      nav.classList.add('active');
    }
  });

  // Update Topbar Title
  const titles = {
    home: "Home", merge: "Merge PDFs", split: "Split PDF",
    'img-to-pdf': "Image to PDF", 'pdf-to-img': "PDF to Image",
    watermark: "Watermark", metadata: "Edit Metadata",
    editor: "PDF Editor", privacy: "Privacy Policy", contact: "Contact Us"
  };
  document.getElementById('topbar-title').textContent = titles[panelId] || "76 PDF Suite";

  // Mobile sidebar close
  closeSidebar();
  
  // FIX: Reset scroll to top so tool starts at the top of the screen
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

/* ── UI HELPERS ─────────────────────────── */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* ── INITIALIZATION ─────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // Sidebar Nav
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () =>
