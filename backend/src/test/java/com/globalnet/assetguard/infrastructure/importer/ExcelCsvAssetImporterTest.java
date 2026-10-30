package com.globalnet.assetguard.infrastructure.importer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.globalnet.assetguard.application.model.AssetImportRow;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class ExcelCsvAssetImporterTest {

    private final ExcelCsvAssetImporter importer = new ExcelCsvAssetImporter();

    @Test
    void parsesCsvRowsAndAssetFields() throws Exception {
        String csv = "serialNumber,model,estimatedValue,purchaseDate\n"
                + "SN-100,Camera,120.50,2026-03-15\n";

        List<AssetImportRow> rows = importer.parse("assets.csv", csv.getBytes(StandardCharsets.UTF_8));

        assertEquals(1, rows.size());
        assertEquals(2, rows.get(0).rowNumber());
        assertEquals("SN-100", rows.get(0).asset().getSerialNumber());
        assertEquals("Camera", rows.get(0).asset().getModel());
        assertEquals(120.50, rows.get(0).asset().getEstimatedValue());
        assertEquals(LocalDate.of(2026, 3, 15), rows.get(0).asset().getPurchaseDate());
        assertEquals("AVAILABLE", rows.get(0).asset().getStatus());
    }

    @Test
    void parsesXlsxRowsAndAssetFields() throws Exception {
        byte[] content;
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Assets");
            var header = sheet.createRow(0);
            header.createCell(0).setCellValue("serialNumber");
            header.createCell(1).setCellValue("model");
            header.createCell(2).setCellValue("estimatedValue");
            header.createCell(3).setCellValue("purchaseDate");
            var data = sheet.createRow(1);
            data.createCell(0).setCellValue("SN-200");
            data.createCell(1).setCellValue("Laptop");
            data.createCell(2).setCellValue(900.0);
            data.createCell(3).setCellValue("2026-04-20");
            workbook.write(output);
            content = output.toByteArray();
        }

        List<AssetImportRow> rows = importer.parse("assets.xlsx", content);

        assertEquals(1, rows.size());
        assertEquals("SN-200", rows.get(0).asset().getSerialNumber());
        assertEquals(900.0, rows.get(0).asset().getEstimatedValue());
        assertEquals(LocalDate.of(2026, 4, 20), rows.get(0).asset().getPurchaseDate());
    }

    @Test
    void parsesFormattedNumericAndExcelDateCellsWithoutDependingOnDisplayText() throws Exception {
        byte[] content;
        LocalDate expectedDate = LocalDate.of(2026, 5, 12);
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Assets");
            var header = sheet.createRow(0);
            header.createCell(0).setCellValue("serialNumber");
            header.createCell(1).setCellValue("model");
            header.createCell(2).setCellValue("estimatedValue");
            header.createCell(3).setCellValue("purchaseDate");
            var data = sheet.createRow(1);
            data.createCell(0).setCellValue("SN-300");
            data.createCell(1).setCellValue("Monitor");
            var valueCell = data.createCell(2);
            valueCell.setCellValue(1250.75);
            var currencyStyle = workbook.createCellStyle();
            currencyStyle.setDataFormat(workbook.createDataFormat().getFormat("$#,##0.00"));
            valueCell.setCellStyle(currencyStyle);
            var dateCell = data.createCell(3);
            Date excelDate = Date.from(expectedDate.atStartOfDay(ZoneId.systemDefault()).toInstant());
            dateCell.setCellValue(excelDate);
            var dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy"));
            dateCell.setCellStyle(dateStyle);
            workbook.write(output);
            content = output.toByteArray();
        }

        List<AssetImportRow> rows = importer.parse("formatted-assets.xlsx", content);

        assertEquals(1, rows.size());
        assertEquals(1250.75, rows.get(0).asset().getEstimatedValue());
        assertEquals(expectedDate, rows.get(0).asset().getPurchaseDate());
    }

    @Test
    void evaluatesFormulaCellsInXlsx() throws Exception {
        byte[] content;
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Assets");
            var header = sheet.createRow(0);
            header.createCell(0).setCellValue("serialNumber");
            header.createCell(1).setCellValue("model");
            header.createCell(2).setCellValue("estimatedValue");
            header.createCell(3).setCellValue("purchaseDate");
            var data = sheet.createRow(1);
            data.createCell(0).setCellValue("SN-400");
            data.createCell(1).setCellValue("Dock");
            data.createCell(2).setCellFormula("500 * 2");
            data.createCell(3).setCellValue("2026-06-01");
            workbook.write(output);
            content = output.toByteArray();
        }

        List<AssetImportRow> rows = importer.parse("formula-assets.xlsx", content);

        assertEquals(1000.0, rows.get(0).asset().getEstimatedValue());
    }

    @Test
    void rejectsUnsupportedFileExtension() {
        assertThrows(IllegalArgumentException.class,
                () -> importer.parse("assets.xls", new byte[] {1}));
    }
}