import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, CheckCircle2, Clock3, MapPin } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { getPublicDeliveryTracking, type PublicDeliveryTracking } from '../../services/customerDeliveryService';

const POLL_INTERVAL_MS = 10_000;

type DeliveryTrackingPoint = NonNullable<PublicDeliveryTracking['trajectory']>[number];

function DeliveryRouteMap({ trajectory }: { trajectory: DeliveryTrackingPoint[] }) {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const routeRef = useRef<L.Polyline | null>(null);
    const markerRef = useRef<L.CircleMarker | null>(null);

    useEffect(() => {
        if (!mapElementRef.current || mapRef.current) return;
        const map = L.map(mapElementRef.current, { zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || trajectory.length === 0) return;
        const coordinates = trajectory.map(point => L.latLng(point.latitude, point.longitude));

        if (routeRef.current) routeRef.current.setLatLngs(coordinates);
        else routeRef.current = L.polyline(coordinates, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(map);

        const current = coordinates[coordinates.length - 1];
        if (markerRef.current) markerRef.current.setLatLng(current);
        else markerRef.current = L.circleMarker(current, {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#16a34a',
            fillOpacity: 1,
        }).addTo(map);

        if (coordinates.length === 1) map.setView(current, 16);
        else map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32], maxZoom: 16 });
    }, [trajectory]);

    return <div ref={mapElementRef} className="h-80 w-full" aria-label="Trajeto percorrido pelo entregador" />;
}

function formatOrderNumber(value: string): string {
    const clean = String(value || '').replace(/^#/, '');
    return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(clean) ? clean.slice(0, 8).toUpperCase() : clean;
}

const DeliveryTrackingPage: React.FC = () => {
    const { token = '' } = useParams();
    const [tracking, setTracking] = useState<PublicDeliveryTracking | null>(null);
    const [error, setError] = useState('');

    const load = async () => {
        if (!token) return;
        try {
            setTracking(await getPublicDeliveryTracking(token));
            setError('');
        } catch {
            setError('Nao foi possivel carregar o acompanhamento desta entrega.');
        }
    };

    useEffect(() => {
        void load();
        const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [token]);

    const locationAgeSeconds = useMemo(() => tracking?.location?.recorded_at
        ? Math.max(0, Math.floor((Date.now() - new Date(tracking.location.recorded_at).getTime()) / 1000))
        : null, [tracking]);
    const mapsLink = tracking?.location
        ? `https://www.google.com/maps/search/?api=1&query=${tracking.location.latitude},${tracking.location.longitude}`
        : '';
    const delivered = tracking?.delivery_status === 'delivered';
    const trajectory = tracking?.trajectory || [];

    return <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-2xl">
            <div className="rounded-3xl bg-emerald-800 p-6 text-white shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Mercado do Vale</p>
                <h1 className="mt-2 text-2xl font-bold">Acompanhe sua entrega</h1>
                {tracking && <p className="mt-1 text-emerald-100">Pedido #{formatOrderNumber(tracking.order_number)}</p>}
            </div>
            {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
            {!tracking && !error && <div className="mt-4 rounded-2xl bg-white p-6 text-slate-600">Carregando localizacao...</div>}
            {tracking && <>
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        {delivered ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : <Bike className="h-8 w-8 text-blue-600" />}
                        <div><h2 className="font-bold text-slate-900">{delivered ? 'Entrega concluida' : tracking.delivery_status === 'in_route' ? 'Seu pedido esta a caminho' : 'Aguardando saida para entrega'}</h2>
                        <p className="text-sm text-slate-500">Atualizacao automatica a cada 10 segundos</p></div>
                    </div>
                </section>
                {tracking.location && !delivered ? <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <DeliveryRouteMap trajectory={trajectory.length > 0 ? trajectory : [{
                        latitude: tracking.location.latitude,
                        longitude: tracking.location.longitude,
                        accuracy: tracking.location.accuracy,
                        recorded_at: tracking.location.recorded_at,
                    }]} />
                    <div className="p-4">
                        <p className="text-sm font-semibold text-slate-800">Trajeto percorrido em tempo real</p>
                        <p className="flex items-center gap-2 text-sm text-slate-600"><Clock3 className="h-4 w-4" />Ultima posicao: {locationAgeSeconds != null && locationAgeSeconds < 60 ? `ha ${locationAgeSeconds}s` : tracking.location.recorded_at ? new Date(tracking.location.recorded_at).toLocaleString('pt-BR') : 'agora'}</p>
                        {locationAgeSeconds != null && locationAgeSeconds > 60 && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">O sinal do entregador esta temporariamente desatualizado.</p>}
                        <a href={mapsLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white"><MapPin className="h-4 w-4" />Abrir no mapa</a>
                    </div>
                </section> : !delivered && <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">Aguardando o primeiro sinal de GPS do entregador.</section>}
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><strong className="text-slate-800">Endereco da entrega</strong><p className="mt-1">{tracking.delivery_address_text}</p></section>
            </>}
        </div>
    </main>;
};

export default DeliveryTrackingPage;
