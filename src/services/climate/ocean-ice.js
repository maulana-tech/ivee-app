export function toDisplayOceanIceData(proto) {
    const measuredAt = Number(proto.measuredAt);
    return {
        ...(hasFinite(proto, 'arcticExtentMkm2') ? { arcticExtentMkm2: proto.arcticExtentMkm2 } : {}),
        ...(hasFinite(proto, 'arcticExtentAnomalyMkm2') ? { arcticExtentAnomalyMkm2: proto.arcticExtentAnomalyMkm2 } : {}),
        ...(typeof proto.arcticTrend === 'string' && proto.arcticTrend ? { arcticTrend: proto.arcticTrend } : {}),
        ...(hasFinite(proto, 'seaLevelMmAbove1993') ? { seaLevelMmAbove1993: proto.seaLevelMmAbove1993 } : {}),
        ...(hasFinite(proto, 'seaLevelAnnualRiseMm') ? { seaLevelAnnualRiseMm: proto.seaLevelAnnualRiseMm } : {}),
        ...(hasFinite(proto, 'ohc0700mZj') ? { ohc0700mZj: proto.ohc0700mZj } : {}),
        ...(hasFinite(proto, 'sstAnomalyC') ? { sstAnomalyC: proto.sstAnomalyC } : {}),
        measuredAt: Number.isFinite(measuredAt) && measuredAt > 0 ? new Date(measuredAt) : undefined,
        iceTrend12m: (proto.iceTrend12m ?? []).map(toDisplayOceanIcePoint),
    };
}
export function normalizeHydratedOceanIce(hydrated) {
    if (!hydrated || typeof hydrated !== 'object')
        return null;
    if ('data' in hydrated && hydrated.data) {
        return normalizeProtoOceanIce(hydrated.data);
    }
    const raw = hydrated;
    const points = Array.isArray(raw.ice_trend_12m)
        ? raw.ice_trend_12m
            .filter((point) => point != null && typeof point.month === 'string'
            && Number.isFinite(Number(point.extent_mkm2))
            && Number.isFinite(Number(point.anomaly_mkm2)))
            .map((point) => ({
            month: point.month ?? '',
            extentMkm2: Number(point.extent_mkm2),
            anomalyMkm2: Number(point.anomaly_mkm2),
        }))
        : [];
    const proto = {
        iceTrend12m: points,
    };
    if (Number.isFinite(Number(raw.arctic_extent_mkm2)))
        proto.arcticExtentMkm2 = Number(raw.arctic_extent_mkm2);
    if (Number.isFinite(Number(raw.arctic_extent_anomaly_mkm2)))
        proto.arcticExtentAnomalyMkm2 = Number(raw.arctic_extent_anomaly_mkm2);
    if (typeof raw.arctic_trend === 'string' && raw.arctic_trend)
        proto.arcticTrend = raw.arctic_trend;
    if (Number.isFinite(Number(raw.sea_level_mm_above_1993)))
        proto.seaLevelMmAbove1993 = Number(raw.sea_level_mm_above_1993);
    if (Number.isFinite(Number(raw.sea_level_annual_rise_mm)))
        proto.seaLevelAnnualRiseMm = Number(raw.sea_level_annual_rise_mm);
    if (Number.isFinite(Number(raw.ohc_0_700m_zj)))
        proto.ohc0700mZj = Number(raw.ohc_0_700m_zj);
    if (Number.isFinite(Number(raw.sst_anomaly_c)))
        proto.sstAnomalyC = Number(raw.sst_anomaly_c);
    if (Number.isFinite(Number(raw.measured_at)))
        proto.measuredAt = Math.round(Number(raw.measured_at));
    return normalizeOceanIcePayload(proto);
}
function toDisplayOceanIcePoint(proto) {
    return {
        month: proto.month,
        extentMkm2: proto.extentMkm2,
        anomalyMkm2: proto.anomalyMkm2,
    };
}
function normalizeProtoOceanIce(rawProto) {
    if (!rawProto || typeof rawProto !== 'object')
        return null;
    const proto = {};
    if (Number.isFinite(Number(rawProto.arcticExtentMkm2)))
        proto.arcticExtentMkm2 = Number(rawProto.arcticExtentMkm2);
    if (Number.isFinite(Number(rawProto.arcticExtentAnomalyMkm2)))
        proto.arcticExtentAnomalyMkm2 = Number(rawProto.arcticExtentAnomalyMkm2);
    if (typeof rawProto.arcticTrend === 'string' && rawProto.arcticTrend)
        proto.arcticTrend = rawProto.arcticTrend;
    if (Number.isFinite(Number(rawProto.seaLevelMmAbove1993)))
        proto.seaLevelMmAbove1993 = Number(rawProto.seaLevelMmAbove1993);
    if (Number.isFinite(Number(rawProto.seaLevelAnnualRiseMm)))
        proto.seaLevelAnnualRiseMm = Number(rawProto.seaLevelAnnualRiseMm);
    if (Number.isFinite(Number(rawProto.ohc0700mZj)))
        proto.ohc0700mZj = Number(rawProto.ohc0700mZj);
    if (Number.isFinite(Number(rawProto.sstAnomalyC)))
        proto.sstAnomalyC = Number(rawProto.sstAnomalyC);
    if (Number.isFinite(Number(rawProto.measuredAt)))
        proto.measuredAt = Math.round(Number(rawProto.measuredAt));
    const points = Array.isArray(rawProto.iceTrend12m)
        ? rawProto.iceTrend12m
            .filter((point) => point != null && typeof point.month === 'string'
            && Number.isFinite(Number(point.extentMkm2))
            && Number.isFinite(Number(point.anomalyMkm2)))
            .map((point) => ({
            month: point.month ?? '',
            extentMkm2: Number(point.extentMkm2),
            anomalyMkm2: Number(point.anomalyMkm2),
        }))
        : [];
    proto.iceTrend12m = points;
    return normalizeOceanIcePayload(proto);
}
function normalizeOceanIcePayload(proto) {
    const normalizedKeys = Object.keys(proto);
    const onlyEmptyTrend = normalizedKeys.length === 1
        && Array.isArray(proto.iceTrend12m)
        && proto.iceTrend12m.length === 0;
    return normalizedKeys.length === 0 || onlyEmptyTrend ? null : proto;
}
function hasFinite(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key) && Number.isFinite(Number(obj[key]));
}
