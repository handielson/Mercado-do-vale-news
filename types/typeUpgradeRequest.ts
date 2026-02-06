/**
 * Customer Type Upgrade Request Types
 */

export type TypeUpgradeRequestStatus = 'pending' | 'approved' | 'rejected';
export type RequestedCustomerType = 'wholesale' | 'resale';

export interface TypeUpgradeRequest {
    id: string;
    customer_id: string;
    requested_type: RequestedCustomerType;
    status: TypeUpgradeRequestStatus;
    requested_at: string;
    reviewed_at?: string;
    reviewed_by?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at: string;
}

export interface TypeUpgradeRequestWithCustomer extends TypeUpgradeRequest {
    customer: {
        id: string;
        name: string;
        email: string;
        cpf_cnpj?: string;
        phone?: string;
    };
}

export interface CreateTypeUpgradeRequest {
    customer_id: string;
    requested_type: RequestedCustomerType;
}

export interface UpdateTypeUpgradeRequest {
    status: TypeUpgradeRequestStatus;
    reviewed_by: string;
    reviewed_at: string;
    rejection_reason?: string;
}
