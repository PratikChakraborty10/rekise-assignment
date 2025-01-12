// Constants
export const MAPTILER_API_KEY = "VqwpCTRfiFiP9uoi9Vkz"
export const EARTH_RADIUS_METERS = 6371000

/**
 * Calculates the distance between two coordinates using the Haversine formula
 */
export const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const [lon1, lat1] = coord1
  const [lon2, lat2] = coord2
  
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_METERS * c
}

/**
 * Calculates the area of a polygon given its coordinates
 */
export const calculateArea = (coords: [number, number][]): number => {
  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1]
  }
  return Math.abs(area) / 2
}

/**
 * Formats a distance value to a human-readable string
 */
export const formatDistance = (distance: number | null): string => {
  if (distance === null) return "-"
  return distance >= 1000
    ? `${(distance / 1000).toFixed(2)} km`
    : `${Math.round(distance)} m`
}