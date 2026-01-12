import React from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportProps {
    data: any[];
    fileName: string;
    title?: string; 
    columns: { header: string, key: string }[];
}

const ExportToolbar: React.FC<ExportProps> = ({ data, fileName, title, columns }) => {
    
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        // Map data to headers and fix Dates
        const exportData = data.map(item => {
            const row: any = {};
            columns.forEach(col => {
                let val = item[col.key];
                // Check if this is a Date field and convert string to Date object
                if (val && (col.key.toLowerCase().includes('time') || col.key.toLowerCase().includes('date') || col.key === 'eta')) {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                        val = d; // Assign Date object for Excel to recognize
                    }
                }
                row[col.header] = val;
            });
            return row;
        });
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        // Add width to columns (Optional visual improvement)
        ws['!cols'] = columns.map(() => ({ wch: 20 }));
        
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    const exportPDF = () => {
        // Landscape orientation ('l')
        const doc = new jsPDF('l', 'mm', 'a4');
        
        // Add Dynamic Title
        const reportTitle = title || fileName;
        doc.setFontSize(14);
        doc.text(reportTitle, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

        autoTable(doc, {
            head: [columns.map(c => c.header)],
            body: data.map(item => columns.map(c => {
                const val = item[c.key];
                // Simple date string for PDF is fine, or formatting
                if (val && (c.key.includes('Time') || c.key === 'eta')) {
                    return new Date(val).toLocaleString();
                }
                return typeof val === 'object' ? JSON.stringify(val) : val;
            })),
            startY: 28, // Start below header
            theme: 'grid',
            styles: { fontSize: 8 }, // Smaller font for landscape columns
            headStyles: { fillColor: [40, 40, 40] }
        });
        
        doc.save(`${fileName}.pdf`);
    };

    return (
        <div className="flex gap-2">
            <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold shadow-sm">
                <i className="fas fa-file-excel"></i> Excel
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-bold shadow-sm">
                <i className="fas fa-file-pdf"></i> PDF
            </button>
        </div>
    );
};
export default ExportToolbar;