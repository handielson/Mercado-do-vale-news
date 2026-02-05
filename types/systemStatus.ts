// System Status and Monitoring Types

export interface SystemStatus {
    overall: 'healthy' | 'warning' | 'critical';
    database: DatabaseStatus;
    performance: PerformanceMetrics;
    errors: ErrorLog[];
    uptime: number;
    lastUpdate: Date;
}

export interface DatabaseStatus {
    connected: boolean;
    responseTime: number; // ms
    activeConnections: number;
    maxConnections: number;
    storageUsed: number; // GB
    storageTotal: number; // GB
}

export interface PerformanceMetrics {
    avgResponseTime: number; // ms
    requestsPerMinute: number;
    errorRate: number; // %
    cacheHitRate: number; // %
    memoryUsage: number; // %
    cpuUsage: number; // %
}

export interface ErrorLog {
    id: string;
    timestamp: Date;
    level: 'error' | 'warning' | 'info' | 'debug';
    message: string;
    stack?: string;
    endpoint?: string;
    userId?: string;
    metadata?: Record<string, any>;
}

export interface PerformanceMetric {
    id: string;
    metric_type: string;
    value: number;
    metadata?: Record<string, any>;
    recorded_at: Date;
}

export interface Alert {
    level: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    channels: ('email' | 'whatsapp')[];
}
