import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFExportProps {
  facilityName: string;
  periodId: string;
  targetRef: React.RefObject<HTMLElement | null>;
}

export function PDFExport({ facilityName, periodId, targetRef }: PDFExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const formatPeriod = (periodId: string) => {
    const [year, month] = periodId.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const handleExport = async () => {
    if (!targetRef.current) return;

    setIsExporting(true);
    setProgress(10);

    try {
      // Get the element to capture
      const element = targetRef.current;

      setProgress(30);

      // Create canvas from the element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f0f1a',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      setProgress(60);

      // Calculate PDF dimensions (A4 size)
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Add title page
      pdf.setFillColor(15, 15, 26);
      pdf.rect(0, 0, 210, 297, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('Financial Performance Report', 105, 100, { align: 'center' });

      pdf.setFontSize(18);
      pdf.setTextColor(102, 126, 234);
      pdf.text(facilityName, 105, 120, { align: 'center' });

      pdf.setFontSize(14);
      pdf.setTextColor(180, 180, 180);
      pdf.text(formatPeriod(periodId), 105, 140, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 280, { align: 'center' });
      pdf.text('SNFPNL.com | SNF Financial Intelligence', 105, 287, { align: 'center' });

      setProgress(70);

      // Add content pages
      const imgData = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = 0;

      // Add first content page
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      setProgress(90);

      // Save the PDF
      const fileName = `${facilityName.replace(/[^a-z0-9]/gi, '_')}_${periodId}_report.pdf`;
      pdf.save(fileName);

      setProgress(100);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setProgress(0);
      }, 500);
    }
  };

  return (
    <button
      className="btn btn-primary"
      onClick={handleExport}
      disabled={isExporting}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '150px',
        justifyContent: 'center',
      }}
    >
      {isExporting ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Exporting... {progress}%
        </>
      ) : (
        <>
          <Download size={16} />
          Export PDF
        </>
      )}
    </button>
  );
}

// Simpler export button that can be placed anywhere
export function ExportButton({
  onClick,
  isExporting = false,
  variant = 'primary'
}: {
  onClick: () => void;
  isExporting?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={isExporting}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {isExporting ? (
        <>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Exporting...
        </>
      ) : (
        <>
          <FileText size={16} />
          Export Report
        </>
      )}
    </button>
  );
}

// Hook for programmatic PDF export
// eslint-disable-next-line react-refresh/only-export-components
export function usePDFExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async (
    element: HTMLElement,
    fileName: string,
    title: string,
    subtitle?: string
  ) => {
    setIsExporting(true);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f0f1a',
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');

      // Title page
      pdf.setFillColor(15, 15, 26);
      pdf.rect(0, 0, 210, 297, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text(title, 105, 100, { align: 'center' });

      if (subtitle) {
        pdf.setFontSize(16);
        pdf.setTextColor(102, 126, 234);
        pdf.text(subtitle, 105, 120, { align: 'center' });
      }

      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 280, { align: 'center' });

      // Content
      const imgData = canvas.toDataURL('image/png');
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      pdf.save(fileName);
    } catch (error) {
      console.error('PDF export failed:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportToPDF, isExporting };
}
