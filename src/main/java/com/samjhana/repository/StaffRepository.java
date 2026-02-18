package com.samjhana.repository;

import com.samjhana.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StaffRepository extends JpaRepository<Staff, UUID> {

    List<Staff> findByIsActiveTrueOrderByFullNameAsc();

    List<Staff> findByBusinessUnitAndIsActiveTrueOrderByFullNameAsc(Staff.BusinessUnit businessUnit);

    List<Staff> findByStaffRoleAndIsActiveTrueOrderByFullNameAsc(Staff.StaffRole staffRole);
}
