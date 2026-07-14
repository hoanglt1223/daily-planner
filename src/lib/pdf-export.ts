import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type PdfTableRow = [string, string, string, string, string, string, string, string, string];

export function generateTimeBlocksPdf(rows: Array<{
  date: string;
  dayName: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  status: string;
  note: string;
}>, dateRange: string, totalMinutes: number): jsPDF {
  const doc = new jsPDF();
  let yPosition = 15;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Timesheet Report', 14, yPosition);
  yPosition += 10;

  // Date range
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${dateRange}`, 14, yPosition);
  yPosition += 7;

  // Summary
  const totalHours = (totalMinutes / 60).toFixed(1);
  doc.text(`Total Duration: ${totalHours} hours (${totalMinutes} minutes)`, 14, yPosition);
  yPosition += 7;

  const completedMinutes = rows
    .filter(r => r.status === 'Completed')
    .reduce((sum, r) => sum + r.durationMin, 0);
  const completedHours = (completedMinutes / 60).toFixed(1);
  doc.text(`Completed: ${completedHours} hours (${completedMinutes} minutes)`, 14, yPosition);
  yPosition += 10;

  // Table headers
  const headers = [['Date', 'Day', 'Title', 'Category', 'Start', 'End', 'Duration (min)', 'Status', 'Note']] as any;

  // Table rows
  const tableData = rows.map(row => [
    row.date,
    row.dayName,
    row.title,
    row.category,
    row.startTime,
    row.endTime,
    row.durationMin.toString(),
    row.status,
    row.note || ''
  ]) as PdfTableRow[];

  // Generate table
  autoTable(doc, {
    head: headers,
    body: tableData,
    startY: yPosition,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 18 }, // Day
      2: { cellWidth: 40 }, // Title
      3: { cellWidth: 25 }, // Category
      4: { cellWidth: 18 }, // Start
      5: { cellWidth: 18 }, // End
      6: { cellWidth: 22, halign: 'right' }, // Duration
      7: { cellWidth: 25 }, // Status
      8: { cellWidth: 'auto' } // Note
    },
    didDrawPage: (data) => {
      // Footer with page number
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${data.pageNumber}`,
        data.settings.margin.left,
        pageHeight - 10
      );

      // Timestamp
      const timestamp = new Date().toLocaleString();
      doc.text(
        `Generated: ${timestamp}`,
        data.settings.margin.left,
        pageHeight - 6
      );
    }
  });

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
