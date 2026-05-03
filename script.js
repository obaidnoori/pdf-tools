// --- GLOBAL CONFIG & STATE ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let mergeQueue = [];
let fabricCanvas = null;
let originalPdfArrayBuffer = null; // Master reference
let undoStack = [];
let isModifying = false;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const mergeListEl = document.getElementById('file-list');
    if (mergeListEl) {
        Sortable.create(mergeListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
    }
});

// --- UTILS ---
function downloadBlob(data, fileName, type) {
    const blob = new Blob([data], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
}

// --- UNDO SYSTEM ---
function saveState() {
    if (!fabricCanvas || isModifying) return;
    undoStack.push(JSON.stringify(fabricCanvas.toJSON()));
    if (undoStack.length > 20) undoStack.shift(); 
}

function undo() {
    if (undoStack.length > 0) {
        isModifying = true; 
        const previousState = undoStack.pop();
        fabricCanvas.loadFromJSON(previousState, () => {
            fabricCanvas.renderAll();
            isModifying = false;
        });
    }
}

// --- EDITOR CORE ---
async function openEditor(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Store the master buffer
        originalPdfArrayBuffer = await file.arrayBuffer();
        
        // Use a copy to render the background
        const loadingTask = pdfjsLib.getDocument({ data: originalPdfArrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        tempCanvas.height = viewport.height;
        tempCanvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const bgData = tempCanvas.toDataURL('image/png');

        if (fabricCanvas) fabricCanvas.dispose();
        
        fabricCanvas = new fabric.Canvas('main-editor-canvas', {
            width: viewport.width,
            height: viewport.height,
        });

        fabric.Image.fromURL(bgData, (img) => {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });

        // Event Listeners
        fabricCanvas.on('object:added', () => saveState());
        fabricCanvas.on('object:modified', () => saveState());

        document.getElementById('editor-modal').style.display = 'block';
    } catch (err) {
        console.error("Load Error:", err);
    }
}

function setTool(tool) {
    if (!fabricCanvas) return;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    fabricCanvas.isDrawingMode = false;

    if (tool === 'select') {
        document.getElementById('btn-select').classList.add('active');
    } else if (tool === 'text') {
        document.getElementById('btn-text').classList.add('active');
        // Simple click-to-add logic
        fabricCanvas.once('mouse:down', (opt) => {
            const t = new fabric.IText('Tap to edit', {
                left: opt.pointer.x,
                top: opt.pointer.y,
                fontSize: 20,
                fontFamily: 'Arial'
            });
            fabricCanvas.add(t);
            fabricCanvas.setActiveObject(t);
        });
    } else if (tool === 'draw') {
        document.getElementById('btn-draw').classList.add('active');
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush.width = 3;
    }
}

async function saveEditedPdf() {
    try {
        const { PDFDocument, rgb } = PDFLib;
        // CRITICAL: Always slice(0) to prevent detached buffer error
        const pdfDoc = await PDFDocument.load(originalPdfArrayBuffer.slice(0));
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();

        const scaleX = width / fabricCanvas.width;
        const scaleY = height / fabricCanvas.height;

        fabricCanvas.getObjects().forEach(obj => {
            if (obj.type === 'i-text' || obj.type === 'text') {
                firstPage.drawText(obj.text, {
                    x: obj.left * scaleX,
                    y: height - (obj.top * scaleY) - (obj.fontSize * scaleY),
                    size: obj.fontSize * scaleY,
                    color: rgb(0, 0, 0)
                });
            }
        });

        const pdfBytes = await pdfDoc.save();
        downloadBlob(pdfBytes, '76_supplier_fixed.pdf', 'application/pdf');
    } catch (err) {
        console.error("Save Error:", err);
        alert("Error: " + err.message);
    }
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
    if (fabricCanvas) fabricCanvas.clear();
}

// --- MERGER LOGIC ---
function handleMergeFiles(event) {
    const files = Array.from(event.target.files);
    const list = document.getElementById('file-list');
    files.forEach(file => {
        const id = Math.random().toString(36).substr(2, 9);
        mergeQueue.push({ id, file });
        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('data-id', id);
        li.innerHTML = `<span>📄 ${file.name}</span>`;
        list.appendChild(li);
    });
}

async function generateMergedPdf() {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    const items = document.querySelectorAll('#file-list li');

    for (const item of items) {
        const id = item.getAttribute('data-id');
        const entry = mergeQueue.find(f => f.id === id);
        const bytes = await entry.file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();
    downloadBlob(mergedBytes, 'merged_76.pdf', 'application/pdf');
}
