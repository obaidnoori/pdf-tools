/**
 * 76 PDF Suite - Comprehensive Logic
 * Powered by 76 Supplier Company
 */

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentPdfFile = null;
let allCanvases = []; // Holds Fabric.js instances for each page
let activeTool = 'select';
let originalFileName = "document";

/**
 * PDF EDITOR LOGIC
 */

async function openEditor(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    currentPdfFile = file;
    originalFileName = file.name.replace(/\.[^/.]+$/, ""); // Get name without extension
    const modal = document.getElementById('editor-modal');
    const container = document.getElementById('canvas-container');
    
    modal.style.display = 'block';
    container.innerHTML = 'Loading pages...';
    allCanvases = [];

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    container.innerHTML = ''; // Clear loading text

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create wrapper for this specific page
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-canvas-wrapper';
        pageWrapper.style.position = 'relative';
        pageWrapper.style.marginBottom = '20px';
        pageWrapper.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
        
        const canvasId = `canvas-page-${i}`;
        const canvasEl = document.createElement('canvas');
        canvasEl.id = canvasId;
        pageWrapper.appendChild(canvasEl);
        container.appendChild(pageWrapper);

        const fabricCanvas = new fabric.Canvas(canvasId, {
            width: viewport.width,
            height: viewport.height
        });

        // Set PDF page as background
        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        fabric.Image.fromURL(tempCanvas.toDataURL(), (img) => {
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });

        allCanvases.push(fabricCanvas);
    }
    setTool('select');
}

function setTool(tool) {
    activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    const btnMap = { 'select': 'btn-select', 'text': 'btn-text', 'draw': 'btn-draw' };
    if (btnMap[tool]) document.getElementById(btnMap[tool]).classList.add('active');

    allCanvases.forEach(canvas => {
        canvas.isDrawingMode = (tool === 'draw');
        canvas.selection = (tool === 'select');
        
        if (tool === 'text') {
            canvas.defaultCursor = 'text';
            canvas.once('mouse:down', (opt) => {
                if (activeTool !== 'text') return;
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
    allCanvases.forEach(canvas => {
        const activeObjects = canvas.getActiveObjects();
        canvas.discardActiveObject();
        if (activeObjects.length) {
            canvas.remove(...activeObjects);
        }
    });
}

async function saveEditedPdf() {
    if (!currentPdfFile) return;

    try {
        const { PDFDocument } = PDFLib;
        const existingPdfBytes = await currentPdfFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();

        for (let i = 0; i < pages.length; i++) {
            const fabricCanvas = allCanvases[i];
            if (!fabricCanvas) continue;

            // Deselect everything to avoid UI boxes appearing in the final PDF
            fabricCanvas.discardActiveObject().renderAll();

            // Export fabric layers (without background) to PNG
            const dataUrl = fabricCanvas.toDataURL({
                format: 'png',
                multiplier: 2,
                // Only capture the objects, not the background PDF image we set earlier
                enableRetinaScaling: true
            });

            const overlayImage = await pdfDoc.embedPng(dataUrl);
            const { width, height } = pages[i].getSize();

            pages[i].drawImage(overlayImage, {
                x: 0,
                y: 0,
                width: width,
                height: height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${originalFileName}_edit.pdf`;
        link.click();
    } catch (err) {
        console.error("Error burning PDF:", err);
        alert("Failed to generate PDF. Check console for details.");
    }
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
    allCanvases = [];
}

/**
 * MERGE TOOL
 */
let mergeFiles = [];
function handleMergeFiles(e) {
    mergeFiles = Array.from(e.target.files);
    const list = document.getElementById('file-list');
    list.innerHTML = mergeFiles.map(f => `<li>${f.name}</li>`).join('');
}

async function generateMergedPdf() {
    if (mergeFiles.length < 2) return alert("Select at least 2 files.");
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    
    for (const file of mergeFiles) {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }
    
    const bytes = await mergedPdf.save();
    downloadBlob(bytes, "merged_76supplier.pdf", "application/pdf");
}

/**
 * SPLIT TOOL
 */
async function generateBatchSplit() {
    const input = document.getElementById('split-input').files[0];
    const interval = parseInt(document.getElementById('split-interval').value);
    if (!input || !interval) return alert("Select file and interval.");

    const { PDFDocument } = PDFLib;
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
        zip.file(`part_${Math.floor(i/interval) + 1}.pdf`, partBytes);
    }

    const content = await zip.generateAsync({type:"blob"});
    downloadBlob(content, "split_files_76.zip", "application/zip");
}

/**
 * WATERMARK TOOL
 */
async function applyWatermark() {
    const file = document.getElementById('watermark-input').files[0];
    const text = document.getElementById('watermark-text').value;
    const opacity = parseFloat(document.getElementById('watermark-opacity').value);
    if (!file || !text) return alert("File and text required.");

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const bytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(text, {
            x: 50,
            y: height / 2,
            size: 50,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
            opacity: opacity,
            rotate: PDFLib.degrees(45),
        });
    });

    const outBytes = await pdfDoc.save();
    downloadBlob(outBytes, "watermarked_76.pdf", "application/pdf");
}

/**
 * UTILS
 */
function downloadBlob(data, name, type) {
    const blob = new Blob([data], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
}
