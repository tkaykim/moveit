/**
 * 두 좌표 간의 거리를 계산하는 함수 (Haversine formula)
 * @param lat1 첫 번째 위치의 위도
 * @param lon1 첫 번째 위치의 경도
 * @param lat2 두 번째 위치의 위도
 * @param lon2 두 번째 위치의 경도
 * @returns 거리 (km)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * 주소 문자열에서 좌표를 추출하려고 시도 (간단한 파싱)
 * 실제로는 Geocoding API를 사용해야 하지만, 여기서는 근사치로 처리
 * @param address 주소 문자열
 * @returns [위도, 경도] 또는 null
 */
export function parseAddressToCoordinates(address: string | null | undefined): [number, number] | null {
  if (!address) return null;
  
  // 서울 중심 좌표 (기본값)
  const seoulCenter: [number, number] = [37.5665, 126.9780];
  
  // 간단한 지역별 좌표 매핑 (실제로는 Geocoding API 사용 권장)
  const regionMap: Record<string, [number, number]> = {
    '강남': [37.5172, 127.0473],
    '강북': [37.6399, 127.0253],
    '강동': [37.5301, 127.1238],
    '강서': [37.5509, 126.8495],
    '관악': [37.4784, 126.9516],
    '광진': [37.5384, 127.0821],
    '구로': [37.4954, 126.8874],
    '금천': [37.4519, 126.9020],
    '노원': [37.6542, 127.0568],
    '도봉': [37.6688, 127.0471],
    '동대문': [37.5744, 127.0396],
    '동작': [37.5124, 126.9393],
    '마포': [37.5663, 126.9019],
    '서대문': [37.5791, 126.9368],
    '서초': [37.4837, 127.0324],
    '성동': [37.5633, 127.0368],
    '성북': [37.5894, 127.0167],
    '송파': [37.5145, 127.1058],
    '양천': [37.5170, 126.8663],
    '영등포': [37.5264, 126.8962],
    '용산': [37.5326, 126.9909],
    '은평': [37.6028, 126.9291],
    '종로': [37.5735, 126.9788],
    '중구': [37.5640, 126.9979],
    '중랑': [37.6064, 127.0926],
  };
  
  // 주소에서 지역명 추출
  for (const [region, coords] of Object.entries(regionMap)) {
    if (address.includes(region)) {
      return coords;
    }
  }
  
  // 매칭되지 않으면 서울 중심 좌표 반환
  return seoulCenter;
}

/**
 * 거리를 포맷팅하여 표시
 * @param distanceKm 거리 (km)
 * @returns 포맷팅된 거리 문자열
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}










