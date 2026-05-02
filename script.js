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
