async function mergePdfs() {
    const input = document.getElementById('pdf-input');
    const status = document.getElementById('status');
    if (input.files.length < 2) {
        alert("Please select at least 2 files.");
        return;
    }

    status.innerText = "Processing locally...";

    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (const file of input.files) {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "merged_by_76supplier.pdf";
    link.click();
    
    status.innerText = "Done!";
}

async function splitPdf() {
    const input = document.getElementById('split-input');
    const range = document.getElementById('page-range').value; // e.g., "1-2"
    const status = document.getElementById('split-status');

    if (!input.files[0]) { alert("Please select a file."); return; }
    status.innerText = "Extracting pages...";

    const { PDFDocument } = PDFLib;
    const existingPdfBytes = await input.files[0].arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const newPdf = await PDFDocument.create();

    // Logic to handle range (Simple version: 1-based index to 0-based)
    let start = 0, end = pdfDoc.getPageCount();
    if (range.includes('-')) {
        const parts = range.split('-');
        start = parseInt(parts[0]) - 1;
        end = parseInt(parts[1]);
    }

    const pages = await newPdf.copyPages(pdfDoc, Array.from({length: end - start}, (_, i) => start + i));
    pages.forEach(page => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
    link.download = "split_by_76supplier.pdf";
    link.click();
    status.innerText = "Done!";
}

let selectedFiles = [];

// Initialize the drag-and-drop list
const el = document.getElementById('file-list');
const sortable = Sortable.create(el, { animation: 150 });

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    const list = document.getElementById('file-list');
    
    files.forEach(file => {
        selectedFiles.push(file);
        const li = document.createElement('li');
        li.className = "file-item";
        li.setAttribute('data-name', file.name);
        li.innerHTML = `📄 ${file.name} <span style="cursor:grab">⠿</span>`;
        li.style = "background:#eee; margin:5px; padding:10px; border-radius:5px; display:flex; justify-content:space-between;";
        list.appendChild(li);
    });
}

async function mergePdfs() {
    const listItems = document.querySelectorAll('#file-list li');
    if (listItems.length < 2) return alert("Select at least 2 files");

    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    // Merge based on the CURRENT order of the list items
    for (const li of listItems) {
        const fileName = li.getAttribute('data-name');
        const file = selectedFiles.find(f => f.name === fileName);
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();
    downloadFile(mergedBytes, "merged_76supplier.pdf");
}


async function splitAllPages() {
    const input = document.getElementById('split-input');
    if (!input.files[0]) return alert("Select a file");

    const { PDFDocument } = PDFLib;
    const bytes = await input.files[0].arrayBuffer();
    const mainPdf = await PDFDocument.load(bytes);
    const pageCount = mainPdf.getPageCount();

    for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(mainPdf, [i]);
        newPdf.addPage(page);
        
        const pdfBytes = await newPdf.save();
        downloadFile(pdfBytes, `page_${i + 1}_76supplier.pdf`);
    }
}

function downloadFile(bytes, name) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
}


async function batchSplitPdf() {
    const input = document.getElementById('split-input');
    const interval = parseInt(document.getElementById('split-interval').value);
    const status = document.getElementById('split-status');

    if (!input.files[0]) return alert("Please select a PDF file.");
    if (isNaN(interval) || interval < 1) return alert("Please enter a valid number.");

    status.innerText = "Processing batch split...";
    
    const { PDFDocument } = PDFLib;
    const zip = new JSZip(); // Initialize JSZip
    const bytes = await input.files[0].arrayBuffer();
    const mainPdf = await PDFDocument.load(bytes);
    const totalPages = mainPdf.getPageCount();

    for (let startPage = 0; startPage < totalPages; startPage += interval) {
        const newPdf = await PDFDocument.create();
        
        // Calculate the end page for this chunk
        const endPage = Math.min(startPage + interval, totalPages);
        const pageIndices = [];
        for (let i = startPage; i < endPage; i++) {
            pageIndices.push(i);
        }

        // Copy and add the pages to the new PDF
        const copiedPages = await newPdf.copyPages(mainPdf, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        
        // Add this PDF to the ZIP folder
        const fileName = `pages_${startPage + 1}_to_${endPage}.pdf`;
        zip.file(fileName, pdfBytes);
    }

    status.innerText = "Creating ZIP file...";
    
    // Generate the ZIP and trigger download
    const zipContent = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipContent);
    link.download = "split_pdfs_76supplier.zip";
    link.click();

    status.innerText = "Done! Check your downloads.";
}

