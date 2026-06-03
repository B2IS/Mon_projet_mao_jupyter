declare module 'pdfjs-dist/build/pdf' {
  export interface TextItem {
    str: string;
    dir?: string;
    width?: number;
    height?: number;
    transform?: number[];
    fontName?: string;
    hasEOL?: boolean;
  }

  export interface TextContent {
    items: TextItem[];
    styles?: Record<string, unknown>;
  }

  export interface PDFPage {
    getTextContent(): Promise<TextContent>;
    getViewport(params: { scale: number }): { width: number; height: number };
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPage>;
    destroy(): Promise<void>;
  }

  export interface GetDocumentParameters {
    data: ArrayBuffer | Uint8Array;
    isEvalSupported?: boolean;
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export function getDocument(params: GetDocumentParameters): PDFDocumentLoadingTask;

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
}
