package com.globalnet.assetguard.application.model;

import com.globalnet.assetguard.domain.model.Asset;

public record AssetImportRow(int rowNumber, Asset asset) {
}