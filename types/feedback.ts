export interface CustomerFeedback {
    id: string;
    company_id: string;
    type: 'Dúvida' | 'Reclamação' | 'Sugestão' | 'Outro';
    message: string;
    customer_name?: string | null;
    customer_contact?: string | null;
    status: 'novo' | 'lido' | 'respondido';
    admin_reply?: string | null;
    created_at: string;
}

export interface FeedbackInput {
    company_id?: string; // Set internally
    type: 'Dúvida' | 'Reclamação' | 'Sugestão' | 'Outro';
    message: string;
    customer_name?: string;
    customer_contact?: string;
}
