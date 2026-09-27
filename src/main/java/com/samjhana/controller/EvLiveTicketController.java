package com.samjhana.controller;

import com.samjhana.entity.User;
import com.samjhana.websocket.LiveTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Hands a signed-in user a one-time ticket for the live EV WebSocket (see {@link LiveTicketService}). */
@RestController
@RequestMapping("/api/ev/live-ticket")
@RequiredArgsConstructor
public class EvLiveTicketController {

    private final LiveTicketService liveTicketService;

    @PostMapping
    public ResponseEntity<?> issue(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("ticket", liveTicketService.issue(user.getUsername())));
    }
}
