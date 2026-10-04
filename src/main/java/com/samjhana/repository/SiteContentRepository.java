package com.samjhana.repository;

import com.samjhana.entity.SiteContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SiteContentRepository extends JpaRepository<SiteContent, String> {
}
