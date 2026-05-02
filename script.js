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
