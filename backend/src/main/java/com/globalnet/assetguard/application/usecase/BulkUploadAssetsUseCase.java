package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.application.model.AssetImportRow;
import com.globalnet.assetguard.application.port.input.AssetFileImporterPort;
import com.globalnet.assetguard.domain.model.Asset;
import java.io.IOException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BulkUploadAssetsUseCase {

    private final AssetFileImporterPort assetFileImporterPort;
    private final AssetUseCase assetUseCase;

    public BulkUploadAssetsUseCase(
            AssetFileImporterPort assetFileImporterPort, AssetUseCase assetUseCase) {
        this.assetFileImporterPort = assetFileImporterPort;
        this.assetUseCase = assetUseCase;
    }

    @Transactional(rollbackFor = Exception.class)
    public List<Asset> execute(String filename, byte[] content) throws IOException {
        List<AssetImportRow> rows = assetFileImporterPort.parse(filename, content);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("The upload contains no asset rows");
        }

        List<Asset> savedAssets = new java.util.ArrayList<>(rows.size());
        for (AssetImportRow importRow : rows) {
            validateRow(importRow.rowNumber(), importRow.asset());
            savedAssets.add(assetUseCase.register(importRow.asset()));
        }
        return savedAssets;
    }

    private void validateRow(int rowNumber, Asset asset) {
        if (asset == null) {
            throw rowError(rowNumber, "La fila está vacía o es inválida");
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