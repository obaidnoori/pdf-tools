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


let orgPdfDoc = null;
let pageRotations = {}; // Keeps track of [pageIndex]: degrees

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
        
        // Apply rotation if any
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
    
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(text, {
            x: width / 4,
            y: height / 2,
            size: 50,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
            opacity: opacity,
            rotate: degrees(45),
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
    const title = document.getElementById('meta-title').value;
    const author = document.getElementById('meta-author').value;

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(await input.files[0].arrayBuffer());
    
    pdfDoc.setTitle(title);
    pdfDoc.setAuthor(author);
    pdfDoc.setProducer("76 PDF Suite");

    const bytes = await pdfDoc.save();
    downloadBlob(bytes, "updated_meta_76supplier.pdf", "application/pdf");
}
