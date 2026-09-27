package com.samjhana.seed;

import com.samjhana.entity.BusinessUnit;
import com.samjhana.repository.BusinessUnitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Profile;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the seeder against a real (embedded) database, the way staging and prod start up. Built
 * directly because it is excluded from the {@code test} profile that CI activates.
 */
@DataJpaTest
class BusinessUnitSeederIntegrationTest {

    @Autowired BusinessUnitRepository businessUnitRepository;
    BusinessUnitSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new BusinessUnitSeeder(businessUnitRepository);
        businessUnitRepository.deleteAll();
    }

    @Test
    void shouldCreateAllFiveUnits_whenTheDatabaseHasNone() {
        seeder.run();

        assertThat(businessUnitRepository.findAll()).extracting(BusinessUnit::getCode)
                .containsExactlyInAnyOrder("petrol", "ev", "furniture", "rental", "loan");
        assertThat(businessUnitRepository.findByCode("ev").orElseThrow().getIsActive()).isTrue();
    }

    @Test
    void shouldAddOnlyTheMissingUnit_whenSomeAlreadyExist() {
        seeder.run();
        businessUnitRepository.delete(businessUnitRepository.findByCode("ev").orElseThrow());

        seeder.run();

        assertThat(businessUnitRepository.count()).isEqualTo(5);
        assertThat(businessUnitRepository.findByCode("ev")).isPresent();
    }

    @Test
    void shouldKeepAnEditedUnitAsItIs_onTheNextStart() {
        seeder.run();
        BusinessUnit petrol = businessUnitRepository.findByCode("petrol").orElseThrow();
        petrol.setName("Renamed Pump");
        businessUnitRepository.save(petrol);

        seeder.run();

        assertThat(businessUnitRepository.findByCode("petrol").orElseThrow().getName()).isEqualTo("Renamed Pump");
        assertThat(businessUnitRepository.count()).isEqualTo(5);
    }

    @Test
    void shouldRunOnDevStagingAndProd_butNotInTheTestSuite() {
        assertThat(BusinessUnitSeeder.class.getAnnotation(Profile.class).value()).containsExactly("!test");
    }
}
