package com.samjhana.service;

import com.samjhana.dto.EvVehicleRequest;
import com.samjhana.entity.EvVehicle;
import com.samjhana.entity.User;
import com.samjhana.repository.EvVehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EvVehicleServiceTest {

    @Mock EvVehicleRepository evVehicleRepository;

    private EvVehicleService service;
    private User staff;

    @BeforeEach
    void setUp() {
        service = new EvVehicleService(evVehicleRepository);
        staff = User.builder().username("staff").passwordHash("x").fullName("Staff").role(User.UserRole.STAFF).build();
    }

    private EvVehicle vehicle(String name) {
        return EvVehicle.builder().id(UUID.randomUUID()).vehicleName(name)
                .batteryCapacityKw(new BigDecimal("50")).seatingCapacity(5)
                .ratePerPercent(new BigDecimal("10")).isActive(true).build();
    }

    private EvVehicleRequest request(String name, String rate) {
        EvVehicleRequest r = new EvVehicleRequest();
        r.setVehicleName(name);
        r.setBatteryCapacityKw(new BigDecimal("60"));
        r.setSeatingCapacity(4);
        r.setRatePerPercent(rate != null ? new BigDecimal(rate) : null);
        return r;
    }

    @Test
    void shouldReturnOnlyActiveVehicles() {
        when(evVehicleRepository.findByIsActiveTrueOrderByVehicleNameAsc()).thenReturn(List.of(vehicle("Higer")));
        assertThat(service.getActiveVehicles()).hasSize(1);
    }

    @Test
    void shouldReturnAllVehicles_regardlessOfActiveStatus() {
        when(evVehicleRepository.findAllByOrderByVehicleNameAsc()).thenReturn(List.of(vehicle("Higer"), vehicle("Keytone")));
        assertThat(service.getAllVehicles()).hasSize(2);
    }

    @Test
    void shouldCreateVehicle_whenValid() {
        when(evVehicleRepository.save(any())).thenAnswer(inv -> {
            EvVehicle v = inv.getArgument(0);
            v.setId(UUID.randomUUID());
            return v;
        });
        var result = service.createVehicle(request("New EV", "12"), staff);
        assertThat(result.getVehicleName()).isEqualTo("New EV");
        assertThat(result.getUpdatedByName()).isEqualTo("Staff");
    }

    @Test
    void shouldRejectCreation_whenVehicleNameBlank() {
        assertThatThrownBy(() -> service.createVehicle(request("  ", "12"), staff))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectCreation_whenRatePerPercentMissing() {
        assertThatThrownBy(() -> service.createVehicle(request("EV", null), staff))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldUpdateOnlyProvidedFields() {
        EvVehicle existing = vehicle("Old Name");
        when(evVehicleRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(evVehicleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EvVehicleRequest partial = new EvVehicleRequest();
        partial.setSeatingCapacity(7);

        var result = service.updateVehicle(existing.getId(), partial, staff);

        assertThat(result.getVehicleName()).isEqualTo("Old Name");
        assertThat(result.getSeatingCapacity()).isEqualTo(7);
    }

    @Test
    void shouldIgnoreBlankVehicleName_onUpdate() {
        EvVehicle existing = vehicle("Old Name");
        when(evVehicleRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(evVehicleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.updateVehicle(existing.getId(), request("   ", "5"), staff);

        assertThat(result.getVehicleName()).isEqualTo("Old Name");
    }

    @Test
    void shouldThrow_whenUpdatingUnknownVehicle() {
        UUID id = UUID.randomUUID();
        when(evVehicleRepository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.updateVehicle(id, request("X", "1"), staff))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldSoftDeleteVehicle() {
        EvVehicle existing = vehicle("X");
        when(evVehicleRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(evVehicleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.deleteVehicle(existing.getId(), staff);

        assertThat(existing.getIsActive()).isFalse();
        assertThat(existing.getUpdatedBy()).isEqualTo(staff);
    }

    @Test
    void shouldThrow_whenDeletingUnknownVehicle() {
        UUID id = UUID.randomUUID();
        when(evVehicleRepository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteVehicle(id, staff)).isInstanceOf(IllegalArgumentException.class);
    }
}
