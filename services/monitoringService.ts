import { supabase } from './supabase';
import type { SystemStatus, DatabaseStatus, PerformanceMetrics, ErrorLog } from '@/types/systemStatus';

export const monitoringService = {
    /**
     * Obter status completo do sistema
     */
    getSystemStatus: async (): Promise<SystemStatus> => {
        const [database, performance, errors] = await Promise.all([
            monitoringService.getDatabaseStatus(),
            monitoringService.getPerformanceMetrics(),
            monitoringService.getRecentErrors()
        ]);

        const overall = monitoringService.calculateOverallHealth(database, performance, errors);

        return {
            overall,
            database,
            performance,
            errors,
            uptime: performance.avgResponseTime > 0 ? 99.9 : 0, // Simplificado
            lastUpdate: new Date()
        };
    },

    /**
     * Obter status do banco de dados
     */
    getDatabaseStatus: async (): Promise<DatabaseStatus> => {
        const start = Date.now();

        try {
            const { data, error } = await supabase
                .from('products')
                .select('id')
                .limit(1);

            const responseTime = Date.now() - start;

            return {
                connected: !error,
                responseTime,
                activeConnections: 5, // Placeholder - obter do Supabase se disponível
                maxConnections: 100,
                storageUsed: 2.5, // GB - Placeholder
                storageTotal: 10 // GB
            };
        } catch (error) {
            return {
                connected: false,
                responseTime: 0,
                activeConnections: 0,
                maxConnections: 100,
                storageUsed: 0,
                storageTotal: 10
            };
        }
    },

    /**
     * Obter métricas de performance
     */
    getPerformanceMetrics: async (): Promise<PerformanceMetrics> => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const { data, error } = await supabase
            .from('performance_metrics')
            .select('*')
            .gte('recorded_at', oneHourAgo.toISOString())
            .order('recorded_at', { ascending: false });

        if (error || !data || data.length === 0) {
            return {
                avgResponseTime: 0,
                requestsPerMinute: 0,
                errorRate: 0,
                cacheHitRate: 0,
                memoryUsage: 0,
                cpuUsage: 0
            };
        }

        // Calcular médias
        const responseTimeMetrics = data.filter(m => m.metric_type === 'response_time');
        const avgResponseTime = responseTimeMetrics.length > 0
            ? responseTimeMetrics.reduce((acc, m) => acc + Number(m.value), 0) / responseTimeMetrics.length
            : 0;

        const requestMetrics = data.filter(m => m.metric_type === 'requests');
        const requestsPerMinute = requestMetrics.length > 0
            ? requestMetrics.reduce((acc, m) => acc + Number(m.value), 0) / requestMetrics.length
            : 0;

        const errorMetrics = data.filter(m => m.metric_type === 'errors');
        const errorRate = errorMetrics.length > 0
            ? errorMetrics.reduce((acc, m) => acc + Number(m.value), 0) / errorMetrics.length
            : 0;

        return {
            avgResponseTime: Math.round(avgResponseTime),
            requestsPerMinute: Math.round(requestsPerMinute),
            errorRate: Number(errorRate.toFixed(2)),
            cacheHitRate: 85, // Placeholder
            memoryUsage: 45, // Placeholder
            cpuUsage: 30 // Placeholder
        };
    },

    /**
     * Obter erros recentes
     */
    getRecentErrors: async (limit: number = 50): Promise<ErrorLog[]> => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .in('level', ['error', 'warning'])
            .gte('created_at', twentyFourHoursAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];

        return (data || []).map(log => ({
            id: log.id,
            timestamp: new Date(log.created_at),
            level: log.level as 'error' | 'warning' | 'info',
            message: log.message,
            stack: log.stack,
            endpoint: log.endpoint,
            userId: log.user_id,
            metadata: log.metadata
        }));
    },

    /**
     * Calcular saúde geral do sistema
     */
    calculateOverallHealth: (
        database: DatabaseStatus,
        performance: PerformanceMetrics,
        errors: ErrorLog[]
    ): 'healthy' | 'warning' | 'critical' => {
        // Crítico
        if (!database.connected) return 'critical';
        if (performance.errorRate > 5) return 'critical';
        if (database.responseTime > 2000) return 'critical';

        // Aviso
        if (database.responseTime > 1000) return 'warning';
        if (performance.errorRate > 1) return 'warning';
        if (errors.filter(e => e.level === 'error').length > 10) return 'warning';
        if (database.storageUsed / database.storageTotal > 0.8) return 'warning';

        return 'healthy';
    },

    /**
     * Registrar erro
     */
    logError: async (
        error: Error,
        context?: {
            endpoint?: string;
            userId?: string;
            metadata?: Record<string, any>;
        }
    ): Promise<void> => {
        try {
            await supabase.from('system_logs').insert({
                level: 'error',
                message: error.message,
                stack: error.stack,
                endpoint: context?.endpoint,
                user_id: context?.userId,
                metadata: context?.metadata
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
    },

    /**
     * Registrar warning
     */
    logWarning: async (
        message: string,
        context?: {
            endpoint?: string;
            userId?: string;
            metadata?: Record<string, any>;
        }
    ): Promise<void> => {
        try {
            await supabase.from('system_logs').insert({
                level: 'warning',
                message,
                endpoint: context?.endpoint,
                user_id: context?.userId,
                metadata: context?.metadata
            });
        } catch (error) {
            console.error('Failed to log warning:', error);
        }
    },

    /**
     * Registrar info
     */
    logInfo: async (
        message: string,
        context?: {
            endpoint?: string;
            userId?: string;
            metadata?: Record<string, any>;
        }
    ): Promise<void> => {
        try {
            await supabase.from('system_logs').insert({
                level: 'info',
                message,
                endpoint: context?.endpoint,
                user_id: context?.userId,
                metadata: context?.metadata
            });
        } catch (error) {
            console.error('Failed to log info:', error);
        }
    },

    /**
     * Registrar métrica de performance
     */
    recordMetric: async (
        type: string,
        value: number,
        metadata?: Record<string, any>
    ): Promise<void> => {
        try {
            await supabase.from('performance_metrics').insert({
                metric_type: type,
                value,
                metadata
            });
        } catch (error) {
            console.error('Failed to record metric:', error);
        }
    },

    /**
     * Limpar logs antigos (manter últimos 30 dias)
     */
    cleanOldLogs: async (): Promise<void> => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        await supabase
            .from('system_logs')
            .delete()
            .lt('created_at', thirtyDaysAgo.toISOString());
    },

    /**
     * Limpar métricas antigas (manter últimos 7 dias)
     */
    cleanOldMetrics: async (): Promise<void> => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        await supabase
            .from('performance_metrics')
            .delete()
            .lt('recorded_at', sevenDaysAgo.toISOString());
    }
};

// Hook para interceptar erros globalmente
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        monitoringService.logError(event.error, {
            endpoint: window.location.pathname,
            metadata: {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        monitoringService.logError(
            new Error(event.reason?.message || 'Unhandled Promise Rejection'),
            {
                endpoint: window.location.pathname,
                metadata: {
                    reason: event.reason
                }
            }
        );
    });
}
