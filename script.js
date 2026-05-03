// --- GLOBAL CONFIG & STATE ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let mergeQueue = [];
let orgPdfDoc = null;
let pageRotations = {}; 
let fabricCanvas = null;
let originalPdfBytes = null;

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

// --- BATCH SPLITTER ---
async function generateBatchSplit() {
    const input = document.getElementById('split-input');
    const interval = parseInt(document.getElementById('split-interval').value);
    const status = document.getElementById('split-status');

    if (!input.files[0]) return alert("Select a PDF file.");
    status.innerText = "Processing split...";

    const { PDFDocument } = PDFLib;
    const zip = new JSZip();
    const bytes = await input.files[0].arrayBuffer();
    const mainPdf = await PDFDocument.load(bytes);
    const totalPages = mainPdf.getPageCount();

    for (let i = 0; i < totalPages; i += interval) {
        const newPdf = await PDFDocument.create();
        const end = Math.min(i + interval, totalPages);
        const indices = Array.from({length: end - i}, (_, n) => i + n);
        const copiedPages = await newPdf.copyPages(mainPdf, indices);
        copiedPages.forEach(p => newPdf.addPage(p));
        
        const pdfBytes = await newPdf.save();
        zip.file(`split_part_${Math.floor(i/interval) + 1}.pdf`, pdfBytes);
    }

    const zipContent = await zip.generateAsync({type: "blob"});
    downloadBlob(zipContent, 'split_bundle_76supplier.zip', 'application/zip');
    status.innerText = "Done!";
}

// --- IMAGE TO PDF ---
async function generateImgToPdf() {
    const input = document.getElementById('img-input');
    if (input.files.length === 0) return alert("Select images first");

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    for (const file of input.files) {
        const imgBytes = await file.arrayBuffer();
        let image = (file.type === "image/png") ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(pdfBytes, 'images_to_76pdf.pdf', 'application/pdf');
}

// --- PDF TO IMAGE ---
async function generatePdfToImg() {
    const input = document.getElementById('pdf-to-img-input');
    if (!input.files[0]) return alert("Select a PDF");

    const zip = new JSZip();
    const arrayBuffer = await input.files[0].arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const imgData = canvas.toDataURL('image/jpeg').split(',')[1];
        zip.file(`page_${i}.jpg`, imgData, { base64: true });
    }

    const content = await zip.generateAsync({ type: "blob" });
    downloadBlob(content, 'pdf_pages_76supplier.zip', 'application/zip');
}

// --- PROTECT PDF ---
async function lockPdf() {
    const input = document.getElementById('protect-input');
    const password = document.getElementById('pdf-password').value;
    if (!input.files[0] || !password) return alert("Select file and enter password");

    const { PDFDocument } = PDFLib;
    const bytes = await input.files[0].arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);

    const encryptedBytes = await pdfDoc.save({
        userPassword: password,
        ownerPassword: password,
        permissions: { printing: 'highResolution', modifying: false, copying: false }
    });

    downloadBlob(encryptedBytes, 'protected_76supplier.pdf', 'application/pdf');
}

// --- ORGANIZE & ROTATE ---
async function loadPagesForOrg(event) {
    const file = event.target.files[0];
    const list = document.getElementById('page-list');
    list.innerHTML = ""; 
    pageRotations = {};

    const { PDFDocument } = PDFLib;
    const bytes = await file.arrayBuffer();
    orgPdfDoc = await PDFDocument.load(bytes);
    const pageCount = orgPdfDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('data-index', i);
        li.innerHTML = `
            <span>Page ${i + 1}</span>
            <div>
                <button onclick="rotatePage(this, ${i})">🔄 Rotate</button>
                <button onclick="this.parentElement.parentElement.remove()" style="color:red">🗑️</button>
                <span style="cursor:grab; margin-left:10px;">⠿</span>
            </div>
        `;
        list.appendChild(li);
    }
    Sortable.create(list, { animation: 150 });
}

