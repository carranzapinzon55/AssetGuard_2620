package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.AssetUseCase;
import com.globalnet.assetguard.application.usecase.BulkUploadAssetsUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.AssetRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetUseCase assetUseCase;
    private final BulkUploadAssetsUseCase bulkUploadAssetsUseCase;

    public AssetController(AssetUseCase assetUseCase, BulkUploadAssetsUseCase bulkUploadAssetsUseCase) {
        this.assetUseCase = assetUseCase;
        this.bulkUploadAssetsUseCase = bulkUploadAssetsUseCase;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Asset> registerAsset(@RequestBody AssetRequestDto request) {
        if (request == null) {
            throw new IllegalArgumentException("Asset request must not be null");
        }

        Asset asset = Asset.builder()
                .serialNumber(request.getSerialNumber())
                .model(request.getModel())
                .estimatedValue(request.getEstimatedValue())
                .status(request.getStatus())
                .purchaseDate(request.getPurchaseDate())
                .build();

        Asset savedAsset = assetUseCase.register(asset);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedAsset);
    }

    @PostMapping(value = "/bulk-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BulkUploadResponse> uploadAssetsBulk(
            @RequestParam("file") MultipartFile file) throws java.io.IOException {
        var assets = bulkUploadAssetsUseCase.execute(file.getOriginalFilename(), file.getBytes());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new BulkUploadResponse(assets.size(), assets));
    }

    public record BulkUploadResponse(int importedCount, java.util.List<Asset> assets) {
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Asset> findById(@PathVariable Long id) {
        return ResponseEntity.ok(assetUseCase.findById(id));
    }

    @GetMapping("/serial/{serialNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Asset> findBySerialNumber(@PathVariable String serialNumber) {
        return ResponseEntity.ok(assetUseCase.findBySerialNumber(serialNumber));
    }
}
