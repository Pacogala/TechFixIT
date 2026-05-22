import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReceiptData {
  id?: string;
  client: {
    name: string;
    phone: string;
  };
  equipment: {
    type: string;
    brand: string;
    model: string;
    serial: string;
  };
  notes: string;
  business?: {
    name: string;
    rfc?: string;
    address?: string;
    phone?: string;
    customMessage?: string;
    logo?: string;
    pdfPrimaryColor?: string;
    pdfAccentColor?: string;
    pdfTermsAndConditions?: string;
  };
}

const loadImage = (url: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};

const hexToRgb = (hex?: string, defaultColor: [number, number, number] = [15, 23, 42]): [number, number, number] => {
  if (!hex) return defaultColor;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [
    isNaN(r) ? defaultColor[0] : r, 
    isNaN(g) ? defaultColor[1] : g, 
    isNaN(b) ? defaultColor[2] : b
  ];
};

export const generateReceptionReceipt = async (data: ReceiptData) => {
  const doc = new jsPDF() as any;
  const date = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
  const ticketId = data.id || `REC-${Math.floor(1000 + Math.random() * 9000)}`;

  const businessName = data.business?.name || 'TechCRM Solutions';
  const businessPhone = data.business?.phone || 'SOPORTE TÉCNICO Y VENTAS';
  const businessAddress = data.business?.address || '';
  const businessRFC = data.business?.rfc ? `RFC: ${data.business.rfc}` : '';

  // Header Colors (Customizable)
  const primaryColor = hexToRgb(data.business?.pdfPrimaryColor, [15, 23, 42]); // Default Slate 900
  const accentColor = hexToRgb(data.business?.pdfAccentColor, [59, 130, 246]); // Default Blue 500

  // Header Background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Try loading company logo
  let logoImg: HTMLImageElement | null = null;
  if (data.business?.logo) {
    logoImg = await loadImage(data.business.logo);
  }

  const textStartX = logoImg ? 45 : 20;

  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', 20, 10, 20, 20);
    } catch (e) {
      console.warn("Failed drawing logo image in PDF:", e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName.toUpperCase(), textStartX, 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(businessPhone, textStartX, 28);
  if (businessAddress) doc.text(businessAddress, textStartX, 33);

  doc.setTextColor(...accentColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE RECEPCIÓN', 135, 22);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`TICKET: ${ticketId}`, 135, 28);
  if (businessRFC) doc.text(businessRFC, 135, 33);

  // Content
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.text(`Fecha de ingreso: ${date}`, 20, 55);

  // Client Section
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', 20, 70);
  doc.line(20, 72, 190, 72);
  
  doc.setFont('helvetica', 'normal');
  autoTable(doc, {
    startY: 75,
    margin: { left: 20 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    body: [
      ['Nombre:', data.client.name],
      ['Teléfono:', data.client.phone],
    ],
  });

  // Equipment Section
  const equipmentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLES DEL EQUIPO', 20, equipmentY);
  doc.line(20, equipmentY + 2, 190, equipmentY + 2);

  autoTable(doc, {
    startY: equipmentY + 5,
    margin: { left: 20 },
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { fontSize: 9 },
    head: [['Campo', 'Información']],
    body: [
      ['Tipo de Equipo', data.equipment.type],
      ['Marca', data.equipment.brand],
      ['Modelo', data.equipment.model],
      ['Número de Serie', data.equipment.serial || 'N/A'],
    ],
  });

  // Observations
  const obsY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('DIAGNÓSTICO INICIAL / NOTAS', 20, obsY);
  doc.line(20, obsY + 2, 190, obsY + 2);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const splitNotes = doc.splitTextToSize(data.notes || 'Sin observaciones adicionales.', 170);
  doc.text(splitNotes, 20, obsY + 8);

  // Terms and Signature
  const footerY = 210;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('TÉRMINOS Y CONDICIONES:', 20, footerY);

  const rawTerms = data.business?.pdfTermsAndConditions || 
    "1. El equipo se recibe para diagnóstico inicial.\n2. No nos hacemos responsables por pérdida de información.\n3. El tiempo estimado de respuesta es de 24 a 48 horas.";
  
  const termsList = rawTerms.split('\n').filter(Boolean);
  let currentY = footerY + 5;
  termsList.forEach((term) => {
    const splitTerm = doc.splitTextToSize(term, 170);
    doc.text(splitTerm, 20, currentY);
    currentY += (splitTerm.length * 4);
  });
  
  if (data.business?.customMessage) {
    doc.setTextColor(...accentColor);
    doc.setFont('helvetica', 'bold');
    const splitCustom = doc.splitTextToSize(data.business.customMessage, 170);
    doc.text(splitCustom, 20, currentY + 4);
  }

  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.line(30, 260, 90, 260);
  doc.text('Firma del Técnico', 45, 265);
  
  doc.line(120, 260, 180, 260);
  doc.text('Firma del Cliente', 135, 265);

  // Save the PDF
  doc.save(`${ticketId}-Recibo.pdf`);
};

export const generateRepairReceipt = async (repair: any, business?: any) => {
  const doc = new jsPDF() as any;
  const date = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
  const ticketId = repair.id.substring(0, 8).toUpperCase();

  const businessName = business?.name || 'TechCRM Solutions';
  const businessPhone = business?.phone || 'SOPORTE TÉCNICO Y VENTAS';
  const businessAddress = business?.address || '';
  const businessRFC = business?.rfc ? `RFC: ${business.rfc}` : '';

  // Colors
  const primaryColor = hexToRgb(business?.pdfPrimaryColor, [15, 23, 42]);
  const accentColor = hexToRgb(business?.pdfAccentColor, [16, 185, 129]); // Default Success Green

  // Header Background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Try loading company logo
  let logoImg: HTMLImageElement | null = null;
  if (business?.logo) {
    logoImg = await loadImage(business.logo);
  }

  const textStartX = logoImg ? 45 : 20;

  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', 20, 10, 20, 20);
    } catch (e) {
      console.warn("Failed drawing logo image in PDF:", e);
    }
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName.toUpperCase(), textStartX, 22);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(businessPhone, textStartX, 28);
  if (businessAddress) doc.text(businessAddress, textStartX, 33);
  
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('COMPROBANTE DE REPARACIÓN', 125, 22);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`TICKET: ${ticketId}`, 125, 28);
  if (businessRFC) doc.text(businessRFC, 125, 33);

  // Info
  doc.setTextColor(50, 50, 50);
  doc.text(`Fecha: ${date}`, 20, 50);
  doc.text(`Cliente: ${repair.client?.name || 'N/A'}`, 20, 56);
  doc.text(`Equipo: ${repair.equipment.brand} ${repair.equipment.model}`, 20, 62);

  // Diagnostic & Actions
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DEL SERVICIO', 20, 75);
  doc.line(20, 77, 190, 77);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Diagnóstico:', 20, 83);
  doc.text(repair.diagnostic || 'No especificado', 45, 83);
  
  doc.text('Acciones Realizadas:', 20, 89);
  const actions = repair.actionsPerformed?.join(', ') || 'No especificadas';
  const splitActions = doc.splitTextToSize(actions, 145);
  doc.text(splitActions, 45, 89);

  // Table of Parts and Labor
  const parts = repair.parts || [];
  const body = parts.map((p: any) => [
    p.name + (p.serial ? ` (S/N: ${p.serial})` : ''),
    p.quantity.toString(),
    `$${p.price.toLocaleString()}`,
    `$${(p.price * p.quantity).toLocaleString()}`
  ]);

  // Add Labor
  if (repair.quote?.labor) {
    body.push(['Mano de Obra / Servicio Técnico', '1', `$${repair.quote.labor.toLocaleString()}`, `$${repair.quote.labor.toLocaleString()}`]);
  }

  autoTable(doc, {
    startY: 105,
    head: [['Descripción / Refacción', 'Cant.', 'P. Unit', 'Total']],
    body: body,
    headStyles: { fillColor: primaryColor },
    foot: [['TOTAL', '', '', `$${repair.quote?.total?.toLocaleString() || '0'}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: primaryColor, fontStyle: 'bold' }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE LA ORDEN:', 20, finalY);
  doc.setTextColor(...accentColor);
  doc.text(repair.status.toUpperCase(), 65, finalY);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Este documento sirve como comprobante de los trabajos realizados y piezas sustituidas.', 20, finalY + 10);
  
  doc.save(`${ticketId}-Servicio.pdf`);
};
