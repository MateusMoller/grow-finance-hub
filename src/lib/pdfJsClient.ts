import * as pdfJs from "pdfjs-dist/legacy/build/pdf.mjs";
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker";

const pdfWorker = new PdfWorker({ name: "grow-pdf-worker" });
pdfJs.GlobalWorkerOptions.workerPort = pdfWorker;

export function loadPdfJsClient() {
  return Promise.resolve(pdfJs);
}
