export function focusInvestmentOnMap(map, mapLayers, lat, lon) {
    map?.enableLayer('gulfInvestments');
    mapLayers.gulfInvestments = true;
    map?.setCenter(lat, lon, 6);
}
