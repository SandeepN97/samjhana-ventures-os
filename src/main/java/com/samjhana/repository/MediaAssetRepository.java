package com.samjhana.repository;

import com.samjhana.entity.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

    Optional<MediaAsset> findByIdAndDeletedAtIsNull(UUID id);

    Optional<MediaAsset> findFirstByOriginalNameAndDeletedAtIsNull(String originalName);

    /** Which of these ids are real, live pictures: checks references without loading any picture bytes. */
    @Query("select m.id from MediaAsset m where m.id in :ids and m.deletedAt is null")
    List<UUID> findLiveIds(@Param("ids") Collection<UUID> ids);
}
