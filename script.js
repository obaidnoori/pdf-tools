// --- GLOBAL CONFIG & STATE ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let mergeQueue = [];
let orgPdfDoc = null;
let pageRotations = {}; 
let fabricCanvas = null;
let originalPdfArrayBuffer = null;
let undoStack = [];
let isModifying = false;

// Initialize Reorderable List for Merger
const mergeListEl = document.getElementById('file-list');
if (mergeListEl) {
    Sortable.create(mergeListEl, {
        animation: 150,
        ghostClass: 'sortable-ghost'
    });
}

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
    if (!fabricCanvas) return;
    undoStack.push(fabricCanvas.toJSON());
    if (undoStack.length > 20) undoStack.shift(); 
}

function undo() {
    if (undoStack.length > 0) {
        const previousState = undoStack.pop();
        isModifying = true; 
        fabricCanvas.loadFromJSON(previousState, function() {
            fabricCanvas.renderAll();
            isModifying = false;
        });
    }
}

// --- ADVANCED MERGER ---
function handleMergeFiles(event) {
    const files = Array.from(event.target.files);
    const listContainer = document.getElementById('file-list');
    
    files.forEach(file => {
        const fileId = Math.random().toString(36).substr(2, 9);
        mergeQueue.push({ id: fileId, file: file });

        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('data-id', fileId);
        li.innerHTML = `<span>📄 ${file.name}</span> <span style="cursor:grab">⠿</span>`;
        listContainer.appendChild(li);
    });
}

