let mergeQueue = [];

// Initialize Reorderable List
const el = document.getElementById('file-list');
if (el) {
    Sortable.create(el, {
        animation: 150,
        ghostClass: 'sortable-ghost'
    });
}

// --- MERGE LOGIC ---
function handleMergeFiles(event) {
    const files = Array.from(event.target.files);
    const listContainer = document.getElementById('file-list');
    
    files.forEach(file => {
        const fileId = Math.random().toString(36).substr(2, 9);
        mergeQueue.push({ id: fileId, file: file });

        const li = document.createElement('li');
        li.className = 'file-item';
        li.setAttribute('data-id', fileId);
        li.innerHTML = `<span>📄 ${file.name}</span> <span>⠿</span>`;
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

// --- BATCH SPLIT LOGIC ---
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
        zip.file(`split_part_${i/interval + 1}.pdf`, pdfBytes);
    }

    const zipContent = await zip.generateAsync({type: "blob"});
    downloadBlob(zipContent, 'split_bundle_76supplier.zip', 'application/zip');
    status.innerText = "Done!";
}

function downloadBlob(data, fileName, type) {
    const blob = new Blob([data], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
}

// --- IMAGE TO PDF ---
async function generateImgToPdf() {
    const input = document.getElementById('img-input');
    if (input.files.length === 0) return alert("Select images first");

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    for (const file of input.files) {
        const imgBytes = await file.arrayBuffer();
        let image;
        if (file.type === "image/jpeg" || file.type === "image/jpg") {
            image = await pdfDoc.embedJpg(imgBytes);
        } else if (file.type === "image/png") {
            image = await pdfDoc.embedPng(imgBytes);
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(pdfBytes, 'images_to_76pdf.pdf', 'application/pdf');
}

// --- PDF TO IMAGE (Uses pdf.js) ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

    // Encrypt the PDF with the user's password
    const encryptedBytes = await pdfDoc.save({
        userPassword: password,
        ownerPassword: password, // For full control
        permissions: {
            printing: 'highResolution',
            modifying: false,
            copying: false
        }
    });

    downloadBlob(encryptedBytes, 'protected_76supplier.pdf', 'application/pdf');
}
