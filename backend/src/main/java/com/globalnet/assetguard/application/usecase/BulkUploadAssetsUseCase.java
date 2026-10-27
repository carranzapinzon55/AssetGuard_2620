package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.application.model.AssetImportRow;
import com.globalnet.assetguard.application.port.input.AssetFileImporterPort;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BulkUploadAssetsUseCase {

    private final AssetFileImporterPort assetFileImporterPort;
    private final AssetRepositoryPort assetRepositoryPort;

    public BulkUploadAssetsUseCase(
            AssetFileImporterPort assetFileImporterPort,
            AssetRepositoryPort assetRepositoryPort) {
        this.assetFileImporterPort = assetFileImporterPort;
        this.assetRepositoryPort = assetRepositoryPort;
    }

    @Transactional(rollbackFor = Exception.class)
    public List<Asset> execute(String filename, byte[] content) throws IOException {
        List<AssetImportRow> rows = assetFileImporterPort.parse(filename, content);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("The upload contains no asset rows");
        }

        Set<String> serialsInFile = new HashSet<>();
        List<Asset> savedAssets = new java.util.ArrayList<>(rows.size());
        for (AssetImportRow importRow : rows) {
            Asset asset = importRow.asset();
            validateRow(importRow.rowNumber(), asset, serialsInFile);
            savedAssets.add(assetRepositoryPort.save(asset));
        }
        return savedAssets;
    }

    private void validateRow(int rowNumber, Asset asset, Set<String> serialsInFile) {
        if (asset == null) {
            throw rowError(rowNumber, "La fila está vacía o es inválida");
        }
        String serial = asset.getSerialNumber();
        if (serial == null || serial.isBlank()) {
            throw rowError(rowNumber, "serialNumber es obligatorio");
        }
        serial = serial.trim();
        asset.setSerialNumber(serial);
        String normalizedSerial = serial.toUpperCase(Locale.ROOT);
        if (!serialsInFile.add(normalizedSerial)) {
            throw rowError(rowNumber, "El serial " + serial + " está duplicado en el archivo");
        }
        if (assetRepositoryPort.findBySerialNumber(serial).isPresent()) {
            throw rowError(rowNumber, "El serial " + serial + " ya existe");
        }
        if (asset.getModel() == null || asset.getModel().isBlank()) {
            throw rowError(rowNumber, "model es obligatorio");
        }
        if (asset.getEstimatedValue() == null || !Double.isFinite(asset.getEstimatedValue())
                || asset.getEstimatedValue() <= 0) {
            throw rowError(rowNumber, "estimatedValue debe ser un valor numérico positivo");
        }
        if (asset.getPurchaseDate() == null) {
            throw rowError(rowNumber, "purchaseDate debe ser una fecha válida");
        }
        asset.setStatus("AVAILABLE");
    }

    private IllegalArgumentException rowError(int rowNumber, String message) {
        return new IllegalArgumentException("Error en la fila " + rowNumber + ": " + message);
    }
}