async function generateMergedPdf() {
    const status = document.getElementById('merge-status');
    const listItems = document.querySelectorAll('#file-list li');
    if (listItems.length < 2) return alert("Please select at least 2 files.");

    status.innerText = "Merging PDFs locally...";
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (const li of listItems) {
        const id = li.getAttribute('data-id');
        const fileObj = mergeQueue.find(item => item.id === id);
        const bytes = await fileObj.file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();
    downloadBlob(mergedBytes, 'merged_76supplier.pdf', 'application/pdf');
    status.innerText = "Complete!";
}

// --- FULL PDF EDITOR (Fabric.js) ---
async function openEditor(event) {
    const file = event.target.files[0];
    if (!file) return;

    const modal = document.getElementById('editor-modal');
    if (modal) modal.style.display = 'block';

    try {
        const arrayBuffer = await file.arrayBuffer();
        originalPdfArrayBuffer = arrayBuffer.slice(0); 
        
        const loadingTask = pdfjsLib.getDocument({data: originalPdfArrayBuffer});
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        tempCanvas.height = viewport.height;
        tempCanvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const bgImageData = tempCanvas.toDataURL('image/png');

        if (fabricCanvas) fabricCanvas.dispose();
        
        fabricCanvas = new fabric.Canvas('main-editor-canvas', {
            width: viewport.width,
            height: viewport.height,
        });

        fabric.Image.fromURL(bgImageData, function(img) {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });

        fabricCanvas.on('object:added', () => { if(!isModifying) saveState(); });
        fabricCanvas.on('object:modified', () => saveState());
        fabricCanvas.on('object:removed', () => { if(!isModifying) saveState(); });

        fabricCanvas.on('mouse:down', function(options) {
            const activeBtn = document.querySelector('.tool-btn.active');
            if (!activeBtn) return;
            const activeTool = activeBtn.id;

            if (activeTool === 'btn-text' && !options.target) {
                const text = new fabric.IText('Type here', {
                    left: options.pointer.x,
                    top: options.pointer.y,
                    fontFamily: 'Arial',
                    fontSize: 20,
                    fill: '#000',
                    padding: 10
                });
                fabricCanvas.add(text);
                setTool('select'); 
                fabricCanvas.setActiveObject(text);
                text.enterEditing();
            }
        });

    } catch (error) {
        console.error("Editor Error:", error);
    }
}

function setTool(tool) {
    if (!fabricCanvas) return;
    
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    fabricCanvas.isDrawingMode = false;

    if (tool === 'select') {
        const btn = document.getElementById('btn-select');
        if (btn) btn.classList.add('active');
        fabricCanvas.defaultCursor = 'default';
    } 
    else if (tool === 'text') {
        const btn = document.getElementById('btn-text');
        if (btn) btn.classList.add('active');
        fabricCanvas.defaultCursor = 'text';
    } 
    else if (tool === 'draw') {
        const btn = document.getElementById('btn-draw');
        if (btn) btn.classList.add('active');
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.width = 3;
        fabricCanvas.freeDrawingBrush.color = "#000000";
    }
}

async function saveEditedPdf() {
    try {
        const { PDFDocument, rgb } = PDFLib;
        const pdfDoc = await PDFDocument.load(originalPdfArrayBuffer.slice(0));
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();

        const scaleX = width / fabricCanvas.width;
        const scaleY = height / fabricCanvas.height;

        const objects = fabricCanvas.getObjects();
        
        for (const obj of objects) {
            if (obj.type === 'i-text') {
                firstPage.drawText(obj.text, {
                    x: obj.left * scaleX,
                    y: height - (obj.top * scaleY) - (obj.fontSize * scaleY),
                    size: obj.fontSize * scaleY,
                    color: rgb(0, 0, 0)
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(pdfBytes, '76_supplier_edited.pdf', 'application/pdf');
    } catch (err) {
        console.error("Save Error:", err);
    }
}

function deleteObject() {
    const active = fabricCanvas.getActiveObject();
    if (active) {
        fabricCanvas.remove(active);
        fabricCanvas.discardActiveObject().renderAll();
    }
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
    if (fabricCanvas) fabricCanvas.clear();
    const uploadInput = document.getElementById('editor-upload');
    if (uploadInput) uploadInput.value = "";
}
// --- SMOOTH UNDO SYSTEM ---
function undo() {
    if (undoStack.length > 0) {
        // Prevent adding the undo action itself to the stack
        isModifying = true; 
        const previousState = undoStack.pop();
        
        fabricCanvas.loadFromJSON(previousState, function() {
            fabricCanvas.renderAll();
            isModifying = false;
            console.log("Undo successful");
        });
    } else {
        console.log("Nothing left to undo");
    }
}

// --- FIXED SAVE/BURN FUNCTION ---
async function saveEditedPdf() {
    const status = document.getElementById('editor-status'); // Optional: add a status span in HTML
    if(status) status.innerText = "Processing...";

    try {
        const { PDFDocument, rgb } = PDFLib;
        
        // FIX: Always use a fresh slice to avoid "detached ArrayBuffer"
        const freshBuffer = originalPdfArrayBuffer.slice(0);
        const pdfDoc = await PDFDocument.load(freshBuffer);
        
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();

        // Calculate scaling between the Fabric canvas and the actual PDF page size
        const scaleX = width / fabricCanvas.width;
        const scaleY = height / fabricCanvas.height;

        const objects = fabricCanvas.getObjects();
        
        for (const obj of objects) {
            if (obj.type === 'i-text' || obj.type === 'text') {
                firstPage.drawText(obj.text, {
                    x: obj.left * scaleX,
                    // PDF coordinates start from bottom-left, Fabric from top-left
                    y: height - (obj.top * scaleY) - (obj.fontSize * scaleY),
                    size: obj.fontSize * scaleY,
                    color: rgb(0, 0, 0)
                });
            }
            // Add similar logic here for drawings/paths if needed
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(pdfBytes, '76_supplier_edited.pdf', 'application/pdf');
        
        if(status) status.innerText = "Download complete!";
    } catch (err) {
        console.error("Save Error:", err);
        if(status) status.innerText = "Error saving PDF.";
        alert("Failed to burn PDF: " + err.message);
    }
}
// (Include Batch Splitter, ImgToPdf, etc. here if you still need them)
