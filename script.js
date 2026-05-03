// --- GLOBAL CONFIG & STATE ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let fabricCanvases = []; // Store a canvas for every page
let originalPdfArrayBuffer = null;
let originalFileName = "edited_document.pdf";

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

// --- EDITOR CORE ---
async function openEditor(event) {
    const file = event.target.files[0];
    if (!file) return;

    originalFileName = file.name; // Capture the original name
    const container = document.getElementById('canvas-container');
    container.innerHTML = ''; // Clear previous pages
    fabricCanvases = [];

    try {
        originalPdfArrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: originalPdfArrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;

        // Loop through all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });

            // Create wrapper div for each page
            const wrapper = document.createElement('div');
            wrapper.className = 'page-wrapper';
            wrapper.style.marginBottom = "20px";
            
            const canvasId = `canvas-page-${i}`;
            const canvasEl = document.createElement('canvas');
            canvasEl.id = canvasId;
            wrapper.appendChild(canvasEl);
            container.appendChild(wrapper);

            // Render PDF page to a temporary canvas for background
            const tempCanvas = document.createElement('canvas');
            const context = tempCanvas.getContext('2d');
            tempCanvas.height = viewport.height;
            tempCanvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const bgData = tempCanvas.toDataURL('image/png');

            // Initialize Fabric for this specific page
            const fCanvas = new fabric.Canvas(canvasId, {
                width: viewport.width,
                height: viewport.height,
            });

            fabric.Image.fromURL(bgData, (img) => {
                fCanvas.setBackgroundImage(img, fCanvas.renderAll.bind(fCanvas));
            });

            fabricCanvases.push(fCanvas);
        }

        document.getElementById('editor-modal').style.display = 'block';
    } catch (err) {
        console.error("Load Error:", err);
    }
}

function setTool(tool) {
    fabricCanvases.forEach(fCanvas => {
        fCanvas.isDrawingMode = false;
        fCanvas.off('mouse:down'); // Clear old listeners
        
        if (tool === 'text') {
            fCanvas.on('mouse:down', (opt) => {
                if (opt.target) return;
                const t = new fabric.IText('Type Here', {
                    left: opt.pointer.x,
                    top: opt.pointer.y,
                    fontSize: 20,
                    fontFamily: 'Arial',
                    fill: '#000000'
                });
                fCanvas.add(t);
                fCanvas.setActiveObject(t);
            });
        } else if (tool === 'draw') {
            fCanvas.isDrawingMode = true;
            fCanvas.freeDrawingBrush.width = 3;
            fCanvas.freeDrawingBrush.color = '#000000';
        }
    });
}

async function saveEditedPdf() {
    const { PDFDocument } = PDFLib;
    const existingPdfBytes = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    // Iterate through all canvases created for each page
    for (let i = 0; i < pages.length; i++) {
        const fabricCanvas = allCanvases[i]; // Array where you stored each page's fabric instance
        if (!fabricCanvas) continue;

        const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 });
        const image = await pdfDoc.embedPng(dataUrl);
        const { width, height } = pages[i].getSize();
        
        pages[i].drawImage(image, { x: 0, y: 0, width, height });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "edited_76supplier.pdf";
    link.click();
}
