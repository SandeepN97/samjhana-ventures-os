package com.samjhana;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Samjhana Ventures OS - Dynamic Multi-Business ERP
 * 
 * A family business management system designed for:
 * - Dad (Nepal): Simple mobile-first data entry with large buttons
 * - Son (USA): Complex dashboard for review, approval, and analysis
 * 
 * Supported Businesses:
 * 1. Furniture Shop - Stock tracking
 * 2. Shringeshwor Petrol Pump - Fuel sales with WAC profit calculation
 * 3. EV Charging Station - Meter-based billing with NEA reconciliation
 * 4. House Rental - Tenant and payment tracking
 * 5. Bank Loan Management - Interest accrual and balance tracking
 * 
 * @author Samjhana Ventures Development Team
 * @version 1.0.0
 */
@SpringBootApplication
@EnableScheduling
public class SamjhanaVenturesOsApplication {

    public static void main(String[] args) {
        // ASCII Art Banner will be shown from banner.txt
        SpringApplication.run(SamjhanaVenturesOsApplication.class, args);
        
        System.out.println("""
            
            ╔═══════════════════════════════════════════════════════════════╗
            ║                                                               ║
            ║   🏢 Samjhana Ventures OS is running!                         ║
            ║                                                               ║
            ║   📱 Mobile UI (Dad):    http://localhost:8080                ║
            ║   🖥️  Dashboard (Son):    http://localhost:8080/dashboard     ║
            ║   📚 API Docs:           http://localhost:8080/swagger-ui     ║
            ║                                                               ║
            ║   💡 Tip: Use Tailscale for secure USA-Nepal connection       ║
            ║                                                               ║
            ╚═══════════════════════════════════════════════════════════════╝
            
            """);
    }
}
