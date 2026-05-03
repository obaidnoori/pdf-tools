pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { PDFDocument, StandardFonts, rgb } = PDFLib;

function getSafeName(file, suffix) {
    const name = file.name.replace(/\.[^/.]+$/, "");
    return `${name}_${suffix}.pdf`;
}

function downloadBlob(data, name, type) {
    const blob = new Blob([data], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
}

/** MERGE */
let mergeFilesArray = [];
function handleMergeFiles(e) {
    mergeFilesArray = Array.from(e.target.files);
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    mergeFilesArray.forEach((f, i) => {
        const li = document.createElement('li');
        li.textContent = f.name;
        li.dataset.index = i;
        li.className = "sortable-item";
        list.appendChild(li);
    });
    new Sortable(list, { animation: 150 });
}

async function generateMergedPdf() {
    if (mergeFilesArray.length < 2) return;
    const listItems = document.querySelectorAll('#file-list li');
    const sortedFiles = Array.from(listItems).map(li => mergeFilesArray[li.dataset.index]);
    const mergedDoc = await PDFDocument.create();
    for (const f of sortedFiles) {
        const doc = await PDFDocument.load(await f.arrayBuffer());
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedDoc.addPage(p));
    }
    downloadBlob(await mergedDoc.save(), "merged_files.pdf", "application/pdf");
}

/** SPLIT */
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
    downloadBlob(content, `${file.name.split('.')[0]}_split_files.zip`, "application/zip");
}

/** IMAGE TO PDF */
async function generateImgToPdf() {
    const files = document.getElementById('img-input').files;
    if (!files.length) return;
    const pdfDoc = await PDFDocument.create();
    for (let f of files) {
        const bytes = await f.arrayBuffer();
        const img = f.type === 'image/jpeg' ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    downloadBlob(await pdfDoc.save(), "images_to_pdf.pdf", "application/pdf");
}

/** WATERMARK */
async function applyWatermark() {
    const file = document.getElementById('watermark-input').files[0];
    const text = document.getElementById('watermark-text').value.toUpperCase();
    if (!file || !text) return;
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    pdfDoc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(text, {
            x: (width / 2) - (font.widthOfTextAtSize(text, 60) / 2),
            y: (height / 2) - 30,
            size: 60, font: font, opacity: parseFloat(document.getElementById('watermark-opacity').value)
        });
    });
    downloadBlob(await pdfDoc.save(), getSafeName(file, "watermarked"), "application/pdf");
}

/** METADATA FIX */
let activeMetaFile = null;
async function loadMetadata(e) {
    activeMetaFile = e.target.files[0];
    if (!activeMetaFile) return;
    const doc = await PDFDocument.load(await activeMetaFile.arrayBuffer());
    document.getElementById('meta-title').value = doc.getTitle() || '';
    document.getElementById('meta-author').value = doc.getAuthor() || '';
}

async function saveMetadata() {
    if (!activeMetaFile) return;
    const doc = await PDFDocument.load(await activeMetaFile.arrayBuffer());
    doc.setTitle(document.getElementById('meta-title').value);
    doc.setAuthor(document.getElementById('meta-author').value);
    downloadBlob(await doc.save(), getSafeName(activeMetaFile, "metadata_update"), "application/pdf");
}

/** FULL EDITOR */
let currentEditorFile = null;
let editorPdfDoc = null;
let allCanvases = {};

async function openEditor(event) {
    currentEditorFile = event.target.files[0];
    if (!currentEditorFile) return;
    const modal = document.getElementById('editor-modal');
    const container = document.getElementById('canvas-container');
    modal.style.display = 'block';
    container.innerHTML = '';
    
    const bytes = await currentEditorFile.arrayBuffer();
    editorPdfDoc = await PDFDocument.load(bytes);
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const wrapper = document.createElement('div');
        wrapper.className = 'page-canvas-wrapper';
        wrapper.dataset.index = i - 1;

        const controls = document.createElement('div');
        controls.className = 'page-controls';
        controls.innerHTML = `<span>Page ${i}</span><button onclick="moveUp(this)">⬆️</button><button onclick="moveDown(this)">⬇️</button><button onclick="delPg(this)" style="color:red">❌</button>`;
        wrapper.appendChild(controls);

        const canvasEl = document.createElement('canvas');
        canvasEl.id = `c-${i}`;
        wrapper.appendChild(canvasEl);
        container.appendChild(wrapper);

        const fabricCanvas = new fabric.Canvas(`c-${i}`, { width: viewport.width, height: viewport.height });
        const tempC = document.createElement('canvas');
        tempC.width = viewport.width; tempC.height = viewport.height;
        await page.render({ canvasContext: tempC.getContext('2d'), viewport }).promise;
        
        fabric.Image.fromURL(tempC.toDataURL(), (img) => {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });
        allCanvases[i-1] = fabricCanvas;
    }
    setTool('select');
}

function setTool(t) {
    Object.values(allCanvases).forEach(c => {
        c.isDrawingMode = (t === 'draw');
        c.freeDrawingBrush.width = 4; // Bold Sign
        if (t === 'text') {
            c.once('mouse:down', (opt) => {
                c.add(new fabric.IText('Text', { left: opt.pointer.x, top: opt.pointer.y, fontSize: 20 }));
                setTool('select');
            });
        }
    });
}

async function saveEditedPdf() {
    const finalPdf = await PDFDocument.create();
    for (let w of document.querySelectorAll('.page-canvas-wrapper')) {
        const idx = parseInt(w.dataset.index);
        const [cp] = await finalPdf.copyPages(editorPdfDoc, [idx]);
        finalPdf.addPage(cp);
        const fab = allCanvases[idx];
        fab.discardActiveObject().renderAll();
        const img = await finalPdf.embedPng(fab.toDataURL({ format: 'png', multiplier: 2 }));
        finalPdf.getPages()[finalPdf.getPageCount()-1].drawImage(img, { x: 0, y: 0, width: cp.getWidth(), height: cp.getHeight() });
    }
    downloadBlob(await finalPdf.save(), getSafeName(currentEditorFile, "edit"), "application/pdf");
}

function moveUp(b) { const w = b.closest('.page-canvas-wrapper'); if (w.previousElementSibling) w.parentNode.insertBefore(w, w.previousElementSibling); }
function moveDown(b) { const w = b.closest('.page-canvas-wrapper'); if (w.nextElementSibling) w.parentNode.insertBefore(w.nextElementSibling, w); }
function delPg(b) { b.closest('.page-canvas-wrapper').remove(); }
function closeEditor() { document.getElementById('editor-modal').style.display = 'none'; }
function deleteObject() { Object.values(allCanvases).forEach(c => { c.remove(...c.getActiveObjects()); c.discardActiveObject(); }); }
