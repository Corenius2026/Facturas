// Tipos e interfaces centralizados para el analizador de facturas e integración con Siigo

export interface ProductoItem {
  cantidad: string;
  descripcion: string;
  precio_unitario: string;
  total_item: string;
}

export interface FacturaDatos {
  NIT: string;
  NombreProveedor?: string;
  BuyerNIT?: string;
  BuyerName?: string;
  NumeroFactura?: string;
  Fecha: string;
  Subtotal: string;
  IVA: string;
  Total: string;
  Productos: ProductoItem[];
}

export type InvoiceFields = FacturaDatos;

export interface EmpresaGuardada {
  nit: string;
  nombre: string;
}

export interface SupabaseInvoice {
  id: string;
  proveedor_nit?: string;
  nit?: string;
  proveedor_nombre?: string | null;
  buyer_nit?: string;
  buyer_name?: string | null;
  numero_factura?: string | null;
  fecha: string | null;
  subtotal: number | string | null;
  iva: number | string | null;
  total: number | string | null;
  productos?: ProductoItem[] | null;
  estado?: string;
  image_hash?: string | null;
  idempotency_key?: string | null;
  modelo_ia?: string | null;
  duracion_ms?: number | null;
  texto_extraido?: string | null;
  xml_content?: string | null;
  creado_en: string;
}

export interface ImageOptimizationStats {
  originalSize: number;
  optimizedSize: number;
  originalWidth: number;
  originalHeight: number;
  finalWidth: number;
  finalHeight: number;
  reductionPercentage: number;
  durationMs: number;
}

export interface DuplicateNotice {
  isDuplicate: boolean;
  type?: 'image_hash' | 'invoice_key' | string;
  message?: string;
}

export interface ToastNotification {
  message: string;
  type: 'success' | 'error' | 'warning';
}

export interface ProcesarApiResponse {
  success: boolean;
  duplicate?: boolean;
  duplicate_type?: 'image_hash' | 'invoice_key';
  existing_id?: string;
  invoice_id?: string;
  message?: string;
  filename?: string;
  motor_usado?: string;
  guardado_en_supabase?: boolean;
  raw_text?: string;
  fields?: FacturaDatos;
  buyer_nit?: string;
  buyer_name?: string;
  nombre_proveedor?: string;
  numero_factura?: string | null;
  productos?: ProductoItem[];
  xml_content?: string;
  invoice_xml_content?: string;
  zip_filename?: string;
  xml_filename_inside?: string;
  pdf_filename_inside?: string;
  zip_b64?: string;
  image_hash?: string;
  idempotency_key?: string | null;
  duracion_ms?: number;
  detail?: string;
}

export interface SiigoStructureResult {
  attachedXml: string;
  invoiceXml: string;
  zipFilename: string;
  xmlFilenameInside: string;
  pdfFilenameInside: string;
  zipBase64?: string;
}
