package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.AssetUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.AssetRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetUseCase assetUseCase;

    public AssetController(AssetUseCase assetUseCase) {
        this.assetUseCase = assetUseCase;
    }

    @PostMapping
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

    @GetMapping("/{id}")
    public ResponseEntity<Asset> findById(@PathVariable Long id) {
        return ResponseEntity.ok(assetUseCase.findById(id));
    }

    @GetMapping("/serial/{serialNumber}")
    public ResponseEntity<Asset> findBySerialNumber(@PathVariable String serialNumber) {
        return ResponseEntity.ok(assetUseCase.findBySerialNumber(serialNumber));
    }
}
