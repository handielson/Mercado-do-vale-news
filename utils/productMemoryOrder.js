function capacityInMb(value) {
    const match = String(value || '').replace(/\s+/g, '').match(/^(\d+(?:[.,]\d+)?)(MB|GB|TB)$/i);
    if (!match) return Number.MAX_SAFE_INTEGER;
    const size = Number(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    return size * (unit === 'TB' ? 1024 * 1024 : unit === 'GB' ? 1024 : 1);
}

export function compareMemoryConfigurations(a, b) {
    return capacityInMb(a.ram) - capacityInMb(b.ram)
        || capacityInMb(a.storage) - capacityInMb(b.storage)
        || String(a.memoryLabel || '').localeCompare(String(b.memoryLabel || ''), 'pt-BR', { numeric: true });
}
