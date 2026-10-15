package com.samjhana.ocpp.diag;

import com.samjhana.repository.OcppCommandLogRepository;
import com.samjhana.repository.OcppConnectionLogRepository;
import com.samjhana.repository.OcppMessageLogRepository;
import com.samjhana.repository.OcppSessionEvidenceRepository;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.mockito.Mockito.mock;

/** Keeps the rows that would be written to the database so a test can inspect them. */
public class RecordingAuditWriter extends OcppAuditWriter {

    public final List<Object> rows = new CopyOnWriteArrayList<>();

    public RecordingAuditWriter(OcppLoggingProperties properties) {
        super(mock(OcppMessageLogRepository.class), mock(OcppConnectionLogRepository.class),
                mock(OcppCommandLogRepository.class), mock(OcppSessionEvidenceRepository.class), properties);
    }

    @Override
    public void enqueue(Object row) {
        if (row != null) rows.add(row);
    }

    /** Every field of every recorded row as one string, so a test can prove a secret is in none of them. */
    public String dump() {
        return dumpRows(rows);
    }

    public static String dumpRows(java.util.Collection<?> rows) {
        StringBuilder out = new StringBuilder();
        for (Object row : rows) {
            out.append(row.getClass().getSimpleName()).append('{');
            for (java.lang.reflect.Field field : row.getClass().getDeclaredFields()) {
                field.setAccessible(true);
                try {
                    out.append(field.getName()).append('=').append(field.get(row)).append(", ");
                } catch (IllegalAccessException ex) {
                    throw new IllegalStateException(ex);
                }
            }
            out.append("}\n");
        }
        return out.toString();
    }

    public <T> List<T> rows(Class<T> type) {
        return rows.stream().filter(type::isInstance).map(type::cast).toList();
    }
}
