package com.samjhana.controller;

import com.samjhana.entity.EvCustomerVehicle;
import com.samjhana.service.ChargeSessionService;
import com.samjhana.service.PlatePhotoStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/ev/vehicle-photos")
@RequiredArgsConstructor
public class EvVehiclePhotoController {

    private final ChargeSessionService chargeSessionService;
    private final PlatePhotoStorageService photoStorageService;

    @GetMapping("/{vehicleId}")
    public ResponseEntity<Resource> photo(@PathVariable UUID vehicleId) {
        EvCustomerVehicle vehicle = chargeSessionService.getVehicle(vehicleId);
        Resource resource = photoStorageService.load(vehicle.getPlatePhotoPath());
        if (resource == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(mediaType(vehicle.getPlatePhotoPath())).body(resource);
    }

    private MediaType mediaType(String path) {
        if (path == null) return MediaType.APPLICATION_OCTET_STREAM;
        String lower = path.toLowerCase();
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }
}
