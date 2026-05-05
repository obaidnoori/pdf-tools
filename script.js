/* ─────────────────────────────────────────
   76 PDF Suite — script.js (Fixed Navigation)
   ───────────────────────────────────────── */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

// 1. Navigation Logic
function showPanel(panelId) {
  // Hide all panels
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Show the requested panel
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

  // Auto-close sidebar on mobile after clicking
  closeSidebar();
  
  // Scroll to top of content
  window.scrollTo(0, 0);
}

// 2. Sidebar & Mobile Controls
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// 3. Initialize Everything on Load
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar Button Listeners
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      const panel = button.getAttribute('data-panel');
      showPanel(panel);
    });
  });

  // Home Grid "Tool Card" Listeners
  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-goto');
      showPanel(target);
    });
  });

  // Hamburger & Overlay
  document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // Default View
  showPanel('home');
});

// --- HELPER FUNCTIONS (Toast, File Size, etc.) ---
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}

// Ensure the "Clear" buttons in the tool cards work
document.querySelectorAll('.file-remove').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const key = e.target.id.split('-')[0]; // gets 'split', 'wm', etc.
    document.getElementById(key + '-info').classList.remove('visible');
  });
});