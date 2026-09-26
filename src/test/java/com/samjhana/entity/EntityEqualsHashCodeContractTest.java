package com.samjhana.entity;

import nl.jqno.equalsverifier.EqualsVerifier;
import nl.jqno.equalsverifier.Warning;
import jakarta.persistence.Id;
import org.junit.jupiter.api.Test;

/**
 * Every entity below uses Lombok's {@code @Data}, which generates {@code equals}/
 * {@code hashCode}/{@code canEqual} covering every declared field. Nothing exercised
 * that generated code before this file existed. EqualsVerifier checks the actual
 * equals/hashCode contract (reflexivity, symmetry, transitivity, null-safety, hashCode
 * consistency) far more thoroughly than hand-written assertions would.
 *
 * <p>NONFINAL_FIELDS and STRICT_INHERITANCE are suppressed for all of them: JPA
 * entities can't have final fields (Hibernate needs mutable state via reflection) and
 * can't be final classes (Hibernate's lazy-loading proxies subclass them) — both are
 * standard, expected properties of a JPA entity, not real equals/hashCode risks here.
 */
class EntityEqualsHashCodeContractTest {

    @Test
    void staffEqualsAndHashCodeShouldCoverEveryField() {
        // BIGDECIMAL_EQUALITY: BigDecimal.equals() is scale-sensitive (0 != 0.0) — standard,
        // well-known Java behavior for a field using plain equals(), not a real bug here.
        EqualsVerifier.forClass(Staff.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE, Warning.BIGDECIMAL_EQUALITY)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void transactionEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(Transaction.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE, Warning.BIGDECIMAL_EQUALITY)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void fieldTemplateEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(FieldTemplate.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void furnitureItemEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(FurnitureItem.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE, Warning.BIGDECIMAL_EQUALITY)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void resourceEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(Resource.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void auditLogEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(AuditLog.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void businessUnitEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(BusinessUnit.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void imageAttachmentEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(ImageAttachment.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void furnitureCustomerEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(FurnitureCustomer.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void systemSettingEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(SystemSetting.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }

    @Test
    void userEqualsAndHashCodeShouldCoverEveryField() {
        EqualsVerifier.forClass(User.class)
                .suppress(Warning.NONFINAL_FIELDS, Warning.STRICT_INHERITANCE)
                .withIgnoredAnnotations(Id.class)
                .verify();
    }
}
