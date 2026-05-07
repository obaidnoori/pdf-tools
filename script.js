/** --- NAVIGATION --- **/
function showPanel(panelId) {
    // Hide all
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    // Show target
    document.getElementById('panel-' + panelId).classList.add('active');
    // Mobile menu close
    document.getElementById('main-nav').classList.remove('open');
    // Scroll to TOP
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMenu() {
    document.getElementById('main-nav').classList.toggle('open');
}

/** --- UTILS --- **/
const { PDFDocument, StandardFonts, rgb } = PDFLib;
function downloadBlob(data, name) {
    const blob = new Blob([data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
}

/** --- MERGE --- **/
let mergeFiles = [];
function handleMergeSelect(e) {
    mergeFiles = Array.from(e.target.files);
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    mergeFiles.forEach((f, i) => {
        const li = document.createElement('li');
        li.className = 'sortable-item';
        li.textContent = f.name;
        li.dataset.index = i;
        list.appendChild(li);
    });
    new Sortable(list, { animation: 150 });
}

async function generateMergedPdf() {
    if (mergeFiles.length < 2) return alert("Select 2+ files");
    const doc = await PDFDocument.create();
    const items = document.querySelectorAll('#file-list li');
    for (let li of items) {
        const file = mergeFiles[li.dataset.index];
        const subDoc = await PDFDocument.load(await file.arrayBuffer());
        const pages = await doc.copyPages(subDoc, subDoc.getPageIndices());
        pages.forEach(p => doc.addPage(p));
    }
    downloadBlob(await doc.save(), "merged_76pdf.pdf");
}

/** --- SPLIT --- **/
function updateSplitLabel(e) {
    const f = e.target.files[0];
    if (f) document.getElementById('split-filename').textContent = "Selected: " + f.name;
}

async function generateBatchSplit() {
    const file = document.getElementById('split-input').files[0];
    const interval = parseInt(document.getElementById('split-interval').value);
    if (!file) return;
    const zip = new JSZip();
    const sourceDoc = await PDFDocument.load(await file.arrayBuffer());
    for (let i = 0; i < sourceDoc.getPageCount(); i += interval) {
        const newDoc = await PDFDocument.create();
        const pages = await newDoc.copyPages(sourceDoc, Array.from({length: Math.min(interval, sourceDoc.getPageCount()-i)}, (_, k) => i + k));
        pages.forEach(p => newDoc.addPage(p));
        zip.file(`${file.name.split('.')[0]}_part_${(i/interval)+1}.pdf`, await newDoc.save());
    }
    const content = await zip.generateAsync({type:"blob"});
    const url = window.URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url; a.download = "split_76pdf.zip"; a.click();
}

/** --- EDITOR (STUB) --- **/
// Keeping editor simple for mobile stability
async function openEditor(e) {
    const file = e.target.files[0];
    if (!file) return;
    alert("Loading Editor for: " + file.name);
    // You can re-insert the full fabric.js logic here
}
