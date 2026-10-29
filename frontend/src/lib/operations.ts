export const USERS_QUERY = `
  query Users { users { id fullName email role status } }
`;

export const CREATE_USER = `
  mutation CreateUser($input: UserInput!) {
    createUser(input: $input) { id fullName email role status }
  }
`;

export const UPDATE_USER = `
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) { id fullName email role status }
  }
`;

export const ASSETS_QUERY = `
  query Assets {
    assets { id serialNumber model estimatedValue status purchaseDate }
  }
`;

export const CREATE_ASSET = `
  mutation CreateAsset($input: AssetInput!) {
    createAsset(input: $input) { id serialNumber model estimatedValue status purchaseDate }
  }
`;

export const UPDATE_ASSET = `
  mutation UpdateAsset($input: UpdateAssetInput!) {
    updateAsset(input: $input) { id serialNumber model estimatedValue status purchaseDate }
  }
`;

export const LOANS_QUERY = `
  query Loans {
    loans {
      id requestDate dueLocalDate returnDateTime status returnCondition delayDays rejectionReason
      user { id fullName email }
      inspector { id fullName }
      asset { id serialNumber model estimatedValue status }
    }
  }
`;

export const MY_LOAN_HISTORY = `
  query MyLoanHistory {
    myLoanHistory {
      id requestDate dueLocalDate returnDateTime status returnCondition delayDays rejectionReason
      asset { id serialNumber model status }
    }
  }
`;

export const REQUEST_LOAN = `
  mutation RequestLoan($input: RequestLoanInput!) {
    requestLoan(input: $input) { id status dueLocalDate }
  }
`;

export const APPROVE_LOAN = `
  mutation ApproveLoan($input: ApproveLoanInput!) {
    approveLoan(input: $input) { id status }
  }
`;

export const REJECT_LOAN = `
  mutation RejectLoan($input: RejectLoanInput!) {
    rejectLoan(input: $input) { id status rejectionReason }
  }
`;

export const RETURN_LOAN = `
  mutation ReturnLoan($input: ReturnLoanInput!) {
    returnLoan(input: $input) { id status returnCondition returnDateTime }
  }
`;

export const MAINTENANCE_QUERY = `
  query MaintenanceRecords {
    maintenanceRecords {
      id providerName reason cost startDate endDate
      asset { id serialNumber model status }
    }
  }
`;

export const CREATE_MAINTENANCE = `
  mutation CreateMaintenance($input: MaintenanceRecordInput!) {
    createMaintenanceRecord(input: $input) {
      id providerName reason cost startDate endDate
      asset { id serialNumber model status }
    }
  }
`;

export const COMPLETE_MAINTENANCE = `
  mutation CompleteMaintenance($input: CompleteMaintenanceInput!) {
    completeMaintenance(input: $input) { id endDate asset { id status } }
  }
`;

export const UPLOAD_ASSETS = `
  mutation UploadAssetsBulk($input: BulkUploadInput!) {
    uploadAssetsBulk(input: $input) {
      importedCount
      assets { id serialNumber model estimatedValue purchaseDate status }
    }
  }
`;

export const AUDIT_QUERY = `
  query AuditLogs($serialNumber: String, $technicianId: ID, $startDate: String, $endDate: String, $status: LoanStatus, $page: Int, $limit: Int) {
    auditLogs(serialNumber: $serialNumber, technicianId: $technicianId, startDate: $startDate, endDate: $endDate, status: $status, page: $page, limit: $limit) {
      loans {
        id requestDate dueLocalDate returnDateTime status returnCondition delayDays rejectionReason
        user { id fullName email }
        inspector { id fullName }
        asset { id serialNumber model estimatedValue status }
      }
      totalElements page limit totalPages
    }
  }
`;

export const DASHBOARD_QUERY = `
  query DashboardMetrics($startDate: String, $endDate: String) {
    dashboardMetrics(startDate: $startDate, endDate: $endDate) {
      estimatedLossValue onTimeReturnPercentage assetsCurrentlyInField
    }
  }
`;