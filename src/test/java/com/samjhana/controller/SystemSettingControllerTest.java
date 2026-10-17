package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.repository.SystemSettingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/** Finding B-01, at the method: nobody who is not a manager or admin gets to read any setting, not even the unknown ones. */
class SystemSettingControllerTest {

    private final SystemSettingRepository repository = mock(SystemSettingRepository.class);
    private final SystemSettingController controller = new SystemSettingController(repository);

    @Test
    void shouldRefuse_whenThereIsNoUser() {
        ResponseEntity<?> response = controller.getSetting("nea_rate", null);

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        verifyNoInteractions(repository);
    }

    @Test
    void shouldRefuseStaffBeforeLookingAnythingUp() {
        User staff = User.builder().username("s").role(User.UserRole.STAFF).build();

        assertThat(controller.getSetting("nea_rate", staff).getStatusCode().value()).isEqualTo(403);
        assertThat(controller.getSetting("anything-else", staff).getStatusCode().value()).isEqualTo(403);
        verifyNoInteractions(repository);
    }
}
