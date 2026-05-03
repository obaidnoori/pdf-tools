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