function rotatePage(btn, index) {
    pageRotations[index] = (pageRotations[index] || 0) + 90;
    btn.style.transform = `rotate(${pageRotations[index]}deg)`;
}

async function exportOrganizedPdf() {
    const listItems = document.querySelectorAll('#page-list li');
    const { PDFDocument, degrees } = PDFLib;
    const newPdf = await PDFDocument.create();

    for (const li of listItems) {
        const oldIndex = parseInt(li.getAttribute('data-index'));
        const [copiedPage] = await newPdf.copyPages(orgPdfDoc, [oldIndex]);
        if (pageRotations[oldIndex]) {
            copiedPage.setRotation(degrees(pageRotations[oldIndex] % 360));
        }
        newPdf.addPage(copiedPage);
    }

    const bytes = await newPdf.save();
    downloadBlob(bytes, "organized_76supplier.pdf", "application/pdf");
}

// --- WATERMARK ---
async function applyWatermark() {
    const input = document.getElementById('watermark-input');
    const text = document.getElementById('watermark-text').value;
    const opacity = parseFloat(document.getElementById('watermark-opacity').value);
    if (!input.files[0] || !text) return alert("Select file and enter text");

    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
    const bytes = await input.files[0].arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    pdfDoc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(text, {
            x: width / 4, y: height / 2,
            size: 50, font: font,
            color: rgb(0.5, 0.5, 0.5),
            opacity: opacity, rotate: degrees(45),
        });
    });

    const pdfBytes = await pdfDoc.save();
    downloadBlob(pdfBytes, "watermarked_76supplier.pdf", "application/pdf");
}

// --- METADATA EDITOR ---
async function loadMetadata(event) {
    const file = event.target.files[0];
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
    document.getElementById('meta-title').value = pdfDoc.getTitle() || "";
    document.getElementById('meta-author').value = pdfDoc.getAuthor() || "";
}

async function saveMetadata() {
    const input = document.getElementById('meta-input');
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(await input.files[0].arrayBuffer());
    
    pdfDoc.setTitle(document.getElementById('meta-title').value);
    pdfDoc.setAuthor(document.getElementById('meta-author').value);
    pdfDoc.setProducer("76 PDF Suite");

    const bytes = await pdfDoc.save();
    downloadBlob(bytes, "updated_meta_76supplier.pdf", "application/pdf");
}

// --- FULL PDF EDITOR (Fabric.js) ---
async function openEditor(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('editor-modal').style.display = 'block';

    try {
        originalPdfBytes = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({data: originalPdfBytes});
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
            height: viewport.height
        });

        fabric.Image.fromURL(bgImageData, function(img) {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });

        // Add text on double click
        fabricCanvas.on('mouse:dblclick', function(options) {
            if (fabricCanvas.isDrawingMode) return;
            const text = new fabric.IText('Type here', {
                left: options.pointer.x,
                top: options.pointer.y,
                fontFamily: 'Arial',
                fontSize: 20,
                fill: '#000'
            });
            fabricCanvas.add(text);
            fabricCanvas.setActiveObject(text);
        });

    } catch (error) {
        console.error("Editor Error:", error);
        alert("Could not open PDF.");
    }
}

function setTool(tool) {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = (tool === 'draw');
    
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = (tool === 'draw') ? document.getElementById('btn-draw') : document.getElementById('btn-text');
    if (activeBtn) activeBtn.classList.add('active');

    if (tool === 'draw') {
        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.width = 2;
        fabricCanvas.freeDrawingBrush.color = "#000000";
    }
}

function deleteObject() {
    const active = fabricCanvas.getActiveObject();
    if (active) fabricCanvas.remove(active);
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
    if (fabricCanvas) fabricCanvas.dispose();
}

async function saveEditedPdf() {
    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const firstPage = pdfDoc.getPages()[0];
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
        } else if (obj.type === 'path') {
            // For drawings, it's safer to export the canvas overlay as an image and layer it
            // but for simple text forms, text rendering is cleaner.
        }
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(pdfBytes, 'edited_76supplier.pdf', 'application/pdf');
}
