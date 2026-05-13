pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let mergeFiles = [];
let imgToPdfFiles = [];
let currentSingleFile = null;

function showPanel(panelId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('panel-' + panelId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-panel') === panelId) nav.classList.add('active');
    });

    const titles = { home: "Home", merge: "Merge PDFs", split: "Split PDF", 'img-to-pdf': "Image to PDF", 'pdf-to-img': "PDF to Image", watermark: "Watermark", metadata: "Edit Metadata", editor: "PDF Editor", privacy: "Privacy Policy", contact: "Contact Us" };
    document.getElementById('topbar-title').textContent = titles[panelId] || "76 PDF Suite";
    closeSidebar();
    window.scrollTo(0, 0);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('visible'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('visible'); }

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showPanel(btn.getAttribute('data-panel'))));
    document.querySelectorAll('.tool-card').forEach(card => card.addEventListener('click', () => showPanel(card.getAttribute('data-goto'))));
    document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

    setupMergeLogic();
    setupSplitLogic();
    setupImgToPdfLogic();
    setupPdfToImgLogic();
    setupWatermarkLogic();
    setupMetadataLogic();

    showPanel('home');
});

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + type;
    setTimeout(() => { t.className = ''; }, 3000);
}

function updateProgress(id, percent, label = '') {
    const wrap = document.getElementById(id + '-progress');
    const bar = document.getElementById(id + '-bar');
    const lbl = document.getElementById(id + '-progress-label');
    if (percent === 0) wrap.classList.remove('visible');
    else wrap.classList.add('visible');
    bar.style.width = percent + '%';
    if (label) lbl.textContent = label;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setupMergeLogic() {
    const input = document.getElementById('merge-input');
    const list = document.getElementById('merge-file-list');
    input.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(f => { if (f.type === 'application/pdf') mergeFiles.push(f); });
        renderMergeList();
    });
    new Sortable(list, { animation: 150, onEnd: (evt) => { const item = mergeFiles.splice(evt.oldIndex, 1)[0]; mergeFiles.splice(evt.newIndex, 0, item); }});
    document.getElementById('btn-merge').addEventListener('click', async () => {
        if (mergeFiles.length < 2) return showToast("Select at least 2 PDFs", "error");
        updateProgress('merge', 10, 'Loading files...');
        try {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();
            for (let i = 0; i < mergeFiles.length; i++) {
                const bytes = await mergeFiles[i].arrayBuffer();
                const pdf = await PDFDocument.load(bytes);
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(p => mergedPdf.addPage(p));
                updateProgress('merge', 10 + ((i + 1) / mergeFiles.length) * 80);
            }
            const pdfBytes = await mergedPdf.save();
            download(pdfBytes, "merged.pdf", "application/pdf");
            updateProgress('merge', 100, 'Done!'); setTimeout(() => updateProgress('merge', 0), 2000);
        } catch (err) { showToast("Error merging PDFs", "error"); updateProgress('merge', 0); }
    });
}
function renderMergeList() {
    const list = document.getElementById('merge-file-list'); list.innerHTML = '';
    mergeFiles.forEach((f, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="drag-handle">☰</span><span class="fn">${f.name}</span><span class="fs">${formatBytes(f.size)}</span><button class="rm" onclick="removeMergeFile(${i})">✕</button>`;
        list.appendChild(li);
    });
}
window.removeMergeFile = (i) => { mergeFiles.splice(i, 1); renderMergeList(); };

function setupSplitLogic() {
    document.getElementById('split-input').addEventListener('change', (e) => {
        currentSingleFile = e.target.files[0];
        if (currentSingleFile) { document.getElementById('split-fname').textContent = currentSingleFile.name; document.getElementById('split-info').classList.add('visible'); }
    });
    document.getElementById('btn-split').addEventListener('click', async () => {
        if (!currentSingleFile) return showToast("Select a PDF", "error");
        const interval = parseInt(document.getElementById('split-interval').value) || 1;
        updateProgress('split', 20, 'Processing...');
        try {
            const { PDFDocument } = PDFLib;
            const zip = new JSZip();
            const bytes = await currentSingleFile.arrayBuffer();
            const sourcePdf = await PDFDocument.load(bytes);
            const pageCount = sourcePdf.getPageCount();
            for (let i = 0; i < pageCount; i += interval) {
                const newPdf = await PDFDocument.create();
                const end = Math.min(i + interval, pageCount);
                const indices = Array.from({length: end - i}, (_, k) => i + k);
                const pages = await newPdf.copyPages(sourcePdf, indices);
                pages.forEach(p => newPdf.addPage(p));
                zip.file(`split_part_${Math.floor(i/interval) + 1}.pdf`, await newPdf.save());
                updateProgress('split', 20 + (i / pageCount) * 70);
            }
            download(await zip.generateAsync({type: "blob"}), "split_pdfs.zip", "application/zip");
            updateProgress('split', 100, 'Success!'); setTimeout(() => updateProgress('split', 0), 2000);
        } catch (err) { showToast("Error splitting PDF", "error"); updateProgress('split', 0); }
    });
}

function setupImgToPdfLogic() {
    document.getElementById('img-input').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(f => imgToPdfFiles.push(f)); renderImgList();
    });
    document.getElementById('btn-img-to-pdf').addEventListener('click', async () => {
        if (imgToPdfFiles.length === 0) return showToast("Select images", "error");
        updateProgress('img', 10);
        try {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            for (const f of imgToPdfFiles) {
                const imgBytes = await f.arrayBuffer();
                let img = f.type === 'image/jpeg' ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
                pdfDoc.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
            }
            download(await pdfDoc.save(), "images_to.pdf", "application/pdf");
            updateProgress('img', 100, 'Complete'); setTimeout(() => updateProgress('img', 0), 2000);
        } catch (err) { showToast("Error converting images", "error"); updateProgress('img', 0); }
    });
}
function renderImgList() {
    const list = document.getElementById('img-file-list'); list.innerHTML = '';
    imgToPdfFiles.forEach((f, i) => {
        const li = document.createElement('li'); li.innerHTML = `<span class="fn">${f.name}</span><button class="rm" onclick="removeImg(${i})">✕</button>`; list.appendChild(li);
    });
}
window.removeImg = (i) => { imgToPdfFiles.splice(i, 1); renderImgList(); };

function setupPdfToImgLogic() {
    document.getElementById('p2i-input').addEventListener('change', (e) => {
        currentSingleFile = e.target.files[0];
        if (currentSingleFile) { document.getElementById('p2i-fname').textContent = currentSingleFile.name; document.getElementById('p2i-info').classList.add('visible'); }
    });
    document.querySelectorAll('.option-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.target.parentElement.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });
    document.getElementById('btn-p2i').addEventListener('click', async () => {
        if (!currentSingleFile) return showToast("Select a PDF", "error");
        updateProgress('p2i', 10, 'Initializing...');
        try {
            const format = document.querySelector('#panel-pdf-to-img .option-pill.selected[data-fmt]')?.dataset.fmt || 'jpg';
            const scale = parseInt(document.querySelector('#panel-pdf-to-img .option-pill.selected[data-dpi]')?.dataset.dpi) || 2;
            const zip = new JSZip();
            const pdf = await pdfjsLib.getDocument({data: await currentSingleFile.arrayBuffer()}).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                updateProgress('p2i', 10 + (i / pdf.numPages) * 80, `Processing page ${i}...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height; canvas.width = viewport.width;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                zip.file(`page_${i}.${format}`, canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`).split(',')[1], {base64: true});
            }
            download(await zip.generateAsync({type: "blob"}), "pdf_images.zip", "application/zip");
            updateProgress('p2i', 100, 'Export complete!'); setTimeout(() => updateProgress('p2i', 0), 2000);
        } catch (err) { showToast("Conversion failed", "error"); updateProgress('p2i', 0); }
    });
}

function setupWatermarkLogic() {
    document.getElementById('watermark-input').addEventListener('change', (e) => {
        currentSingleFile = e.target.files[0];
        if (currentSingleFile) { document.getElementById('wm-fname').textContent = currentSingleFile.name; document.getElementById('wm-info').classList.add('visible'); }
    });
    document.getElementById('watermark-opacity').addEventListener('input', (e) => document.getElementById('wm-opacity-val').textContent = Math.round(e.target.value * 100) + '%');
    document.getElementById('btn-watermark').addEventListener('click', async () => {
        const text = document.getElementById('watermark-text').value;
        if (!currentSingleFile || !text) return showToast("Select PDF and enter text", "error");
        updateProgress('wm', 30);
        try {
            const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.load(await currentSingleFile.arrayBuffer());
            const helvetica = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const opacity = parseFloat(document.getElementById('watermark-opacity').value);
            pdfDoc.getPages().forEach(page => {
                const { width, height } = page.getSize();
                page.drawText(text, { x: width / 4, y: height / 2, size: 50, font: helvetica, color: rgb(0.7, 0.7, 0.7), rotate: degrees(45), opacity: opacity });
            });
            download(await pdfDoc.save(), "watermarked.pdf", "application/pdf");
            updateProgress('wm', 100); setTimeout(() => updateProgress('wm', 0), 2000);
        } catch (err) { showToast("Watermark failed", "error"); }
    });
}

function setupMetadataLogic() {
    document.getElementById('meta-input').addEventListener('change', (e) => {
        currentSingleFile = e.target.files[0];
        if (currentSingleFile) { document.getElementById('meta-fname').textContent = currentSingleFile.name; document.getElementById('meta-info').classList.add('visible'); }
    });
    document.getElementById('btn-metadata').addEventListener('click', async () => {
        if (!currentSingleFile) return showToast("Select PDF", "error");
        updateProgress('meta', 50);
        try {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(await currentSingleFile.arrayBuffer());
            pdfDoc.setTitle(document.getElementById('meta-title').value);
            pdfDoc.setAuthor(document.getElementById('meta-author').value);
            pdfDoc.setSubject(document.getElementById('meta-subject').value);
            download(await pdfDoc.save(), "updated_metadata.pdf", "application/pdf");
            updateProgress('meta', 100); setTimeout(() => updateProgress('meta', 0), 2000);
        } catch (err) { showToast("Failed to update metadata", "error"); }
    });
}

function download(data, name, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

document.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.getElementById(e.target.parentElement.id).classList.remove('visible');
        currentSingleFile = null;
    });
});
