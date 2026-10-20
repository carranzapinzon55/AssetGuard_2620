package com.globalnet.assetguard.domain.model;

public class User {
    private Long id;
    private String fullName;
    private String email;
    private String password;
    private String role; // Valores permitidos: ADMIN, INSPECTOR, TECHNICIAN
    private Boolean status;

    // Constructor vacío
    public User() {
    }

    // Constructor con todos los atributos
    public User(Long id, String fullName, String email, String password, String role, Boolean status) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.password = password;
        this.role = role;
        this.status = status;
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Boolean getStatus() { return status; }
    public void setStatus(Boolean status) { this.status = status; }
}