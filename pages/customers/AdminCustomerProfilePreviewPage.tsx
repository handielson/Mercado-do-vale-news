import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { customerService } from '../../services/customers';
import type { Customer } from '../../types/customer';
import { CustomerProfilePage } from '../customer/CustomerProfilePage';

export default function AdminCustomerProfilePreviewPage() {
    const { id } = useParams();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!id) {
            setError('Cliente nao informado');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        customerService.getById(id)
            .then((data) => {
                if (!cancelled) setCustomer(data);
            })
            .catch((err: any) => {
                if (!cancelled) setError(err?.message || 'Erro ao carregar cliente');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [id]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Carregando visualizacao do cliente...
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-medium text-slate-700">{error || 'Cliente nao encontrado'}</p>
                    <Link
                        to="/admin/customers"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar aos clientes
                    </Link>
                </div>
            </div>
        );
    }

    return <CustomerProfilePage customerOverride={customer} isAdminPreview />;
}
