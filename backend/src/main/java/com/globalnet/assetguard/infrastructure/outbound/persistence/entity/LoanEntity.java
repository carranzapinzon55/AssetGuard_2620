package com.globalnet.assetguard.infrastructure.outbound.persistence.entity;

import com.globalnet.assetguard.infrastructure.outbound.persistence.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "loans")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_date")
    private LocalDateTime requestDate;

    @Column(name = "due_local_date")
    private LocalDate dueLocalDate;

    @Column(name = "return_date_time")
    private LocalDateTime returnDateTime;

    @Column(name = "status")
    private String status;

    @Column(name = "return_condition")
    private String returnCondition;

    @Column(name = "delay_days")
    private Integer delayDays;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private AssetEntity asset;
}