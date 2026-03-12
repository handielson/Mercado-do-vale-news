export interface ProductReview {
    id: string;
    product_id: string;
    customer_id: string;
    rating: number;
    review_text: string | null;
    status: 'pending' | 'approved' | 'hidden';
    admin_reply: string | null;
    created_at: string;
    // Relacionamento (Join) com Customer
    customer?: {
        name: string;
        avatar_url: string | null;
    };
}

export interface ReviewInput {
    product_id: string;
    rating: number;
    review_text?: string;
}
