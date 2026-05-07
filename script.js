/* ─────────────────────────────────────────
   76 PDF Suite — script.js
   ───────────────────────────────────────── */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

// 1. Navigation Logic (Fixed Scrolling)
function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById('panel-' + panelId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
    if (nav.getAttribute('data-panel') === panelId) {
      nav.classList.add('active');
    }
  });

  const titles = {
    home: "Home", merge: "Merge PDFs", split: "Split PDF",
    'img-to-pdf': "Image to PDF", 'pdf-to-img': "PDF to Image",
    watermark: "Watermark", metadata: "Edit Metadata",
    editor: "PDF Editor", privacy: "Privacy Policy", contact: "Contact Us"
  };
  document.getElementById('topbar-title').textContent = titles[panelId] || "76 PDF Suite";

  closeSidebar();
  
  // FIX: Ensure tool appears at top of screen on selection
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

// 2. Initialize Navigation & Contact
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => showPanel(button.getAttribute('data-panel')));
  });

  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => showPanel(card.getAttribute('data-goto')));
  });

  document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // CONTACT FORM HANDLER
  const contactBtn = document.getElementById('btn-contact');
  if (contactBtn) {
    contactBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      const serviceID = 'YOUR_SERVICE_ID'; // Replace with yours
      const templateID = 'YOUR_TEMPLATE_ID'; // Replace with yours

      const params = {
        from_name: document.getElementById('contact-name').value,
        reply_to: document.getElementById('contact-email').value,
        subject: document.getElementById('contact-subject').value,
        message: document.getElementById('contact-message').value,
      };

      if (!params.from_name || !params.reply_to || !params.message) {
        showToast("All fields are required", "error");
        return;
      }

      contactBtn.innerText = "Sending...";
      contactBtn.disabled = true;

      emailjs.send(serviceID, templateID, params)
        .then(() => {
          showToast("Message Sent!", "success");
          document.querySelectorAll('.contact-form input, .contact-form textarea').forEach(i => i.value = '');
          contactBtn.innerText = "✉️ Send Message";
          contactBtn.disabled = false;
        }, (err) => {
          showToast("Send failed.", "error");
          contactBtn.innerText = "✉️ Send Message";
          contactBtn.disabled = false;
        });
    });
  }

  showPanel('home');
});

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}
