/**
 * 76 PDF Suite - Comprehensive Logic
 * Powered by 76 Supplier Company
 */

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

/** --- UTILS --- */
function downloadBlob(data, name, type) {
    const blob = new Blob([data], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
}

/** --- MERGE TOOL --- */
let mergeFilesArray = [];

function handleMergeFiles(e) {
    mergeFilesArray = Array.from(e.target.files);
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    
    // Create list items with data-index to track original file
    mergeFilesArray.forEach((f, index) => {
        const li = document.createElement('li');
        li.textContent = f.name;
        li.dataset.index = index;
        li.className = "sortable-item";
        list.appendChild(li);
    });

    // Initialize Sortable
    new Sortable(list, { animation: 150 });
}

async function generateMergedPdf() {
    if (mergeFilesArray.length < 2) return alert("Select at least 2 files.");
    
    // Read the new order from the DOM
    const listItems = document.querySelectorAll('#file-list li');
    const sortedFiles = Array.from(listItems).map(li => mergeFilesArray[li.dataset.index]);

    const mergedPdf = await PDFDocument.create();
    
    for (const file of sortedFiles) {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }
    
    const bytes = await mergedPdf.save();
    downloadBlob(bytes, "merged_76supplier.pdf", "application/pdf");
}

/** --- BATCH SPLITTER --- */
async function generateBatchSplit() {
    const input = document.getElementById('split-input').files[0];
    const interval = parseInt(document.getElementById('split-interval').value);
    if (!input || !interval) return alert("Select file and valid interval.");

    const originalName = input.name.replace(/\.[^/.]+$/, "");
    const zip = new JSZip();
    const sourceBytes = await input.arrayBuffer();
    const sourceDoc = await PDFDocument.load(sourceBytes);
    const totalPages = sourceDoc.getPageCount();

    for (let i = 0; i < totalPages; i += interval) {
        const newDoc = await PDFDocument.create();
        const end = Math.min(i + interval, totalPages);
        const indices = Array.from({length: end - i}, (_, k) => i + k);
        const pages = await newDoc.copyPages(sourceDoc, indices);
        pages.forEach(p => newDoc.addPage(p));
        const partBytes = await newDoc.save();
        zip.file(`${originalName}_part_${Math.floor(i/interval) + 1}.pdf`, partBytes);
    }

    const content = await zip.generateAsync({type:"blob"});
    downloadBlob(content, `${originalName}_split_files.zip`, "application/zip");
}

/** --- IMAGE TO PDF --- */
async function generateImgToPdf() {
    const files = document.getElementById('img-input').files;
    if (files.length === 0) return alert("Please select images.");

    const pdfDoc = await PDFDocument.create();

    for (let file of files) {
        const bytes = await file.arrayBuffer();
        let image;
        if (file.type === 'image/jpeg') image = await pdfDoc.embedJpg(bytes);
        else if (file.type === 'image/png') image = await pdfDoc.embedPng(bytes);
        else continue; // Skip unsupported formats

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(pdfBytes, "images_converted_76.pdf", "application/pdf");
}

/** --- WATERMARK TOOL --- */
async function applyWatermark() {
    const file = document.getElementById('watermark-input').files[0];
    let text = document.getElementById('watermark-text').value;
    const opacity = parseFloat(document.getElementById('watermark-opacity').value);
    if (!file || !text) return alert("File and text required.");

    // Force uppercase
    text = text.toUpperCase();

    const bytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const fontSize = 60;

    // Calculate approximate text width
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    pages.forEach(page => {
        const { width, height } = page.getSize();
        // Calculate center point
        const centerX = width / 2;
        const centerY = height / 2;

        page.drawText(text, {
            x: centerX - (textWidth / 2),
            y: centerY - (textHeight / 2),
            size: fontSize,
            font: font,
            color: rgb(0.6, 0.6, 0.6),
            opacity: opacity,
        });
    });

    const outBytes = await pdfDoc.save();
    downloadBlob(outBytes, "watermarked_76.pdf", "application/pdf");
}

/** --- METADATA EDITOR --- */
let activeMetaDoc = null;
async function loadMetadata(e) {
    const file = e.target.files[0];
    if (!file) return;
    const bytes = await file.arrayBuffer();
    activeMetaDoc = await PDFDocument.load(bytes);
    
    document.getElementById('meta-title').value = activeMetaDoc.getTitle() || '';
    document.getElementById('meta-author').value = activeMetaDoc.getAuthor() || '';
}

async function saveMetadata() {
    if (!activeMetaDoc) return alert("Please load a PDF first.");
    activeMetaDoc.setTitle(document.getElementById('meta-title').value);
    activeMetaDoc.setAuthor(document.getElementById('meta-author').value);
    
    const bytes = await activeMetaDoc.save();
    downloadBlob(bytes, "metadata_updated_76.pdf", "application/pdf");
}

/** --- FULL PDF EDITOR & ORGANIZER --- */
let currentPdfFile = null;
let originalFileName = "document";
let allCanvases = {}; // Dictionary to track original page index to Fabric canvas
let originalPdfDoc = null; // Store original loaded PDF

async function openEditor(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    currentPdfFile = file;
    originalFileName = file.name.replace(/\.[^/.]+$/, "");
    
    const modal = document.getElementById('editor-modal');
    const container = document.getElementById('canvas-container');
    
    modal.style.display = 'block';
    container.innerHTML = '<p style="color:white; margin-top: 20px;">Loading pages...</p>';
    allCanvases = {};

    const arrayBuffer = await file.arrayBuffer();
    originalPdfDoc = await PDFDocument.load(arrayBuffer); // Load via pdf-lib for later burning
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    container.innerHTML = ''; 

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        // Page Wrapper
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-canvas-wrapper';
        pageWrapper.dataset.originalIndex = i - 1; // 0-based for pdf-lib

        // Page Management Controls
        const controls = document.createElement('div');
        controls.className = 'page-controls';
        controls.innerHTML = `
            <span style="font-weight:bold;">Page ${i}</span>
            <button onclick="moveWrapperUp(this)" class="tool-btn">⬆️ Move Up</button>
            <button onclick="moveWrapperDown(this)" class="tool-btn">⬇️ Move Down</button>
            <button onclick="deleteWrapper(this)" class="tool-btn" style="color:red;">❌ Delete</button>
        `;
        pageWrapper.appendChild(controls);

        // Canvas
        const canvasId = `canvas-page-${i}`;
        const canvasEl = document.createElement('canvas');
        canvasEl.id = canvasId;
        pageWrapper.appendChild(canvasEl);
        container.appendChild(pageWrapper);

        const fabricCanvas = new fabric.Canvas(canvasId, {
            width: viewport.width,
            height: viewport.height
        });

        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        fabric.Image.fromURL(tempCanvas.toDataURL(), (img) => {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });

        allCanvases[i - 1] = fabricCanvas;
    }
    setTool('select');
}

// Editor DOM Management Functions
function moveWrapperUp(btn) {
    const wrapper = btn.closest('.page-canvas-wrapper');
    if (wrapper.previousElementSibling) wrapper.parentNode.insertBefore(wrapper, wrapper.previousElementSibling);
}
function moveWrapperDown(btn) {
    const wrapper = btn.closest('.page-canvas-wrapper');
    if (wrapper.nextElementSibling) wrapper.parentNode.insertBefore(wrapper.nextElementSibling, wrapper);
}
function deleteWrapper(btn) {
    btn.closest('.page-canvas-wrapper').remove();
}

function setTool(tool) {
    document.querySelectorAll('.editor-header .tool-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = { 'select': 'btn-select', 'text': 'btn-text', 'draw': 'btn-draw' };
    if (btnMap[tool]) document.getElementById(btnMap[tool]).classList.add('active');

    Object.values(allCanvases).forEach(canvas => {
        canvas.isDrawingMode = (tool === 'draw');
        canvas.selection = (tool === 'select');
        
        if (tool === 'text') {
            canvas.defaultCursor = 'text';
            canvas.once('mouse:down', (opt) => {
                const text = new fabric.IText('Type here', {
                    left: opt.pointer.x,
                    top: opt.pointer.y,
                    fontFamily: 'Arial',
                    fontSize: 20,
                    fill: '#000'
                });
                canvas.add(text);
                canvas.setActiveObject(text);
                setTool('select');
            });
        } else {
            canvas.defaultCursor = 'default';
        }
    });
}

function deleteObject() {
    Object.values(allCanvases).forEach(canvas => {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length) {
            canvas.remove(...activeObjects);
            canvas.discardActiveObject();
        }
    });
}

async function saveEditedPdf() {
    if (!originalPdfDoc) return;

    try {
        const finalPdf = await PDFDocument.create();
        
        // Get the visual order of wrappers from the DOM
        const wrappers = document.querySelectorAll('.page-canvas-wrapper');
        
        for (let wrapper of wrappers) {
            const origIndex = parseInt(wrapper.dataset.originalIndex);
            const fabricCanvas = allCanvases[origIndex];

            // Copy the base page from the original document
            const [copiedPage] = await finalPdf.copyPages(originalPdfDoc, [origIndex]);
            finalPdf.addPage(copiedPage);

            // Stamp edits if the canvas exists
            if (fabricCanvas) {
                fabricCanvas.discardActiveObject().renderAll();
                const dataUrl = fabricCanvas.toDataURL({
                    format: 'png',
                    multiplier: 2,
                    enableRetinaScaling: true
                });

                const overlayImage = await finalPdf.embedPng(dataUrl);
                const { width, height } = copiedPage.getSize();

                copiedPage.drawImage(overlayImage, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                });
            }
        }

        const pdfBytes = await finalPdf.save();
        downloadBlob(pdfBytes, `${originalFileName}_edit.pdf`, "application/pdf");
    } catch (err) {
        console.error("Error burning PDF:", err);
        alert("Failed to generate PDF. Check console for details.");
    }
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
    allCanvases = {};
    document.getElementById('canvas-container').innerHTML = '';
}
