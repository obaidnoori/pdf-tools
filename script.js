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
    try {
        const { PDFDocument, rgb } = PDFLib;
        const pdfDoc = await PDFDocument.load(originalPdfArrayBuffer.slice(0));
        const pages = pdfDoc.getPages();

        // Process every page's canvas
        for (let i = 0; i < fabricCanvases.length; i++) {
            const fCanvas = fabricCanvases[i];
            const pdfPage = pages[i];
            const { width, height } = pdfPage.getSize();

            const scaleX = width / fCanvas.width;
            const scaleY = height / fCanvas.height;

            const objects = fCanvas.getObjects();
            for (const obj of objects) {
                if (obj.type === 'i-text' || obj.type === 'text') {
                    pdfPage.drawText(obj.text, {
                        x: obj.left * scaleX,
                        // Fix coordinate flip: PDF y starts at bottom
                        y: height - (obj.top * scaleY) - (obj.fontSize * scaleY),
                        size: obj.fontSize * scaleY,
                        color: rgb(0, 0, 0)
                    });
                } else if (obj.type === 'path') {
                    // Convert drawing paths back to PDF
                    pdfPage.drawSvgPath(obj.pathData, {
                        x: obj.left * scaleX,
                        y: height - (obj.top * scaleY),
                        scale: scaleX,
                        borderColor: rgb(0, 0, 0),
                    });
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(pdfBytes, originalFileName, 'application/pdf');
    } catch (err) {
        console.error("Save Error:", err);
    }
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
    fabricCanvases.forEach(c => c.dispose());
    fabricCanvases = [];
}
