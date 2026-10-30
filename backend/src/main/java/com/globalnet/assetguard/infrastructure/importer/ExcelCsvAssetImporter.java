package com.globalnet.assetguard.infrastructure.importer;

import com.globalnet.assetguard.application.model.AssetImportRow;
import com.globalnet.assetguard.application.port.input.AssetFileImporterPort;
import com.globalnet.assetguard.domain.model.Asset;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.CellValue;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

@Component
public class ExcelCsvAssetImporter implements AssetFileImporterPort {

    private static final List<String> REQUIRED_HEADERS =
            List.of("serialnumber", "model", "estimatedvalue", "purchasedate");
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("M/d/uuuu", Locale.ROOT),
            DateTimeFormatter.ofPattern("d/M/uuuu", Locale.ROOT));

    @Override
    public List<AssetImportRow> parse(String filename, byte[] content) throws IOException {
        if (filename == null || content == null || content.length == 0) {
            throw new IllegalArgumentException("A filename and non-empty file content are required");
        }
        String normalizedFilename = filename.toLowerCase(Locale.ROOT);
        if (normalizedFilename.endsWith(".csv")) {
            return parseCsv(content);
        }
        if (normalizedFilename.endsWith(".xlsx")) {
            return parseXlsx(content);
        }
        throw new IllegalArgumentException("Only .csv and .xlsx files are supported");
    }

    private List<AssetImportRow> parseCsv(byte[] content) throws IOException {
        try (CSVReader reader = new CSVReader(new InputStreamReader(
                new ByteArrayInputStream(content), StandardCharsets.UTF_8))) {
            String[] headerRow = reader.readNext();
            Map<String, Integer> headers = headerIndexes(headerRow);
            List<AssetImportRow> rows = new ArrayList<>();
            String[] values;
            int rowNumber = 1;
            while ((values = reader.readNext()) != null) {
                rowNumber++;
                if (isEmpty(values)) {
                    continue;
                }
                rows.add(new AssetImportRow(rowNumber, toAsset(rowNumber,
                        get(values, headers, "serialnumber"),
                        get(values, headers, "model"),
                        get(values, headers, "estimatedvalue"),
                        get(values, headers, "purchasedate"), null)));
            }
            return rows;
        } catch (CsvValidationException exception) {
            throw new IOException("Invalid CSV structure: " + exception.getMessage(), exception);
        }
    }

    private List<AssetImportRow> parseXlsx(byte[] content) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new IllegalArgumentException("Workbook contains no sheets");
            }
            var sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            DataFormatter formatter = new DataFormatter();
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            Map<String, Integer> headers = headerIndexes(headerRow, formatter);
            List<AssetImportRow> rows = new ArrayList<>();
            for (int index = headerRow.getRowNum() + 1; index <= sheet.getLastRowNum(); index++) {
                Row row = sheet.getRow(index);
                if (row == null || isEmpty(row, formatter)) {
                    continue;
                }
                rows.add(new AssetImportRow(index + 1,
                    toXlsxAsset(index + 1, row, headers, formatter, evaluator)));
            }
            return rows;
        }
    }

    private Map<String, Integer> headerIndexes(String[] headerRow) {
        if (headerRow == null) {
            throw new IllegalArgumentException("File has no header row");
        }
        Map<String, Integer> indexes = new HashMap<>();
        for (int index = 0; index < headerRow.length; index++) {
            indexes.put(normalizeHeader(headerRow[index]), index);
        }
        requireHeaders(indexes);
        return indexes;
    }

    private Map<String, Integer> headerIndexes(Row headerRow, DataFormatter formatter) {
        if (headerRow == null) {
            throw new IllegalArgumentException("File has no header row");
        }
        Map<String, Integer> indexes = new HashMap<>();
        for (int index = headerRow.getFirstCellNum(); index < headerRow.getLastCellNum(); index++) {
            if (index >= 0) {
                indexes.put(normalizeHeader(formatter.formatCellValue(headerRow.getCell(index))), index);
            }
        }
        requireHeaders(indexes);
        return indexes;
    }

    private void requireHeaders(Map<String, Integer> headers) {
        List<String> missing = REQUIRED_HEADERS.stream().filter(header -> !headers.containsKey(header)).toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Missing required columns: " + String.join(", ", missing));
        }
    }

    private Asset toAsset(
            int rowNumber, String serial, String model, String value, String date, Cell dateCell) {
        try {
            return Asset.builder()
                    .serialNumber(serial == null ? null : serial.trim())
                    .model(model == null ? null : model.trim())
                    .estimatedValue(value == null || value.isBlank() ? null : Double.valueOf(value.trim()))
                    .purchaseDate(parseDate(date, dateCell))
                    .status("AVAILABLE")
                    .build();
        } catch (NumberFormatException | DateTimeParseException exception) {
            throw new IllegalArgumentException("Error en la fila " + rowNumber + ": " + exception.getMessage(), exception);
        }
    }

    private Asset toXlsxAsset(
            int rowNumber,
            Row row,
            Map<String, Integer> headers,
            DataFormatter formatter,
            FormulaEvaluator evaluator) {
        try {
            Cell serialCell = row.getCell(headers.get("serialnumber"));
            Cell modelCell = row.getCell(headers.get("model"));
            Cell valueCell = row.getCell(headers.get("estimatedvalue"));
            Cell dateCell = row.getCell(headers.get("purchasedate"));
            String serial = formatter.formatCellValue(serialCell, evaluator);
            String model = formatter.formatCellValue(modelCell, evaluator);

            return Asset.builder()
                    .serialNumber(serial == null ? null : serial.trim())
                    .model(model == null ? null : model.trim())
                    .estimatedValue(readNumericCell(valueCell, evaluator, rowNumber))
                    .purchaseDate(readDateCell(dateCell, formatter, evaluator, rowNumber))
                    .status("AVAILABLE")
                    .build();
        } catch (NumberFormatException | DateTimeParseException exception) {
            throw new IllegalArgumentException(
                    "Error en la fila " + rowNumber + ": " + exception.getMessage(), exception);
        }
    }

    private Double readNumericCell(Cell cell, FormulaEvaluator evaluator, int rowNumber) {
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return null;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            CellValue evaluated = evaluator.evaluate(cell);
            if (evaluated == null || evaluated.getCellType() == CellType.BLANK) {
                return null;
            }
            if (evaluated.getCellType() == CellType.NUMERIC) {
                return evaluated.getNumberValue();
            }
            if (evaluated.getCellType() == CellType.STRING) {
                return parseNumericText(evaluated.getStringValue(), rowNumber);
            }
            throw rowError(rowNumber, "estimatedValue debe ser numérico");
        }
        if (cellType == CellType.NUMERIC) {
            return cell.getNumericCellValue();
        }
        if (cellType == CellType.STRING) {
            return parseNumericText(cell.getStringCellValue(), rowNumber);
        }
        throw rowError(rowNumber, "estimatedValue debe ser numérico");
    }

    private Double parseNumericText(String value, int rowNumber) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.valueOf(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(
                    "Error en la fila " + rowNumber + ": estimatedValue debe ser numérico", exception);
        }
    }

    private LocalDate readDateCell(
            Cell cell, DataFormatter formatter, FormulaEvaluator evaluator, int rowNumber) {
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return null;
        }

        CellType cellType = cell.getCellType();
        boolean dateFormatted = DateUtil.isADateFormat(
                cell.getCellStyle().getDataFormat(),
                cell.getCellStyle().getDataFormatString());
        if (dateFormatted && (cellType == CellType.NUMERIC || cellType == CellType.FORMULA)) {
            double excelDate;
            if (cellType == CellType.FORMULA) {
                CellValue evaluated = evaluator.evaluate(cell);
                if (evaluated == null || evaluated.getCellType() != CellType.NUMERIC) {
                    throw rowError(rowNumber, "purchaseDate debe ser una fecha válida");
                }
                excelDate = evaluated.getNumberValue();
            } else {
                excelDate = cell.getNumericCellValue();
            }
            return DateUtil.getJavaDate(excelDate)
                    .toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate();
        }

        String value = formatter.formatCellValue(cell, evaluator);
        try {
            return parseDate(value, null);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(
                    "Error en la fila " + rowNumber + ": purchaseDate debe ser una fecha válida", exception);
        }
    }

    private IllegalArgumentException rowError(int rowNumber, String message) {
        return new IllegalArgumentException("Error en la fila " + rowNumber + ": " + message);
    }

    private LocalDate parseDate(String value, Cell cell) {
        if (cell != null && cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC
                && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (value == null || value.isBlank()) {
            return null;
        }
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(value.trim(), format);
            } catch (DateTimeParseException ignored) {
                // Try the next supported representation.
            }
        }
        throw new DateTimeParseException("Expected date as yyyy-MM-dd", value, 0);
    }

    private String get(String[] values, Map<String, Integer> headers, String column) {
        int index = headers.get(column);
        return index < values.length ? values[index] : null;
    }

    private String normalizeHeader(String header) {
        return header == null ? "" : header.replace("\uFEFF", "").trim().toLowerCase(Locale.ROOT);
    }

    private boolean isEmpty(String[] values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return false;
            }
        }
        return true;
    }

    private boolean isEmpty(Row row, DataFormatter formatter) {
        for (int index = row.getFirstCellNum(); index < row.getLastCellNum(); index++) {
            if (index >= 0 && !formatter.formatCellValue(row.getCell(index)).isBlank()) {
                return false;
            }
        }
        return true;
    }
}