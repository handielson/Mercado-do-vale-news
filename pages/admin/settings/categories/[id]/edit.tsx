import React from 'react';
import { useParams } from 'react-router-dom';
import { CategoryEditPage } from '../../../../../components/categories/CategoryEditPage';

/**
 * Edit Category Page
 * Route: /admin/settings/categories/:id/edit
 */
export default function EditCategoryPage() {
    const { id } = useParams<{ id: string }>();

    // Show loading if no ID
    if (!id) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    return <CategoryEditPage categoryId={id} />;
}
