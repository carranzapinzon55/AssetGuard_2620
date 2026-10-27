package com.globalnet.assetguard.application.port.input;

import com.globalnet.assetguard.application.model.AssetImportRow;
import java.io.IOException;
import java.util.List;

public interface AssetFileImporterPort {

    List<AssetImportRow> parse(String filename, byte[] content) throws IOException;
}